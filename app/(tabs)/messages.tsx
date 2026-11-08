import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useTabBarClearance } from '@/components/liquid-tab-bar';
import { ActionButton } from '@/components/ui/action-button';
import { AppHeader } from '@/components/ui/app-header';
import { ScreenHero } from '@/components/ui/screen-hero';
import { GradientBackground } from '@/components/ui/gradient-background';
import { type AtticoPalette, Fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';
import { formatRelativeTime, getLocalizedText } from '@/lib/format';
import { loadBlockedIds } from '@/src/features/safety/lib/safety';
import { useReadableColumn } from '@/hooks/use-responsive';
import { debugWarn } from '@/lib/debug';

interface Conversation {
  id: string;
  client_id: string;
  agent_id: string;
  property_id: string | null;
  last_message_at: string | null;
  unread_for_client: number | null;
  unread_for_agent: number | null;
}

interface OtherProfile {
  id: string;
  full_name: string | null;
  agency_name: string | null;
}

interface PropertyStub {
  id: string;
  title: string;
  title_i18n: Record<string, string> | null;
}

interface InboxCache {
  userId: string;
  conversations: Conversation[];
  profiles: Record<string, OtherProfile>;
  properties: Record<string, PropertyStub>;
  blocked: Set<string>;
}

// The last full inbox, so reopening Messages shows the previous list
// instantly and refreshes it in the background instead of holding the
// screen on a spinner for two round trips every time. Keyed by account
// and cleared on sign-out — a shared phone never shows the previous
// person's conversations.
let inboxCache: InboxCache | null = null;

// Every subscription gets its own name. supabase.channel() hands back a channel
// of the same name if it is still there, and removeChannel is asynchronous, so
// re-subscribing under one name (the signed-in user object changes on every
// token refresh) threw "cannot add postgres_changes callbacks after subscribe()".
let inboxChannelSeq = 0;

export default function MessagesInboxScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { user, isAgent } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // A centred column on an unfolded Fold or a spanned Duo (hooks/use-responsive).
  const readable = useReadableColumn();
  // A real tab: the bottom menu stays on screen and the person chooses
  // where to go next. Nothing here sends them anywhere by itself.
  const tabBarClearance = useTabBarClearance();

  // Android's own back button would otherwise jump to Home (the tab
  // navigator's default). Here the person picks the next tab from the menu,
  // as on iPhone, so back stays put. Only while this list is on screen: an
  // open chat is a screen above it, and its back still returns here.
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => sub.remove();
    }, []),
  );
  const initial = user && inboxCache?.userId === user.id ? inboxCache : null;
  const [conversations, setConversations] = useState<Conversation[]>(() => initial?.conversations ?? []);
  const [profiles, setProfiles] = useState<Record<string, OtherProfile>>(() => initial?.profiles ?? {});
  const [properties, setProperties] = useState<Record<string, PropertyStub>>(() => initial?.properties ?? {});
  // Cached inbox: no spinner, the list is already there. First open: the
  // header and hero render at once and only the list area loads.
  const [loading, setLoading] = useState(() => !initial);
  const [error, setError] = useState(false);
  // True once names and titles have arrived (or came from cache). Until
  // then the list shows skeleton rows, not rows named '?' — the history
  // (conversations) is already there, only its labels are still loading.
  const [detailsReady, setDetailsReady] = useState(() => !!initial);
  // People this user has blocked, tagged in the list.
  const [blocked, setBlocked] = useState<Set<string>>(() => initial?.blocked ?? new Set());
  // Only the newest refresh may apply its details — realtime can fire
  // several while one is still awaiting the batched lookups.
  const loadSeq = useRef(0);
  // A different account on an already-mounted screen (sign-out → sign-in
  // without leaving) must never see the previous person's list, even
  // briefly, from state or from the cache above.
  const lastUserId = useRef(user?.id);
  useEffect(() => {
    const next = user?.id;
    if (next && lastUserId.current && next !== lastUserId.current && inboxCache?.userId !== next) {
      setConversations([]);
      setProfiles({});
      setProperties({});
      setBlocked(new Set());
      setDetailsReady(false);
      setLoading(true);
    }
    lastUserId.current = next;
  }, [user?.id]);

  // Mirrors the web app's Messages.jsx loadConversations() exactly — same
  // query, same batched profile/property lookups for the list preview —
  // split in two so the list renders on the first answer instead of
  // holding the whole screen on a spinner until the second.
  const loadConversations = useCallback(async () => {
    if (!user) {
      inboxCache = null;
      setConversations([]);
      setLoading(false);
      return;
    }
    const run = ++loadSeq.current;
    setError(false);
    const { data, error: convoError } = await supabase
      .from('conversations')
      .select('*')
      .or(`client_id.eq.${user.id},agent_id.eq.${user.id}`)
      .order('last_message_at', { ascending: false });
    if (run !== loadSeq.current) return;
    // The error was previously discarded, so a failed fetch fell through to the
    // empty state — an agent whose leads failed to load was told they had no
    // conversations at all.
    if (convoError) {
      debugWarn('Messages', convoError);
      setError(true);
      setLoading(false);
      return;
    }
    const convos = data ?? [];
    // Stage one: the list (and the hero counts) is correct now; names and
    // titles fill in from stage two as background data.
    setConversations(convos);
    setLoading(false);

    const otherIds = [...new Set(convos.map((c) => (c.client_id === user.id ? c.agent_id : c.client_id)))];
    const propIds = [...new Set(convos.map((c) => c.property_id).filter(Boolean))] as string[];

    const [profRes, propRes, blockedIds] = await Promise.all([
      otherIds.length
        ? supabase.from('profiles').select('id, full_name, agency_name').in('id', otherIds)
        : Promise.resolve({ data: [] as OtherProfile[] }),
      propIds.length
        ? supabase.from('properties').select('id, title, title_i18n').in('id', propIds)
        : Promise.resolve({ data: [] as PropertyStub[] }),
      loadBlockedIds(supabase),
    ]);
    if (run !== loadSeq.current) return;
    const nextProfiles = Object.fromEntries((profRes.data ?? []).map((p) => [p.id, p]));
    const nextProperties = Object.fromEntries((propRes.data ?? []).map((p) => [p.id, p]));
    setBlocked(blockedIds);
    setProfiles(nextProfiles);
    setProperties(nextProperties);
    setDetailsReady(true);
    inboxCache = {
      userId: user.id,
      conversations: convos,
      profiles: nextProfiles,
      properties: nextProperties,
      blocked: blockedIds,
    };
  }, [user]);

  // On every visit, not only the first: a tab stays mounted between visits.
  // One fetch per focus; while it is open the realtime channel below keeps
  // it current.
  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [loadConversations]),
  );

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`messages-inbox-${++inboxChannelSeq}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, loadConversations)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadConversations]);

  const unreadTotal = conversations.reduce(
    (sum, c) => sum + ((c.client_id === user?.id ? c.unread_for_client : c.unread_for_agent) ?? 0),
    0,
  );

  if (!user) {
    return (
      <GradientBackground>
        <SafeAreaView style={[styles.container, readable]} edges={['top']}>
          <AppHeader />
          <View style={styles.center}>
            <Text style={styles.description}>{t('messages.loginPrompt')}</Text>
            {/* Sign-in lives on the Profile tab; without this the screen was
                a dead end. */}
            <View style={styles.signInButton}>
              <ActionButton title={t('common.signIn')} onPress={() => router.navigate('/(tabs)/profile' as Href)} />
            </View>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <SafeAreaView style={[styles.container, readable]} edges={['top']}>
        <AppHeader />

        {/* Matches web's Messages.jsx screen-kicker/screen-headline hero
            exactly, including the agent-vs-client copy split. */}
        <ScreenHero
          kicker={isAgent
                ? t('messages.agent.kicker', { leads: conversations.length, newToday: unreadTotal })
                : t('messages.client.kicker', { count: conversations.length, unread: unreadTotal })}
          pre={isAgent ? t('messages.agent.headlinePre') : t('messages.client.headlinePre')}
          em={isAgent ? t('messages.agent.headlineEm') : t('messages.client.headlineEm')}
        />

        {/* Only the list area loads: the header and hero above are already
            there, so opening Messages never waits on the network — and a
            refresh that fails keeps the previous list instead of swapping
            it for an error. */}
        {loading && conversations.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : error && conversations.length === 0 ? (
          <View style={styles.center}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="error-outline" size={40} color={colors.accent} />
            </View>
            <Text style={styles.subtitle}>{t('errors.generic')}</Text>
            <TouchableOpacity accessibilityRole="button" onPress={loadConversations} activeOpacity={0.7}>
              <Text style={styles.retryText}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : conversations.length === 0 ? (
          <View style={styles.center}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="mail-outline" size={40} color={colors.accent} />
            </View>
            <Text style={styles.subtitle}>{t('messages.empty')}</Text>
            <Text style={styles.description}>{t('messages.emptyHint')}</Text>
          </View>
        ) : !detailsReady ? (
          // Rows confirmed, labels still loading: placeholder rows keep the
          // list's shape instead of flashing rows named '?'.
          <View style={styles.list} accessibilityLiveRegion="polite">
            {[0, 1, 2, 3, 4].map((n) => (
              <View key={n} style={styles.skeletonRow}>
                <View style={styles.skeletonAvatar} />
                <View style={styles.skeletonBody}>
                  <View style={styles.skeletonLineWide} />
                  <View style={styles.skeletonLineNarrow} />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.list, { paddingBottom: tabBarClearance }]}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const otherId = item.client_id === user.id ? item.agent_id : item.client_id;
              const other = profiles[otherId];
              const prop = item.property_id ? properties[item.property_id] : null;
              const myUnread = (item.client_id === user.id ? item.unread_for_client : item.unread_for_agent) ?? 0;
              const name = other?.full_name || other?.agency_name || '?';
              const propTitle = prop ? getLocalizedText(prop.title_i18n, i18n.language) || prop.title : '';

              return (
                <TouchableOpacity
                  accessibilityRole="button"
                  style={[styles.row, myUnread > 0 && styles.rowUnread]}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/messages/${item.id}` as Href)}>
                  <LinearGradient colors={[colors.accent, colors.accentEnd]} style={styles.avatar}>
                    <Text style={styles.avatarText}>{name[0]?.toUpperCase() || '?'}</Text>
                  </LinearGradient>
                  <View style={styles.rowBody}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.rowName, styles.nameFlex]} numberOfLines={1}>{name}</Text>
                      {blocked.has(otherId) ? (
                        <Text style={styles.blockedBadge}>{t('safety.blockedBadge')}</Text>
                      ) : null}
                    </View>
                    {propTitle ? (
                      <Text style={styles.rowPreview} numberOfLines={1}>{propTitle}</Text>
                    ) : null}
                  </View>
                  <View style={styles.rowMeta}>
                    <Text style={styles.rowTime}>{formatRelativeTime(item.last_message_at, i18n.language)}</Text>
                    {myUnread > 0 && <View style={styles.unreadDot} />}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}

