import React, { useState, useEffect } from 'react'
import { ChevronDownIcon, ChevronRightIcon, Cross2Icon } from '@radix-ui/react-icons'
import type { RootInfo, ProjectInfo } from '../../types.js'
import { ProjectNode } from './ProjectNode.js'
import * as api from '../../api.js'

interface RootNodeProps {
  root: RootInfo
  isPinned: (projectId: string) => boolean
  onTogglePin: (projectId: string) => void
  activeSessionId: string | null
  activeSubAgentId: string | null
  activeProjectId: string | null
  compareSelections: Set<string>
  compareMode: boolean
  onSelectSession: (projectId: string, sessionId: string) => void
  onSelectSubAgent: (projectId: string, parentSessionId: string, childSessionId: string) => void
  onCompareToggle: (projectId: string, sessionId: string) => void
  onDeleteSession: (projectId: string, sessionId: string) => void
  onRemoveRoot: () => void
  onMoveSession?: (projectId: string, sessionId: string, sessionTitle: string) => void
  onMoveProject?: (projectId: string, projectName: string) => void
  onRenameSession?: (projectId: string, sessionId: string) => void
  refreshTrigger?: number
}

export function RootNode({
  root, isPinned, onTogglePin,
  activeSessionId, activeSubAgentId, activeProjectId, compareSelections, compareMode,
  onSelectSession, onSelectSubAgent, onCompareToggle, onDeleteSession, onRemoveRoot,
  onMoveSession, onMoveProject, onRenameSession, refreshTrigger,
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

  // Sort: pinned first, then by most recent activity (server already sorted by activity)
  const sortedProjects = [...projects].sort((a, b) => {
    const aPinned = isPinned(a.id) ? 0 : 1
    const bPinned = isPinned(b.id) ? 0 : 1
    if (aPinned !== bPinned) return aPinned - bPinned
    // Both same pin status: sort by lastActivity desc (server order)
    if (a.lastActivity && b.lastActivity) return b.lastActivity.localeCompare(a.lastActivity)
    if (a.lastActivity) return -1
    if (b.lastActivity) return 1
    return a.displayName.localeCompare(b.displayName)
  })

  return (
    <div className="root-node">
      <div className="root-header" onClick={() => setExpanded(!expanded)}>
        <span className="expand-icon">{expanded ? <ChevronDownIcon width={10} height={10} /> : <ChevronRightIcon width={10} height={10} />}</span>
        <span className="root-label">{root.label}</span>
        <span className="root-path" title={root.path}>{root.path}</span>
        <button
          className="remove-root-btn"
          onClick={(e) => { e.stopPropagation(); onRemoveRoot() }}
          title="Remove root"
        >
          <Cross2Icon width={10} height={10} />
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
              activeSubAgentId={activeProjectId === project.id ? activeSubAgentId : null}
              compareSelections={compareSelections}
              compareMode={compareMode}
              onSelectSession={(sessionId) => onSelectSession(project.id, sessionId)}
              onSelectSubAgent={(parentSessionId, childSessionId) => onSelectSubAgent(project.id, parentSessionId, childSessionId)}
              onCompareToggle={(sessionId) => onCompareToggle(project.id, sessionId)}
              onDeleteSession={(sessionId) => onDeleteSession(project.id, sessionId)}
              onMoveSession={onMoveSession ? (sessionId, sessionTitle) => onMoveSession(project.id, sessionId, sessionTitle) : undefined}
              onMoveProject={onMoveProject ? () => onMoveProject(project.id, project.displayName) : undefined}
              onRenameSession={onRenameSession ? (sessionId) => onRenameSession(project.id, sessionId) : undefined}
              refreshTrigger={refreshTrigger}
            />
          ))}
          {!loading && projects.length === 0 && <div className="empty-text">No projects found</div>}
        </div>
      )}
    </div>
  )
}
