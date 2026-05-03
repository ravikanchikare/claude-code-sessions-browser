export interface RootInfo {
  id: string
  path: string
  label: string
}

export interface ProjectInfo {
  id: string
  displayName: string
  sessionCount: number
  lastActivity: string | null
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

export interface Attachment {
  type: string       // e.g. "image"
  mediaType?: string // e.g. "image/png"
  fileName?: string  // e.g. "clipboard-2026-04-14.png"
  source?: string    // full path or URL
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
  parentUuid?: string | null
  messageIndex?: number
  attachments?: Attachment[]
}

export interface ParsedConversation {
  sessionId: string
  /** Absolute path to the session JSONL file. */
  filePath?: string
  /** Shorter path for UI (e.g. ~/.claude/projects/...). */
  filePathDisplay?: string
  /** Absolute path to `.../projects/{project-directory}`. */
  projectPath?: string
  projectPathDisplay?: string
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
