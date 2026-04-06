import { readdir, readFile, open as fsOpen, stat as fsStat } from 'fs/promises'
import { join } from 'path'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const AGENT_FILE_RE = /^agent-([0-9a-f]+)\.jsonl$/i
const HEAD_TAIL_SIZE = 65536

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProjectInfo {
  id: string          // sanitized dir name
  displayName: string // best-effort decoded path
  sessionCount: number
}

export interface SessionInfo {
  id: string
  filePath: string
  firstPrompt: string
  customTitle: string | null
  summary: string | null
  timestamp: string | null
  lastTimestamp: string | null
  model: string | null
  gitBranch: string | null
  version: string | null
  messageCount: number
  fileSize: number
  // Sub-agent linking
  isSubAgent: boolean
  agentId: string | null
  agentDescription: string | null
  parentSessionId: string | null
  childSessionIds: string[]
}

// ---------------------------------------------------------------------------
// Path decoding — best-effort reverse of sanitizePath()
// ---------------------------------------------------------------------------

function decodeProjectName(sanitized: string): string {
  // sanitizePath replaces all non-alphanumeric with '-'
  // We can't perfectly reverse this, but common patterns work:
  // -Users-devrev-Documents-foo -> /Users/devrev/Documents/foo
  if (sanitized.startsWith('-')) {
    return sanitized.replace(/-/g, '/')
  }
  return sanitized
}

// ---------------------------------------------------------------------------
// Head/tail reading — matches Claude Code's readSessionLite pattern
// ---------------------------------------------------------------------------

export async function readHeadAndTail(filePath: string): Promise<{ head: string; tail: string; fileSize: number } | null> {
  try {
    const fh = await fsOpen(filePath, 'r')
    try {
      const st = await fh.stat()
      if (st.size === 0) return null

      const buf = Buffer.allocUnsafe(HEAD_TAIL_SIZE)
      const headResult = await fh.read(buf, 0, HEAD_TAIL_SIZE, 0)
      if (headResult.bytesRead === 0) return null

      const head = buf.toString('utf8', 0, headResult.bytesRead)

      const tailOffset = Math.max(0, st.size - HEAD_TAIL_SIZE)
      let tail = head
      if (tailOffset > 0) {
        const tailResult = await fh.read(buf, 0, HEAD_TAIL_SIZE, tailOffset)
        tail = buf.toString('utf8', 0, tailResult.bytesRead)
      }

      return { head, tail, fileSize: st.size }
    } finally {
      await fh.close()
    }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Fast field extraction without full JSON parse
// ---------------------------------------------------------------------------

function extractField(text: string, key: string): string | undefined {
  const patterns = [`"${key}":"`, `"${key}": "`]
  for (const pattern of patterns) {
    const idx = text.indexOf(pattern)
    if (idx < 0) continue
    const valueStart = idx + pattern.length
    let i = valueStart
    while (i < text.length) {
      if (text[i] === '\\') { i += 2; continue }
      if (text[i] === '"') return text.slice(valueStart, i)
      i++
    }
  }
  return undefined
}

function extractLastField(text: string, key: string): string | undefined {
  const patterns = [`"${key}":"`, `"${key}": "`]
  let lastValue: string | undefined
  for (const pattern of patterns) {
    let searchFrom = 0
    while (true) {
      const idx = text.indexOf(pattern, searchFrom)
      if (idx < 0) break
      const valueStart = idx + pattern.length
      let i = valueStart
      while (i < text.length) {
        if (text[i] === '\\') { i += 2; continue }
        if (text[i] === '"') { lastValue = text.slice(valueStart, i); break }
        i++
      }
      searchFrom = (i || searchFrom) + 1
    }
  }
  return lastValue
}

// Skip patterns for first prompt (matches Claude Code's logic)
const SKIP_FIRST_PROMPT_RE = /^(?:\s*<[a-z][\w-]*[\s>]|\[Request interrupted by user[^\]]*\])/

function extractFirstPrompt(head: string): string {
  let start = 0
  while (start < head.length) {
    const newlineIdx = head.indexOf('\n', start)
    const line = newlineIdx >= 0 ? head.slice(start, newlineIdx) : head.slice(start)
    start = newlineIdx >= 0 ? newlineIdx + 1 : head.length

    if (!line.includes('"type":"user"') && !line.includes('"type": "user"')) continue
    if (line.includes('"tool_result"')) continue
    if (line.includes('"isMeta":true') || line.includes('"isMeta": true')) continue

    try {
      const entry = JSON.parse(line)
      if (entry.type !== 'user') continue
      const content = entry.message?.content
      const texts: string[] = []
      if (typeof content === 'string') {
        texts.push(content)
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'text' && typeof block.text === 'string') {
            texts.push(block.text)
          }
        }
      }
      for (const raw of texts) {
        const result = raw.replace(/\n/g, ' ').trim()
        if (!result) continue
        if (SKIP_FIRST_PROMPT_RE.test(result)) continue
        return result.length > 200 ? result.slice(0, 200) + '\u2026' : result
      }
    } catch { continue }
  }
  return ''
}

