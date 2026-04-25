import type { RootInfo, ProjectInfo, SessionInfo, ParsedConversation } from './types.js'

const BASE = '/api'

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

export async function getRoots(): Promise<RootInfo[]> {
  return fetchJson(`${BASE}/roots`)
}

export async function addRoot(path: string, label?: string): Promise<RootInfo> {
  return fetchJson(`${BASE}/roots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, label }),
  })
}

export async function removeRoot(rootId: string): Promise<void> {
  await fetch(`${BASE}/roots/${rootId}`, { method: 'DELETE' })
}

export async function getProjects(rootId: string): Promise<ProjectInfo[]> {
  return fetchJson(`${BASE}/roots/${rootId}/projects`)
}

export async function getSessions(rootId: string, projectId: string): Promise<SessionInfo[]> {
  return fetchJson(`${BASE}/roots/${encodeURIComponent(rootId)}/projects/${encodeURIComponent(projectId)}/sessions`)
}

export async function getMessages(rootId: string, projectId: string, sessionId: string, filter?: string): Promise<ParsedConversation> {
  const params = filter ? `?filter=${filter}` : ''
  return fetchJson(`${BASE}/roots/${encodeURIComponent(rootId)}/projects/${encodeURIComponent(projectId)}/sessions/${sessionId}/messages${params}`)
}

export async function deleteSession(rootId: string, projectId: string, sessionId: string): Promise<void> {
  const res = await fetch(`${BASE}/roots/${encodeURIComponent(rootId)}/projects/${encodeURIComponent(projectId)}/sessions/${sessionId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete session')
}

export async function moveSession(rootId: string, projectId: string, sessionId: string, targetProjectId: string): Promise<void> {
  const res = await fetch(`${BASE}/roots/${encodeURIComponent(rootId)}/projects/${encodeURIComponent(projectId)}/sessions/${sessionId}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetProjectId }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? 'Failed to move session')
  }
}

export async function moveProject(rootId: string, projectId: string, targetRootId: string): Promise<void> {
  const res = await fetch(`${BASE}/roots/${encodeURIComponent(rootId)}/projects/${encodeURIComponent(projectId)}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetRootId }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? 'Failed to move project')
  }
}

export async function renameSession(rootId: string, projectId: string, sessionId: string, title: string): Promise<void> {
  const res = await fetch(`${BASE}/roots/${encodeURIComponent(rootId)}/projects/${encodeURIComponent(projectId)}/sessions/${sessionId}/rename`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? 'Failed to rename session')
  }
}

export async function rewindSession(rootId: string, projectId: string, sessionId: string, targetMessageUuid: string): Promise<void> {
  const res = await fetch(`${BASE}/roots/${encodeURIComponent(rootId)}/projects/${encodeURIComponent(projectId)}/sessions/${sessionId}/rewind`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetMessageUuid }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? 'Failed to rewind session')
  }
}

export async function branchSession(rootId: string, projectId: string, sessionId: string, targetMessageUuid: string): Promise<{ newSessionId: string; title: string }> {
  const res = await fetch(`${BASE}/roots/${encodeURIComponent(rootId)}/projects/${encodeURIComponent(projectId)}/sessions/${sessionId}/branch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetMessageUuid }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? 'Failed to branch session')
  }
  return res.json() as Promise<{ newSessionId: string; title: string }>
}

