import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'

// Favourites, as in the app (contexts/favorites-context.tsx): the signed-in
// person's `favorites` rows, the heart flips at once and is put back if the
// save fails, and a signed-out tap goes to sign-in first.

const FavoritesContext = createContext(null)

export function FavoritesProvider({ children }) {
  const { user } = useAuth()
  const [ids, setIds] = useState(() => new Set())
  const [homes, setHomes] = useState([])
  const [status, setStatus] = useState('idle') // idle | loading | ready | error
  const idsRef = useRef(ids)
  const uid = user?.id ?? null

  const apply = (next) => {
    idsRef.current = next
    setIds(next)
  }

  const load = useCallback(async () => {
    if (!uid) {
      apply(new Set())
      setHomes([])
      setStatus('idle')
      return
    }
    setStatus('loading')
    const { data, error } = await supabase
      .from('favorites')
      .select('property_id, created_at, properties(*)')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) return setStatus('error')
    const props = (data ?? []).map((f) => f.properties).filter((p) => p && p.status === 'active')
    apply(new Set((data ?? []).map((f) => f.property_id)))
    setHomes(props)
    setStatus('ready')
  }, [uid])

  useEffect(() => {
    load()
  }, [load])

  const toggle = useCallback(
    async (property) => {
      if (!uid) return false
      const id = property.id
      const was = idsRef.current.has(id)
      const next = new Set(idsRef.current)
      if (was) next.delete(id)
      else next.add(id)
      apply(next)
      setHomes((list) => (was ? list.filter((p) => p.id !== id) : [property, ...list.filter((p) => p.id !== id)]))
      const { error } = was
        ? await supabase.from('favorites').delete().eq('user_id', uid).eq('property_id', id)
        : await supabase.from('favorites').upsert({ user_id: uid, property_id: id }, { onConflict: 'user_id,property_id', ignoreDuplicates: true })
      if (error) {
        // Put the heart back as it was.
        const undo = new Set(idsRef.current)
        if (was) undo.add(id)
        else undo.delete(id)
        apply(undo)
        load()
      }
      return true
    },
    [uid, load],
  )

  const value = useMemo(() => ({ ids, homes, status, reload: load, toggle, isFavorite: (id) => ids.has(id) }), [ids, homes, status, load, toggle])
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext)
  if (!ctx) throw new Error('useFavorites must be used inside FavoritesProvider')
  return ctx
}

/** The heart: saves or removes a home; signed out, it opens sign-in and comes back. */
export function FavoriteButton({ property, className = '' }) {
  const { t } = useTranslation()
  const { session } = useAuth()
  const { isFavorite, toggle } = useFavorites()
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const on = isFavorite(property.id)
  return (
    <button
      type="button"
      className={`fav-btn ${on ? 'is-on' : ''} ${className}`}
      aria-pressed={on}
      aria-label={on ? t('web.fav.remove') : t('web.fav.add')}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!session) return navigate(`/login?next=${encodeURIComponent(pathname + search)}`)
        toggle(property)
      }}
    >
      <Heart size={18} aria-hidden="true" fill={on ? 'currentColor' : 'none'} />
    </button>
  )
}
