import React, { useState } from 'react'
import { ChevronDownIcon, ChevronRightIcon } from '@radix-ui/react-icons'
import type { NormalizedMessage } from '../../types.js'

interface ToolCallGroupProps {
  messages: NormalizedMessage[]
}

function basename(filePath: string): string {
  const parts = filePath.split('/')
  return parts[parts.length - 1] || filePath
}

function pillLabel(tc: { name: string; input: Record<string, unknown> }): string {
  const inp = tc.input
  switch (tc.name) {
    case 'Read':
    case 'Write':
    case 'Edit':
      return inp.file_path ? `${tc.name} ${basename(inp.file_path as string)}` : tc.name
    case 'Grep':
      return typeof inp.pattern === 'string' ? `Grep ${inp.pattern.slice(0, 30)}` : 'Grep'
    case 'Glob':
      return typeof inp.pattern === 'string' ? `Glob ${inp.pattern.slice(0, 30)}` : 'Glob'
    case 'Bash':
      if (typeof inp.description === 'string') return `Bash ${inp.description.slice(0, 40)}`
      return 'Bash'
    default:
      return tc.name
  }
}

export function ToolCallGroup({ messages }: ToolCallGroupProps) {
  const [expanded, setExpanded] = useState(false)

  const allCalls = messages.flatMap(msg => msg.toolCalls ?? [])

  return (
    <div className="tool-call-group">
      <div className="tool-call-group-pills">
        {allCalls.map((tc, i) => (
          <span key={i} className="tool-pill" title={JSON.stringify(tc.input, null, 2)}>
            {pillLabel(tc)}
          </span>
        ))}
      </div>
      <button className="toggle-btn toggle-btn-small" onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronDownIcon width={11} height={11} /> : <ChevronRightIcon width={11} height={11} />} Details
      </button>
      {expanded && (
        <div className="tool-call-group-details">
          {allCalls.map((tc, i) => (
            <div key={i} className="tool-call-detail">
              <span className="tool-name">{tc.name}</span>
              <pre className="tool-input">{JSON.stringify(tc.input, null, 2)}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
