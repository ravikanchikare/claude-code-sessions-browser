import { useState, useCallback } from 'react'

const STORAGE_KEY = 'claude-session-browser:pinnedProjects'

function loadPinned(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return new Set(JSON.parse(raw))
  } catch { /* ignore */ }
  return new Set()
}

function savePinned(pinned: Set<string>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...pinned]))
}

function makeKey(rootId: string, projectId: string): string {
  return `${rootId}:${projectId}`
}

export function usePinnedProjects() {
  const [pinned, setPinned] = useState<Set<string>>(loadPinned)

  const togglePin = useCallback((rootId: string, projectId: string) => {
    setPinned(prev => {
      const key = makeKey(rootId, projectId)
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      savePinned(next)
      return next
    })
  }, [])

  const isPinned = useCallback((rootId: string, projectId: string): boolean => {
    return pinned.has(makeKey(rootId, projectId))
  }, [pinned])

  return { pinned, togglePin, isPinned }
}
