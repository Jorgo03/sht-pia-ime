import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../../lib/supabase'
import { debugWarn } from '../../lib/debug'

const FavoritesContext = createContext(null)

export function FavoritesProvider({ children }) {
  const { user } = useAuth()
  const [favoriteIds, setFavoriteIds] = useState(new Set())
  const [favoriteProperties, setFavoriteProperties] = useState([])
  const [loading, setLoading] = useState(true)
  // The hearts as they are right now, for toggle(), and one write at a time
  // per listing in tap order. A quick second tap used to send its unsave
  // while the first tap's save was still reading the listing, so the server
  // kept a favourite the visitor had removed (AUDIT-028).
  const idsRef = useRef(new Set())
  const writes = useRef(new Map())
  const applyIds = useCallback((next) => {
    idsRef.current = next
    setFavoriteIds(next)
  }, [])

  const fetchFavorites = useCallback(async () => {
    if (!user) {
      applyIds(new Set())
      setFavoriteProperties([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      // Try join query first (works when FK relationship exists)
      const { data, error } = await supabase
        .from('favorites')
        .select('id, created_at, property_id, property:properties(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      const hasJoinedData = data?.some((f) => f.property)

      if (hasJoinedData) {
        const props = (data ?? []).map((f) => f.property).filter(Boolean)
        const ids = new Set(props.map((p) => p.id))
        applyIds(ids)
        setFavoriteProperties(props)
      } else {
        // Fallback: join failed silently, fetch properties separately
        const ids = new Set((data ?? []).map((f) => f.property_id).filter(Boolean))
        applyIds(ids)
        if (ids.size > 0) {
          const { data: props } = await supabase
            .from('properties')
            .select('*')
            .in('id', [...ids])
          setFavoriteProperties(props ?? [])
        } else {
          setFavoriteProperties([])
        }
      }
    } catch {
      // Table might not exist yet — start empty
      applyIds(new Set())
      setFavoriteProperties([])
    } finally {
      setLoading(false)
    }
  }, [user, applyIds])

  useEffect(() => {
    fetchFavorites()
  }, [fetchFavorites])

  const isFavorite = useCallback(
    (propertyId) => favoriteIds.has(propertyId),
    [favoriteIds],
  )

  const toggle = useCallback(
    async (propertyId) => {
      if (!user) return

      const wasFav = idsRef.current.has(propertyId)

      const next = new Set(idsRef.current)
      if (wasFav) next.delete(propertyId)
      else next.add(propertyId)
      applyIds(next)

      // Queue the write behind any earlier one for this listing, before
      // reading the listing below, so the server sees taps in order.
      const write = async () => {
        const { error } = wasFav
          ? await supabase.from('favorites').delete().eq('user_id', user.id).eq('property_id', propertyId)
          : await supabase.from('favorites').insert({ user_id: user.id, property_id: propertyId })
        return error
      }
      const run = (writes.current.get(propertyId) ?? Promise.resolve(null)).then(write, write)
      writes.current.set(propertyId, run)

      if (wasFav) {
        setFavoriteProperties((prev) => prev.filter((p) => p.id !== propertyId))
      } else {
        const { data } = await supabase
          .from('properties')
          .select('*')
          .eq('id', propertyId)
          .single()
        if (data && idsRef.current.has(propertyId)) {
          setFavoriteProperties((prev) => (prev.some((p) => p.id === data.id) ? prev : [...prev, data]))
        }
      }

      let error
      try {
        error = await run
      } catch (err) {
        error = err
      }
      if (writes.current.get(propertyId) === run) writes.current.delete(propertyId)

      if (error) {
        debugWarn('Favorites toggle', error)
        fetchFavorites()
      }
    },
    [user, applyIds, fetchFavorites],
  )

  return (
    <FavoritesContext.Provider
      value={{ favoriteIds, favoriteProperties, loading, isFavorite, toggle }}
    >
      {children}
    </FavoritesContext.Provider>
  )
}

export function useFavorites() {
  const context = useContext(FavoritesContext)
  if (!context) {
    throw new Error('useFavorites must be used within a FavoritesProvider')
  }
  return context
}
