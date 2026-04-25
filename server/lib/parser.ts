import { readFile } from 'fs/promises'
import { join } from 'path'
import { parseRecord, type ParsedRecord, type UserRecord, type AssistantRecord } from './schemas.js'

// ---------------------------------------------------------------------------
// Types for normalized messages returned to the frontend
// ---------------------------------------------------------------------------

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
// Extract text and attachments from user message content
// ---------------------------------------------------------------------------

const MEDIA_TYPE_MAP: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
}

function parseImageRefs(text: string): { text: string; attachments: Attachment[] } {
  const attachments: Attachment[] = []
  let cleaned: string

  // Only extract [Image: source: ...] when the block is purely image references.
  // This avoids false-positive matches in conversation summaries and code snippets.
  const withoutRefs = text.replace(/\[Image: source: ([^\]]+)\]/g, '').trim()
  if (withoutRefs.length === 0 && text.includes('[Image: source:')) {
    const re = /\[Image: source: ([^\]]+)\]/g
    let match: RegExpExecArray | null
    while ((match = re.exec(text)) !== null) {
      const sourcePath = match[1]
      const fileName = sourcePath.split('/').pop() ?? sourcePath
      const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
      attachments.push({
        type: 'image',
        mediaType: MEDIA_TYPE_MAP[ext] ?? `image/${ext}`,
        fileName,
        source: sourcePath,
      })
    }
    cleaned = ''
  } else {
    cleaned = text
  }

  // Strip [Image #N] markers (redundant when structured attachments exist)
  cleaned = cleaned.replace(/\[Image #\d+\]\s*/g, '')

  return { text: cleaned, attachments }
}

function extractUserContent(content: string | Array<{ type: string; text?: string; source?: unknown; [k: string]: unknown }>): { text: string; attachments: Attachment[] } {
  if (typeof content === 'string') {
    return parseImageRefs(content)
  }

  const textParts: string[] = []
  const attachments: Attachment[] = []

  for (const block of content) {
    if (block.type === 'text' && typeof block.text === 'string') {
      const parsed = parseImageRefs(block.text)
      if (parsed.text.trim()) textParts.push(parsed.text)
      attachments.push(...parsed.attachments)
    } else if (block.type === 'image') {
      const src = block.source as { type?: string; media_type?: string; url?: string } | undefined
      attachments.push({
        type: 'image',
        mediaType: src?.media_type ?? 'image/unknown',
        source: src?.url,
      })
    }
  }

  return { text: textParts.join('\n'), attachments }
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
        const { text: rawText, attachments } = extractUserContent(record.message.content)
        const text = rawText.trim()
        if (text || attachments.length > 0) {
          messages.push({
            type: 'user',
            uuid: record.uuid,
            parentUuid: record.parentUuid ?? null,
            messageIndex: messages.length,
            timestamp: record.timestamp,
            content: text,
            gitBranch: record.gitBranch,
            attachments: attachments.length > 0 ? attachments : undefined,
          })
        }
        if (!gitBranch && record.gitBranch) gitBranch = record.gitBranch
        if (!version && record.version) version = record.version
        break
      }
      case 'assistant': {
        const extracted = extractAssistantText(record.message.content)
        const assistantText = extracted.text.trim()
        const assistantThinking = extracted.thinking.trim()
        if (assistantText || extracted.toolCalls.length > 0) {
          const usage = record.message.usage
          if (usage) {
            totalInputTokens += usage.input_tokens ?? 0
            totalOutputTokens += usage.output_tokens ?? 0
          }
          if (!model && record.message.model) model = record.message.model

          messages.push({
            type: 'assistant',
            uuid: record.uuid,
            parentUuid: record.parentUuid ?? null,
            messageIndex: messages.length,
            timestamp: record.timestamp,
            content: assistantText,
            model: record.message.model,
            thinkingContent: assistantThinking || undefined,
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
