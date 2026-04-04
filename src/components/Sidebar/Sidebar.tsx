import React, { useState } from 'react'
import type { RootInfo } from '../../types.js'
import { RootNode } from './RootNode.js'

interface SidebarProps {
  roots: RootInfo[]
  isPinned: (rootId: string, projectId: string) => boolean
  onTogglePin: (rootId: string, projectId: string) => void
  activeRootId: string | null
  activeProjectId: string | null
  activeSessionId: string | null
  compareSelections: Set<string>
  compareMode: boolean
  onSelectSession: (rootId: string, projectId: string, sessionId: string) => void
  onCompareToggle: (sessionId: string) => void
  onToggleCompareMode: () => void
  onDeleteSession: (rootId: string, projectId: string, sessionId: string) => void
  onAddRoot: (path: string) => void
  onRemoveRoot: (rootId: string) => void
  onMoveSession?: (rootId: string, projectId: string, sessionId: string, sessionTitle: string) => void
  onMoveProject?: (rootId: string, projectId: string, projectName: string) => void
  refreshTrigger?: number
}

export function Sidebar({
  roots, isPinned, onTogglePin,
  activeRootId, activeProjectId, activeSessionId,
  compareSelections, compareMode,
  onSelectSession, onCompareToggle, onToggleCompareMode,
  onDeleteSession, onAddRoot, onRemoveRoot,
  onMoveSession, onMoveProject, refreshTrigger,
}: SidebarProps) {
  const [addingRoot, setAddingRoot] = useState(false)
  const [newRootPath, setNewRootPath] = useState('')

  const handleAddRoot = () => {
    if (newRootPath.trim()) {
      onAddRoot(newRootPath.trim())
      setNewRootPath('')
      setAddingRoot(false)
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>Sessions</h2>
        <div className="sidebar-actions">
          <button
            className={`compare-mode-btn ${compareMode ? 'active' : ''}`}
            onClick={onToggleCompareMode}
            title={compareMode ? 'Exit compare mode' : 'Compare sessions'}
          >
            {compareMode ? 'Exit Compare' : 'Compare'}
          </button>
          <button className="add-root-btn" onClick={() => setAddingRoot(!addingRoot)} title="Add root folder">
            +
          </button>
        </div>
      </div>

      {addingRoot && (
        <div className="add-root-form">
          <input
            type="text"
            value={newRootPath}
            onChange={e => setNewRootPath(e.target.value)}
            placeholder="/path/to/.claude"
            onKeyDown={e => e.key === 'Enter' && handleAddRoot()}
            autoFocus
          />
          <button onClick={handleAddRoot}>Add</button>
          <button onClick={() => setAddingRoot(false)}>Cancel</button>
        </div>
      )}

      {compareMode && compareSelections.size > 0 && (
        <div className="compare-info">
          {compareSelections.size} session{compareSelections.size !== 1 ? 's' : ''} selected (max 3)
        </div>
      )}

      <div className="sidebar-tree">
        {roots.map(root => (
          <RootNode
            key={root.id}
            root={root}
            isPinned={(projectId) => isPinned(root.id, projectId)}
            onTogglePin={(projectId) => onTogglePin(root.id, projectId)}
            activeSessionId={activeRootId === root.id ? activeSessionId : null}
            activeProjectId={activeRootId === root.id ? activeProjectId : null}
            compareSelections={compareSelections}
            compareMode={compareMode}
            onSelectSession={(projectId, sessionId) => onSelectSession(root.id, projectId, sessionId)}
            onCompareToggle={onCompareToggle}
            onDeleteSession={(projectId, sessionId) => onDeleteSession(root.id, projectId, sessionId)}
            onRemoveRoot={() => onRemoveRoot(root.id)}
            onMoveSession={onMoveSession ? (projectId, sessionId, sessionTitle) => onMoveSession(root.id, projectId, sessionId, sessionTitle) : undefined}
            onMoveProject={onMoveProject ? (projectId, projectName) => onMoveProject(root.id, projectId, projectName) : undefined}
            refreshTrigger={refreshTrigger}
          />
        ))}
        {roots.length === 0 && (
          <div className="empty-state">
            No roots configured. Click + to add a .claude folder.
          </div>
        )}
      </div>
    </aside>
  )
}
