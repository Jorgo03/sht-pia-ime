import { useState, useCallback } from 'react'

const STORAGE_KEY = 'fho_recently_viewed'
const MAX_ITEMS = 10

function getStored() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []
  } catch {
    return []
  }
}

export function addRecentlyViewed(id) {
  if (!id) return
  const list = getStored().filter(i => i !== id)
  list.unshift(id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_ITEMS)))
}

export function useRecentlyViewed() {
  const [ids] = useState(getStored)

  const clear = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  return { recentIds: ids, clear }
}
