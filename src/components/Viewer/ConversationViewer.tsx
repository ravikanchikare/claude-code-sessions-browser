import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import type { ParsedConversation, NormalizedMessage, SessionInfo } from '../../types.js'
import { MessageBubble } from './MessageBubble.js'
import { CheckpointGroup } from './CheckpointGroup.js'
import { DateGroup } from './DateGroup.js'
import { ControlBar } from './ControlBar.js'
import { Badge } from '../common/Badge.js'

interface ConversationViewerProps {
  conversation: ParsedConversation | null
  loading: boolean
  error: string | null
  onExport?: () => void
  // Sub-agent support
  childSessions?: SessionInfo[]
  activeSubAgentId?: string | null
  subConversation?: ParsedConversation | null
  subLoading?: boolean
  subError?: string | null
  onSelectSubAgent?: (childSessionId: string) => void
  onCloseSubAgent?: () => void
  // Session lifecycle
  onRename?: (newTitle: string) => Promise<void>
  renameRequested?: number
  onRewind?: (targetMessageUuid: string) => Promise<void>
  onBranch?: (targetMessageUuid: string) => Promise<void>
}

function formatDate(ts: string | null): string {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

function isToolOnlyMessage(msg: NormalizedMessage): boolean {
  return msg.type === 'assistant' && !msg.content.trim() && (msg.toolCalls?.length ?? 0) > 0
}

interface CheckpointData {
  index: number
  userMessage: NormalizedMessage
  intermediates: NormalizedMessage[]
  finalResponse: NormalizedMessage | null
  trailing: NormalizedMessage[]
}

function buildCheckpoints(messages: NormalizedMessage[]): { orphans: NormalizedMessage[]; checkpoints: CheckpointData[] } {
  const orphans: NormalizedMessage[] = []
  const checkpoints: CheckpointData[] = []
  let current: CheckpointData | null = null
  let idx = 0

  const flush = () => {
    if (current) checkpoints.push(current)
    current = null
  }

  for (const msg of messages) {
    if (msg.type === 'user') {
      flush()
      idx++
      current = { index: idx, userMessage: msg, intermediates: [], finalResponse: null, trailing: [] }
    } else if (current) {
      if (current.finalResponse) {
        // Already have a final response — additional messages go to trailing
        current.trailing.push(msg)
      } else if (isToolOnlyMessage(msg)) {
        current.intermediates.push(msg)
      } else if (msg.type === 'assistant') {
        current.finalResponse = msg
      } else {
        current.trailing.push(msg)
      }
    } else {
      orphans.push(msg)
    }
  }
  flush()
  return { orphans, checkpoints }
}

const DATE_BUCKET_ORDER = ['Last few hours', 'Today', 'Yesterday', 'This week', 'Older'] as const

function getDateBucket(timestamp: string | undefined): string {
  if (!timestamp) return 'Older'
  const now = new Date()
  const date = new Date(timestamp)
  const hoursAgo = (now.getTime() - date.getTime()) / 3_600_000

  if (hoursAgo < 3) return 'Last few hours'

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (date >= todayStart) return 'Today'

  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)
  if (date >= yesterdayStart) return 'Yesterday'

  const weekStart = new Date(todayStart)
  weekStart.setDate(weekStart.getDate() - todayStart.getDay())
  if (date >= weekStart) return 'This week'

  return 'Older'
}

interface DateBucket {
  label: string
  checkpoints: CheckpointData[]
}

function groupByDate(checkpoints: CheckpointData[]): DateBucket[] {
  const bucketMap = new Map<string, CheckpointData[]>()
  for (const cp of checkpoints) {
    const label = getDateBucket(cp.userMessage.timestamp)
    const arr = bucketMap.get(label) ?? []
    arr.push(cp)
    bucketMap.set(label, arr)
  }
  // Return in canonical order, skipping empty buckets
  return DATE_BUCKET_ORDER
    .filter(label => bucketMap.has(label))
    .map(label => ({ label, checkpoints: bucketMap.get(label)! }))
}

