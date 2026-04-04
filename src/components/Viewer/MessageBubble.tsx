import React, { useState } from 'react'
import type { NormalizedMessage } from '../../types.js'

interface MessageBubbleProps {
  message: NormalizedMessage
  onNavigateAgent?: (agentId: string) => void
}

function formatTime(ts?: string): string {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch { return '' }
}

export function MessageBubble({ message, onNavigateAgent }: MessageBubbleProps) {
  const [showThinking, setShowThinking] = useState(false)
  const [showTools, setShowTools] = useState(false)

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
      <div className="message-body">
        <pre className="message-text">{message.content}</pre>
      </div>
      {message.thinkingContent && (
        <div className="message-extra">
          <button className="toggle-btn" onClick={() => setShowThinking(!showThinking)}>
            {showThinking ? '\u25BC Thinking' : '\u25B6 Thinking'}
          </button>
          {showThinking && <pre className="thinking-content">{message.thinkingContent}</pre>}
        </div>
      )}
      {message.toolCalls && message.toolCalls.length > 0 && (
        <div className="message-extra">
          <button className="toggle-btn" onClick={() => setShowTools(!showTools)}>
            {showTools ? '\u25BC' : '\u25B6'} {message.toolCalls.length} tool call{message.toolCalls.length !== 1 ? 's' : ''}
          </button>
          {showTools && (
            <div className="tool-calls">
              {message.toolCalls.map((tc, i) => {
                const isAgentCall = tc.name === 'Task' || tc.name === 'Agent'
                const agentDesc = isAgentCall ? (tc.input.description as string ?? tc.input.subagent_type as string ?? 'Sub-agent') : null
                const agentType = isAgentCall ? (tc.input.subagent_type as string ?? null) : null
                return (
                  <div key={i} className={`tool-call ${isAgentCall ? 'tool-call-agent' : ''}`}>
                    <div className="tool-call-header">
                      <span className="tool-name">{tc.name}</span>
                      {isAgentCall && agentDesc && (
                        <span className="tool-agent-desc">{agentDesc}</span>
                      )}
                      {isAgentCall && agentType && (
                        <span className="tool-agent-type">{agentType}</span>
                      )}
                    </div>
                    <pre className="tool-input">{JSON.stringify(tc.input, null, 2)}</pre>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
