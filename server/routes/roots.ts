import { Router } from 'express'
import { getRoots, addRoot, removeRoot } from '../lib/config.js'

const router = Router()

router.get('/', async (_req, res) => {
  try {
    const roots = await getRoots()
    res.json(roots)
  } catch (error) {
    res.status(500).json({ error: 'Failed to load roots' })
  }
})

router.post('/', async (req, res) => {
  const { path, label } = req.body as { path?: string; label?: string }
  if (!path || typeof path !== 'string') {
    res.status(400).json({ error: 'path is required' })
    return
  }
  try {
    const root = await addRoot(path, label)
    res.json(root)
  } catch (error) {
    res.status(500).json({ error: 'Failed to add root' })
  }
})

router.delete('/:rootId', async (req, res) => {
  try {
    const removed = await removeRoot(req.params.rootId)
    res.json({ removed })
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove root' })
  }
})

export default router
