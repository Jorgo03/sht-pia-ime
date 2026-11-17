import { usePathname } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/contexts/auth-context';
import { debugWarn } from '@/lib/debug';
import { Notifications } from '@/lib/notifications-module';
import { supabase } from '@/lib/supabase';
import {
  conversationInPath,
  shouldBanner,
  type AppNotification,
} from '@/src/features/notifications/lib/feed';

interface NotificationsValue {
  /** Unread count, kept live. */
  unread: number;
  /** Goes up on every change, so a list on screen knows to reload. */
  version: number;
  /** The notification to show as a banner, or null. */
  banner: AppNotification | null;
  dismissBanner: () => void;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsValue>({
  unread: 0,
  version: 0,
  banner: null,
  dismissBanner: () => {},
  markRead: async () => {},
  markAllRead: async () => {},
});

// A new name per subscription: supabase.channel() returns a channel of the
// same name if one is still closing, and subscribing to that one throws.
let channelSeq = 0;

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  const [version, setVersion] = useState(0);
  const [banner, setBanner] = useState<AppNotification | null>(null);
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  const refreshUnread = useCallback(async () => {
    if (!userId) return;
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null);
    if (!error) setUnread(count ?? 0);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setUnread(0);
      setBanner(null);
      return;
    }
    void refreshUnread();
    const channel = supabase
      .channel(`notifications-${++channelSeq}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        async (payload) => {
          setVersion((v) => v + 1);
          void refreshUnread();
          const row = payload.new as AppNotification | undefined;
          if (!row?.id || !shouldBanner(row, { pathname: pathRef.current })) return;
          // Read at the moment it matters, so a switch just turned off counts.
          const { data: prefs } = await supabase
            .from('notification_preferences')
            .select('messages, viewings')
            .eq('user_id', userId)
            .maybeSingle();
          if (shouldBanner(row, { pathname: pathRef.current, prefs })) setBanner(row);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refreshUnread]);

  // Reading a conversation clears what was waiting about it.
  const openConversation = conversationInPath(pathname);
  useEffect(() => {
    if (!userId || !openConversation) return;
    void supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null)
      .eq('data->>conversation_id', openConversation)
      .then(({ error }) => {
        if (error) debugWarn('Could not clear conversation notifications', error);
      });
  }, [userId, openConversation, version]);

  // The number on the app icon, where the phone has one.
  useEffect(() => {
    if (Platform.OS === 'web' || !Notifications) return;
    Notifications.setBadgeCountAsync(unread).catch(() => {});
  }, [unread]);

  const markRead = useCallback(
    async (id: string) => {
      if (!userId) return;
      setUnread((n) => Math.max(0, n - 1));
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId)
        .is('read_at', null);
      if (error) void refreshUnread();
      setVersion((v) => v + 1);
    },
    [userId, refreshUnread],
  );

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    setUnread(0);
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null);
    if (error) void refreshUnread();
    setVersion((v) => v + 1);
  }, [userId, refreshUnread]);

  const value = useMemo(
    () => ({ unread, version, banner, dismissBanner: () => setBanner(null), markRead, markAllRead }),
    [unread, version, banner, markRead, markAllRead],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
