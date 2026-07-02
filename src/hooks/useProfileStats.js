import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export function useProfileStats() {
  const { user, isAgent } = useAuth()
  const [stats, setStats] = useState({ loading: true, saved: 0, searches: 0, third: 0 })

  useEffect(() => {
    if (!user) {
      setStats({ loading: false, saved: 0, searches: 0, third: 0 })
      return
    }

    let active = true

    Promise.all([
      supabase
        .from('favorites')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
      supabase
        .from('saved_searches')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
      isAgent
        ? supabase
            .from('properties')
            .select('id', { count: 'exact', head: true })
            .eq('owner_id', user.id)
            .eq('status', 'active')
        : supabase
            .from('viewings')
            .select('id', { count: 'exact', head: true })
            .eq('client_id', user.id)
            .in('status', ['requested', 'confirmed']),
    ]).then(([f, s, t]) => {
      if (!active) return
      setStats({
        loading: false,
        saved: f.count ?? 0,
        searches: s.count ?? 0,
        third: t.count ?? 0,
      })
    }).catch(() => {
      if (!active) return
      setStats({ loading: false, saved: 0, searches: 0, third: 0 })
    })

    return () => { active = false }
  }, [user?.id, isAgent])

  return stats
}
