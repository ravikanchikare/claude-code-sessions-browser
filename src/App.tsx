import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Sidebar } from './components/Sidebar/Sidebar.js'
import { ResizeHandle } from './components/Sidebar/ResizeHandle.js'
import { ConversationViewer } from './components/Viewer/ConversationViewer.js'
import { CompareView } from './components/Comparator/CompareView.js'
import { MoveDialog } from './components/MoveDialog.js'
import { useRoots } from './hooks/useRoots.js'
import { useMessages } from './hooks/useMessages.js'
import { usePinnedProjects } from './hooks/usePinnedProjects.js'
import * as api from './api.js'
import type { CompareSelection, SessionInfo } from './types.js'

function parseHash(): { rootId: string | null; projectId: string | null; sessionId: string | null } {
  const hash = window.location.hash.slice(1)
  if (!hash) return { rootId: null, projectId: null, sessionId: null }
  const params = new URLSearchParams(hash)
  return {
    rootId: params.get('root'),
    projectId: params.get('project'),
    sessionId: params.get('session'),
  }
}

function updateHash(rootId: string | null, projectId: string | null, sessionId: string | null) {
  if (rootId && projectId && sessionId) {
    const params = new URLSearchParams({ root: rootId, project: projectId, session: sessionId })
    history.replaceState(null, '', `#${params.toString()}`)
  } else {
    history.replaceState(null, '', window.location.pathname)
  }
}

