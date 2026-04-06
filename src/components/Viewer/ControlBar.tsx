import React, { useState, useCallback } from 'react'

interface ControlBarProps {
  viewMode: 'compact' | 'detailed'
  onViewModeChange: (mode: 'compact' | 'detailed') => void
  sortOrder: 'oldest' | 'newest'
  onSortOrderChange: (order: 'oldest' | 'newest') => void
  sessionId: string
  onExport?: () => void
}

export function ControlBar({
  viewMode, onViewModeChange,
  sortOrder, onSortOrderChange,
  sessionId, onExport,
}: ControlBarProps) {
  const [copied, setCopied] = useState(false)
  const resumeCmd = `claude -r ${sessionId}`

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(resumeCmd)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [resumeCmd])

  return (
    <div className="control-bar">
      <div className="control-bar-left">
        <div className="toggle-group">
          <button
            className={`toggle-group-btn ${viewMode === 'compact' ? 'active' : ''}`}
            onClick={() => onViewModeChange('compact')}
          >Compact</button>
          <button
            className={`toggle-group-btn ${viewMode === 'detailed' ? 'active' : ''}`}
            onClick={() => onViewModeChange('detailed')}
          >Detailed</button>
        </div>
        <button
          className="sort-btn"
          onClick={() => onSortOrderChange(sortOrder === 'oldest' ? 'newest' : 'oldest')}
          title={sortOrder === 'oldest' ? 'Showing oldest first' : 'Showing newest first'}
        >
          {sortOrder === 'oldest' ? '\u2191 Oldest' : '\u2193 Newest'}
        </button>
      </div>

      <div className="control-bar-right">
        <div
          className={`resume-cmd ${copied ? 'resume-cmd-copied' : ''}`}
          onClick={handleCopy}
          title="Click to copy resume command"
        >
          {copied ? 'Copied!' : resumeCmd}
          {!copied && <span className="copy-icon">&#128203;</span>}
        </div>
        {onExport && (
          <button className="control-bar-action-btn" onClick={onExport}>Export</button>
        )}
      </div>
    </div>
  )
}
