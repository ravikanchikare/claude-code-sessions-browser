import React, { useState, useMemo, useCallback } from 'react'
import { ChevronRightIcon, ClipboardIcon } from '@radix-ui/react-icons'
import type { NormalizedMessage } from '../../types.js'
import { JsonTree } from '../common/JsonTree.js'

interface TurnRowProps {
  index: number
  userMessage: NormalizedMessage
  intermediates: NormalizedMessage[]
  finalResponse: NormalizedMessage | null
  trailing: NormalizedMessage[]
  /** Pre-formatted turn transcript (User / Claude / Claude Summary) for clipboard */
  turnCopyText?: string
  defaultExpanded: boolean
  isLatest?: boolean
  onAgentClick?: (description: string) => void
  onRewind?: (uuid: string) => void
  onBranch?: (uuid: string) => void
}

const MSG_COLLAPSED_KEYS = ['uuid', 'usage', 'toolCalls', 'model', 'stopReason']
const MSG_COLLAPSED_SET = new Set(MSG_COLLAPSED_KEYS)

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k'
  return String(n)
}

function formatTime(ts?: string): string {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

function isAgentToolCall(tc: { name: string; input: Record<string, unknown> }): boolean {
  return (tc.name === 'Task' || tc.name === 'Agent') && typeof tc.input.subagent_type === 'string'
}

function msgToTree(msg: NormalizedMessage): Record<string, unknown> {
  const tree: Record<string, unknown> = {}
  const trimmedContent = msg.content.trim()
  const trimmedThinking = msg.thinkingContent?.trim()
  if (trimmedContent) tree.content = trimmedContent
  if (trimmedThinking) tree.thinking = trimmedThinking
  if (msg.toolCalls?.length) tree.toolCalls = msg.toolCalls
  if (msg.tokenUsage) tree.usage = msg.tokenUsage
  if (msg.model) tree.model = msg.model
  if (msg.stopReason) tree.stopReason = msg.stopReason
  if (msg.uuid) tree.uuid = msg.uuid
  return tree
}

/** Assistant message where all visible tree keys are in the collapsed set (no content/thinking). */
function isLowValueMsg(msg: NormalizedMessage): boolean {
  if (msg.type !== 'assistant') return false
  const tree = msgToTree(msg)
  return Object.keys(tree).every(k => MSG_COLLAPSED_SET.has(k))
}

type RenderItem =
  | { kind: 'message'; msg: NormalizedMessage }
  | { kind: 'collapsed-group'; messages: NormalizedMessage[]; toolCallCount: number }

function buildRenderItems(messages: NormalizedMessage[]): RenderItem[] {
  const items: RenderItem[] = []
  let buffer: NormalizedMessage[] = []

  const flush = () => {
    if (buffer.length === 0) return
    const toolCalls = buffer.reduce((n, m) => n + (m.toolCalls?.length ?? 0), 0)
    items.push({ kind: 'collapsed-group', messages: [...buffer], toolCallCount: toolCalls })
    buffer = []
  }

  for (const msg of messages) {
    if (isLowValueMsg(msg)) {
      buffer.push(msg)
    } else {
      flush()
      items.push({ kind: 'message', msg })
    }
  }
  flush()
  return items
}

function TurnMsgGroup({
  msg, onAgentClick,
}: {
  msg: NormalizedMessage
  onAgentClick?: (desc: string) => void
}) {
  const roleClass = msg.type === 'user' ? 'role-user'
    : msg.type === 'assistant' ? (msg.stopReason === 'end_turn' ? 'role-assistant' : 'role-assistant-muted')
    : 'role-system'
  const roleLabel = msg.type === 'user' ? 'user'
    : msg.type === 'assistant' ? (msg.stopReason === 'end_turn' ? 'result' : 'assistant')
    : msg.type

  const agentCalls = (msg.toolCalls ?? []).filter(isAgentToolCall)

  return (
    <div className="turn-msg-group">
      <div className="turn-msg-header">
        <span className={`role-badge ${roleClass}`}>{roleLabel}</span>
        {msg.timestamp && <span className="turn-msg-time">{formatTime(msg.timestamp)}</span>}
        {msg.model && (
          <span className="turn-msg-model">{msg.model.replace('claude-', '').replace(/-\d{8}$/, '')}</span>
        )}
        {msg.tokenUsage && (() => {
          const u = msg.tokenUsage!
          const inp = (u.inputTokens ?? 0) + (u.cacheCreationTokens ?? 0)
          const out = u.outputTokens ?? 0
          if (!inp && !out) return null
          return <span className="turn-msg-tokens">{fmtNum(inp)}in {fmtNum(out)}out</span>
        })()}
        {agentCalls.length > 0 && onAgentClick && agentCalls.map((tc, i) => (
          <button
            key={i}
            className="turn-agent-launch"
            onClick={(e) => {
              e.stopPropagation()
              const desc = tc.input.description as string ?? tc.input.subagent_type as string ?? 'agent'
              onAgentClick(desc)
            }}
          >
            ↗ {tc.input.subagent_type as string ?? 'agent'}
          </button>
        ))}
      </div>
      {msg.attachments && msg.attachments.length > 0 && (() => {
        const hasNamed = msg.attachments!.some(a => a.fileName || a.source)
        const visible = hasNamed ? msg.attachments!.filter(a => a.fileName || a.source) : msg.attachments!
        return (
          <div className="msg-attachments">
            {visible.map((att, i) => (
              <div key={i} className="msg-attachment" title={att.source}>
                <span className="msg-attachment-type">{att.mediaType ?? att.type}</span>
                <span className="msg-attachment-name">{att.fileName ?? att.source ?? 'inline image'}</span>
              </div>
            ))}
          </div>
        )
      })()}
      <JsonTree value={msgToTree(msg)} maxDepth={2} maxStrLen={400} collapsedKeys={MSG_COLLAPSED_KEYS} />
    </div>
  )
}

function CollapsedMsgGroup({
  messages, toolCallCount, onAgentClick,
}: {
  messages: NormalizedMessage[]
  toolCallCount: number
  onAgentClick?: (desc: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const label = messages.length === 1
    ? `Assistant${toolCallCount ? ` (${toolCallCount} tool call${toolCallCount !== 1 ? 's' : ''})` : ''}`
    : `${messages.length} assistant messages${toolCallCount ? ` (${toolCallCount} tool call${toolCallCount !== 1 ? 's' : ''})` : ''}`

  return (
    <div className="collapsed-msg-group">
      <div className="collapsed-msg-group-header" onClick={() => setExpanded(!expanded)}>
        <span className="collapsed-msg-group-toggle">{expanded ? '\u25BC' : '\u25B6'}</span>
        <span className="collapsed-msg-group-label">{label}</span>
      </div>
      {expanded && messages.map((msg, i) => (
        <TurnMsgGroup key={msg.uuid ?? `cm-${i}`} msg={msg} onAgentClick={onAgentClick} />
      ))}
    </div>
  )
}

export function TurnRow({
  index, userMessage, intermediates, finalResponse, trailing,
  turnCopyText, defaultExpanded, isLatest, onAgentClick, onRewind,
}: TurnRowProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  const handleCopyTurn = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (turnCopyText) void navigator.clipboard.writeText(turnCopyText)
    },
    [turnCopyText],
  )

  const preview = userMessage.content.trim().replace(/\n/g, ' ').slice(0, 120)
  const time = formatTime(userMessage.timestamp)

  const toolCount = intermediates.reduce((n, m) => n + (m.toolCalls?.length ?? 0), 0)
  const agentCount = intermediates.reduce(
    (n, m) => n + (m.toolCalls ?? []).filter(isAgentToolCall).length, 0
  )

  // Token info from final response
  const tokens = (() => {
    const u = finalResponse?.tokenUsage
    if (!u) return null
    const inp = (u.inputTokens ?? 0) + (u.cacheCreationTokens ?? 0)
    const out = u.outputTokens ?? 0
    if (!inp && !out) return null
    return `${fmtNum(inp)}in ${fmtNum(out)}out`
  })()

  const allMessages: NormalizedMessage[] = [
    userMessage,
    ...intermediates,
    ...(finalResponse ? [finalResponse] : []),
    ...trailing,
  ].filter(msg => !(msg.type === 'assistant' && !msg.content.trim() && !(msg.toolCalls?.length)))

  const renderItems = useMemo(() => buildRenderItems(allMessages), [allMessages])

  return (
    <div className={`turn-row ${expanded ? 'turn-row-expanded' : ''} ${isLatest ? 'turn-row-latest' : ''}`}>
      <div className="turn-row-header" onClick={() => setExpanded(!expanded)}>
        <span className={`turn-expand-arrow ${expanded ? 'turn-expand-arrow-open' : ''}`}><ChevronRightIcon width={11} height={11} /></span>
        <span className="turn-index">#{index}</span>
        <span className="turn-preview">{preview || 'Untitled'}</span>
        <div className="turn-badges">
          {agentCount > 0 && (
            <span className="turn-badge turn-badge-agent">{agentCount} agent{agentCount !== 1 ? 's' : ''}</span>
          )}
          {toolCount > 0 && (
            <span className="turn-badge turn-badge-tools">{toolCount} tools</span>
          )}
          {tokens && <span className="turn-tokens">{tokens}</span>}
          {time && <span className="turn-time">{time}</span>}
          {onRewind && userMessage.uuid && (
            <button
              className="turn-action-btn"
              onClick={(e) => { e.stopPropagation(); onRewind(userMessage.uuid!) }}
            >Rewind</button>
          )}
          {turnCopyText != null && (
            <button
              type="button"
              className="turn-copy-btn"
              aria-label="Copy transcript for this turn"
              title="Copy transcript for this turn (User, Claude, and Claude Summary where applicable)"
              onClick={handleCopyTurn}
            >
              <ClipboardIcon width={12} height={12} />
            </button>
          )}
        </div>
      </div>
      {expanded && (
        <div className="turn-row-body">
          {renderItems.map((item, i) => {
            if (item.kind === 'message') {
              return (
                <TurnMsgGroup
                  key={item.msg.uuid ?? `m-${i}`}
                  msg={item.msg}
                  onAgentClick={onAgentClick}
                />
              )
            }
            return (
              <CollapsedMsgGroup
                key={`grp-${i}`}
                messages={item.messages}
                toolCallCount={item.toolCallCount}
                onAgentClick={onAgentClick}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
