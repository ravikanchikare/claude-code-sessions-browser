import React from 'react'
import type { ParsedConversation } from '../../types.js'
import { MessageBubble } from '../Viewer/MessageBubble.js'
import { Badge } from '../common/Badge.js'

interface CompareColumnProps {
  conversation: ParsedConversation
  onRemove: () => void
}

function formatDate(ts: string | null): string {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

export function CompareColumn({ conversation, onRemove }: CompareColumnProps) {
  const { metadata, messages, customTitle } = conversation
  const title = customTitle ?? messages.find(m => m.type === 'user')?.content.slice(0, 60) ?? 'Untitled'
  const userCount = messages.filter(m => m.type === 'user').length
  const assistantCount = messages.filter(m => m.type === 'assistant').length

  return (
    <div className="compare-column">
      <div className="compare-column-header">
        <h3 className="compare-column-title" title={title}>{title}</h3>
        <button className="compare-remove-btn" onClick={onRemove}>&times;</button>
      </div>
      <div className="compare-column-meta">
        <Badge label="Model" value={metadata.model?.replace('claude-', '').replace(/-\d{8}$/, '')} />
        <Badge label="Branch" value={metadata.gitBranch} />
        <Badge label="Started" value={formatDate(metadata.firstTimestamp)} />
        <Badge label="Msgs" value={`${userCount}u/${assistantCount}a`} />
        <Badge label="Tokens" value={metadata.totalInputTokens ? `${(metadata.totalInputTokens + metadata.totalOutputTokens).toLocaleString()}` : null} />
      </div>
      <div className="compare-column-messages">
        {messages.map((msg, i) => (
          <MessageBubble key={msg.uuid ?? i} message={msg} />
        ))}
      </div>
    </div>
  )
}
