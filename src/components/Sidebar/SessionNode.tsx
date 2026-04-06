import React, { useState } from 'react'
import type { SessionInfo } from '../../types.js'
import { SessionContextMenu } from './SessionContextMenu.js'

interface SessionNodeProps {
  session: SessionInfo
  childSessions: SessionInfo[]
  isActive: boolean
  isCompareSelected: boolean
  compareMode: boolean
  activeSessionId: string | null
  activeSubAgentId: string | null
  onSelect: () => void
  onSelectChild: (childId: string) => void
  onCompareToggle: () => void
  onDelete: () => void
  onMove?: () => void
  onRename?: () => void
  compareSelections: Set<string>
}

function formatDate(ts: string | null): string {
  if (!ts) return ''
  try {
    const d = new Date(ts)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function SessionRow({
  session, isActive, isCompareSelected, compareMode,
  onSelect, onCompareToggle, onDelete, onMove, onRename,
  isChild,
}: {
  session: SessionInfo
  isActive: boolean
  isCompareSelected: boolean
  compareMode: boolean
  onSelect: () => void
  onCompareToggle: () => void
  onDelete?: () => void
  onMove?: () => void
  onRename?: () => void
  isChild?: boolean
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const title = session.customTitle ?? session.firstPrompt ?? 'Untitled'
  const displayTitle = title.length > 80 ? title.slice(0, 80) + '\u2026' : title

  return (
    <div className={`session-node ${isActive ? 'active' : ''} ${isCompareSelected ? 'compare-selected' : ''} ${isChild ? 'session-child' : ''}`}>
      {compareMode && (
        <span className="compare-checkbox" onClick={(e) => { e.stopPropagation(); onCompareToggle() }}>
          {isCompareSelected ? '\u2611' : '\u2610'}
        </span>
      )}
      <div className="session-content" onClick={onSelect}>
        {isChild && (
          <span className="agent-badge" title={session.agentDescription ?? session.agentId ?? 'sub-agent'}>
            {session.agentDescription ?? session.agentId ?? 'agent'}
          </span>
        )}
        <div className="session-title">{displayTitle || 'Untitled session'}</div>
        <div className="session-meta">
          {session.timestamp && <span className="meta-item">{formatDate(session.timestamp)}</span>}
          {session.model && <span className="meta-item">{session.model.replace('claude-', '').replace(/-\d{8}$/, '')}</span>}
          {session.gitBranch && <span className="meta-item branch">{session.gitBranch}</span>}
          <span className="meta-item">{formatSize(session.fileSize)}</span>
        </div>
      </div>
      {onDelete && !isChild && (
        <div className="session-menu-wrapper">
          <button
            className="session-menu-btn"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
            title="Session actions"
          >&#8942;</button>
          {menuOpen && (
            <SessionContextMenu
              onRename={onRename}
              onMove={onMove}
              onDelete={onDelete}
              compareMode={compareMode}
              isCompareSelected={isCompareSelected}
              onCompareToggle={onCompareToggle}
              onClose={() => setMenuOpen(false)}
            />
          )}
        </div>
      )}
    </div>
  )
}

export function SessionNode({
  session, childSessions, isActive, isCompareSelected, compareMode,
  activeSessionId, activeSubAgentId, onSelect, onSelectChild, onCompareToggle,
  onDelete, onMove, onRename, compareSelections,
}: SessionNodeProps) {
  const [childrenExpanded, setChildrenExpanded] = useState(false)
  const hasChildren = childSessions.length > 0

  return (
    <div className="session-group">
      <div className="session-parent-row">
        <SessionRow
          session={session}
          isActive={isActive}
          isCompareSelected={isCompareSelected}
          compareMode={compareMode}
          onSelect={onSelect}
          onCompareToggle={onCompareToggle}
          onDelete={onDelete}
          onMove={onMove}
          onRename={onRename}
        />
        {hasChildren && (
          <button
            className="agent-count-badge"
            onClick={(e) => { e.stopPropagation(); setChildrenExpanded(!childrenExpanded) }}
            title={`${childSessions.length} sub-agent session${childSessions.length !== 1 ? 's' : ''}`}
          >
            <span className="agent-count-icon">{childrenExpanded ? '\u25BC' : '\u25B6'}</span>
            +{childSessions.length} agent{childSessions.length !== 1 ? 's' : ''}
          </button>
        )}
      </div>
      {hasChildren && childrenExpanded && (
        <div className="session-children">
          {childSessions.map(child => (
            <SessionRow
              key={child.id}
              session={child}
              isActive={child.id === activeSubAgentId}
              isCompareSelected={compareSelections.has(child.id)}
              compareMode={compareMode}
              onSelect={() => onSelectChild(child.id)}
              onCompareToggle={() => {}}
              isChild
            />
          ))}
        </div>
      )}
    </div>
  )
}
