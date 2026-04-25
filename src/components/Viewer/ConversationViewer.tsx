import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Pencil1Icon, ClipboardIcon, Cross2Icon } from '@radix-ui/react-icons'
import type { ParsedConversation, NormalizedMessage, SessionInfo } from '../../types.js'
import { formatTurnPairCopy, formatFullSessionTranscript, filterMessagesForTranscript } from '../../lib/turnPairCopy.js'
import { TurnRow } from './TurnRow.js'
import { Badge } from '../common/Badge.js'

interface ConversationViewerProps {
  conversation: ParsedConversation | null
  loading: boolean
  error: string | null
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

interface CheckpointData {
  index: number
  userMessage: NormalizedMessage
  intermediates: NormalizedMessage[]
  finalResponse: NormalizedMessage | null
  trailing: NormalizedMessage[]
}

/** If the turn never got an assistant with stopReason end_turn, treat the last assistant as the pair end (legacy / incomplete data). */
function promoteLastAssistantIfNoFinal(c: CheckpointData) {
  if (c.finalResponse) return
  for (let i = c.intermediates.length - 1; i >= 0; i--) {
    const m = c.intermediates[i]
    if (m.type === 'assistant') {
      c.finalResponse = m
      c.intermediates.splice(i, 1)
      break
    }
  }
}

/**
 * turn_pair: one user message through the assistant’s closing message with stopReason "end_turn"
 * (or the last assistant in the segment when end_turn is absent).
 */
function buildCheckpoints(messages: NormalizedMessage[]): { orphans: NormalizedMessage[]; checkpoints: CheckpointData[] } {
  const orphans: NormalizedMessage[] = []
  const checkpoints: CheckpointData[] = []
  let current: CheckpointData | null = null
  let idx = 0

  const flush = () => {
    if (current) {
      promoteLastAssistantIfNoFinal(current)
      checkpoints.push(current)
    }
    current = null
  }

  for (const msg of messages) {
    if (msg.type === 'user') {
      // Merge consecutive user messages (e.g., images + text sent together)
      if (current && !current.finalResponse && current.intermediates.length === 0 && current.trailing.length === 0) {
        const mergedAttachments = [...(current.userMessage.attachments ?? []), ...(msg.attachments ?? [])]
        current.userMessage = {
          ...current.userMessage,
          content: [current.userMessage.content, msg.content].filter(Boolean).join('\n'),
          attachments: mergedAttachments.length > 0 ? mergedAttachments : undefined,
        }
      } else {
        flush()
        idx++
        current = { index: idx, userMessage: msg, intermediates: [], finalResponse: null, trailing: [] }
      }
    } else if (current) {
      if (current.finalResponse) {
        current.trailing.push(msg)
      } else if (msg.type === 'assistant') {
        if (msg.stopReason === 'end_turn') {
          current.finalResponse = msg
        } else {
          current.intermediates.push(msg)
        }
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
        <span className="title-edit-icon" onClick={() => setEditing(true)} title="Rename session"><Pencil1Icon width={13} height={13} /></span>
      )}
    </h2>
  )
}

function ResumeCmd({ sessionId }: { sessionId: string }) {
  const [copied, setCopied] = useState(false)
  const cmd = `claude -r ${sessionId}`
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(cmd)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [cmd])

  return (
    <div
      className={`resume-cmd ${copied ? 'resume-cmd-copied' : ''}`}
      onClick={handleCopy}
      title="Click to copy resume command"
    >
      {copied ? 'Copied!' : cmd}
      {!copied && <span className="copy-icon"><ClipboardIcon width={13} height={13} /></span>}
    </div>
  )
}

function TurnList({ conversation, onAgentClick, onRewind, onBranch }: {
  conversation: ParsedConversation
  onAgentClick?: (description: string) => void
  onRewind?: (uuid: string) => void
  onBranch?: (uuid: string) => void
}) {
  const filtered = filterMessagesForTranscript(conversation.messages)
  const { orphans, checkpoints } = useMemo(() => buildCheckpoints(filtered), [filtered])

  // Newest first
  const reversed = useMemo(() => [...checkpoints].reverse(), [checkpoints])

  return (
    <div className="viewer-messages">
      {reversed.map((cp, idx) => (
        <TurnRow
          key={cp.userMessage.uuid ?? `cp-${cp.index}`}
          index={cp.index}
          userMessage={cp.userMessage}
          intermediates={cp.intermediates}
          finalResponse={cp.finalResponse}
          trailing={cp.trailing}
          turnCopyText={formatTurnPairCopy(cp.userMessage, cp.intermediates, cp.finalResponse)}
          defaultExpanded={false}
          isLatest={idx === 0}
          onAgentClick={onAgentClick}
          onRewind={onRewind}
          onBranch={onBranch}
        />
      ))}
      {orphans.map((msg, i) => (
        <div key={msg.uuid ?? `orphan-${i}`} className="turn-orphan">
          <span className="turn-orphan-text">{msg.content}</span>
        </div>
      ))}
    </div>
  )
}

