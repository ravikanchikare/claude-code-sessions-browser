import React, { useState } from 'react'
import { exportSessions } from '../../api.js'

interface ExportDialogProps {
  rootId: string
  projectId?: string
  sessionIds?: string[]
  onClose: () => void
}

export function ExportDialog({ rootId, projectId, sessionIds, onClose }: ExportDialogProps) {
  const [format, setFormat] = useState<'markdown' | 'json'>('markdown')
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scope = sessionIds && sessionIds.length > 0
    ? `${sessionIds.length} session${sessionIds.length !== 1 ? 's' : ''}`
    : projectId
      ? 'all sessions in project'
      : 'all sessions in root'

  const handleExport = async () => {
    setExporting(true)
    setError(null)
    try {
      const blob = await exportSessions(rootId, projectId, sessionIds, format)
      const ext = format === 'json' ? 'json' : 'md'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `claude-sessions-export.${ext}`
      a.click()
      URL.revokeObjectURL(url)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="export-overlay" onClick={onClose}>
      <div className="export-dialog" onClick={e => e.stopPropagation()}>
        <h3>Export Sessions</h3>
        <p className="export-scope">Scope: {scope}</p>

        <div className="export-format">
          <label>
            <input type="radio" name="format" value="markdown" checked={format === 'markdown'} onChange={() => setFormat('markdown')} />
            Markdown (human messages + assistant text)
          </label>
          <label>
            <input type="radio" name="format" value="json" checked={format === 'json'} onChange={() => setFormat('json')} />
            JSON (structured data)
          </label>
        </div>

        {error && <p className="export-error">{error}</p>}

        <div className="export-actions">
          <button onClick={handleExport} disabled={exporting}>
            {exporting ? 'Exporting...' : 'Export'}
          </button>
          <button onClick={onClose} className="cancel-btn">Cancel</button>
        </div>
      </div>
    </div>
  )
}
