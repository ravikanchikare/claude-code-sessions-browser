import React, { useEffect, useRef } from 'react'
import { Pencil1Icon, EnterIcon, CheckboxIcon, SquareIcon, TrashIcon, ClipboardIcon } from '@radix-ui/react-icons'

interface SessionContextMenuProps {
  onRename?: () => void
  onMove?: () => void
  onCopyTranscript?: () => void | Promise<void>
  onDelete?: () => void
  compareMode: boolean
  isCompareSelected: boolean
  onCompareToggle: () => void
  onClose: () => void
}

export function SessionContextMenu({
  onRename, onMove, onCopyTranscript, onDelete, compareMode, isCompareSelected, onCompareToggle, onClose,
}: SessionContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  // Auto-flip upward if near bottom of viewport
  useEffect(() => {
    if (!menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    if (rect.bottom > window.innerHeight - 10) {
      menuRef.current.style.top = 'auto'
      menuRef.current.style.bottom = '100%'
    }
  }, [])

  return (
    <div className="context-menu" ref={menuRef}>
      {onRename && (
        <button className="context-menu-item" onClick={(e) => { e.stopPropagation(); onRename(); onClose() }}>
          <span className="context-menu-icon"><Pencil1Icon width={13} height={13} /></span> Rename
        </button>
      )}
      {onMove && (
        <button className="context-menu-item" onClick={(e) => { e.stopPropagation(); onMove(); onClose() }}>
          <span className="context-menu-icon"><EnterIcon width={13} height={13} /></span> Move
        </button>
      )}
      {onCopyTranscript && (
        <button
          className="context-menu-item"
          onClick={(e) => {
            e.stopPropagation()
            void Promise.resolve(onCopyTranscript()).finally(() => onClose())
          }}
        >
          <span className="context-menu-icon"><ClipboardIcon width={13} height={13} /></span> Copy transcript
        </button>
      )}
      {compareMode && (
        <button className="context-menu-item" onClick={(e) => { e.stopPropagation(); onCompareToggle(); onClose() }}>
          <span className="context-menu-icon">{isCompareSelected ? <CheckboxIcon width={13} height={13} /> : <SquareIcon width={13} height={13} />}</span>
          {isCompareSelected ? 'Remove from compare' : 'Add to compare'}
        </button>
      )}
      {onDelete && (
        <>
          <div className="context-menu-sep" />
          <button className="context-menu-item context-menu-danger" onClick={(e) => { e.stopPropagation(); onDelete(); onClose() }}>
            <span className="context-menu-icon"><TrashIcon width={13} height={13} /></span> Delete
          </button>
        </>
      )}
    </div>
  )
}
