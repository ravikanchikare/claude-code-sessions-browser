import React from 'react'
import { DrawingPinFilledIcon, DrawingPinIcon } from '@radix-ui/react-icons'

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
      {pinned ? <DrawingPinFilledIcon width={13} height={13} /> : <DrawingPinIcon width={13} height={13} />}
    </button>
  )
}