export function App() {
  const { roots, addRoot, removeRoot } = useRoots()
  const { conversation, loading, error, load, clear } = useMessages()
  const { conversation: subConversation, loading: subLoading, error: subError, load: subLoad, clear: subClear } = useMessages()
  const { isPinned, togglePin } = usePinnedProjects()
  const initializedRef = useRef(false)

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebarWidth')
    return saved ? Number(saved) : 340
  })
  const handleSidebarResize = useCallback((w: number) => {
    setSidebarWidth(w)
    localStorage.setItem('sidebarWidth', String(w))
  }, [])

  const [activeRootId, setActiveRootId] = useState<string | null>(null)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [activeSubAgentId, setActiveSubAgentId] = useState<string | null>(null)
  const [childSessions, setChildSessions] = useState<SessionInfo[]>([])

  const [compareMode, setCompareMode] = useState(false)
  const [compareSelections, setCompareSelections] = useState<CompareSelection[]>([])

  const [renameRequested, setRenameRequested] = useState(0)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [moveDialog, setMoveDialog] = useState<{
    mode: 'session' | 'project'
    rootId: string
    projectId: string
    sessionId?: string
    itemTitle: string
  } | null>(null)

  // Fetch child sessions when active session changes
  useEffect(() => {
    if (!activeRootId || !activeProjectId || !activeSessionId) {
      setChildSessions([])
      return
    }
    api.getSessions(activeRootId, activeProjectId).then(sessions => {
      const parent = sessions.find(s => s.id === activeSessionId)
      if (parent?.childSessionIds?.length) {
        const children = sessions.filter(s => parent.childSessionIds.includes(s.id))
        setChildSessions(children)
      } else {
        setChildSessions([])
      }
    }).catch(() => setChildSessions([]))
  }, [activeRootId, activeProjectId, activeSessionId])

  // Restore from URL hash or auto-select most recent session on first load
  useEffect(() => {
    if (initializedRef.current || roots.length === 0) return
    initializedRef.current = true

    const { rootId, projectId, sessionId } = parseHash()
    if (rootId && projectId && sessionId) {
      setActiveRootId(rootId)
      setActiveProjectId(projectId)
      setActiveSessionId(sessionId)
      load(rootId, projectId, sessionId)
      return
    }

    // No hash — auto-select the most recent session
    ;(async () => {
      for (const root of roots) {
        try {
          const projects = await api.getProjects(root.id)
          projects.sort((a, b) => {
            if (a.lastActivity && b.lastActivity) return b.lastActivity.localeCompare(a.lastActivity)
            if (a.lastActivity) return -1
            if (b.lastActivity) return 1
            return 0
          })
          for (const project of projects) {
            const sessions = await api.getSessions(root.id, project.id)
            const topSession = sessions
              .filter(s => !s.isSubAgent)
              .sort((a, b) => {
                const ta = a.lastTimestamp ?? a.timestamp
                const tb = b.lastTimestamp ?? b.timestamp
                if (ta && tb) return tb.localeCompare(ta)
                if (ta) return -1
                if (tb) return 1
                return 0
              })[0]
            if (topSession) {
              setActiveRootId(root.id)
              setActiveProjectId(project.id)
              setActiveSessionId(topSession.id)
              load(root.id, project.id, topSession.id)
              updateHash(root.id, project.id, topSession.id)
              return
            }
          }
        } catch { /* skip root */ }
      }
    })()
  }, [roots, load])

  const handleSelectSession = useCallback((rootId: string, projectId: string, sessionId: string) => {
    setActiveRootId(rootId)
    setActiveProjectId(projectId)
    setActiveSessionId(sessionId)
    setActiveSubAgentId(null)
    subClear()
    if (!compareMode) {
      load(rootId, projectId, sessionId)
      updateHash(rootId, projectId, sessionId)
    }
  }, [compareMode, load, subClear])

  const handleSelectSubAgent = useCallback((rootId: string, projectId: string, parentSessionId: string, childSessionId: string) => {
    if (activeSessionId !== parentSessionId) {
      setActiveRootId(rootId)
      setActiveProjectId(projectId)
      setActiveSessionId(parentSessionId)
      load(rootId, projectId, parentSessionId)
    }
    setActiveSubAgentId(childSessionId)
    subLoad(rootId, projectId, childSessionId)
  }, [activeSessionId, load, subLoad])

  const handleSelectSubAgentById = useCallback((childSessionId: string) => {
    if (!activeRootId || !activeProjectId || !activeSessionId) return
    setActiveSubAgentId(childSessionId)
    subLoad(activeRootId, activeProjectId, childSessionId)
  }, [activeRootId, activeProjectId, activeSessionId, subLoad])

  const handleCloseSubAgent = useCallback(() => {
    setActiveSubAgentId(null)
    subClear()
  }, [subClear])

  const compareSessionIds = new Set(compareSelections.map(s => s.sessionId))

  const handleCompareToggle = useCallback((rootId: string, projectId: string, sessionId: string) => {
    setCompareSelections(prev => {
      const existing = prev.find(s => s.sessionId === sessionId)
      if (existing) {
        return prev.filter(s => s.sessionId !== sessionId)
      }
      if (prev.length >= 2) return prev
      return [...prev, { rootId, projectId, sessionId }]
    })
  }, [])

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
        setActiveSubAgentId(null)
        clear()
        subClear()
      }
      setCompareSelections(prev => prev.filter(s => s.sessionId !== sessionId))
    } catch {
      // deletion failed silently
    }
  }, [activeSessionId, clear, subClear])

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
        setActiveSubAgentId(null)
        clear()
        subClear()
      }
    } else if (moveDialog.mode === 'project' && target.targetRootId) {
      await api.moveProject(moveDialog.rootId, moveDialog.projectId, target.targetRootId)
      if (activeProjectId === moveDialog.projectId) {
        setActiveSessionId(null)
        setActiveProjectId(null)
        setActiveSubAgentId(null)
        clear()
        subClear()
      }
    }
    setRefreshTrigger(prev => prev + 1)
  }, [moveDialog, activeSessionId, activeProjectId, clear, subClear])

  const handleRenameFromSidebar = useCallback((rootId: string, projectId: string, sessionId: string) => {
    // Select the session first, then trigger rename mode
    setActiveRootId(rootId)
    setActiveProjectId(projectId)
    setActiveSessionId(sessionId)
    setActiveSubAgentId(null)
    subClear()
    load(rootId, projectId, sessionId)
    setRenameRequested(prev => prev + 1)
  }, [load, subClear])

  const handleRename = useCallback(async (newTitle: string) => {
    if (!activeRootId || !activeProjectId || !activeSessionId) return
    await api.renameSession(activeRootId, activeProjectId, activeSessionId, newTitle)
    setRefreshTrigger(prev => prev + 1)
    load(activeRootId, activeProjectId, activeSessionId)
  }, [activeRootId, activeProjectId, activeSessionId, load])

  const handleRewind = useCallback(async (targetMessageUuid: string) => {
    if (!activeRootId || !activeProjectId || !activeSessionId) return
    const ok = window.confirm('Rewind is destructive. All messages after this checkpoint will be permanently deleted. Continue?')
    if (!ok) return
    await api.rewindSession(activeRootId, activeProjectId, activeSessionId, targetMessageUuid)
    setRefreshTrigger(prev => prev + 1)
    load(activeRootId, activeProjectId, activeSessionId)
  }, [activeRootId, activeProjectId, activeSessionId, load])

  const handleBranch = useCallback(async (targetMessageUuid: string) => {
    if (!activeRootId || !activeProjectId || !activeSessionId) return
    const result = await api.branchSession(activeRootId, activeProjectId, activeSessionId, targetMessageUuid)
    setRefreshTrigger(prev => prev + 1)
    setActiveSessionId(result.newSessionId)
    load(activeRootId, activeProjectId, result.newSessionId)
  }, [activeRootId, activeProjectId, activeSessionId, load])

  return (
    <div className="app">
      <Sidebar
        style={{ width: sidebarWidth, minWidth: sidebarWidth }}
        roots={roots}
        isPinned={isPinned}
        onTogglePin={togglePin}
        activeRootId={activeRootId}
        activeProjectId={activeProjectId}
        activeSessionId={activeSessionId}
        activeSubAgentId={activeSubAgentId}
        compareSelections={compareSessionIds}
        compareMode={compareMode}
        onSelectSession={handleSelectSession}
        onSelectSubAgent={handleSelectSubAgent}
        onCompareToggle={handleCompareToggle}
        onToggleCompareMode={handleToggleCompareMode}
        onDeleteSession={handleDeleteSession}
        onAddRoot={addRoot}
        onRemoveRoot={removeRoot}
        onMoveSession={handleMoveSession}
        onMoveProject={handleMoveProject}
        onRenameSession={handleRenameFromSidebar}
        refreshTrigger={refreshTrigger}
      />

      <ResizeHandle onResize={handleSidebarResize} />

      <main className="main-content">
        {compareMode ? (
          <CompareView
            selections={compareSelections}
            onRemoveSelection={handleRemoveCompareSelection}
          />
        ) : (
          <ConversationViewer
            conversation={conversation}
            loading={loading}
            error={error}
            childSessions={childSessions}
            activeSubAgentId={activeSubAgentId}
            subConversation={subConversation}
            subLoading={subLoading}
            subError={subError}
            onSelectSubAgent={handleSelectSubAgentById}
            onCloseSubAgent={handleCloseSubAgent}
            onRename={handleRename}
            renameRequested={renameRequested}
            onRewind={handleRewind}
            onBranch={handleBranch}
          />
        )}
      </main>

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