function filterMessages(messages: NormalizedMessage[], viewMode: 'compact' | 'detailed'): NormalizedMessage[] {
  if (viewMode === 'detailed') return messages
  return messages.filter(msg => {
    if (msg.type === 'assistant' && !msg.content.trim() && !(msg.toolCalls?.length)) return false
    if (msg.type === 'user') {
      const trimmed = msg.content.trim()
      if (trimmed.startsWith('<') && /<\/[a-zA-Z][a-zA-Z0-9-]*>\s*$/.test(trimmed)) return false
      if (trimmed.toLowerCase().startsWith('caviat')) return false
    }
    return true
  })
}

function EditableTitle({ title, onRename, editTrigger }: { title: string; onRename?: (newTitle: string) => Promise<void>; editTrigger?: number }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setValue(title) }, [title])
  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])
  useEffect(() => { if (editTrigger && onRename) setEditing(true) }, [editTrigger, onRename])

  const commit = useCallback(async () => {
    setEditing(false)
    const trimmed = value.trim()
    if (trimmed && trimmed !== title && onRename) {
      await onRename(trimmed)
    } else {
      setValue(title)
    }
  }, [value, title, onRename])

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="editable-title-input"
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setValue(title); setEditing(false) } }}
      />
    )
  }

  return (
    <h2 className="viewer-title">
      {title}
      {onRename && (
        <span className="title-edit-icon" onClick={() => setEditing(true)} title="Rename session">&#9998;</span>
      )}
    </h2>
  )
}

function MessagesPane({ conversation, viewMode, sortOrder, onAgentClick, onRewind, onBranch }: {
  conversation: ParsedConversation
  viewMode: 'compact' | 'detailed'
  sortOrder: 'oldest' | 'newest'
  onAgentClick?: (description: string) => void
  onRewind?: (uuid: string) => void
  onBranch?: (uuid: string) => void
}) {
  const filteredMessages = filterMessages(conversation.messages, viewMode)
  const { orphans, checkpoints } = useMemo(() => buildCheckpoints(filteredMessages), [filteredMessages])
  const dateBuckets = useMemo(() => groupByDate(checkpoints), [checkpoints])

  const orderedBuckets = sortOrder === 'newest' ? [...dateBuckets].reverse() : dateBuckets

  const renderCheckpoint = (cp: CheckpointData) => (
    <CheckpointGroup
      key={cp.userMessage.uuid ?? `cp-${cp.index}`}
      checkpointIndex={cp.index}
      userMessage={cp.userMessage}
      intermediates={cp.intermediates}
      finalResponse={cp.finalResponse}
      trailing={cp.trailing}
      defaultExpanded={cp.index === checkpoints.length}
      viewMode={viewMode}
      onAgentClick={onAgentClick}
      onRewind={onRewind}
      onBranch={onBranch}
    />
  )

  return (
    <div className="viewer-messages">
      {sortOrder === 'oldest' && orphans.map((msg, i) => (
        <MessageBubble key={msg.uuid ?? `orphan-${i}`} message={msg} />
      ))}
      {orderedBuckets.map(bucket => {
        const cps = sortOrder === 'newest' ? [...bucket.checkpoints].reverse() : bucket.checkpoints
        const hasRecentBucket = orderedBuckets.some(b => b.label === 'Last few hours')
        const isRecent = bucket.label === 'Last few hours' || bucket.label === 'Today'
        const shouldExpand = isRecent || (!hasRecentBucket && bucket.label === 'Older')
        return (
          <DateGroup key={bucket.label} label={bucket.label} defaultExpanded={shouldExpand}>
            {cps.map(renderCheckpoint)}
          </DateGroup>
        )
      })}
      {sortOrder === 'newest' && orphans.map((msg, i) => (
        <MessageBubble key={msg.uuid ?? `orphan-${i}`} message={msg} />
      ))}
    </div>
  )
}

