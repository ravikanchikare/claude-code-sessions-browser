import React, { useState } from 'react'

interface DateGroupProps {
  label: string
  defaultExpanded: boolean
  children: React.ReactNode
}

export function DateGroup({ label, defaultExpanded, children }: DateGroupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div className="date-group">
      <div className="date-group-header" onClick={() => setExpanded(!expanded)}>
        <span className={`date-group-chevron ${expanded ? '' : 'collapsed'}`}>&#9660;</span>
        <span className="date-group-label">{label}</span>
        <span className="date-group-line" />
      </div>
      {expanded && <div className="date-group-body">{children}</div>}
    </div>
  )
}
