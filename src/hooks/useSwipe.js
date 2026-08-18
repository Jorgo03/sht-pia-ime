import { useRef } from 'react'

/**
 * Horizontal swipe/drag via Pointer Events — covers touch, mouse, and pen
 * with one code path, no extra dependency. Consumers set `touch-action:
 * pan-y` on the element so the browser still handles vertical scroll
 * natively; this hook only decides once a drag reads as horizontal.
 */
export function useSwipe({ onSwipeLeft, onSwipeRight, threshold = 40 } = {}) {
  const startRef = useRef(null)

  const onPointerDown = (e) => {
    startRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
  }

  const onPointerUp = (e) => {
    const start = startRef.current
    startRef.current = null
    if (!start || start.id !== e.pointerId) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy)) return
    if (dx < 0) onSwipeLeft?.()
    else onSwipeRight?.()
  }

  const onPointerCancel = () => { startRef.current = null }

  return { onPointerDown, onPointerUp, onPointerCancel, style: { touchAction: 'pan-y' } }
}
