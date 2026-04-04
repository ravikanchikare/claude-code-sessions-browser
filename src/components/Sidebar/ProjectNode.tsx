import React, { useState, useEffect, useMemo } from 'react'
import type { ProjectInfo, SessionInfo } from '../../types.js'
import { PinButton } from '../common/PinButton.js'
import { SessionNode } from './SessionNode.js'
import * as api from '../../api.js'

interface ProjectNodeProps {
  rootId: string
  project: ProjectInfo
  isPinned: boolean
  onTogglePin: () => void
  activeSessionId: string | null
  compareSelections: Set<string>
  compareMode: boolean
  onSelectSession: (sessionId: string) => void
  onCompareToggle: (sessionId: string) => void
  onDeleteSession: (sessionId: string) => void
  onMoveSession?: (sessionId: string, sessionTitle: string) => void
  onMoveProject?: () => void
  refreshTrigger?: number
}

export function ProjectNode({
  rootId, project, isPinned, onTogglePin,
  activeSessionId, compareSelections, compareMode,
  onSelectSession, onCompareToggle, onDeleteSession,
  onMoveSession, onMoveProject, refreshTrigger,
}: ProjectNodeProps) {
  const [expanded, setExpanded] = useState(false)
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!expanded) return
    setLoading(true)
    api.getSessions(rootId, project.id)
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setLoading(false))
  }, [expanded, rootId, project.id, refreshTrigger])

  // Group: top-level sessions (non-sub-agent), with children attached
  const { topLevel, childMap } = useMemo(() => {
    const childMap = new Map<string, SessionInfo[]>()
    const subAgentIds = new Set<string>()

    // Build child map: parent session id -> child sessions
    for (const s of sessions) {
      if (s.isSubAgent && s.parentSessionId) {
        const children = childMap.get(s.parentSessionId) ?? []
        children.push(s)
        childMap.set(s.parentSessionId, children)
        subAgentIds.add(s.id)
      }
    }

    // Also check childSessionIds from the parent side
    for (const s of sessions) {
      if (s.childSessionIds && s.childSessionIds.length > 0) {
        const existing = childMap.get(s.id) ?? []
        const existingIds = new Set(existing.map(c => c.id))
        for (const childId of s.childSessionIds) {
          if (!existingIds.has(childId)) {
            const child = sessions.find(c => c.id === childId)
            if (child) {
              existing.push(child)
              subAgentIds.add(childId)
            }
          }
        }
        if (existing.length > 0) childMap.set(s.id, existing)
      }
    }

    // Sort children by timestamp
    for (const [, children] of childMap) {
      children.sort((a, b) => {
        if (!a.timestamp && !b.timestamp) return 0
        if (!a.timestamp) return 1
        if (!b.timestamp) return -1
        return a.timestamp.localeCompare(b.timestamp)
      })
    }

    // Top-level: non-sub-agent sessions (or orphan agents with no parent in this list)
    const topLevel = sessions.filter(s => !subAgentIds.has(s.id))

    return { topLevel, childMap }
  }, [sessions])

  const shortName = project.displayName.split('/').filter(Boolean).slice(-2).join('/')

  return (
    <div className={`project-node ${isPinned ? 'pinned' : ''}`}>
      <div className="project-header" onClick={() => setExpanded(!expanded)}>
        {onMoveProject && (
          <button
            className="project-move-btn"
            onClick={(e) => { e.stopPropagation(); onMoveProject() }}
            title="Move project to another root"
          >&#x21c4;</button>
        )}
        <span className="expand-icon">{expanded ? '\u25BC' : '\u25B6'}</span>
        <PinButton pinned={isPinned} onToggle={onTogglePin} />
        <span className="project-name" title={project.displayName}>{shortName}</span>
        <span className="session-count">{project.sessionCount}</span>
      </div>
      {expanded && (
        <div className="project-sessions">
          {loading && <div className="loading-text">Loading sessions...</div>}
          {topLevel.map(session => (
            <SessionNode
              key={session.id}
              session={session}
              childSessions={childMap.get(session.id) ?? []}
              isActive={session.id === activeSessionId}
              isCompareSelected={compareSelections.has(session.id)}
              compareMode={compareMode}
              activeSessionId={activeSessionId}
              onSelect={() => onSelectSession(session.id)}
              onSelectChild={(childId) => onSelectSession(childId)}
              onCompareToggle={() => onCompareToggle(session.id)}
              onMove={onMoveSession ? () => {
                const title = session.customTitle ?? session.firstPrompt ?? 'Untitled'
                onMoveSession(session.id, title)
              } : undefined}
              onDelete={() => {
                onDeleteSession(session.id)
                setSessions(prev => prev.filter(s => s.id !== session.id))
              }}
              onDeleteChild={(childId) => {
                onDeleteSession(childId)
                setSessions(prev => prev.filter(s => s.id !== childId))
              }}
              compareSelections={compareSelections}
            />
          ))}
          {!loading && topLevel.length === 0 && sessions.length === 0 && <div className="empty-text">No sessions</div>}
        </div>
      )}
    </div>
  )
}
