import React from 'react'

interface PinButtonProps {
  pinned: boolean
  onToggle: () => void
}

export function PinButton({ pinned, onToggle }: PinButtonProps) {
  return (
    <button
      className={`pin-btn ${pinned ? 'pinned' : ''}`}
      onClick={(e) => { e.stopPropagation(); onToggle() }}
      title={pinned ? 'Unpin project' : 'Pin project'}
    >
      {pinned ? '\u25C9' : '\u25CB'}
    </button>
  )
}
