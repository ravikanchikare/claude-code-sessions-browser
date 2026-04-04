import { Router } from 'express'
import { decodeRootId } from '../lib/config.js'
import { listProjects } from '../lib/scanner.js'
import { moveProjectToRoot } from '../lib/mover.js'

const router = Router()

router.get('/:rootId/projects', async (req, res) => {
  try {
    const rootPath = decodeRootId(req.params.rootId)
    const projects = await listProjects(rootPath)
    res.json(projects)
  } catch (error) {
    res.status(500).json({ error: 'Failed to list projects' })
  }
})

router.post('/:rootId/projects/:projectId/move', async (req, res) => {
  try {
    const { targetRootId } = req.body
    if (!targetRootId || typeof targetRootId !== 'string') {
      return res.status(400).json({ error: 'targetRootId is required' })
    }
    const srcRootPath = decodeRootId(req.params.rootId)
    const targetRootPath = decodeRootId(targetRootId)
    if (srcRootPath === targetRootPath) {
      return res.status(400).json({ error: 'Source and target roots are the same' })
    }
    await moveProjectToRoot(srcRootPath, targetRootPath, req.params.projectId)
    res.json({ moved: true, targetRootId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to move project'
    const status = message.includes('already exists') ? 409 : 500
    res.status(status).json({ error: message })
  }
})

export default router
