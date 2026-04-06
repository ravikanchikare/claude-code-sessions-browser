import { Router } from 'express'
import { join } from 'path'
import { unlink } from 'fs/promises'
import { decodeRootId } from '../lib/config.js'
import { listSessions } from '../lib/scanner.js'
import { moveSessionToProject } from '../lib/mover.js'
import { renameSession, rewindSession, branchSession } from '../lib/operations.js'

const router = Router()

router.get('/:rootId/projects/:projectId/sessions', async (req, res) => {
  try {
    const rootPath = decodeRootId(req.params.rootId)
    const sessions = await listSessions(rootPath, req.params.projectId)
    res.json(sessions)
  } catch (error) {
    res.status(500).json({ error: 'Failed to list sessions' })
  }
})

router.delete('/:rootId/projects/:projectId/sessions/:sessionId', async (req, res) => {
  try {
    const rootPath = decodeRootId(req.params.rootId)
    const filePath = join(rootPath, 'projects', req.params.projectId, `${req.params.sessionId}.jsonl`)
    await unlink(filePath)
    res.json({ deleted: true })
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete session' })
  }
})

router.post('/:rootId/projects/:projectId/sessions/:sessionId/move', async (req, res) => {
  try {
    const { targetProjectId } = req.body
    if (!targetProjectId || typeof targetProjectId !== 'string') {
      return res.status(400).json({ error: 'targetProjectId is required' })
    }
    const rootPath = decodeRootId(req.params.rootId)
    const { projectId, sessionId } = req.params
    if (targetProjectId === projectId) {
      return res.status(400).json({ error: 'Source and target projects are the same' })
    }
    const result = await moveSessionToProject(rootPath, projectId, targetProjectId, sessionId)
    res.json({ moved: true, targetProjectId, movedFiles: result.movedFiles.length })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to move session'
    res.status(500).json({ error: message })
  }
})

router.post('/:rootId/projects/:projectId/sessions/:sessionId/rename', async (req, res) => {
  try {
    const { title } = req.body
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'title is required' })
    }
    const rootPath = decodeRootId(req.params.rootId)
    const filePath = join(rootPath, 'projects', req.params.projectId, `${req.params.sessionId}.jsonl`)
    await renameSession(filePath, req.params.sessionId, title)
    res.json({ renamed: true, title })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to rename session'
    res.status(500).json({ error: message })
  }
})

router.post('/:rootId/projects/:projectId/sessions/:sessionId/rewind', async (req, res) => {
  try {
    const { targetMessageUuid } = req.body
    if (!targetMessageUuid || typeof targetMessageUuid !== 'string') {
      return res.status(400).json({ error: 'targetMessageUuid is required' })
    }
    const rootPath = decodeRootId(req.params.rootId)
    const filePath = join(rootPath, 'projects', req.params.projectId, `${req.params.sessionId}.jsonl`)
    const result = await rewindSession(filePath, targetMessageUuid)
    res.json({ rewound: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to rewind session'
    res.status(500).json({ error: message })
  }
})

router.post('/:rootId/projects/:projectId/sessions/:sessionId/branch', async (req, res) => {
  try {
    const { targetMessageUuid } = req.body
    if (!targetMessageUuid || typeof targetMessageUuid !== 'string') {
      return res.status(400).json({ error: 'targetMessageUuid is required' })
    }
    const rootPath = decodeRootId(req.params.rootId)
    const projectDir = join(rootPath, 'projects', req.params.projectId)
    const filePath = join(projectDir, `${req.params.sessionId}.jsonl`)
    const result = await branchSession(filePath, req.params.sessionId, targetMessageUuid, projectDir)
    res.json({ branched: true, newSessionId: result.newSessionId, title: result.title })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to branch session'
    res.status(500).json({ error: message })
  }
})

export default router
