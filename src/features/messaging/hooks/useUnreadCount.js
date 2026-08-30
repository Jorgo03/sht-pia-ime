import { useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { supabase } from '../../../lib/supabase'

export function useUnreadCount() {
  const { user } = useAuth()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!user) { setCount(0); return }

    // Pick the counter per conversation by which side this user is on —
    // an agent browsing someone else's listing chats as the client.
    const refresh = async () => {
      const { data } = await supabase
        .from('conversations')
        .select('client_id, unread_for_client, unread_for_agent')
        .or(`client_id.eq.${user.id},agent_id.eq.${user.id}`)
      setCount((data ?? []).reduce(
        (s, r) => s + ((r.client_id === user.id ? r.unread_for_client : r.unread_for_agent) ?? 0), 0))
    }

    refresh()

    const channel = supabase
      .channel('unread-nav')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, refresh)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // Depends on the stable user?.id, not the user object: Supabase hands back
  // a new object identity on every refresh, which would re-run this effect
  // (and re-open the realtime channel) for no reason.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  return count
}
