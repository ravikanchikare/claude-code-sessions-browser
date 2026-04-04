import { useState, useCallback } from 'react'
import type { ParsedConversation } from '../types.js'
import * as api from '../api.js'

export function useMessages() {
  const [conversation, setConversation] = useState<ParsedConversation | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (rootId: string, projectId: string, sessionId: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getMessages(rootId, projectId, sessionId)
      setConversation(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load messages')
    } finally {
      setLoading(false)
    }
  }, [])

  const clear = useCallback(() => {
    setConversation(null)
    setError(null)
  }, [])

  return { conversation, loading, error, load, clear }
}