function countLines(text: string): number {
  let count = 0
  let idx = 0
  while (idx < text.length) {
    const nl = text.indexOf('\n', idx)
    if (nl < 0) { count++; break }
    count++
    idx = nl + 1
  }
  return count
}

// ---------------------------------------------------------------------------
// Project scanning
// ---------------------------------------------------------------------------

export async function listProjects(rootPath: string): Promise<ProjectInfo[]> {
  const projectsDir = join(rootPath, 'projects')
  try {
    const entries = await readdir(projectsDir, { withFileTypes: true })
    const projects: ProjectInfo[] = []

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const projDir = join(projectsDir, entry.name)
      let sessionCount = 0
      try {
        const files = await readdir(projDir)
        // Count only parent (UUID-named) sessions, not agent-*.jsonl files
        sessionCount = files.filter(f => f.endsWith('.jsonl') && UUID_RE.test(f.replace('.jsonl', ''))).length
      } catch { /* skip unreadable */ }

      if (sessionCount === 0) continue

      projects.push({
        id: entry.name,
        displayName: decodeProjectName(entry.name),
        sessionCount,
      })
    }

    return projects.sort((a, b) => a.displayName.localeCompare(b.displayName))
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Session scanning
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Extract agent descriptions from parent session's Task tool_use blocks
// ---------------------------------------------------------------------------

function extractAgentDescriptions(head: string): Map<string, string> {
  const descriptions = new Map<string, string>()
  let start = 0
  while (start < head.length) {
    const newlineIdx = head.indexOf('\n', start)
    const line = newlineIdx >= 0 ? head.slice(start, newlineIdx) : head.slice(start)
    start = newlineIdx >= 0 ? newlineIdx + 1 : head.length

    if (!line.includes('"type":"assistant"') && !line.includes('"type": "assistant"')) continue
    if (!line.includes('"Task"') && !line.includes('"Agent"')) continue

    try {
      const entry = JSON.parse(line)
      if (entry.type !== 'assistant') continue
      const content = entry.message?.content
      if (!Array.isArray(content)) continue
      for (const block of content) {
        if (block.type !== 'tool_use') continue
        if (block.name !== 'Task' && block.name !== 'Agent') continue
        const input = block.input
        if (!input) continue
        const desc = input.description ?? input.subagent_type ?? 'Sub-agent'
        // The resume field links to an agentId; the tool_result will have the agentId too
        if (input.resume) {
          descriptions.set(input.resume, typeof desc === 'string' ? desc : 'Sub-agent')
        }
        // Also store by subagent_type if available
        if (input.subagent_type) {
          const key = `type:${input.subagent_type}`
          descriptions.set(key, typeof desc === 'string' ? desc : input.subagent_type)
        }
      }
    } catch { continue }
  }
  return descriptions
}

// ---------------------------------------------------------------------------
// Extract sessionId and agentId from a sub-agent file's head
// ---------------------------------------------------------------------------

export function extractAgentMeta(head: string): { sessionId: string | null; agentId: string | null; subagentType: string | null } {
  let sessionId: string | null = null
  let agentId: string | null = null
  let subagentType: string | null = null

  let start = 0
  while (start < head.length && (!sessionId || !agentId)) {
    const newlineIdx = head.indexOf('\n', start)
    const line = newlineIdx >= 0 ? head.slice(start, newlineIdx) : head.slice(start)
    start = newlineIdx >= 0 ? newlineIdx + 1 : head.length

    if (!sessionId) {
      const sid = extractField(line, 'sessionId')
      if (sid) sessionId = sid
    }
    if (!agentId) {
      const aid = extractField(line, 'agentId')
      if (aid) agentId = aid
    }
    if (!subagentType) {
      const sat = extractField(line, 'subagent_type')
      if (sat) subagentType = sat
    }
  }
  return { sessionId, agentId, subagentType }
}

// ---------------------------------------------------------------------------
// Session scanning with sub-agent grouping
// ---------------------------------------------------------------------------

export async function listSessions(rootPath: string, projectId: string): Promise<SessionInfo[]> {
  const projDir = join(rootPath, 'projects', projectId)
  let allFiles: string[]
  try {
    allFiles = (await readdir(projDir)).filter(f => f.endsWith('.jsonl'))
  } catch {
    return []
  }

  const uuidFiles = allFiles.filter(f => UUID_RE.test(f.replace('.jsonl', '')))
  const agentFiles = allFiles.filter(f => AGENT_FILE_RE.test(f))

  // Also discover agent files inside companion folders: {sessionId}/subagents/agent-*.jsonl
  const companionAgentFiles: Array<{ file: string; filePath: string; metaDescription?: string }> = []
  await Promise.all(uuidFiles.map(async (f) => {
    const sessionId = f.replace('.jsonl', '')
    const subagentsDir = join(projDir, sessionId, 'subagents')
    try {
      const entries = await readdir(subagentsDir)
      for (const entry of entries) {
        if (AGENT_FILE_RE.test(entry)) {
          const item: { file: string; filePath: string; metaDescription?: string } = {
            file: entry,
            filePath: join(subagentsDir, entry),
          }
          // Try to read companion .meta.json for accurate description
          try {
            const metaPath = join(subagentsDir, entry.replace('.jsonl', '.meta.json'))
            const metaJson = JSON.parse(await readFile(metaPath, 'utf-8'))
            if (metaJson.description) item.metaDescription = metaJson.description
          } catch { /* no meta file */ }
          companionAgentFiles.push(item)
        }
      }
    } catch { /* no companion folder */ }
  }))

  // Parse all sessions (parent + agent) in parallel
  const parentSessions: SessionInfo[] = []
  const agentSessions: SessionInfo[] = []

  // Map from agentId -> agent session info
  const agentById = new Map<string, SessionInfo>()
  // Map from parent sessionId -> child agent session ids
  const parentToChildren = new Map<string, string[]>()
  // Map from parent sessionId -> agent descriptions extracted from Task tool_use
  const parentDescriptions = new Map<string, Map<string, string>>()

  // Parse parent sessions
  await Promise.all(uuidFiles.map(async (file) => {
    const filePath = join(projDir, file)
    const data = await readHeadAndTail(filePath)
    if (!data) return

    const sessionId = file.replace('.jsonl', '')
    const firstPrompt = extractFirstPrompt(data.head)
    const customTitle = extractLastField(data.tail, 'title') ?? null
    const summary = extractLastField(data.tail, 'summary') ?? null
    const timestamp = extractField(data.head, 'timestamp') ?? null
    const lastTimestamp = extractLastField(data.tail, 'timestamp') ?? null
    const model = extractField(data.head, 'model') ?? extractField(data.tail, 'model') ?? null
    const gitBranch = extractField(data.head, 'gitBranch') ?? null
    const version = extractField(data.head, 'version') ?? null
    const estimatedLines = Math.max(countLines(data.head), Math.round(data.fileSize / 2048))

    // Extract agent descriptions from Task/Agent tool_use blocks
    const descs = extractAgentDescriptions(data.head)
    if (data.tail !== data.head) {
      const tailDescs = extractAgentDescriptions(data.tail)
      for (const [k, v] of tailDescs) descs.set(k, v)
    }
    if (descs.size > 0) {
      parentDescriptions.set(sessionId, descs)
    }

    parentSessions.push({
      id: sessionId,
      filePath,
      firstPrompt,
      customTitle,
      summary,
      timestamp,
      lastTimestamp,
      model,
      gitBranch,
      version,
      messageCount: estimatedLines,
      fileSize: data.fileSize,
      isSubAgent: false,
      agentId: null,
      agentDescription: null,
      parentSessionId: null,
      childSessionIds: [],
    })
  }))

  // Parse agent sessions (from both project root and companion subagents/ folders)
  const allAgentEntries: Array<{ file: string; filePath: string; metaDescription?: string }> = [
    ...agentFiles.map(f => ({ file: f, filePath: join(projDir, f) })),
    ...companionAgentFiles,
  ]

  await Promise.all(allAgentEntries.map(async ({ file, filePath, metaDescription }) => {
    const data = await readHeadAndTail(filePath)
    if (!data) return

    const match = AGENT_FILE_RE.exec(file)
    if (!match) return
    const fileAgentId = match[1]

    const meta = extractAgentMeta(data.head)
    const agentId = meta.agentId ?? fileAgentId
    const parentSessionId = meta.sessionId ?? null

    const firstPrompt = extractFirstPrompt(data.head)
    const customTitle = extractLastField(data.tail, 'title') ?? null
    const summary = extractLastField(data.tail, 'summary') ?? null
    const timestamp = extractField(data.head, 'timestamp') ?? null
    const lastTimestamp = extractLastField(data.tail, 'timestamp') ?? null
    const model = extractField(data.head, 'model') ?? extractField(data.tail, 'model') ?? null
    const gitBranch = extractField(data.head, 'gitBranch') ?? null
    const version = extractField(data.head, 'version') ?? null
    const estimatedLines = Math.max(countLines(data.head), Math.round(data.fileSize / 2048))

    const session: SessionInfo = {
      id: file.replace('.jsonl', ''),
      filePath,
      firstPrompt,
      customTitle,
      summary,
      timestamp,
      lastTimestamp,
      model,
      gitBranch,
      version,
      messageCount: estimatedLines,
      fileSize: data.fileSize,
      isSubAgent: true,
      agentId,
      agentDescription: metaDescription ?? meta.subagentType ?? null,
      parentSessionId,
      childSessionIds: [],
    }

    agentSessions.push(session)
    agentById.set(agentId, session)

    // Link to parent
    if (parentSessionId) {
      const children = parentToChildren.get(parentSessionId) ?? []
      children.push(session.id)
      parentToChildren.set(parentSessionId, children)
    }
  }))

  // Wire up parent -> children links and enrich agent descriptions
  for (const parent of parentSessions) {
    const children = parentToChildren.get(parent.id)
    if (children) {
      parent.childSessionIds = children
    }
    // Try to enrich agent descriptions from parent's Task tool_use blocks
    const descs = parentDescriptions.get(parent.id)
    if (descs) {
      for (const child of agentSessions.filter(a => a.parentSessionId === parent.id)) {
        if (!child.agentDescription && child.agentId) {
          child.agentDescription = descs.get(child.agentId) ?? null
        }
        if (!child.agentDescription && child.agentDescription === null) {
          // Try matching by subagent_type
          for (const [key, val] of descs) {
            if (key.startsWith('type:')) {
              child.agentDescription = val
              break
            }
          }
        }
      }
    }
  }

  // Combine: parents first (sorted by timestamp desc), then orphan agents
  const allSessions = [...parentSessions, ...agentSessions]
  return allSessions.sort((a, b) => {
    // Sub-agents sort after their parent (handled client-side via nesting)
    // At the API level, just sort by timestamp desc
    if (!a.timestamp && !b.timestamp) return 0
    if (!a.timestamp) return 1
    if (!b.timestamp) return -1
    return b.timestamp.localeCompare(a.timestamp)
  })
}
