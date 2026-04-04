import React, { useState, useEffect } from 'react'
import type { RootInfo, ProjectInfo } from '../types.js'
import * as api from '../api.js'

interface MoveDialogProps {
  mode: 'session' | 'project'
  rootId: string
  projectId: string
  sessionId?: string
  itemTitle: string
  roots: RootInfo[]
  onConfirm: (target: { targetProjectId?: string; targetRootId?: string }) => Promise<void>
  onClose: () => void
}

export function MoveDialog({
  mode, rootId, projectId, sessionId, itemTitle, roots, onConfirm, onClose,
}: MoveDialogProps) {
  const [projects, setProjects] = useState<ProjectInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [moving, setMoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  // For session moves: fetch projects in the current root
  useEffect(() => {
    if (mode !== 'session') return
    setLoading(true)
    api.getProjects(rootId)
      .then(p => setProjects(p.filter(proj => proj.id !== projectId)))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false))
  }, [mode, rootId, projectId])

  const targets = mode === 'session'
    ? projects.map(p => ({ id: p.id, label: p.displayName }))
    : roots.filter(r => r.id !== rootId).map(r => ({ id: r.id, label: r.label }))

  const handleConfirm = async () => {
    if (!selected) return
    setMoving(true)
    setError(null)
    try {
      if (mode === 'session') {
        await onConfirm({ targetProjectId: selected })
      } else {
        await onConfirm({ targetRootId: selected })
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Move failed')
    } finally {
      setMoving(false)
    }
  }

  return (
    <div className="export-overlay" onClick={onClose}>
      <div className="export-dialog move-dialog" onClick={e => e.stopPropagation()}>
        <h3>Move {mode === 'session' ? 'Session' : 'Project'}</h3>
        <p className="export-scope">
          {mode === 'session'
            ? `Move "${itemTitle}" to another project`
            : `Move project "${itemTitle}" to another root`
          }
        </p>

        <div className="move-target-list">
          {loading && <div className="loading-text">Loading targets...</div>}
          {!loading && targets.length === 0 && (
            <div className="empty-text">
              No {mode === 'session' ? 'other projects' : 'other roots'} available
            </div>
          )}
          {targets.map(t => (
            <div
              key={t.id}
              className={`move-target-item ${selected === t.id ? 'selected' : ''}`}
              onClick={() => setSelected(t.id)}
            >
              {t.label}
            </div>
          ))}
        </div>

        {error && <p className="export-error">{error}</p>}

        <div className="export-actions">
          <button onClick={handleConfirm} disabled={!selected || moving}>
            {moving ? 'Moving...' : 'Move'}
          </button>
          <button onClick={onClose} className="cancel-btn">Cancel</button>
        </div>
      </div>
    </div>
  )
}
