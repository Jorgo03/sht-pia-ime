import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppHeader } from '@/components/ui/app-header';
import { GradientBackground } from '@/components/ui/gradient-background';
import { type AtticoPalette, Fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';
import { formatDate, formatPrice, getLocalizedText } from '@/lib/format';

interface Stats {
  listings: number;
  views: number;
  conversations: number;
  leads: number;
}

interface PendingViewing {
  id: string;
  client_id: string;
  scheduled_at: string;
  property: { id: string; title: string; title_i18n: Record<string, string> | null; city: string | null } | null;
}

interface WantedHome {
  id: string;
  client_id: string;
  city: string;
  listing_type: string;
  max_price: number | null;
  min_bedrooms: number | null;
  notes: string | null;
  created_at: string;
}

interface ClientProfile {
  full_name: string | null;
  phone: string | null;
}

export default function AgentDashboardScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [stats, setStats] = useState<Stats>({ listings: 0, views: 0, conversations: 0, leads: 0 });
  const [pendingViewings, setPendingViewings] = useState<PendingViewing[]>([]);
  const [wantedFeed, setWantedFeed] = useState<WantedHome[]>([]);
  const [clientProfiles, setClientProfiles] = useState<Record<string, ClientProfile>>({});
  const [actionError, setActionError] = useState(false);

  // Mirrors the web app's AgentDashboard.jsx load() exactly — same five
  // parallel queries, same 30-day view window, same real counts (no
  // hardcoded numbers anywhere in this screen).
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(false);
    try {
      const since = new Date();
      since.setDate(since.getDate() - 30);

      const { data: myProps } = await supabase
        .from('properties')
        .select('id, status')
        .or(`owner_id.eq.${user.id},agent_id.eq.${user.id}`);
      const propIds = (myProps ?? []).map((p) => p.id);

      const [viewsRes, convRes, leadsRes, viewingsRes, wantedRes] = await Promise.all([
        propIds.length
          ? supabase
              .from('property_activity')
              .select('id', { count: 'exact', head: true })
              .in('property_id', propIds)
              .eq('type', 'view')
              .gte('created_at', since.toISOString())
          : Promise.resolve({ count: 0 }),
        supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('agent_id', user.id),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('agent_id', user.id),
        supabase
          .from('viewings')
          .select('*, property:properties(id, title, title_i18n, city)')
          .eq('status', 'requested')
          .neq('client_id', user.id)
          .order('scheduled_at', { ascending: true })
          .limit(10),
        supabase.from('wanted_homes').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(10),
      ]);

      setStats({
        listings: (myProps ?? []).filter((p) => p.status === 'active').length,
        views: viewsRes.count ?? 0,
        conversations: convRes.count ?? 0,
        leads: leadsRes.count ?? 0,
      });
      const pv = (viewingsRes.data ?? []) as PendingViewing[];
      setPendingViewings(pv);
      const wf = (wantedRes.data ?? []) as WantedHome[];
      setWantedFeed(wf);

      const clientIds = [...new Set([...pv.map((v) => v.client_id), ...wf.map((w) => w.client_id)])];
      if (clientIds.length) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name, phone').in('id', clientIds);
        setClientProfiles(Object.fromEntries((profs ?? []).map((p) => [p.id, p])));
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const setViewingStatus = async (id: string, status: 'confirmed' | 'declined') => {
    const { error: err } = await supabase.from('viewings').update({ status }).eq('id', id);
    if (err) {
      setActionError(true);
      setTimeout(() => setActionError(false), 3000);
      return;
    }
    setPendingViewings((prev) => prev.filter((v) => v.id !== id));
  };

  const statCards: { icon: keyof typeof MaterialIcons.glyphMap; label: string; value: number; to?: Href }[] = [
    { icon: 'apartment', label: t('agentDashboard.statListings'), value: stats.listings, to: '/my-listings' as Href },
    { icon: 'visibility', label: t('agentDashboard.statViews'), value: stats.views },
    { icon: 'mail-outline', label: t('agentDashboard.statConversations'), value: stats.conversations, to: '/messages' as Href },
    { icon: 'people-outline', label: t('agentDashboard.statLeads'), value: stats.leads },
  ];

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <AppHeader onBack={() => router.back()} />

        {/* Matches web's AgentDashboard.jsx screen-kicker/screen-headline hero. */}
        <View style={styles.heroBlock}>
          <View style={styles.kickerRow}>
            <View style={styles.kickerDash} />
            <Text style={styles.kicker}>{t('agentDashboard.kicker')}</Text>
          </View>
          <Text style={styles.headline}>
            {t('agentDashboard.headlinePre')} <Text style={styles.headlineEm}>{t('agentDashboard.headlineEm')}</Text>
          </Text>
        </View>

        {actionError && <Text style={styles.errorBanner}>{t('errors.updateFailed')}</Text>}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.description}>{t('common.error')}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={load} activeOpacity={0.8}>
              <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.statGrid}>
              {statCards.map((card) => (
                <TouchableOpacity
                  key={card.label}
                  style={styles.statCard}
                  disabled={!card.to}
                  onPress={() => card.to && router.push(card.to)}
                  activeOpacity={card.to ? 0.7 : 1}>
                  <MaterialIcons name={card.icon} size={20} color={colors.accent} />
                  <Text style={styles.statValue}>{card.value}</Text>
                  <Text style={styles.statLabel}>{card.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>{t('agentDashboard.pendingViewings')}</Text>
                <TouchableOpacity onPress={() => router.push('/viewings' as Href)}>
                  <Text style={styles.sectionLink}>{t('home.seeAll')}</Text>
                </TouchableOpacity>
              </View>
              {pendingViewings.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyCardText}>{t('agentDashboard.noPendingViewings')}</Text>
                </View>
              ) : (
                pendingViewings.map((v) => {
                  const title = v.property ? getLocalizedText(v.property.title_i18n, i18n.language) || v.property.title : '';
                  const client = clientProfiles[v.client_id];
                  const time = new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit' }).format(
                    new Date(v.scheduled_at),
                  );
                  return (
                    <View key={v.id} style={styles.listCard}>
                      <Text style={styles.listCardTitle}>{title}</Text>
                      <View style={styles.metaRow}>
                        <MaterialIcons name="event" size={13} color={colors.textSecondary} />
                        <Text style={styles.listCardMeta}>
                          {formatDate(v.scheduled_at, i18n.language)} · {time}
                          {client ? ` · ${client.full_name || '?'}` : ''}
                        </Text>
                      </View>
                      <View style={styles.listCardActions}>
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => setViewingStatus(v.id, 'confirmed')}
                          activeOpacity={0.7}>
                          <MaterialIcons name="check" size={14} color={colors.textPrimary} />
                          <Text style={styles.actionButtonText}>{t('viewings.confirm')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => setViewingStatus(v.id, 'declined')}
                          activeOpacity={0.7}>
                          <MaterialIcons name="close" size={14} color={colors.textPrimary} />
                          <Text style={styles.actionButtonText}>{t('viewings.decline')}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>{t('agentDashboard.wantedFeed')}</Text>
                <Text style={styles.sectionSub}>{t('agentDashboard.wantedFeedSub')}</Text>
              </View>
              {wantedFeed.length === 0 ? (
                <View style={styles.emptyCard}>
                  <MaterialIcons name="favorite-border" size={20} color={colors.textSecondary} />
                  <Text style={styles.emptyCardText}>{t('agentDashboard.wantedEmpty')}</Text>
                </View>
              ) : (
                wantedFeed.map((w) => {
                  const client = clientProfiles[w.client_id];
                  return (
                    <View key={w.id} style={styles.listCard}>
                      <View style={styles.wantedHead}>
                        <View style={styles.metaRow}>
                          <MaterialIcons name="place" size={13} color={colors.textSecondary} />
                          <Text style={styles.listCardTitle}>
                            {w.city} · {t(`listing.type.${w.listing_type}`, w.listing_type)}
                          </Text>
                        </View>
                        <Text style={styles.wantedDate}>{formatDate(w.created_at, i18n.language)}</Text>
                      </View>
                      <View style={styles.wantedMetaRow}>
                        {w.max_price ? (
                          <Text style={styles.listCardMeta}>
                            {t('addSheet.maxPrice')}: {formatPrice(w.max_price, i18n.language)}
                          </Text>
                        ) : null}
                        {w.min_bedrooms ? (
                          <Text style={styles.listCardMeta}>
                            {t('addSheet.minBedrooms')}: {w.min_bedrooms}+
                          </Text>
                        ) : null}
                        {client?.full_name ? <Text style={styles.listCardMeta}>· {client.full_name}</Text> : null}
                      </View>
                      {w.notes ? <Text style={styles.listCardMeta}>{w.notes}</Text> : null}
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>
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
    paddingBottom: 4,
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
    gap: 12,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.accent,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  errorBanner: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.error,
    paddingVertical: 4,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 24,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: colors.primaryLight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  section: {
    gap: 10,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Matches web's .section-title h2.
  sectionTitle: {
    fontFamily: Fonts?.serif,
    fontSize: 18,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  sectionLink: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
  },
  sectionSub: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  emptyCardText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  listCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 6,
  },
  listCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  listCardMeta: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listCardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  // Matches web's .pill-btn — transparent, pill radius.
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  wantedHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wantedDate: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  wantedMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
