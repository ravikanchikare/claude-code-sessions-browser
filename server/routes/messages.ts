import { Router } from 'express'
import { join } from 'path'
import { access, readdir } from 'fs/promises'
import { decodeRootId } from '../lib/config.js'
import { parseConversation } from '../lib/parser.js'

async function resolveSessionPath(rootPath: string, projectId: string, sessionId: string): Promise<string> {
  const projDir = join(rootPath, 'projects', projectId)
  const directPath = join(projDir, `${sessionId}.jsonl`)
  try {
    await access(directPath)
    return directPath
  } catch { /* not at top level */ }

  // Search companion subagents/ folders for agent-*.jsonl
  const fileName = `${sessionId}.jsonl`
  try {
    const entries = await readdir(projDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const subagentsDir = join(projDir, entry.name, 'subagents')
      try {
        const files = await readdir(subagentsDir)
        if (files.includes(fileName)) {
          return join(subagentsDir, fileName)
        }
      } catch { /* no subagents dir */ }
    }
  } catch { /* projDir unreadable */ }

  return directPath // fall back to direct path (will error in parseConversation)
}

const router = Router()

router.get('/:rootId/projects/:projectId/sessions/:sessionId/messages', async (req, res) => {
  try {
    const rootPath = decodeRootId(req.params.rootId)
    const filePath = await resolveSessionPath(rootPath, req.params.projectId, req.params.sessionId)
    const conversation = await parseConversation(filePath)

    // Optional filter: ?filter=user,assistant
    const filterParam = req.query.filter as string | undefined
    if (filterParam) {
      const allowedTypes = new Set(filterParam.split(','))
      conversation.messages = conversation.messages.filter(m => allowedTypes.has(m.type))
    }

    res.json(conversation)
  } catch (error) {
    res.status(500).json({ error: 'Failed to read conversation' })
  }
})

export default router
