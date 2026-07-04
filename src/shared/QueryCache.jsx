import { createContext, useContext } from 'react'

const cache = new Map()

export const cacheGet = (k) => {
  const v = cache.get(k)
  if (!v || v.expiresAt < Date.now()) return null
  return v.data
}

export const cacheSet = (k, data, ttlMs = 60_000) => {
  cache.set(k, { data, expiresAt: Date.now() + ttlMs })
}

export const cacheDelete = (k) => {
  cache.delete(k)
}

const QueryCacheContext = createContext({ cacheGet, cacheSet, cacheDelete })

export function QueryCacheProvider({ children }) {
  return (
    <QueryCacheContext.Provider value={{ cacheGet, cacheSet, cacheDelete }}>
      {children}
    </QueryCacheContext.Provider>
  )
}

export function useQueryCache() {
  return useContext(QueryCacheContext)
}