export function ConversationViewer({
  conversation, loading, error, onExport,
  childSessions, activeSubAgentId,
  subConversation, subLoading, subError,
  onSelectSubAgent, onCloseSubAgent,
  onRename, renameRequested, onRewind, onBranch,
}: ConversationViewerProps) {
  const [viewMode, setViewMode] = useState<'compact' | 'detailed'>('compact')
  const [sortOrder, setSortOrder] = useState<'oldest' | 'newest'>('oldest')

  // Build description -> childSessionId mapping
  const descriptionToChild = useMemo(() => {
    const map = new Map<string, string>()
    if (childSessions) {
      for (const child of childSessions) {
        if (child.agentDescription) {
          map.set(child.agentDescription, child.id)
        }
      }
    }
    return map
  }, [childSessions])

  const handleAgentClick = useMemo(() => {
    if (!onSelectSubAgent || !childSessions?.length) return undefined
    return (description: string) => {
      const childId = descriptionToChild.get(description)
      if (childId) {
        onSelectSubAgent(childId)
      }
    }
  }, [onSelectSubAgent, childSessions, descriptionToChild])

  if (loading) {
    return <div className="viewer-empty">Loading conversation...</div>
  }

  if (error) {
    return <div className="viewer-empty viewer-error">{error}</div>
  }

  if (!conversation) {
    return <div className="viewer-empty">Select a session to view its conversation</div>
  }

  const { metadata, messages, customTitle } = conversation
  const title = customTitle ?? messages.find(m => {
    if (m.type !== 'user') return false
    const t = m.content.trim()
    if (t.startsWith('<') && /<\/[a-zA-Z][a-zA-Z0-9-]*>\s*$/.test(t)) return false
    if (t.toLowerCase().startsWith('caviat')) return false
    return true
  })?.content.slice(0, 100) ?? 'Untitled'
  const userMessages = messages.filter(m => m.type === 'user').length
  const assistantMessages = messages.filter(m => m.type === 'assistant').length

  const hasSubAgent = activeSubAgentId != null

  // Find the active sub-agent's description for the panel title
  const activeSubAgent = childSessions?.find(c => c.id === activeSubAgentId)
  const subAgentTitle = activeSubAgent?.agentDescription ?? activeSubAgent?.agentId ?? 'Sub-agent'

  return (
    <div className="viewer">
      <div className="viewer-header">
        <EditableTitle title={title} onRename={onRename} editTrigger={renameRequested} />
        <div className="viewer-meta">
          <Badge label="Model" value={metadata.model?.replace('claude-', '').replace(/-\d{8}$/, '')} />
          <Badge label="Branch" value={metadata.gitBranch} />
          <Badge label="Version" value={metadata.version} />
          <Badge label="Started" value={formatDate(metadata.firstTimestamp)} />
          <Badge label="Messages" value={`${userMessages}u / ${assistantMessages}a`} />
          <Badge label="Tokens" value={metadata.totalInputTokens ? `${metadata.totalInputTokens.toLocaleString()} in / ${metadata.totalOutputTokens.toLocaleString()} out` : null} />
        </div>
      </div>
      <ControlBar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
        sessionId={conversation.sessionId}
        onExport={onExport}
      />
      <div className="viewer-body">
        <div className={`viewer-body-main ${hasSubAgent ? 'viewer-body-main-split' : ''}`}>
          <MessagesPane conversation={conversation} viewMode={viewMode} sortOrder={sortOrder} onAgentClick={handleAgentClick} onRewind={onRewind} onBranch={onBranch} />
        </div>
        {hasSubAgent && (
          <div className="viewer-body-sub">
            <div className="subagent-panel-header">
              <span className="subagent-panel-title">{subAgentTitle}</span>
              <button className="subagent-close-btn" onClick={onCloseSubAgent} title="Close sub-agent panel">&times;</button>
            </div>
            {subLoading ? (
              <div className="viewer-empty">Loading sub-agent...</div>
            ) : subError ? (
              <div className="viewer-empty viewer-error">{subError}</div>
            ) : subConversation ? (
              <MessagesPane conversation={subConversation} viewMode={viewMode} sortOrder={sortOrder} />
            ) : (
              <div className="viewer-empty">Select a sub-agent</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
