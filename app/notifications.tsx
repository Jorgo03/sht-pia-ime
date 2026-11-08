import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/ui/action-button';
import { AppHeader } from '@/components/ui/app-header';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { GradientBackground } from '@/components/ui/gradient-background';
import { ScreenHero } from '@/components/ui/screen-hero';
import { SignInPrompt } from '@/components/ui/sign-in-prompt';
import { type AtticoPalette, Fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useNotifications } from '@/contexts/notifications-context';
import { useTheme } from '@/contexts/theme-context';
import { useReadableColumn } from '@/hooks/use-responsive';
import { formatRelativeTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import {
  notificationCopy,
  notificationRoute,
  type AppNotification,
} from '@/src/features/notifications/lib/feed';

const PAGE_SIZE = 24;
type Filter = 'all' | 'unread' | 'read';

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const readable = useReadableColumn();
  const { unread, version, markRead, markAllRead } = useNotifications();

  const [filter, setFilter] = useState<Filter>('all');
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  // Only the newest load may land: filters and live changes overlap.
  const loadSeq = useRef(0);
  const countRef = useRef(0);

  const fetchPage = useCallback(
    (from: number, to: number) => {
      let query = supabase
        .from('notifications')
        .select('id, kind, data, read_at, created_at')
        .eq('user_id', user?.id ?? '')
        .order('created_at', { ascending: false })
        .range(from, to);
      if (filter === 'unread') query = query.is('read_at', null);
      if (filter === 'read') query = query.not('read_at', 'is', null);
      return query;
    },
    [user?.id, filter],
  );

  const load = useCallback(async () => {
    if (!user) return;
    const run = ++loadSeq.current;
    setError(false);
    // A live refresh keeps what is showing, and however much was loaded.
    const size = Math.max(countRef.current, PAGE_SIZE);
    const { data, error: failed } = await fetchPage(0, size - 1);
    if (run !== loadSeq.current) return;
    setLoading(false);
    if (failed) {
      setError(true);
      return;
    }
    const rows = (data ?? []) as AppNotification[];
    countRef.current = rows.length;
    setItems(rows);
    setHasMore(rows.length === size);
  }, [user, fetchPage]);

  useEffect(() => {
    void load();
  }, [load, version]);

  const changeFilter = (next: Filter) => {
    if (next === filter) return;
    countRef.current = 0;
    setItems([]);
    setLoading(true);
    setFilter(next);
  };

  const loadMore = async () => {
    setLoadingMore(true);
    const run = ++loadSeq.current;
    const { data, error: failed } = await fetchPage(items.length, items.length + PAGE_SIZE - 1);
    setLoadingMore(false);
    if (run !== loadSeq.current || failed) return;
    const rows = (data ?? []) as AppNotification[];
    setItems((prev) => {
      const seen = new Set(prev.map((n) => n.id));
      const merged = [...prev, ...rows.filter((n) => !seen.has(n.id))];
      countRef.current = merged.length;
      return merged;
    });
    setHasMore(rows.length === PAGE_SIZE);
  };

  const open = (n: AppNotification) => {
    if (!n.read_at) void markRead(n.id);
    const route = notificationRoute(n);
    if (route) router.push(route as Href);
  };

  if (!user) return <SignInPrompt />;

  const labels: Record<Filter, string> = {
    all: t('notifications.all'),
    unread: t('notifications.unread'),
    read: t('notifications.read'),
  };
  const emptyText =
    filter === 'unread' ? t('notifications.emptyUnread') : filter === 'read' ? t('notifications.emptyRead') : t('notifications.empty');

  return (
    <GradientBackground>
      <SafeAreaView style={[styles.container, readable]} edges={['top']}>
        <AppHeader onBack={() => (router.canGoBack() ? router.back() : router.replace('/' as Href))} />
        <ScreenHero
          pre={t('notifications.headlinePre')}
          em={t('notifications.headlineEm')}
        />
        <View style={styles.controls}>
          <FilterTabs
            compact
            tabs={[labels.all, labels.unread, labels.read]}
            activeTab={labels[filter]}
            onTabChange={(tab) => changeFilter((Object.keys(labels) as Filter[]).find((k) => labels[k] === tab) ?? 'all')}
          />
          {unread > 0 && (
            <TouchableOpacity accessibilityRole="button" style={styles.markAll} onPress={() => void markAllRead()} activeOpacity={0.7}>
              <MaterialIcons name="done-all" size={18} color={colors.accentText} />
              <Text style={styles.markAllText}>{t('notifications.markAll')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <View style={styles.list}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.skeleton} />
            ))}
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.centerText} accessibilityLiveRegion="polite">{t('notifications.loadFailed')}</Text>
            <ActionButton title={t('common.retry')} onPress={() => void load()} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.center}>
            <MaterialIcons name="notifications-none" size={40} color={colors.textSecondary} />
            <Text style={styles.centerText}>{emptyText}</Text>
            {filter === 'all' && <Text style={styles.centerHint}>{t('notifications.emptyHint')}</Text>}
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(n) => n.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={
              hasMore ? (
                <ActionButton
                  variant="secondary"
                  title={loadingMore ? t('common.loading') : t('notifications.loadMore')}
                  onPress={() => void loadMore()}
                  disabled={loadingMore}
                />
              ) : undefined
            }
            renderItem={({ item }) => {
              const { title, body } = notificationCopy(item, t);
              const isUnread = !item.read_at;
              return (
                <View style={[styles.row, isUnread && styles.rowUnread]}>
                  <Pressable style={styles.rowMain} onPress={() => open(item)} accessibilityRole="button">
                    <View style={[styles.dot, isUnread && styles.dotUnread]} />
                    <View style={styles.rowText}>
                      <View style={styles.rowHead}>
                        <Text style={[styles.rowTitle, isUnread && styles.rowTitleUnread]} numberOfLines={2}>{title}</Text>
                        <Text style={styles.rowTime}>{formatRelativeTime(item.created_at, i18n.language)}</Text>
                      </View>
                      <Text style={styles.rowBody}>{body}</Text>
                      {isUnread && <Text style={styles.unreadTag}>{t('notifications.unreadTag')}</Text>}
                    </View>
                  </Pressable>
                  {isUnread && (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`${t('notifications.markRead')}: ${title}`}
                      style={styles.markRead}
                      onPress={() => void markRead(item.id)}
                      activeOpacity={0.7}>
                      <MaterialIcons name="done" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            }}
          />
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    container: { flex: 1 },
    controls: { paddingBottom: 4 },
    markAll: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-end',
      gap: 6,
      minHeight: 44,
      marginTop: -10,
      marginRight: 20,
    },
    markAllText: { fontSize: 14, fontFamily: Fonts.sansSemiBold, color: colors.accentText },
    list: { paddingHorizontal: 20, paddingBottom: 32, gap: 10 },
    skeleton: { height: 84, borderRadius: 16, backgroundColor: colors.glass },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
    centerText: { fontSize: 16, fontFamily: Fonts.sansSemiBold, color: colors.textPrimary, textAlign: 'center' },
    centerHint: { fontSize: 14, lineHeight: 20, fontFamily: Fonts.sans, color: colors.textSecondary, textAlign: 'center' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.primaryLight,
    },
    rowUnread: { borderColor: colors.accent },
    rowMain: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, minHeight: 64 },
    dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5, backgroundColor: 'transparent' },
    dotUnread: { backgroundColor: colors.accent },
    rowText: { flex: 1, gap: 3 },
    rowHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
    rowTitle: { flexShrink: 1, fontSize: 15, fontFamily: Fonts.sansMedium, color: colors.textPrimary },
    rowTitleUnread: { fontFamily: Fonts.sansBold },
    rowTime: { fontSize: 12, fontFamily: Fonts.sans, color: colors.textSecondary },
    rowBody: { fontSize: 14, lineHeight: 20, fontFamily: Fonts.sans, color: colors.textSecondary },
    // In words as well as the dot: not by colour alone.
    unreadTag: { fontSize: 12, fontFamily: Fonts.sansSemiBold, color: colors.accentText },
    markRead: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  });
