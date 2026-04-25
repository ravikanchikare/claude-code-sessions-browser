import { z } from 'zod'

// ---------------------------------------------------------------------------
// Content block schemas
// ---------------------------------------------------------------------------

const TextBlockSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
})

const ThinkingBlockSchema = z.object({
  type: z.literal('thinking'),
  thinking: z.string(),
  signature: z.string().optional(),
})

const ToolUseBlockSchema = z.object({
  type: z.literal('tool_use'),
  id: z.string(),
  name: z.string(),
  input: z.record(z.unknown()),
})

const ToolResultBlockSchema = z.object({
  type: z.literal('tool_result'),
  tool_use_id: z.string(),
  content: z.union([z.string(), z.array(z.unknown())]).optional(),
  is_error: z.boolean().optional(),
})

const ContentBlockSchema = z.discriminatedUnion('type', [
  TextBlockSchema,
  ThinkingBlockSchema,
  ToolUseBlockSchema,
  ToolResultBlockSchema,
])

// ---------------------------------------------------------------------------
// Usage schema
// ---------------------------------------------------------------------------

const UsageSchema = z.object({
  input_tokens: z.number().optional(),
  output_tokens: z.number().optional(),
  cache_creation_input_tokens: z.number().optional(),
  cache_read_input_tokens: z.number().optional(),
  service_tier: z.string().nullable().optional(),
}).passthrough()

// ---------------------------------------------------------------------------
// Top-level record schemas
// ---------------------------------------------------------------------------

const BaseFields = {
  uuid: z.string().optional(),
  parentUuid: z.string().nullable().optional(),
  sessionId: z.string().optional(),
  timestamp: z.string().optional(),
  cwd: z.string().optional(),
  gitBranch: z.string().optional(),
  version: z.string().optional(),
  userType: z.string().optional(),
  isSidechain: z.boolean().optional(),
}

// User messages can include image blocks and other types not in the assistant schema
const AnyContentBlockSchema = z.object({ type: z.string() }).passthrough()

export const UserRecordSchema = z.object({
  ...BaseFields,
  type: z.literal('user'),
  message: z.object({
    role: z.literal('user'),
    content: z.union([z.string(), z.array(AnyContentBlockSchema)]),
  }),
})

export const AssistantRecordSchema = z.object({
  ...BaseFields,
  type: z.literal('assistant'),
  message: z.object({
    role: z.literal('assistant'),
    id: z.string().optional(),
    type: z.string().optional(),
    model: z.string().optional(),
    content: z.array(ContentBlockSchema),
    stop_reason: z.string().nullable().optional(),
    usage: UsageSchema.optional(),
  }),
})

export const SystemRecordSchema = z.object({
  ...BaseFields,
  type: z.literal('system'),
  subtype: z.string().optional(),
  content: z.string().optional(),
  level: z.string().optional(),
  isMeta: z.boolean().optional(),
})

export const SummaryRecordSchema = z.object({
  type: z.literal('summary'),
  summary: z.string(),
  leafUuid: z.string().optional(),
})

export const FileHistorySnapshotSchema = z.object({
  type: z.literal('file-history-snapshot'),
  messageId: z.string().optional(),
  snapshot: z.record(z.unknown()).optional(),
  isSnapshotUpdate: z.boolean().optional(),
})

export const CustomTitleSchema = z.object({
  ...BaseFields,
  type: z.literal('custom-title'),
  title: z.string().optional(),
})

// Catch-all for unknown record types (agent-name, last-prompt, etc.)
const UnknownRecordSchema = z.object({
  type: z.string(),
}).passthrough()

// ---------------------------------------------------------------------------
// Discriminated parsing
// ---------------------------------------------------------------------------

export function parseRecord(raw: unknown): ParsedRecord | null {
  if (typeof raw !== 'object' || raw === null || !('type' in raw)) return null

  const type = (raw as { type: unknown }).type
  switch (type) {
    case 'user': {
      const result = UserRecordSchema.safeParse(raw)
      return result.success ? result.data : null
    }
    case 'assistant': {
      const result = AssistantRecordSchema.safeParse(raw)
      return result.success ? result.data : null
    }
    case 'system': {
      const result = SystemRecordSchema.safeParse(raw)
      return result.success ? result.data : null
    }
    case 'summary': {
      const result = SummaryRecordSchema.safeParse(raw)
      return result.success ? result.data : null
    }
    case 'file-history-snapshot':
      return null // skip in display
    case 'custom-title': {
      const result = CustomTitleSchema.safeParse(raw)
      return result.success ? result.data : null
    }
    default:
      return null // skip unknown types
  }
}

export type UserRecord = z.infer<typeof UserRecordSchema>
export type AssistantRecord = z.infer<typeof AssistantRecordSchema>
export type SystemRecord = z.infer<typeof SystemRecordSchema>
export type SummaryRecord = z.infer<typeof SummaryRecordSchema>
export type CustomTitleRecord = z.infer<typeof CustomTitleSchema>
export type ParsedRecord = UserRecord | AssistantRecord | SystemRecord | SummaryRecord | CustomTitleRecord
