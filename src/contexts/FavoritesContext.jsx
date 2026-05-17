import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'

const FavoritesContext = createContext(null)

export function FavoritesProvider({ children }) {
  const { user } = useAuth()
  const [favoriteIds, setFavoriteIds] = useState(new Set())
  const [favoriteProperties, setFavoriteProperties] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchFavorites = useCallback(async () => {
    if (!user) {
      setFavoriteIds(new Set())
      setFavoriteProperties([])
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('property_id, properties(*)')
        .eq('user_id', user.id)

      if (error) throw error

      const props = (data ?? []).map((f) => f.properties).filter(Boolean)
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

      if (!user) return

      try {
        if (wasFav) {
          await supabase
            .from('favorites')
            .delete()
            .eq('user_id', user.id)
            .eq('property_id', propertyId)
        } else {
          await supabase
            .from('favorites')
            .insert({ user_id: user.id, property_id: propertyId })
        }
      } catch {
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
