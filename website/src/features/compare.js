import { useSyncExternalStore } from 'react'
import { MAX_COMPARE, parseCompareIds, toggleCompareId } from '@/src/features/properties/lib/compare.js'

// The homes picked for comparison, as in the app (contexts/compare-context.tsx):
// up to three, remembered on this device.
const KEY = 'fho_compare_ids' // same key the app uses on the web
const listeners = new Set()

function read() {
  try {
    return parseCompareIds(localStorage.getItem(KEY))
  } catch {
    return []
  }
}

let ids = read()
let snapshot = ids.join(',')

function write(next) {
  ids = next
  snapshot = next.join(',')
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Not remembered, still compared this visit.
  }
  listeners.forEach((l) => l())
}

// Another tab changed the list: pick it up here too, so the last write in one
// tab does not quietly undo the other's.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY && e.key !== null) return
    ids = read()
    snapshot = ids.join(',')
    listeners.forEach((l) => l())
  })
}

export function toggleCompare(id) {
  write(toggleCompareId(ids, id, MAX_COMPARE))
}
export function removeCompare(id) {
  write(ids.filter((x) => x !== id))
}

export function useCompare() {
  const value = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => snapshot,
  )
  return value ? value.split(',') : []
}

export { MAX_COMPARE }
