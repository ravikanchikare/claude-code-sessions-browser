import type { NormalizedMessage } from '../types.js'

const L_USER = 'User'
const L_CLAUDE = 'Claude'
const L_CLAUDE_SUMMARY = 'Claude Summary'

/** Same filtering as the conversation viewer before transcript export. */
export function filterMessagesForTranscript(messages: NormalizedMessage[]): NormalizedMessage[] {
  return messages.filter(msg => {
    if (msg.type === 'assistant' && !msg.content.trim() && !(msg.toolCalls?.length)) return false
    if (msg.type === 'user') {
      const trimmed = msg.content.trim()
      if (trimmed.startsWith('<') && /<\/[a-zA-Z][a-zA-Z0-9-]*>\s*$/.test(trimmed)) return false
      if (trimmed.toLowerCase().startsWith('caviat')) return false
    }
    return true
  })
}

/**
 * Serialize one turn transcript for clipboard: user prompt, Claude blocks (assistant `content` only), then Claude Summary when end_turn.
 * Tool-only assistant messages are omitted.
 */
export function formatTurnPairCopy(
  userMessage: NormalizedMessage,
  intermediates: NormalizedMessage[],
  finalResponse: NormalizedMessage | null,
): string {
  const parts: string[] = []
  const userText = userMessage.content.trim()
  parts.push(`${L_USER}:\n${userText || '(empty)'}`)

  for (const m of intermediates) {
    if (m.type !== 'assistant') continue
    const text = m.content.trim()
    if (!text) continue
    parts.push(`${L_CLAUDE}:\n${text}`)
  }

  if (finalResponse) {
    const text = finalResponse.content.trim()
    if (text) {
      const closingLabel = finalResponse.stopReason === 'end_turn' ? L_CLAUDE_SUMMARY : L_CLAUDE
      parts.push(`${closingLabel}:\n${text}`)
    }
  }

  return parts.join('\n\n')
}

/**
 * Chronological transcript: User / Claude / Claude Summary (assistant `content` only; no tool-call lines).
 * For raw session logs, use {@link formatFullSessionTranscript} so viewer filters apply.
 */
export function formatSessionMessagesCopy(messages: NormalizedMessage[]): string {
  const parts: string[] = []
  for (const msg of messages) {
    if (msg.type === 'user') {
      const t = msg.content.trim()
      parts.push(`${L_USER}:\n${t || '(empty)'}`)
    } else if (msg.type === 'summary') {
      const t = msg.content.trim()
      if (t) parts.push(`${L_CLAUDE_SUMMARY}:\n${t}`)
    } else if (msg.type === 'assistant') {
      const t = msg.content.trim()
      if (!t) continue
      const label = msg.stopReason === 'end_turn' ? L_CLAUDE_SUMMARY : L_CLAUDE
      parts.push(`${label}:\n${t}`)
    }
  }
  return parts.join('\n\n')
}

/** Chronological transcript with viewer filters applied (User / Claude / Claude Summary; content only). */
export function formatFullSessionTranscript(messages: NormalizedMessage[]): string {
  return formatSessionMessagesCopy(filterMessagesForTranscript(messages))
}
