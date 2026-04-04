import React, { useState, useCallback } from 'react'
import { Sidebar } from './components/Sidebar/Sidebar.js'
import { ConversationViewer } from './components/Viewer/ConversationViewer.js'
import { CompareView } from './components/Comparator/CompareView.js'
import { ExportDialog } from './components/Export/ExportDialog.js'
import { MoveDialog } from './components/MoveDialog.js'
import { useRoots } from './hooks/useRoots.js'
import { useMessages } from './hooks/useMessages.js'
import { usePinnedProjects } from './hooks/usePinnedProjects.js'
import * as api from './api.js'
import type { CompareSelection } from './types.js'

export function App() {
  const { roots, addRoot, removeRoot } = useRoots()
  const { conversation, loading, error, load, clear } = useMessages()
  const { isPinned, togglePin } = usePinnedProjects()

  const [activeRootId, setActiveRootId] = useState<string | null>(null)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  const [compareMode, setCompareMode] = useState(false)
  const [compareSelections, setCompareSelections] = useState<CompareSelection[]>([])

  const [showExport, setShowExport] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [moveDialog, setMoveDialog] = useState<{
    mode: 'session' | 'project'
    rootId: string
    projectId: string
    sessionId?: string
    itemTitle: string
  } | null>(null)

  const handleSelectSession = useCallback((rootId: string, projectId: string, sessionId: string) => {
    setActiveRootId(rootId)
    setActiveProjectId(projectId)
    setActiveSessionId(sessionId)
    if (!compareMode) {
      load(rootId, projectId, sessionId)
    }
  }, [compareMode, load])

  const compareSessionIds = new Set(compareSelections.map(s => s.sessionId))

  const handleCompareToggle = useCallback((sessionId: string) => {
    setCompareSelections(prev => {
      const existing = prev.find(s => s.sessionId === sessionId)
      if (existing) {
        return prev.filter(s => s.sessionId !== sessionId)
      }
      if (prev.length >= 3) return prev // max 3
      if (!activeRootId || !activeProjectId) return prev
      return [...prev, { rootId: activeRootId, projectId: activeProjectId, sessionId }]
    })
  }, [activeRootId, activeProjectId])

  const handleToggleCompareMode = useCallback(() => {
    setCompareMode(prev => {
      if (prev) {
        setCompareSelections([])
      }
      return !prev
    })
  }, [])

  const handleRemoveCompareSelection = useCallback((sessionId: string) => {
    setCompareSelections(prev => prev.filter(s => s.sessionId !== sessionId))
  }, [])

  const handleDeleteSession = useCallback(async (rootId: string, projectId: string, sessionId: string) => {
    try {
      await api.deleteSession(rootId, projectId, sessionId)
      if (activeSessionId === sessionId) {
        setActiveSessionId(null)
        clear()
      }
      setCompareSelections(prev => prev.filter(s => s.sessionId !== sessionId))
    } catch {
      // deletion failed silently — the ProjectNode already removed it from its local list,
      // but the file still exists; a refresh will restore it
    }
  }, [activeSessionId, clear])

  const handleMoveSession = useCallback((rootId: string, projectId: string, sessionId: string, sessionTitle: string) => {
    setMoveDialog({ mode: 'session', rootId, projectId, sessionId, itemTitle: sessionTitle })
  }, [])

  const handleMoveProject = useCallback((rootId: string, projectId: string, projectName: string) => {
    setMoveDialog({ mode: 'project', rootId, projectId, itemTitle: projectName })
  }, [])

  const handleMoveConfirm = useCallback(async (target: { targetProjectId?: string; targetRootId?: string }) => {
    if (!moveDialog) return
    if (moveDialog.mode === 'session' && moveDialog.sessionId && target.targetProjectId) {
      await api.moveSession(moveDialog.rootId, moveDialog.projectId, moveDialog.sessionId, target.targetProjectId)
      if (activeSessionId === moveDialog.sessionId) {
        setActiveSessionId(null)
        clear()
      }
    } else if (moveDialog.mode === 'project' && target.targetRootId) {
      await api.moveProject(moveDialog.rootId, moveDialog.projectId, target.targetRootId)
      if (activeProjectId === moveDialog.projectId) {
        setActiveSessionId(null)
        setActiveProjectId(null)
        clear()
      }
    }
    setRefreshTrigger(prev => prev + 1)
  }, [moveDialog, activeSessionId, activeProjectId, clear])

  return (
    <div className="app">
      <Sidebar
        roots={roots}
        isPinned={isPinned}
        onTogglePin={togglePin}
        activeRootId={activeRootId}
        activeProjectId={activeProjectId}
        activeSessionId={activeSessionId}
        compareSelections={compareSessionIds}
        compareMode={compareMode}
        onSelectSession={handleSelectSession}
        onCompareToggle={handleCompareToggle}
        onToggleCompareMode={handleToggleCompareMode}
        onDeleteSession={handleDeleteSession}
        onAddRoot={addRoot}
        onRemoveRoot={removeRoot}
        onMoveSession={handleMoveSession}
        onMoveProject={handleMoveProject}
        refreshTrigger={refreshTrigger}
      />

      <main className="main-content">
        {compareMode ? (
          <CompareView
            selections={compareSelections}
            onRemoveSelection={handleRemoveCompareSelection}
            onExport={() => setShowExport(true)}
          />
        ) : (
          <ConversationViewer
            conversation={conversation}
            loading={loading}
            error={error}
            onExport={conversation ? () => setShowExport(true) : undefined}
          />
        )}
      </main>

      {showExport && activeRootId && (
        <ExportDialog
          rootId={activeRootId}
          projectId={activeProjectId ?? undefined}
          sessionIds={compareMode
            ? compareSelections.map(s => s.sessionId)
            : activeSessionId ? [activeSessionId] : undefined}
          onClose={() => setShowExport(false)}
        />
      )}

      {moveDialog && (
        <MoveDialog
          mode={moveDialog.mode}
          rootId={moveDialog.rootId}
          projectId={moveDialog.projectId}
          sessionId={moveDialog.sessionId}
          itemTitle={moveDialog.itemTitle}
          roots={roots}
          onConfirm={handleMoveConfirm}
          onClose={() => setMoveDialog(null)}
        />
      )}
    </div>
  )
}
