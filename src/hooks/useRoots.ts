import { useState, useEffect, useCallback } from 'react'
import type { RootInfo } from '../types.js'
import * as api from '../api.js'

export function useRoots() {
  const [roots, setRoots] = useState<RootInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getRoots()
      setRoots(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load roots')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const addRoot = useCallback(async (path: string, label?: string) => {
    await api.addRoot(path, label)
    await refresh()
  }, [refresh])

  const removeRoot = useCallback(async (rootId: string) => {
    await api.removeRoot(rootId)
    await refresh()
  }, [refresh])

  return { roots, loading, error, refresh, addRoot, removeRoot }
}
