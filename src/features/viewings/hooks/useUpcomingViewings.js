import { useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { supabase } from '../../../lib/supabase'

const WINDOW_HOURS = 48

// Upcoming viewings for the bell: anything requested/confirmed in the next
// 48h where the user is a participant (RLS scopes rows — no explicit
// user filter needed). Refreshed on mount and every 5 minutes.
export function useUpcomingViewings() {
  const { user } = useAuth()
  const [viewings, setViewings] = useState([])

  useEffect(() => {
    if (!user) { setViewings([]); return }
    let active = true

    const load = async () => {
      const now = new Date()
      const until = new Date(now.getTime() + WINDOW_HOURS * 3600 * 1000)
      const { data } = await supabase
        .from('viewings')
        .select('id, scheduled_at, status, client_id, property:properties(id, title, title_i18n, city)')
        .in('status', ['requested', 'confirmed'])
        .gte('scheduled_at', now.toISOString())
        .lte('scheduled_at', until.toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(10)
      if (active) setViewings(data ?? [])
    }

    load()
    const id = setInterval(load, 5 * 60 * 1000)
    return () => { active = false; clearInterval(id) }
  }, [user?.id])

  return viewings
}
