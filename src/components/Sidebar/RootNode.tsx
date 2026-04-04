import React, { useState, useEffect } from 'react'
import type { RootInfo, ProjectInfo } from '../../types.js'
import { ProjectNode } from './ProjectNode.js'
import * as api from '../../api.js'

interface RootNodeProps {
  root: RootInfo
  isPinned: (projectId: string) => boolean
  onTogglePin: (projectId: string) => void
  activeSessionId: string | null
  activeProjectId: string | null
  compareSelections: Set<string>
  compareMode: boolean
  onSelectSession: (projectId: string, sessionId: string) => void
  onCompareToggle: (sessionId: string) => void
  onDeleteSession: (projectId: string, sessionId: string) => void
  onRemoveRoot: () => void
  onMoveSession?: (projectId: string, sessionId: string, sessionTitle: string) => void
  onMoveProject?: (projectId: string, projectName: string) => void
  refreshTrigger?: number
}

export function RootNode({
  root, isPinned, onTogglePin,
  activeSessionId, activeProjectId, compareSelections, compareMode,
  onSelectSession, onCompareToggle, onDeleteSession, onRemoveRoot,
  onMoveSession, onMoveProject, refreshTrigger,
}: RootNodeProps) {
  const [expanded, setExpanded] = useState(true)
  const [projects, setProjects] = useState<ProjectInfo[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!expanded) return
    setLoading(true)
    api.getProjects(root.id)
      .then(setProjects)
      .catch(() => setProjects([]))
      .finally(() => setLoading(false))
  }, [expanded, root.id, refreshTrigger])

  // Sort: pinned first, then alphabetical
  const sortedProjects = [...projects].sort((a, b) => {
    const aPinned = isPinned(a.id) ? 0 : 1
    const bPinned = isPinned(b.id) ? 0 : 1
    if (aPinned !== bPinned) return aPinned - bPinned
    return a.displayName.localeCompare(b.displayName)
  })

  return (
    <div className="root-node">
      <div className="root-header" onClick={() => setExpanded(!expanded)}>
        <span className="expand-icon">{expanded ? '\u25BC' : '\u25B6'}</span>
        <span className="root-label">{root.label}</span>
        <span className="root-path" title={root.path}>{root.path}</span>
        <button
          className="remove-root-btn"
          onClick={(e) => { e.stopPropagation(); onRemoveRoot() }}
          title="Remove root"
        >
          &times;
        </button>
      </div>
      {expanded && (
        <div className="root-projects">
          {loading && <div className="loading-text">Loading projects...</div>}
          {sortedProjects.map(project => (
            <ProjectNode
              key={project.id}
              rootId={root.id}
              project={project}
              isPinned={isPinned(project.id)}
              onTogglePin={() => onTogglePin(project.id)}
              activeSessionId={activeProjectId === project.id ? activeSessionId : null}
              compareSelections={compareSelections}
              compareMode={compareMode}
              onSelectSession={(sessionId) => onSelectSession(project.id, sessionId)}
              onCompareToggle={onCompareToggle}
              onDeleteSession={(sessionId) => onDeleteSession(project.id, sessionId)}
              onMoveSession={onMoveSession ? (sessionId, sessionTitle) => onMoveSession(project.id, sessionId, sessionTitle) : undefined}
              onMoveProject={onMoveProject ? () => onMoveProject(project.id, project.displayName) : undefined}
              refreshTrigger={refreshTrigger}
            />
          ))}
          {!loading && projects.length === 0 && <div className="empty-text">No projects found</div>}
        </div>
      )}
    </div>
  )
}
