import React from 'react'
import type { ParsedConversation } from '../../types.js'
import { MessageBubble } from './MessageBubble.js'
import { Badge } from '../common/Badge.js'

interface ConversationViewerProps {
  conversation: ParsedConversation | null
  loading: boolean
  error: string | null
  onExport?: () => void
}

function formatDate(ts: string | null): string {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

export function ConversationViewer({ conversation, loading, error, onExport }: ConversationViewerProps) {
  if (loading) {
    return <div className="viewer-empty">Loading conversation...</div>
  }

  if (error) {
    return <div className="viewer-empty viewer-error">{error}</div>
  }

  if (!conversation) {
    return <div className="viewer-empty">Select a session to view its conversation</div>
  }

  const { metadata, messages, customTitle, summary } = conversation
  const title = customTitle ?? messages.find(m => m.type === 'user')?.content.slice(0, 100) ?? 'Untitled'
  const userMessages = messages.filter(m => m.type === 'user').length
  const assistantMessages = messages.filter(m => m.type === 'assistant').length

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
        {onExport && (
          <button className="export-btn" onClick={onExport}>Export</button>
        )}
      </div>
      <div className="viewer-messages">
        {messages.map((msg, i) => (
          <MessageBubble key={msg.uuid ?? i} message={msg} />
        ))}
      </div>
    </div>
  )
}
