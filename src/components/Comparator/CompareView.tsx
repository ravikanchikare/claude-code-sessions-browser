import React, { useState, useEffect } from 'react'
import type { ParsedConversation } from '../../types.js'
import { CompareColumn } from './CompareColumn.js'
import * as api from '../../api.js'

interface CompareViewProps {
  selections: Array<{ rootId: string; projectId: string; sessionId: string }>
  onRemoveSelection: (sessionId: string) => void
  onExport?: () => void
}

export function CompareView({ selections, onRemoveSelection, onExport }: CompareViewProps) {
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

  if (selections.length === 0) {
    return <div className="viewer-empty">Select sessions in the sidebar to compare (max 2)</div>
  }

  return (
    <div className="compare-view">
      <div className="compare-header">
        <h2>Comparing {selections.length} session{selections.length !== 1 ? 's' : ''}</h2>
        {onExport && <button className="export-btn" onClick={onExport}>Export Selected</button>}
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
