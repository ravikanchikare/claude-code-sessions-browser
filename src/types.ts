export interface RootInfo {
  id: string
  path: string
  label: string
}

export interface ProjectInfo {
  id: string
  displayName: string
  sessionCount: number
}

export interface SessionInfo {
  id: string
  filePath: string
  firstPrompt: string
  customTitle: string | null
  summary: string | null
  timestamp: string | null
  lastTimestamp: string | null
  model: string | null
  gitBranch: string | null
  version: string | null
  messageCount: number
  fileSize: number
  // Sub-agent linking
  isSubAgent: boolean
  agentId: string | null
  agentDescription: string | null
  parentSessionId: string | null
  childSessionIds: string[]
}

export interface NormalizedMessage {
  type: 'user' | 'assistant' | 'system' | 'summary'
  uuid?: string
  timestamp?: string
  content: string
  model?: string
  gitBranch?: string
  thinkingContent?: string
  toolCalls?: Array<{ name: string; input: Record<string, unknown> }>
  tokenUsage?: {
    inputTokens?: number
    outputTokens?: number
    cacheCreationTokens?: number
    cacheReadTokens?: number
  }
  stopReason?: string | null
}

export interface ParsedConversation {
  sessionId: string
  customTitle: string | null
  summary: string | null
  messages: NormalizedMessage[]
  metadata: {
    model: string | null
    gitBranch: string | null
    version: string | null
    firstTimestamp: string | null
    lastTimestamp: string | null
    totalInputTokens: number
    totalOutputTokens: number
  }
}

export interface CompareSelection {
  rootId: string
  projectId: string
  sessionId: string
}
