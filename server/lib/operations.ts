import { randomUUID } from 'crypto'
import { readFile, writeFile, appendFile } from 'fs/promises'
import { join } from 'path'

/**
 * Rename a session by appending a custom-title entry to its JSONL file.
 * Last-write-wins semantics (matching Claude Code convention).
 */
export async function renameSession(
  filePath: string,
  sessionId: string,
  newTitle: string,
): Promise<void> {
  const entry = JSON.stringify({
    type: 'custom-title',
    sessionId,
    customTitle: newTitle,
    title: newTitle,
  })
  await appendFile(filePath, entry + '\n', 'utf-8')
}

/**
 * Rewind a session by truncating the JSONL file at the target user message.
 * Keeps all lines up to and including the target, discards everything after.
 * This is destructive — callers should confirm with the user first.
 */
export async function rewindSession(
  filePath: string,
  targetMessageUuid: string,
): Promise<{ linesKept: number; linesRemoved: number }> {
  const raw = await readFile(filePath, 'utf-8')
  const lines = raw.split('\n').filter(line => line.trim())

  let cutIndex = -1
  for (let i = 0; i < lines.length; i++) {
    try {
      const parsed = JSON.parse(lines[i])
      if (parsed.type === 'user' && parsed.uuid === targetMessageUuid) {
        cutIndex = i
        break
      }
    } catch {
      continue
    }
  }

  if (cutIndex === -1) {
    throw new Error(`Target message uuid not found: ${targetMessageUuid}`)
  }

  const kept = lines.slice(0, cutIndex + 1)
  const removed = lines.length - kept.length

  if (removed === 0) {
    return { linesKept: kept.length, linesRemoved: 0 }
  }

  await writeFile(filePath, kept.join('\n') + '\n', 'utf-8')
  return { linesKept: kept.length, linesRemoved: removed }
}

/**
 * Branch/fork a session at the target user message checkpoint.
 * Creates a new JSONL file with entries up to that point, new sessionId,
 * forkedFrom metadata, and rebuilt parentUuid chain.
 * Filters out isSidechain entries (sub-agents are not duplicated).
 * Follows the pattern from claude-code-src/src/commands/branch/branch.ts.
 */
export async function branchSession(
  filePath: string,
  sessionId: string,
  targetMessageUuid: string,
  projectDir: string,
): Promise<{ newSessionId: string; newFilePath: string; title: string }> {
  const newSessionId = randomUUID()
  const raw = await readFile(filePath, 'utf-8')
  const lines = raw.split('\n').filter(line => line.trim())

  const outputLines: string[] = []
  const contentReplacements: Array<{ sessionId: string; replacements: unknown[] }> = []
  let customTitle: string | null = null
  let firstUserContent: string | null = null
  let parentUuid: string | null = null
  let reachedTarget = false

  for (const line of lines) {
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(line)
    } catch {
      continue
    }

    // Collect custom-title (last-write-wins) for deriving branch title
    if (parsed.type === 'custom-title') {
      customTitle = (parsed.customTitle ?? parsed.title ?? null) as string | null
      continue
    }

    // Collect content-replacement entries for the original session
    if (parsed.type === 'content-replacement' && parsed.sessionId === sessionId) {
      contentReplacements.push(parsed as { sessionId: string; replacements: unknown[] })
      continue
    }

    // Skip non-transcript entries (summary, file-history-snapshot, etc.)
    const type = parsed.type as string
    if (!['user', 'assistant', 'system', 'attachment'].includes(type)) {
      continue
    }

    // Filter out sidechain entries (sub-agents)
    if (parsed.isSidechain === true) {
      continue
    }

    // Track first user message for title derivation
    if (type === 'user' && firstUserContent === null) {
      const content = (parsed.message as Record<string, unknown>)?.content
      if (typeof content === 'string') {
        firstUserContent = content.replace(/\s+/g, ' ').trim().slice(0, 100)
      } else if (Array.isArray(content)) {
        const textBlock = content.find(
          (b: unknown) => (b as Record<string, unknown>).type === 'text',
        ) as Record<string, unknown> | undefined
        if (textBlock?.text && typeof textBlock.text === 'string') {
          firstUserContent = textBlock.text.replace(/\s+/g, ' ').trim().slice(0, 100)
        }
      }
    }

    // Build forked entry
    const forkedEntry: Record<string, unknown> = {
      ...parsed,
      sessionId: newSessionId,
      parentUuid,
      isSidechain: false,
      forkedFrom: {
        sessionId,
        messageUuid: parsed.uuid,
      },
    }

    outputLines.push(JSON.stringify(forkedEntry))

    // Advance parentUuid chain (skip progress entries)
    if (type !== 'progress') {
      parentUuid = parsed.uuid as string
    }

    // Stop after the target user message
    if (type === 'user' && parsed.uuid === targetMessageUuid) {
      reachedTarget = true
      break
    }
  }

  if (!reachedTarget) {
    throw new Error(`Target message uuid not found: ${targetMessageUuid}`)
  }

  if (outputLines.length === 0) {
    throw new Error('No messages to branch')
  }

  // Append content-replacement entries with new sessionId
  for (const cr of contentReplacements) {
    outputLines.push(JSON.stringify({
      type: 'content-replacement',
      sessionId: newSessionId,
      replacements: cr.replacements,
    }))
  }

  // Derive branch title
  const baseName = customTitle ?? firstUserContent ?? 'Branched conversation'
  const branchTitle = `${baseName} (Branch)`

  // Append custom-title entry
  outputLines.push(JSON.stringify({
    type: 'custom-title',
    sessionId: newSessionId,
    customTitle: branchTitle,
    title: branchTitle,
  }))

  // Write fork file
  const newFilePath = join(projectDir, `${newSessionId}.jsonl`)
  await writeFile(newFilePath, outputLines.join('\n') + '\n', 'utf-8')

  return { newSessionId, newFilePath, title: branchTitle }
}
