import React, { useState, useCallback } from 'react'
import { ChevronDownIcon, ChevronRightIcon, CheckboxIcon, SquareIcon, DotsVerticalIcon } from '@radix-ui/react-icons'
import type { SessionInfo } from '../../types.js'
import * as api from '../../api.js'
import { formatFullSessionTranscript } from '../../lib/turnPairCopy.js'
import { SessionContextMenu } from './SessionContextMenu.js'

interface SessionNodeProps {
  rootId: string
  projectId: string
  session: SessionInfo
  childSessions: SessionInfo[]
  isActive: boolean
  isCompareSelected: boolean
  compareMode: boolean
  activeSubAgentId: string | null
  onSelect: () => void
  onSelectChild: (childId: string) => void
  onCompareToggle: () => void
  onDelete: () => void
  onMove?: () => void
  onRename?: () => void
  compareSelections: Set<string>
}

function formatRelativeTime(ts: string | null): string {
  if (!ts) return ''
  try {
    const diff = Date.now() - new Date(ts).getTime()
    const mins = Math.floor(diff / 60_000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch { return '' }
}

function sessionHeadingLine(s: SessionInfo): string {
  return (s.customTitle ?? s.firstPrompt ?? 'Untitled').trim() || s.id
}

function transcriptSection(heading: string, sessionId: string, body: string): string {
  return `=== ${heading} (${sessionId}) ===\n\n${body}`
}

function SessionRow({
  session, isActive, isCompareSelected, compareMode,
  onSelect, onCompareToggle, onDelete, onMove, onRename, onCopyTranscript,
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
  onCopyTranscript?: () => void | Promise<void>
  isChild?: boolean
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const title = session.customTitle ?? session.firstPrompt ?? 'Untitled'
  const displayTitle = title.length > 80 ? title.slice(0, 80) + '\u2026' : title

  const showOverflow =
    !!(onRename || onMove || onDelete || onCopyTranscript || (compareMode && !isChild))

  return (
    <div className={`session-node ${isActive ? 'active' : ''} ${isCompareSelected ? 'compare-selected' : ''} ${isChild ? 'session-child' : ''}`}>
      {compareMode && (
        <span className="compare-checkbox" onClick={(e) => { e.stopPropagation(); onCompareToggle() }}>
          {isCompareSelected ? <CheckboxIcon width={15} height={15} /> : <SquareIcon width={15} height={15} />}
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
          {(session.lastTimestamp ?? session.timestamp) && (
            <span className="meta-item meta-time">{formatRelativeTime(session.lastTimestamp ?? session.timestamp)}</span>
          )}
          {session.model && <span className="meta-item">{session.model.replace('claude-', '').replace(/-\d{8}$/, '')}</span>}
          {session.gitBranch && <span className="meta-item branch">{session.gitBranch}</span>}
        </div>
      </div>
      {showOverflow && (
        <div className="session-menu-wrapper">
          <button
            className="session-menu-btn"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
            title="Session actions"
          ><DotsVerticalIcon width={13} height={13} /></button>
          {menuOpen && (
            <SessionContextMenu
              onRename={onRename}
              onMove={onMove}
              onCopyTranscript={onCopyTranscript}
              onDelete={onDelete}
              compareMode={compareMode && !isChild}
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
  rootId, projectId, session, childSessions, isActive, isCompareSelected, compareMode,
  activeSubAgentId, onSelect, onSelectChild, onCompareToggle,
  onDelete, onMove, onRename, compareSelections,
}: SessionNodeProps) {
  const [childrenExpanded, setChildrenExpanded] = useState(false)
  const hasChildren = childSessions.length > 0

  const copyParentTranscript = useCallback(async () => {
    try {
      const blocks: string[] = []
      const parentConv = await api.getMessages(rootId, projectId, session.id)
      blocks.push(
        transcriptSection(sessionHeadingLine(session), session.id, formatFullSessionTranscript(parentConv.messages)),
      )
      for (const child of childSessions) {
        try {
          const childConv = await api.getMessages(rootId, projectId, child.id)
          const head = `Sub-agent: ${sessionHeadingLine(child)}`
          blocks.push(transcriptSection(head, child.id, formatFullSessionTranscript(childConv.messages)))
        } catch { /* skip broken child */ }
      }
      await navigator.clipboard.writeText(blocks.join('\n\n'))
    } catch { /* parent fetch or clipboard failed */ }
  }, [rootId, projectId, session, childSessions])

  const copyChildTranscript = useCallback(async (child: SessionInfo) => {
    try {
      const conv = await api.getMessages(rootId, projectId, child.id)
      const head = `Sub-agent: ${sessionHeadingLine(child)}`
      await navigator.clipboard.writeText(transcriptSection(head, child.id, formatFullSessionTranscript(conv.messages)))
    } catch { /* skip */ }
  }, [rootId, projectId])

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
          onCopyTranscript={copyParentTranscript}
        />
        {hasChildren && (
          <button
            className="agent-count-badge"
            onClick={(e) => { e.stopPropagation(); setChildrenExpanded(!childrenExpanded) }}
            title={`${childSessions.length} sub-agent session${childSessions.length !== 1 ? 's' : ''}`}
          >
            <span className="agent-count-icon">{childrenExpanded ? <ChevronDownIcon width={10} height={10} /> : <ChevronRightIcon width={10} height={10} />}</span>
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
              onCopyTranscript={() => copyChildTranscript(child)}
              isChild
            />
          ))}
        </div>
      )}
    </div>
  )
}
