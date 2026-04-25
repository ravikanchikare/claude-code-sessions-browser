import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { ClipboardIcon } from '@radix-ui/react-icons'
import type { ParsedConversation } from '../../types.js'
import { CompareColumn } from './CompareColumn.js'
import { formatFullSessionTranscript } from '../../lib/turnPairCopy.js'
import * as api from '../../api.js'

interface CompareViewProps {
  selections: Array<{ rootId: string; projectId: string; sessionId: string }>
  onRemoveSelection: (sessionId: string) => void
}

function sessionHeading(conv: ParsedConversation): string {
  const { messages, customTitle } = conv
  const title = customTitle ?? messages.find(m => m.type === 'user')?.content.slice(0, 80) ?? 'Untitled'
  return title.trim() || 'Untitled'
}

export function CompareView({ selections, onRemoveSelection }: CompareViewProps) {
  const [conversations, setConversations] = useState<Map<string, ParsedConversation>>(new Map())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (selections.length === 0) return

    setLoading(true)
    const promises = selections.map(async (sel) => {
      if (conversations.has(sel.sessionId)) return
      try {
        const conv = await api.getMessages(sel.rootId, sel.projectId, sel.sessionId)
        setConversations(prev => new Map(prev).set(sel.sessionId, conv))
      } catch { /* skip failed loads */ }
    })

    Promise.all(promises).finally(() => setLoading(false))
  }, [selections])

  const copySelectedText = useMemo(() => {
    const blocks: string[] = []
    for (const sel of selections) {
      const conv = conversations.get(sel.sessionId)
      if (!conv) continue
      const head = sessionHeading(conv)
      const body = formatFullSessionTranscript(conv.messages)
      blocks.push(`=== ${head} (${sel.sessionId}) ===\n\n${body}`)
    }
    return blocks.join('\n\n')
  }, [selections, conversations])

  const allLoaded = selections.length > 0 && selections.every(s => conversations.has(s.sessionId))

  const handleCopySelected = useCallback(() => {
    if (!copySelectedText) return
    void navigator.clipboard.writeText(copySelectedText)
  }, [copySelectedText])

  if (selections.length === 0) {
    return <div className="viewer-empty">Select sessions in the sidebar to compare (max 2)</div>
  }

  return (
    <div className="compare-view">
      <div className="compare-header">
        <h2>Comparing {selections.length} session{selections.length !== 1 ? 's' : ''}</h2>
        <button
          type="button"
          className="compare-copy-btn"
          onClick={handleCopySelected}
          disabled={!allLoaded || !copySelectedText}
          aria-label="Copy transcript"
          title="Copy transcript for each selected session (User / Claude / Claude Summary, separated by session headers)"
        >
          <ClipboardIcon width={14} height={14} />
        </button>
      </div>
      <div className="compare-grid">
        {loading && <div className="loading-text">Loading conversations...</div>}
        {selections.map(sel => {
          const conv = conversations.get(sel.sessionId)
          if (!conv) return null
          return (
            <CompareColumn
              key={sel.sessionId}
              conversation={conv}
              onRemove={() => onRemoveSelection(sel.sessionId)}
            />
          )
        })}
      </div>
    </div>
  )
}
