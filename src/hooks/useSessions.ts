import { useState, useEffect, useCallback } from 'react'
import type { SessionInfo } from '../types.js'
import * as api from '../api.js'

export function useSessions(rootId: string | null, projectId: string | null) {
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!rootId || !projectId) { setSessions([]); return }
    setLoading(true)
    setError(null)
    try {
      const data = await api.getSessions(rootId, projectId)
      setSessions(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }, [rootId, projectId])

  useEffect(() => { refresh() }, [refresh])

  return { sessions, loading, error, refresh }
}
