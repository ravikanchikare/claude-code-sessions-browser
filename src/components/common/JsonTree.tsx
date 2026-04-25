import React, { useState } from 'react'

interface JtNodeProps {
  value: unknown
  keyName?: string | number | null
  depth: number
  maxDepth: number
  maxStrLen: number
  collapsedKeys?: string[]
}

function JtLabel({ keyName }: { keyName?: string | number | null }) {
  if (keyName === undefined || keyName === null) return null
  if (typeof keyName === 'number') return <span className="jt-idx">{keyName}</span>
  return <span className="jt-key">{keyName}</span>
}

function JtLeaf({ keyName, children }: { keyName?: string | number | null; children: React.ReactNode }) {
  return (
    <div className="jt-row">
      <span className="jt-toggle" style={{ visibility: 'hidden' }}>▶</span>
      <JtLabel keyName={keyName} />
      {children}
    </div>
  )
}

function JtNode({ value, keyName, depth, maxDepth, maxStrLen, collapsedKeys }: JtNodeProps) {
  const [collapsed, setCollapsed] = useState(depth >= maxDepth)
  const [strExpanded, setStrExpanded] = useState(false)
  const [moreExpanded, setMoreExpanded] = useState(false)

  if (value === null) return <JtLeaf keyName={keyName}><span className="jt-null">null</span></JtLeaf>
  if (value === undefined) return <JtLeaf keyName={keyName}><span className="jt-null">undefined</span></JtLeaf>

  const type = typeof value
  if (type === 'boolean') return <JtLeaf keyName={keyName}><span className="jt-bool">{String(value)}</span></JtLeaf>
  if (type === 'number') return <JtLeaf keyName={keyName}><span className="jt-num">{String(value)}</span></JtLeaf>

  if (type === 'string') {
    const str = value as string
    if (str.length > maxStrLen && !strExpanded) {
      return (
        <JtLeaf keyName={keyName}>
          <span className="jt-str jt-str-long" onClick={() => setStrExpanded(true)}>
            &quot;{str.slice(0, maxStrLen)}&hellip;&quot;{' '}
            <span className="jt-preview">({str.length} chars)</span>
          </span>
        </JtLeaf>
      )
    }
    return <JtLeaf keyName={keyName}><span className="jt-str">&quot;{str}&quot;</span></JtLeaf>
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <JtLeaf keyName={keyName}><span className="jt-bracket">[]</span></JtLeaf>
    return (
      <div className={`jt-node ${collapsed ? 'jt-collapsed' : 'jt-expanded'}`}>
        <div className="jt-row">
          <span className="jt-toggle" onClick={() => setCollapsed(!collapsed)}>{collapsed ? '▶' : '▼'}</span>
          <JtLabel keyName={keyName} />
          <span className="jt-bracket">[</span>
          <span className="jt-preview">[{value.length} items]</span>
        </div>
        <div className="jt-children">
          {!collapsed && value.map((item, i) => (
            <JtNode key={i} value={item} keyName={i} depth={depth + 1} maxDepth={maxDepth} maxStrLen={maxStrLen} />
          ))}
        </div>
        <div className="jt-row">
          <span className="jt-toggle" style={{ visibility: 'hidden' }}>▶</span>
          <span className="jt-bracket">]</span>
        </div>
      </div>
    )
  }

  if (type === 'object') {
    const obj = value as Record<string, unknown>
    const allKeys = Object.keys(obj)
    if (allKeys.length === 0) return <JtLeaf keyName={keyName}><span className="jt-bracket">{'{}'}</span></JtLeaf>

    const collapsedSet = collapsedKeys?.length ? new Set(collapsedKeys) : null
    const mainKeys = collapsedSet ? allKeys.filter(k => !collapsedSet.has(k)) : allKeys
    const hiddenKeys = collapsedSet ? allKeys.filter(k => collapsedSet.has(k)) : []

    return (
      <div className={`jt-node ${collapsed ? 'jt-collapsed' : 'jt-expanded'}`}>
        <div className="jt-row">
          <span className="jt-toggle" onClick={() => setCollapsed(!collapsed)}>{collapsed ? '▶' : '▼'}</span>
          <JtLabel keyName={keyName} />
          <span className="jt-bracket">{'{'}</span>
          <span className="jt-preview">&#123;{allKeys.length} keys&#125;</span>
        </div>
        <div className="jt-children">
          {!collapsed && mainKeys.map(k => (
            <JtNode key={k} value={obj[k]} keyName={k} depth={depth + 1} maxDepth={maxDepth} maxStrLen={maxStrLen} />
          ))}
          {!collapsed && hiddenKeys.length > 0 && (
            <>
              <div className="jt-row jt-more-toggle" onClick={() => setMoreExpanded(!moreExpanded)}>
                <span className="jt-toggle">{moreExpanded ? '▼' : '▶'}</span>
                <span className="jt-preview jt-more-label">{hiddenKeys.length} more field{hiddenKeys.length !== 1 ? 's' : ''}</span>
              </div>
              {moreExpanded && hiddenKeys.map(k => (
                <JtNode key={k} value={obj[k]} keyName={k} depth={depth + 1} maxDepth={maxDepth} maxStrLen={maxStrLen} />
              ))}
            </>
          )}
        </div>
        <div className="jt-row">
          <span className="jt-toggle" style={{ visibility: 'hidden' }}>▶</span>
          <span className="jt-bracket">{'}'}</span>
        </div>
      </div>
    )
  }

  return <JtLeaf keyName={keyName}><span className="jt-str">{String(value)}</span></JtLeaf>
}

interface JsonTreeProps {
  value: unknown
  maxDepth?: number
  maxStrLen?: number
  collapsedKeys?: string[]
}

export function JsonTree({ value, maxDepth = 3, maxStrLen = 300, collapsedKeys }: JsonTreeProps) {
  return (
    <div className="jt">
      <JtNode value={value} keyName={null} depth={0} maxDepth={maxDepth} maxStrLen={maxStrLen} collapsedKeys={collapsedKeys} />
    </div>
  )
}