export function ConversationViewer({
  conversation, loading, error,
  childSessions, activeSubAgentId,
  subConversation, subLoading, subError,
  onSelectSubAgent, onCloseSubAgent,
  onRename, renameRequested, onRewind, onBranch,
}: ConversationViewerProps) {
  const descriptionToChild = useMemo(() => {
    const map = new Map<string, string>()
    if (childSessions) {
      for (const child of childSessions) {
        if (child.agentDescription) map.set(child.agentDescription, child.id)
      }
    }
    return map
  }, [childSessions])

  const handleAgentClick = useMemo(() => {
    if (!onSelectSubAgent || !childSessions?.length) return undefined
    return (description: string) => {
      const childId = descriptionToChild.get(description)
      if (childId) onSelectSubAgent(childId)
    }
  }, [onSelectSubAgent, childSessions, descriptionToChild])

  const sessionTranscriptText = useMemo(
    () => formatFullSessionTranscript(conversation?.messages ?? []),
    [conversation],
  )
  const handleCopySessionTranscript = useCallback(() => {
    void navigator.clipboard.writeText(sessionTranscriptText)
  }, [sessionTranscriptText])

  if (loading) return <div className="viewer-empty">Loading conversation...</div>
  if (error) return <div className="viewer-empty viewer-error">{error}</div>
  if (!conversation) return <div className="viewer-empty">Select a session to view its conversation</div>

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
  const activeSubAgent = childSessions?.find(c => c.id === activeSubAgentId)
  const subAgentTitle = activeSubAgent?.agentDescription ?? activeSubAgent?.agentId ?? 'Sub-agent'

  return (
    <div className="viewer">
      <div className="viewer-header">
        <div className="viewer-header-top">
          <EditableTitle title={title} onRename={onRename} editTrigger={renameRequested} />
          <div className="viewer-header-actions">
            <ResumeCmd sessionId={conversation.sessionId} />
            <button
              type="button"
              className="viewer-icon-btn"
              onClick={handleCopySessionTranscript}
              aria-label="Copy transcript"
              title="Copy full session transcript (User / Claude / Claude Summary, chronological order)"
            >
              <ClipboardIcon width={14} height={14} />
            </button>
          </div>
        </div>
        <div className="viewer-meta">
          <div className="viewer-meta-left">
            <Badge label="Model" value={metadata.model?.replace('claude-', '').replace(/-\d{8}$/, '')} className="badge-model" />
            <Badge label="Messages" value={`${userMessages}u / ${assistantMessages}a`} className="badge-messages" />
            <Badge label="Tokens" value={metadata.totalInputTokens ? `${metadata.totalInputTokens.toLocaleString()} in / ${metadata.totalOutputTokens.toLocaleString()} out` : null} className="badge-tokens" />
          </div>
          <div className="viewer-meta-right">
            <Badge label="Branch" value={metadata.gitBranch} />
            <Badge label="Version" value={metadata.version} />
            <Badge label="Last active" value={formatDate(metadata.lastTimestamp)} />
          </div>
        </div>
      </div>
      <div className="viewer-body">
        <div className={`viewer-body-main ${hasSubAgent ? 'viewer-body-main-split' : ''}`}>
          <TurnList
            conversation={conversation}
            onAgentClick={handleAgentClick}
            onRewind={onRewind}
            onBranch={onBranch}
          />
        </div>
        {hasSubAgent && (
          <div className="viewer-body-sub">
            <div className="subagent-panel-header">
              <span className="subagent-panel-title">{subAgentTitle}</span>
              <button className="subagent-close-btn" onClick={onCloseSubAgent} title="Close sub-agent panel"><Cross2Icon width={12} height={12} /></button>
            </div>
            {subLoading ? (
              <div className="viewer-empty">Loading sub-agent...</div>
            ) : subError ? (
              <div className="viewer-empty viewer-error">{subError}</div>
            ) : subConversation ? (
              <TurnList conversation={subConversation} />
            ) : (
              <div className="viewer-empty">Select a sub-agent</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
