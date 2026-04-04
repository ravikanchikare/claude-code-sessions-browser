import React from 'react'

interface BadgeProps {
  label: string
  value: string | number | null | undefined
  className?: string
}

export function Badge({ label, value, className }: BadgeProps) {
  if (value === null || value === undefined) return null
  return (
    <span className={`badge ${className ?? ''}`}>
      <span className="badge-label">{label}</span>
      <span className="badge-value">{value}</span>
    </span>
  )
}
