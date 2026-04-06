import React, { useState, useMemo } from 'react'
import type { ParsedConversation, NormalizedMessage, SessionInfo } from '../../types.js'
import { MessageBubble } from './MessageBubble.js'
import { ToolCallGroup } from './ToolCallGroup.js'
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

function isAgentToolCall(tc: { name: string; input: Record<string, unknown> }): boolean {
  return (tc.name === 'Task' || tc.name === 'Agent') && typeof tc.input.subagent_type === 'string'
}

type DisplayItem =
  | { kind: 'message'; message: NormalizedMessage; key: string }
  | { kind: 'tool-group'; messages: NormalizedMessage[]; key: string }

function groupMessages(messages: NormalizedMessage[], compact: boolean): DisplayItem[] {
  if (!compact) {
    return messages.map((msg, i) => ({ kind: 'message', message: msg, key: msg.uuid ?? `m-${i}` }))
  }

  const items: DisplayItem[] = []
  let pendingToolMsgs: NormalizedMessage[] = []

  const flushPending = () => {
    if (pendingToolMsgs.length === 0) return
    if (pendingToolMsgs.length === 1) {
      items.push({ kind: 'message', message: pendingToolMsgs[0], key: pendingToolMsgs[0].uuid ?? `m-${items.length}` })
    } else {
      items.push({ kind: 'tool-group', messages: [...pendingToolMsgs], key: `tg-${items.length}` })
    }
    pendingToolMsgs = []
  }

  for (const msg of messages) {
    if (isToolOnlyMessage(msg) && !msg.toolCalls?.some(isAgentToolCall)) {
      pendingToolMsgs.push(msg)
    } else {
      flushPending()
      items.push({ kind: 'message', message: msg, key: msg.uuid ?? `m-${items.length}` })
    }
  }
  flushPending()
  return items
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

function MessagesPane({ conversation, viewMode, onAgentClick }: { conversation: ParsedConversation; viewMode: 'compact' | 'detailed'; onAgentClick?: (description: string) => void }) {
  const filteredMessages = filterMessages(conversation.messages, viewMode)
  const displayItems = groupMessages(filteredMessages, viewMode === 'compact')

  return (
    <div className="viewer-messages">
      {displayItems.map(item =>
        item.kind === 'message'
          ? <MessageBubble key={item.key} message={item.message} onAgentClick={onAgentClick} />
          : <ToolCallGroup key={item.key} messages={item.messages} />
      )}
    </div>
  )
}

export function ConversationViewer({
  conversation, loading, error, onExport,
  childSessions, activeSubAgentId,
  subConversation, subLoading, subError,
  onSelectSubAgent, onCloseSubAgent,
}: ConversationViewerProps) {
  const [viewMode, setViewMode] = useState<'compact' | 'detailed'>('compact')

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
        <h2 className="viewer-title">{title}</h2>
        <div className="viewer-meta">
          <Badge label="Model" value={metadata.model?.replace('claude-', '').replace(/-\d{8}$/, '')} />
          <Badge label="Branch" value={metadata.gitBranch} />
          <Badge label="Version" value={metadata.version} />
          <Badge label="Started" value={formatDate(metadata.firstTimestamp)} />
          <Badge label="Messages" value={`${userMessages}u / ${assistantMessages}a`} />
          <Badge label="Tokens" value={metadata.totalInputTokens ? `${metadata.totalInputTokens.toLocaleString()} in / ${metadata.totalOutputTokens.toLocaleString()} out` : null} />
        </div>
        <div className="viewer-actions">
          <div className="view-toggle">
            <button className={`view-toggle-btn ${viewMode === 'compact' ? 'active' : ''}`} onClick={() => setViewMode('compact')}>Compact</button>
            <button className={`view-toggle-btn ${viewMode === 'detailed' ? 'active' : ''}`} onClick={() => setViewMode('detailed')}>Detailed</button>
          </div>
          {onExport && (
            <button className="export-btn" onClick={onExport}>Export</button>
          )}
        </div>
      </div>
      <div className="viewer-body">
        <div className={`viewer-body-main ${hasSubAgent ? 'viewer-body-main-split' : ''}`}>
          <MessagesPane conversation={conversation} viewMode={viewMode} onAgentClick={handleAgentClick} />
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
              <MessagesPane conversation={subConversation} viewMode={viewMode} />
            ) : (
              <div className="viewer-empty">Select a sub-agent</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
