import { Router } from 'express'
import { join } from 'path'
import { decodeRootId } from '../lib/config.js'
import { parseConversation } from '../lib/parser.js'

const router = Router()

router.get('/:rootId/projects/:projectId/sessions/:sessionId/messages', async (req, res) => {
  try {
    const rootPath = decodeRootId(req.params.rootId)
    const filePath = join(rootPath, 'projects', req.params.projectId, `${req.params.sessionId}.jsonl`)
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
