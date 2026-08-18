import { useRef, useState } from 'react'

/**
 * Drag-to-dismiss for a bottom sheet, via Pointer Events on a drag-handle
 * zone only (the grip + header) — NOT the sheet's scrollable body, so
 * dragging never fights normal content scrolling. Follows the pointer 1:1
 * while dragging; past `dismissThreshold` it dismisses, short of it it
 * springs back. There's no separate "collapsed" state to expand into (the
 * sheet already opens at its full height), so an upward drag is clamped to
 * 0 — a small rubber-band that confirms the handle is grabbable without
 * inventing a detent the rest of the UI doesn't have.
 */
export function useDragSheet({ onDismiss, dismissThreshold = 120 } = {}) {
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startRef = useRef(null)
  const dragYRef = useRef(0)

  const onPointerDown = (e) => {
    startRef.current = e.clientY
    setDragging(true)
    // Can throw (e.g. no active pointer session for this id) — capture is
    // an optimization so drag keeps tracking outside the handle's bounds,
    // not a requirement, so a failure here shouldn't break the drag.
    try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch { /* ignore */ }
  }

  const onPointerMove = (e) => {
    if (startRef.current == null) return
    const delta = Math.max(0, e.clientY - startRef.current)
    dragYRef.current = delta
    setDragY(delta)
  }

  const endDrag = () => {
    if (startRef.current == null) return
    startRef.current = null
    setDragging(false)
    const finalDelta = dragYRef.current
    dragYRef.current = 0
    setDragY(0)
    if (finalDelta > dismissThreshold) onDismiss?.()
  }

  return {
    dragHandleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      style: { touchAction: 'none', cursor: 'grab' },
    },
    // Raw values, not a finished `transform` string — the sheet's own CSS
    // may already need its own transform (e.g. `translateX(-50%)` to
    // center a fixed-position sheet), so the caller composes the two
    // rather than this hook overwriting it.
    dragY,
    dragging,
    dragTransition: dragging ? 'none' : 'transform 300ms cubic-bezier(0.2, 0.8, 0.2, 1)',
  }
}
