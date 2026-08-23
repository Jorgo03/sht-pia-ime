import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { supabase } from '../../../lib/supabase'

const WINDOW_HOURS = 48
const SEEN_KEY = 'fho_bell_seen_at'

function readSeenAt() {
  try {
    return localStorage.getItem(SEEN_KEY) || ''
  } catch {
    return ''
  }
}

// Upcoming viewings for the header bell: anything requested/confirmed in the
// next 48h where the user is a participant (RLS scopes rows — no explicit
// user filter needed). Fetched once on mount, then kept current by a realtime
// subscription rather than a timer — the project's Supabase rules rule out
// polling, and this previously re-ran the query every 5 minutes for the whole
// session. public.viewings had to be added to the supabase_realtime
// publication for this to fire at all (migration 20260823180919); it was
// absent, which is why the poll existed.
//
// Unread is tracked client-side against a "last opened the bell" timestamp
// in localStorage rather than a DB column: there is no notifications table,
// and viewings.read_at would be ambiguous (a row has two participants who
// read it at different times). Per-device is the honest scope here — noted
// in DECISIONS.md.
export function useUpcomingViewings() {
  const { user } = useAuth()
  const [viewings, setViewings] = useState([])
  const [seenAt, setSeenAt] = useState(readSeenAt)

  useEffect(() => {
    if (!user) { setViewings([]); return }
    let active = true

    const load = async () => {
      const now = new Date()
      const until = new Date(now.getTime() + WINDOW_HOURS * 3600 * 1000)
      const { data } = await supabase
        .from('viewings')
        .select('id, scheduled_at, created_at, status, client_id, property:properties(id, title, title_i18n, city)')
        .in('status', ['requested', 'confirmed'])
        .gte('scheduled_at', now.toISOString())
        .lte('scheduled_at', until.toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(10)
      if (active) setViewings(data ?? [])
    }

    load()
    // Channel name is per-user so two sessions in one browser profile can't
    // collide on a shared topic, matching useUnreadCount's 'unread-nav'.
    const channel = supabase
      .channel(`viewings-bell-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'viewings' }, load)
      .subscribe()

    return () => { active = false; supabase.removeChannel(channel) }
  }, [user?.id])

  // Anything created since the last time the bell was opened counts as
  // unread. No seenAt yet (first ever open) → everything is unread.
  const unreadCount = viewings.filter(v => !seenAt || (v.created_at && v.created_at > seenAt)).length

  const markAsRead = useCallback(() => {
    const stamp = new Date().toISOString()
    try { localStorage.setItem(SEEN_KEY, stamp) } catch { /* storage blocked — badge just won't persist as read */ }
    setSeenAt(stamp)
  }, [])

  return { viewings, unreadCount, markAsRead }
}