const createStyles = (colors: AtticoPalette) => StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 17,
    fontFamily: Fonts.sansSemiBold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  description: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  signInButton: {
    alignSelf: 'stretch',
    marginTop: 12,
  },
  // Matches the home screen's retry affordance so the two error states read
  // as the same control.
  retryText: {
    fontSize: 14,
    fontFamily: Fonts.sansSemiBold,
    color: colors.accentText,
    marginTop: 12,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  skeletonAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.glass,
  },
  skeletonBody: {
    flex: 1,
    gap: 8,
  },
  skeletonLineWide: {
    height: 14,
    width: '60%',
    borderRadius: 7,
    backgroundColor: colors.glass,
  },
  skeletonLineNarrow: {
    height: 12,
    width: '40%',
    borderRadius: 6,
    backgroundColor: colors.glass,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  // Mirrors web's .msg-row.unread { background: var(--fho-surface) }.
  rowUnread: {
    backgroundColor: colors.primaryLight,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 17,
    fontFamily: Fonts.sansBold,
    color: '#fff',
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontSize: 15,
    fontFamily: Fonts.sansSemiBold,
    color: colors.textPrimary,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameFlex: {
    flexShrink: 1,
  },
  blockedBadge: {
    fontSize: 12,
    fontFamily: Fonts.sansSemiBold,
    color: colors.textSecondary,
    backgroundColor: colors.surface2,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  rowPreview: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: colors.textSecondary,
  },
  rowMeta: {
    alignItems: 'flex-end',
    gap: 6,
  },
  rowTime: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: colors.textSecondary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
});
