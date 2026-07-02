import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export function useUnreadCount() {
  const { user, profile } = useAuth()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!user) { setCount(0); return }

    const col = profile?.role === 'agent' ? 'unread_for_agent' : 'unread_for_client'

    const refresh = async () => {
      const { data } = await supabase
        .from('conversations')
        .select(col)
        .or(`client_id.eq.${user.id},agent_id.eq.${user.id}`)
      setCount((data ?? []).reduce((s, r) => s + (r[col] ?? 0), 0))
    }

    refresh()

    const channel = supabase
      .channel('unread-nav')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, refresh)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id, profile?.role])

  return count
}
