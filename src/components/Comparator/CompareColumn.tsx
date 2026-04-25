import React, { useState, useMemo } from 'react'
import { Cross2Icon } from '@radix-ui/react-icons'
import type { ParsedConversation, NormalizedMessage } from '../../types.js'
import { MessageBubble } from '../Viewer/MessageBubble.js'
import { CheckpointGroup } from '../Viewer/CheckpointGroup.js'
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

function filterMessages(messages: NormalizedMessage[]): NormalizedMessage[] {
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

export function CompareColumn({ conversation, onRemove }: CompareColumnProps) {
  const { metadata, messages, customTitle } = conversation
  const title = customTitle ?? messages.find(m => m.type === 'user')?.content.slice(0, 60) ?? 'Untitled'
  const userCount = messages.filter(m => m.type === 'user').length
  const assistantCount = messages.filter(m => m.type === 'assistant').length

  const filtered = filterMessages(messages)
  const { orphans, checkpoints } = useMemo(() => buildCheckpoints(filtered), [filtered])

  return (
    <div className="compare-column">
      <div className="compare-column-header">
        <h3 className="compare-column-title" title={title}>{title}</h3>
        <button className="compare-remove-btn" onClick={onRemove}><Cross2Icon width={12} height={12} /></button>
      </div>
      <div className="compare-column-meta">
        <Badge label="Model" value={metadata.model?.replace('claude-', '').replace(/-\d{8}$/, '')} />
        <Badge label="Branch" value={metadata.gitBranch} />
        <Badge label="Started" value={formatDate(metadata.firstTimestamp)} />
        <Badge label="Msgs" value={`${userCount}u/${assistantCount}a`} />
        <Badge label="Tokens" value={metadata.totalInputTokens ? `${(metadata.totalInputTokens + metadata.totalOutputTokens).toLocaleString()}` : null} />
      </div>
      <div className="compare-column-messages">
        {orphans.map((msg, i) => (
          <MessageBubble key={msg.uuid ?? `orphan-${i}`} message={msg} />
        ))}
        {checkpoints.map(cp => (
          <CheckpointGroup
            key={cp.userMessage.uuid ?? `cp-${cp.index}`}
            checkpointIndex={cp.index}
            userMessage={cp.userMessage}
            intermediates={cp.intermediates}
            finalResponse={cp.finalResponse}
            trailing={cp.trailing}
            defaultExpanded={cp.index === checkpoints.length}
          />
        ))}
      </div>
    </div>
  )
}
