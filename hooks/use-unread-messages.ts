import { useEffect, useId, useState } from 'react';

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
  // This hook mounts twice at once in normal use — once inside LiquidTabBar
  // (present on every tab screen) and once inside the Profile screen itself.
  // supabase-js reuses an existing channel object for a topic name it's
  // already seen, so two instances sharing one hardcoded name meant the
  // second instance's `.on()` landed on a channel the first had already
  // `.subscribe()`d — a hard crash ("cannot add postgres_changes callbacks
  // ... after subscribe()"), not just a wasted duplicate subscription. Each
  // instance now gets its own channel.
  const instanceId = useId();

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }

    const refresh = async () => {
      const { data } = await supabase
        .from('conversations')
        .select('client_id, agent_id, unread_for_client, unread_for_agent')
        .or(`client_id.eq.${user.id},agent_id.eq.${user.id}`);

      const total = (data ?? []).reduce((sum, c) => {
        const mine = c.client_id === user.id ? c.unread_for_client : c.unread_for_agent;
        return sum + (mine ?? 0);
      }, 0);
      setCount(total);
    };

    refresh();

    const channel = supabase
      .channel(`unread-messages-${instanceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, refresh)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // Depends on user.id (a stable primitive), not the user object — matches
    // web's useUnreadCount.js and, unlike depending on the object/a
    // useCallback derived from it, doesn't tear down and recreate the
    // subscription on every token refresh (a new session object, same
    // account, fires on an interval regardless of user activity).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, instanceId]);

  return count;
}
