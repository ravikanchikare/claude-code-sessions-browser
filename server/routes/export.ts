import { Router } from 'express'
import { join } from 'path'
import { decodeRootId } from '../lib/config.js'
import { listProjects } from '../lib/scanner.js'
import { listSessions } from '../lib/scanner.js'
import { parseForExport } from '../lib/parser.js'

const router = Router()

interface ExportRequest {
  rootId: string
  projectId?: string
  sessionIds?: string[]
  format?: 'markdown' | 'json'
}

function formatTimestamp(ts?: string): string {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return ts
  }
}

function toMarkdown(sessions: Awaited<ReturnType<typeof parseForExport>>[]): string {
  const parts: string[] = []

  for (const session of sessions) {
    parts.push(`# ${session.title}`)
    parts.push('')

    const meta = session.metadata
    if (meta.model) parts.push(`- **Model**: ${meta.model}`)
    if (meta.gitBranch) parts.push(`- **Branch**: ${meta.gitBranch}`)
    if (meta.firstTimestamp) parts.push(`- **Started**: ${formatTimestamp(meta.firstTimestamp)}`)
    if (meta.lastTimestamp) parts.push(`- **Ended**: ${formatTimestamp(meta.lastTimestamp)}`)
    if (meta.totalInputTokens || meta.totalOutputTokens) {
      parts.push(`- **Tokens**: ${meta.totalInputTokens.toLocaleString()} in / ${meta.totalOutputTokens.toLocaleString()} out`)
    }
    parts.push('')
    parts.push('## Conversation')
    parts.push('')

    for (const msg of session.messages) {
      const ts = msg.timestamp ? ` (${formatTimestamp(msg.timestamp)})` : ''
      if (msg.role === 'user') {
        parts.push(`### User${ts}`)
      } else {
        parts.push(`### Assistant${ts}`)
      }
      parts.push('')
      parts.push(msg.content)
      parts.push('')
    }

    if (session.summary) {
      parts.push('## Summary')
      parts.push('')
      parts.push(session.summary)
      parts.push('')
    }

    parts.push('---')
    parts.push('')
  }

  return parts.join('\n')
}

router.post('/', async (req, res) => {
  try {
    const body = req.body as ExportRequest
    const { rootId, projectId, sessionIds, format = 'markdown' } = body

    if (!rootId) {
      res.status(400).json({ error: 'rootId is required' })
      return
    }

    const rootPath = decodeRootId(rootId)
    const filePaths: string[] = []

    if (sessionIds && sessionIds.length > 0 && projectId) {
      // Export specific sessions
      for (const sid of sessionIds) {
        filePaths.push(join(rootPath, 'projects', projectId, `${sid}.jsonl`))
      }
    } else if (projectId) {
      // Export all sessions in a project
      const sessions = await listSessions(rootPath, projectId)
      for (const s of sessions) {
        filePaths.push(s.filePath)
      }
    } else {
      // Export all sessions in all projects under this root
      const projects = await listProjects(rootPath)
      for (const proj of projects) {
        const sessions = await listSessions(rootPath, proj.id)
        for (const s of sessions) {
          filePaths.push(s.filePath)
        }
      }
    }

    const parsed = await Promise.all(filePaths.map(fp => parseForExport(fp).catch(() => null)))
    const valid = parsed.filter((p): p is NonNullable<typeof p> => p !== null)

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Disposition', 'attachment; filename="claude-sessions-export.json"')
      res.json(valid)
    } else {
      const md = toMarkdown(valid)
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename="claude-sessions-export.md"')
      res.send(md)
    }
  } catch (error) {
    res.status(500).json({ error: 'Export failed' })
  }
})

export default router
