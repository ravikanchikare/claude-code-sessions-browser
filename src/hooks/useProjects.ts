import { useState, useEffect, useCallback } from 'react'
import type { ProjectInfo } from '../types.js'
import * as api from '../api.js'

export function useProjects(rootId: string | null) {
  const [projects, setProjects] = useState<ProjectInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!rootId) { setProjects([]); return }
    setLoading(true)
    setError(null)
    try {
      const data = await api.getProjects(rootId)
      setProjects(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  }, [rootId])

  useEffect(() => { refresh() }, [refresh])

  return { projects, loading, error, refresh }
}
