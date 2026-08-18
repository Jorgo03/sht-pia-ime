import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';

/**
 * Total unread message count across all of the current user's conversations
 * — same unread_for_client/unread_for_agent columns the web app reads,
 * kept live via a realtime subscription on `conversations` (any change
 * re-sums, matching Messages.jsx's own reload-on-any-change pattern).
 */
export function useUnreadMessages(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const reload = useCallback(async () => {
    if (!user) {
      setCount(0);
      return;
    }
    const { data } = await supabase
      .from('conversations')
      .select('client_id, agent_id, unread_for_client, unread_for_agent')
      .or(`client_id.eq.${user.id},agent_id.eq.${user.id}`);

    const total = (data ?? []).reduce((sum, c) => {
      const mine = c.client_id === user.id ? c.unread_for_client : c.unread_for_agent;
      return sum + (mine ?? 0);
    }, 0);
    setCount(total);
  }, [user]);

  useEffect(() => {
    reload();
    if (!user) return;
    const channel = supabase
      .channel('unread-messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, reload)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, reload]);

  return count;
}
