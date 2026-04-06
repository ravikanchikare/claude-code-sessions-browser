import React, { useCallback, useRef } from 'react'

interface ResizeHandleProps {
  onResize: (width: number) => void
}

export function ResizeHandle({ onResize }: ResizeHandleProps) {
  const activeRef = useRef(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    activeRef.current = true
    document.body.classList.add('resizing')

    const onMouseMove = (ev: MouseEvent) => {
      const w = Math.max(200, Math.min(600, ev.clientX))
      onResize(w)
    }

    const onMouseUp = () => {
      activeRef.current = false
      document.body.classList.remove('resizing')
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [onResize])

  return <div className="resize-handle" onMouseDown={handleMouseDown} />
}
