import React, { useState } from 'react'
import { ChevronDownIcon } from '@radix-ui/react-icons'
import type { NormalizedMessage } from '../../types.js'
import { MessageBubble } from './MessageBubble.js'
import { ToolCallGroup } from './ToolCallGroup.js'

interface CheckpointGroupProps {
  checkpointIndex: number
  userMessage: NormalizedMessage
  intermediates: NormalizedMessage[]
  finalResponse: NormalizedMessage | null
  trailing: NormalizedMessage[]
  defaultExpanded: boolean
  onAgentClick?: (description: string) => void
  onRewind?: (uuid: string) => void
  onBranch?: (uuid: string) => void
}

function formatFriendlyTime(ts?: string): string {
  if (!ts) return ''
  try {
    const date = new Date(ts)
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterdayStart = new Date(todayStart)
    yesterdayStart.setDate(yesterdayStart.getDate() - 1)
    const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    if (date >= todayStart) return `Today ${time}`
    if (date >= yesterdayStart) return `Yesterday ${time}`
    const weekStart = new Date(todayStart)
    weekStart.setDate(weekStart.getDate() - todayStart.getDay())
    if (date >= weekStart) return `${date.toLocaleDateString('en-US', { weekday: 'short' })} ${time}`
    return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${time}`
  } catch { return '' }
}

function isAgentToolCall(tc: { name: string; input: Record<string, unknown> }): boolean {
  return (tc.name === 'Task' || tc.name === 'Agent') && typeof tc.input.subagent_type === 'string'
}

function isToolOnlyMessage(msg: NormalizedMessage): boolean {
  return msg.type === 'assistant' && !msg.content.trim() && (msg.toolCalls?.length ?? 0) > 0
}

export function CheckpointGroup({
  checkpointIndex, userMessage, intermediates, finalResponse, trailing,
  defaultExpanded, onAgentClick, onRewind, onBranch,
}: CheckpointGroupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  const summary = userMessage.content.trim().split('\n')[0].slice(0, 80)
  const time = formatFriendlyTime(userMessage.timestamp)

  // Group consecutive non-agent tool-only intermediates into ToolCallGroup batches
  const renderIntermediates = () => {
    const items: React.ReactNode[] = []
    let toolBatch: NormalizedMessage[] = []

    const flushBatch = () => {
      if (toolBatch.length === 0) return
      if (toolBatch.length === 1) {
        items.push(<MessageBubble key={toolBatch[0].uuid ?? `tb-${items.length}`} message={toolBatch[0]} onAgentClick={onAgentClick} />)
      } else {
        items.push(<ToolCallGroup key={`tg-${items.length}`} messages={[...toolBatch]} />)
      }
      toolBatch = []
    }

    for (const msg of intermediates) {
      if (isToolOnlyMessage(msg) && !msg.toolCalls?.some(isAgentToolCall)) {
        toolBatch.push(msg)
      } else {
        flushBatch()
        items.push(<MessageBubble key={msg.uuid ?? `int-${items.length}`} message={msg} onAgentClick={onAgentClick} />)
      }
    }
    flushBatch()
    return items
  }

  return (
    <div className="checkpoint-group">
      <div className="checkpoint-header" onClick={() => setExpanded(!expanded)}>
        <span className={`checkpoint-chevron ${expanded ? '' : 'collapsed'}`}><ChevronDownIcon width={11} height={11} /></span>
        <span className="checkpoint-index">#{checkpointIndex}</span>
        <span className="checkpoint-summary">{summary || 'Untitled checkpoint'}</span>
        <div className="checkpoint-actions">
          {onRewind && userMessage.uuid && (
            <button className="checkpoint-action checkpoint-rewind" onClick={(e) => { e.stopPropagation(); onRewind(userMessage.uuid!) }}>Rewind</button>
          )}
          {onBranch && userMessage.uuid && (
            <button className="checkpoint-action checkpoint-branch" onClick={(e) => { e.stopPropagation(); onBranch(userMessage.uuid!) }}>Branch</button>
          )}
        </div>
        <span className="checkpoint-time">{time}</span>
      </div>
      {expanded && (
        <div className="checkpoint-body">
          <MessageBubble message={userMessage} onAgentClick={onAgentClick} />
          {renderIntermediates()}
          {finalResponse && <MessageBubble message={finalResponse} onAgentClick={onAgentClick} />}
          {trailing.map((msg, i) => (
            <MessageBubble key={msg.uuid ?? `trail-${i}`} message={msg} onAgentClick={onAgentClick} />
          ))}
        </div>
      )}
    </div>
  )
}
