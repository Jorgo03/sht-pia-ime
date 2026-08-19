import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppHeader } from '@/components/ui/app-header';
import { GradientBackground } from '@/components/ui/gradient-background';
import { type AtticoPalette, Fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';
import { formatRelativeTime, getLocalizedText } from '@/lib/format';

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

export default function MessagesInboxScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { user, isAgent } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [profiles, setProfiles] = useState<Record<string, OtherProfile>>({});
  const [properties, setProperties] = useState<Record<string, PropertyStub>>({});
  const [loading, setLoading] = useState(true);

  // Mirrors the web app's Messages.jsx loadConversations() exactly — same
  // query, same batched profile/property lookups for the list preview.
  const loadConversations = useCallback(async () => {
    if (!user) {
      setConversations([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .or(`client_id.eq.${user.id},agent_id.eq.${user.id}`)
      .order('last_message_at', { ascending: false });
    const convos = data ?? [];
    setConversations(convos);

    const otherIds = [...new Set(convos.map((c) => (c.client_id === user.id ? c.agent_id : c.client_id)))];
    const propIds = [...new Set(convos.map((c) => c.property_id).filter(Boolean))] as string[];

    const [profRes, propRes] = await Promise.all([
      otherIds.length
        ? supabase.from('profiles').select('id, full_name, agency_name').in('id', otherIds)
        : Promise.resolve({ data: [] as OtherProfile[] }),
      propIds.length
        ? supabase.from('properties').select('id, title, title_i18n').in('id', propIds)
        : Promise.resolve({ data: [] as PropertyStub[] }),
    ]);
    setProfiles(Object.fromEntries((profRes.data ?? []).map((p) => [p.id, p])));
    setProperties(Object.fromEntries((propRes.data ?? []).map((p) => [p.id, p])));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('messages-inbox')
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
        <SafeAreaView style={styles.container} edges={['top']}>
          <AppHeader onBack={() => router.back()} />
          <View style={styles.center}>
            <Text style={styles.description}>{t('messages.loginPrompt')}</Text>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <AppHeader onBack={() => router.back()} />

        {/* Matches web's Messages.jsx screen-kicker/screen-headline hero
            exactly, including the agent-vs-client copy split. */}
        <View style={styles.heroBlock}>
          <View style={styles.kickerRow}>
            <View style={styles.kickerDash} />
            <Text style={styles.kicker}>
              {isAgent
                ? t('messages.agent.kicker', { leads: conversations.length, newToday: unreadTotal })
                : t('messages.client.kicker', { count: conversations.length, unread: unreadTotal })}
            </Text>
          </View>
          <Text style={styles.headline}>
            {isAgent ? t('messages.agent.headlinePre') : t('messages.client.headlinePre')}{' '}
            <Text style={styles.headlineEm}>
              {isAgent ? t('messages.agent.headlineEm') : t('messages.client.headlineEm')}
            </Text>
          </Text>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : conversations.length === 0 ? (
          <View style={styles.center}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="mail-outline" size={40} color={colors.accent} />
            </View>
            <Text style={styles.subtitle}>{t('messages.empty')}</Text>
            <Text style={styles.description}>{t('messages.emptyHint')}</Text>
          </View>
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
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
                  style={[styles.row, myUnread > 0 && styles.rowUnread]}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/messages/${item.id}` as Href)}>
                  <LinearGradient colors={[colors.accent, colors.accentEnd]} style={styles.avatar}>
                    <Text style={styles.avatarText}>{name[0]?.toUpperCase() || '?'}</Text>
                  </LinearGradient>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowName} numberOfLines={1}>{name}</Text>
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
  // Matches web's .screen-kicker / .screen-headline exactly.
  heroBlock: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  kickerDash: {
    width: 14,
    height: 1,
    backgroundColor: colors.accent,
  },
  kicker: {
    fontFamily: Fonts?.mono,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    fontWeight: '600',
  },
  headline: {
    fontFamily: Fonts?.serif,
    fontSize: 28,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  headlineEm: {
    fontStyle: 'italic',
    color: colors.accent,
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
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
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
    fontWeight: '700',
    color: '#fff',
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  rowPreview: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  rowMeta: {
    alignItems: 'flex-end',
    gap: 6,
  },
  rowTime: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
});
