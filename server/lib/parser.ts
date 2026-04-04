import { readFile } from 'fs/promises'
import { join } from 'path'
import { parseRecord, type ParsedRecord, type UserRecord, type AssistantRecord } from './schemas.js'

// ---------------------------------------------------------------------------
// Types for normalized messages returned to the frontend
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Extract text from user message content
// ---------------------------------------------------------------------------

function extractUserText(content: string | Array<{ type: string; text?: string; [k: string]: unknown }>): string {
  if (typeof content === 'string') return content
  return content
    .filter(block => block.type === 'text' && typeof block.text === 'string')
    .map(block => block.text as string)
    .join('\n')
}

// ---------------------------------------------------------------------------
// Extract text blocks from assistant content
// ---------------------------------------------------------------------------

function extractAssistantText(content: Array<{ type: string; text?: string; thinking?: string; name?: string; input?: Record<string, unknown>; [k: string]: unknown }>): {
  text: string
  thinking: string
  toolCalls: Array<{ name: string; input: Record<string, unknown> }>
} {
  const textParts: string[] = []
  const thinkingParts: string[] = []
  const toolCalls: Array<{ name: string; input: Record<string, unknown> }> = []

  for (const block of content) {
    if (block.type === 'text' && typeof block.text === 'string') {
      textParts.push(block.text)
    } else if (block.type === 'thinking' && typeof block.thinking === 'string') {
      thinkingParts.push(block.thinking)
    } else if (block.type === 'tool_use' && typeof block.name === 'string') {
      toolCalls.push({ name: block.name, input: (block.input ?? {}) as Record<string, unknown> })
    }
  }

  return {
    text: textParts.join('\n'),
    thinking: thinkingParts.join('\n'),
    toolCalls,
  }
}

// ---------------------------------------------------------------------------
// Parse a full JSONL conversation file
// ---------------------------------------------------------------------------

export async function parseConversation(filePath: string): Promise<ParsedConversation> {
  const raw = await readFile(filePath, 'utf-8')
  const lines = raw.split('\n').filter(line => line.trim())

  const messages: NormalizedMessage[] = []
  let customTitle: string | null = null
  let summaryText: string | null = null
  let model: string | null = null
  let gitBranch: string | null = null
  let version: string | null = null
  let firstTimestamp: string | null = null
  let lastTimestamp: string | null = null
  let totalInputTokens = 0
  let totalOutputTokens = 0

  for (const line of lines) {
    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch {
      continue
    }

    const record = parseRecord(parsed)
    if (!record) continue

    // Track timestamps
    if ('timestamp' in record && record.timestamp) {
      if (!firstTimestamp) firstTimestamp = record.timestamp
      lastTimestamp = record.timestamp
    }

    switch (record.type) {
      case 'user': {
        const text = extractUserText(record.message.content)
        if (text.trim()) {
          messages.push({
            type: 'user',
            uuid: record.uuid,
            timestamp: record.timestamp,
            content: text,
            gitBranch: record.gitBranch,
          })
        }
        if (!gitBranch && record.gitBranch) gitBranch = record.gitBranch
        if (!version && record.version) version = record.version
        break
      }
      case 'assistant': {
        const extracted = extractAssistantText(record.message.content)
        if (extracted.text.trim() || extracted.toolCalls.length > 0) {
          const usage = record.message.usage
          if (usage) {
            totalInputTokens += usage.input_tokens ?? 0
            totalOutputTokens += usage.output_tokens ?? 0
          }
          if (!model && record.message.model) model = record.message.model

          messages.push({
            type: 'assistant',
            uuid: record.uuid,
            timestamp: record.timestamp,
            content: extracted.text,
            model: record.message.model,
            thinkingContent: extracted.thinking || undefined,
            toolCalls: extracted.toolCalls.length > 0 ? extracted.toolCalls : undefined,
            tokenUsage: usage ? {
              inputTokens: usage.input_tokens,
              outputTokens: usage.output_tokens,
              cacheCreationTokens: usage.cache_creation_input_tokens,
              cacheReadTokens: usage.cache_read_input_tokens,
            } : undefined,
            stopReason: record.message.stop_reason,
          })
        }
        break
      }
      case 'system': {
        if (record.subtype === 'compact_boundary') {
          messages.push({
            type: 'system',
            uuid: record.uuid,
            timestamp: record.timestamp,
            content: '--- Conversation compacted ---',
          })
        }
        break
      }
      case 'summary': {
        summaryText = record.summary
        messages.push({
          type: 'summary',
          content: record.summary,
        })
        break
      }
      case 'custom-title': {
        if (record.title) customTitle = record.title
        break
      }
    }
  }

  return {
    sessionId: filePath.split('/').pop()?.replace('.jsonl', '') ?? '',
    customTitle,
    summary: summaryText,
    messages,
    metadata: {
      model,
      gitBranch,
      version,
      firstTimestamp,
      lastTimestamp,
      totalInputTokens,
      totalOutputTokens,
    },
  }
}

// ---------------------------------------------------------------------------
// Export-only parsing: returns just human messages + final assistant summary
// ---------------------------------------------------------------------------

export async function parseForExport(filePath: string): Promise<{
  title: string
  messages: Array<{ role: 'user' | 'assistant'; timestamp?: string; content: string }>
  summary: string | null
  metadata: ParsedConversation['metadata']
}> {
  const conv = await parseConversation(filePath)

  const exportMessages: Array<{ role: 'user' | 'assistant'; timestamp?: string; content: string }> = []

  for (const msg of conv.messages) {
    if (msg.type === 'user') {
      exportMessages.push({ role: 'user', timestamp: msg.timestamp, content: msg.content })
    } else if (msg.type === 'assistant' && msg.content.trim()) {
      exportMessages.push({ role: 'assistant', timestamp: msg.timestamp, content: msg.content })
    }
  }

  return {
    title: conv.customTitle ?? conv.messages.find(m => m.type === 'user')?.content.slice(0, 100) ?? 'Untitled',
    messages: exportMessages,
    summary: conv.summary,
    metadata: conv.metadata,
  }
}
