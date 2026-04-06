import React, { useEffect, useRef } from 'react'

interface SessionContextMenuProps {
  onRename?: () => void
  onMove?: () => void
  onDelete: () => void
  compareMode: boolean
  isCompareSelected: boolean
  onCompareToggle: () => void
  onClose: () => void
}

export function SessionContextMenu({
  onRename, onMove, onDelete, compareMode, isCompareSelected, onCompareToggle, onClose,
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
          <span className="context-menu-icon">&#9998;</span> Rename
        </button>
      )}
      {onMove && (
        <button className="context-menu-item" onClick={(e) => { e.stopPropagation(); onMove(); onClose() }}>
          <span className="context-menu-icon">&#8644;</span> Move
        </button>
      )}
      {compareMode && (
        <button className="context-menu-item" onClick={(e) => { e.stopPropagation(); onCompareToggle(); onClose() }}>
          <span className="context-menu-icon">{isCompareSelected ? '\u2611' : '\u2610'}</span>
          {isCompareSelected ? 'Remove from compare' : 'Add to compare'}
        </button>
      )}
      <div className="context-menu-sep" />
      <button className="context-menu-item context-menu-danger" onClick={(e) => { e.stopPropagation(); onDelete(); onClose() }}>
        <span className="context-menu-icon">&#10005;</span> Delete
      </button>
    </div>
  )
}
