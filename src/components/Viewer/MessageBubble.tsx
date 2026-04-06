import React, { useState } from 'react'
import type { NormalizedMessage } from '../../types.js'

interface MessageBubbleProps {
  message: NormalizedMessage
  onNavigateAgent?: (agentId: string) => void
  onAgentClick?: (description: string) => void
}

function formatTime(ts?: string): string {
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

function basename(filePath: string): string {
  const parts = filePath.split('/')
  return parts[parts.length - 1] || filePath
}

function toolSummary(tc: { name: string; input: Record<string, unknown> }): string {
  const inp = tc.input
  switch (tc.name) {
    case 'Read':
    case 'Write':
      return inp.file_path ? basename(inp.file_path as string) : ''
    case 'Edit':
      return inp.file_path ? basename(inp.file_path as string) : ''
    case 'Grep':
      return typeof inp.pattern === 'string' ? inp.pattern.slice(0, 40) : ''
    case 'Glob':
      return typeof inp.pattern === 'string' ? inp.pattern.slice(0, 40) : ''
    case 'Bash':
      if (typeof inp.description === 'string') return inp.description.slice(0, 50)
      if (typeof inp.command === 'string') return inp.command.slice(0, 50)
      return ''
    case 'Agent':
    case 'Task':
      return typeof inp.description === 'string' ? inp.description : ''
    default:
      return ''
  }
}

function isAgentToolCall(tc: { name: string; input: Record<string, unknown> }): boolean {
  return (tc.name === 'Task' || tc.name === 'Agent') && typeof tc.input.subagent_type === 'string'
}

const TRUNCATION_CHARS = 600
const TRUNCATION_LINES = 15

function shouldTruncate(content: string): boolean {
  if (content.length > TRUNCATION_CHARS) return true
  const newlines = content.split('\n').length
  return newlines > TRUNCATION_LINES
}

export function MessageBubble({ message, onNavigateAgent, onAgentClick }: MessageBubbleProps) {
  const [showThinking, setShowThinking] = useState(false)
  const [expandedTools, setExpandedTools] = useState<Set<number>>(new Set())
  const [contentExpanded, setContentExpanded] = useState(false)

  if (message.type === 'system') {
    return (
      <div className="message message-system">
        <span className="system-text">{message.content}</span>
      </div>
    )
  }

  if (message.type === 'summary') {
    return (
      <div className="message message-summary">
        <div className="message-header">
          <span className="message-role">Summary</span>
        </div>
        <div className="message-body">{message.content}</div>
      </div>
    )
  }

  const isUser = message.type === 'user'
  const roleClass = isUser ? 'message-user' : 'message-assistant'
  const roleLabel = isUser ? 'User' : 'Assistant'

  const toggleTool = (idx: number) => {
    setExpandedTools(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  // Separate agent calls from regular tool calls
  const agentCalls = message.toolCalls?.filter(isAgentToolCall) ?? []
  const regularCalls = message.toolCalls?.filter(tc => !isAgentToolCall(tc)) ?? []

  return (
    <div className={`message ${roleClass}`}>
      <div className="message-header">
        <span className="message-role">{roleLabel}</span>
        {message.timestamp && <span className="message-time">{formatTime(message.timestamp)}</span>}
        {message.model && <span className="message-model">{message.model.replace('claude-', '').replace(/-\d{8}$/, '')}</span>}
        {message.tokenUsage && (
          <span className="message-tokens">
            {(message.tokenUsage.inputTokens ?? 0).toLocaleString()}in / {(message.tokenUsage.outputTokens ?? 0).toLocaleString()}out
          </span>
        )}
      </div>
      {message.content.trim() && (() => {
        const truncatable = shouldTruncate(message.content)
        const isTruncated = truncatable && !contentExpanded
        return (
          <div
            className={`message-body ${isTruncated ? 'message-body-truncated' : ''} ${truncatable ? 'message-body-clickable' : ''}`}
            onClick={truncatable ? () => setContentExpanded(!contentExpanded) : undefined}
          >
            <pre className="message-text">{message.content}</pre>
          </div>
        )
      })()}
      {message.thinkingContent && (
        <div className="message-extra">
          <button className="toggle-btn" onClick={() => setShowThinking(!showThinking)}>
            {showThinking ? '\u25BC Thinking' : '\u25B6 Thinking'}
          </button>
          {showThinking && <pre className="thinking-content">{message.thinkingContent}</pre>}
        </div>
      )}
      {agentCalls.map((tc, i) => {
        const desc = tc.input.description as string ?? tc.input.subagent_type as string ?? 'Sub-agent'
        const agentType = tc.input.subagent_type as string
        const prompt = tc.input.prompt as string | undefined
        const globalIdx = message.toolCalls!.indexOf(tc)
        const isExpanded = expandedTools.has(globalIdx)
        return (
          <div
            key={`agent-${i}`}
            className={`agent-prompt-inline ${onAgentClick ? 'agent-prompt-clickable' : ''}`}
            onClick={onAgentClick ? () => onAgentClick(desc) : undefined}
          >
            <div className="agent-prompt-header">
              <span className="agent-type-badge">{agentType}</span>
              <span className="agent-desc">{desc}</span>
            </div>
            {prompt && <pre className="agent-prompt-text">{prompt}</pre>}
            <button className="toggle-btn toggle-btn-small" onClick={() => toggleTool(globalIdx)}>
              {isExpanded ? '\u25BC' : '\u25B6'} Full input
            </button>
            {isExpanded && <pre className="tool-input">{JSON.stringify(tc.input, null, 2)}</pre>}
          </div>
        )
      })}
      {regularCalls.length > 0 && (
        <div className="message-extra">
          <div className="tool-calls-inline">
            {regularCalls.map((tc, i) => {
              const globalIdx = message.toolCalls!.indexOf(tc)
              const isExpanded = expandedTools.has(globalIdx)
              const summary = toolSummary(tc)
              return (
                <div key={i} className="tool-call-item">
                  <button className="toggle-btn" onClick={() => toggleTool(globalIdx)}>
                    {isExpanded ? '\u25BC' : '\u25B6'}{' '}
                    <span className="tool-name-label">{tc.name}</span>
                    {summary && <span className="tool-summary">{summary}</span>}
                  </button>
                  {isExpanded && <pre className="tool-input">{JSON.stringify(tc.input, null, 2)}</pre>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
