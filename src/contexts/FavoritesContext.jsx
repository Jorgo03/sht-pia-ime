import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'

const FavoritesContext = createContext(null)

export function FavoritesProvider({ children }) {
  const { user } = useAuth()
  const [favoriteIds, setFavoriteIds] = useState(new Set())
  const [favoriteProperties, setFavoriteProperties] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchFavorites = useCallback(async () => {
    if (!user) {
      setFavoriteIds(new Set())
      setFavoriteProperties([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('id, created_at, property:properties(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      const props = (data ?? []).map((f) => f.property).filter(Boolean)
      const ids = new Set(props.map((p) => p.id))

      setFavoriteIds(ids)
      setFavoriteProperties(props)
    } catch {
      setFavoriteIds(new Set())
      setFavoriteProperties([])
    } finally {
      setLoading(false)
    }
  }, [user])

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

      const wasFav = favoriteIds.has(propertyId)

      setFavoriteIds((prev) => {
        const next = new Set(prev)
        if (wasFav) next.delete(propertyId)
        else next.add(propertyId)
        return next
      })

      if (wasFav) {
        setFavoriteProperties((prev) => prev.filter((p) => p.id !== propertyId))
      } else {
        const { data } = await supabase
          .from('properties')
          .select('*')
          .eq('id', propertyId)
          .single()
        if (data) setFavoriteProperties((prev) => [...prev, data])
      }

      let error
      if (wasFav) {
        ({ error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('property_id', propertyId))
      } else {
        ({ error } = await supabase
          .from('favorites')
          .insert({ user_id: user.id, property_id: propertyId }))
      }

      if (error) {
        console.error('[Favorites] toggle failed:', error.message)
        fetchFavorites()
      }
    },
    [user, favoriteIds, fetchFavorites],
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
