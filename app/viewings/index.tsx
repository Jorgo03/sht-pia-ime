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
import { formatDate, getLocalizedText } from '@/lib/format';

type ViewingStatus = 'requested' | 'confirmed' | 'declined' | 'cancelled';

interface ViewingProperty {
  id: string;
  title: string;
  title_i18n: Record<string, string> | null;
  city: string | null;
  owner_id: string | null;
  agent_id: string | null;
}

interface Viewing {
  id: string;
  client_id: string;
  agent_id: string | null;
  scheduled_at: string;
  notes: string | null;
  status: ViewingStatus;
  property: ViewingProperty | null;
}

interface ClientProfile {
  id: string;
  full_name: string | null;
  agency_name: string | null;
}

// Theme-aware, matching web's --fho-status-* (which swap in dark mode) —
// see the same fix in my-listings. Viewing statuses map onto the shared
// status palette: requested→paused, confirmed→active, declined→sold.
function statusColor(colors: AtticoPalette, status: ViewingStatus): string {
  const map: Record<ViewingStatus, string> = {
    requested: colors.statusPaused,
    confirmed: colors.statusActive,
    declined: colors.statusSold,
    cancelled: colors.statusDraft,
  };
  return map[status] ?? colors.statusDraft;
}

function formatWhen(iso: string, lang: string) {
  const time = new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  return `${formatDate(iso, lang)} · ${time}`;
}

export default function ViewingsScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [viewings, setViewings] = useState<Viewing[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ClientProfile>>({});
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState(false);

  // Mirrors the web app's Viewings.jsx load() — RLS already scopes rows to
  // where the user is the client, the agent, or the property owner.
  const load = useCallback(async () => {
    if (!user) {
      setViewings([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('viewings')
      .select('*, property:properties(id, title, title_i18n, city, owner_id, agent_id)')
      .order('scheduled_at', { ascending: true });
    const rows = (data ?? []) as Viewing[];
    setViewings(rows);

    const clientIds = [...new Set(rows.filter((v) => v.client_id !== user.id).map((v) => v.client_id))];
    if (clientIds.length) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name, agency_name').in('id', clientIds);
      setProfiles(Object.fromEntries((profs ?? []).map((p) => [p.id, p])));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (id: string, status: ViewingStatus) => {
    const { error } = await supabase.from('viewings').update({ status }).eq('id', id);
    if (error) {
      setActionError(true);
      setTimeout(() => setActionError(false), 3000);
      return;
    }
    setViewings((prev) => prev.map((v) => (v.id === id ? { ...v, status } : v)));
  };

  const mine = viewings.filter((v) => v.client_id === user?.id);
  const incoming = viewings.filter((v) => v.client_id !== user?.id);

  const renderRow = (v: Viewing, isIncoming: boolean) => {
    const title = v.property ? getLocalizedText(v.property.title_i18n, i18n.language) || v.property.title : '';
    const client = profiles[v.client_id];
    const color = statusColor(colors, v.status);

    return (
      <View key={v.id} style={styles.card}>
        <View style={styles.cardHead}>
          <TouchableOpacity
            disabled={!v.property}
            onPress={() => v.property && router.push(`/property/${v.property.id}` as Href)}
            style={styles.cardTitleWrap}>
            <Text style={styles.cardTitle} numberOfLines={1}>{title || t('viewings.title')}</Text>
          </TouchableOpacity>
          <View style={[styles.statusPill, { backgroundColor: `${color}33` }]}>
            <Text style={[styles.statusPillText, { color }]}>{t(`viewings.status.${v.status}`, v.status)}</Text>
          </View>
        </View>

        <View style={styles.cardMetaRow}>
          <MaterialIcons name="calendar-today" size={13} color={colors.textSecondary} />
          <Text style={styles.cardMetaText}>{formatWhen(v.scheduled_at, i18n.language)}</Text>
          {v.property?.city ? (
            <>
              <MaterialIcons name="location-on" size={13} color={colors.textSecondary} style={{ marginLeft: 8 }} />
              <Text style={styles.cardMetaText}>{v.property.city}</Text>
            </>
          ) : null}
        </View>

        {isIncoming && client ? (
          <Text style={styles.cardFrom}>
            {t('viewings.from', { name: client.full_name || client.agency_name || '?' })}
          </Text>
        ) : null}

        {v.notes ? <Text style={styles.cardNotes}>{v.notes}</Text> : null}

        <View style={styles.cardActions}>
          {isIncoming && v.status === 'requested' && (
            <>
              <TouchableOpacity style={styles.actionButton} onPress={() => setStatus(v.id, 'confirmed')} activeOpacity={0.7}>
                <MaterialIcons name="check" size={14} color={colors.textPrimary} />
                <Text style={styles.actionButtonText}>{t('viewings.confirm')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={() => setStatus(v.id, 'declined')} activeOpacity={0.7}>
                <MaterialIcons name="close" size={14} color={colors.textPrimary} />
                <Text style={styles.actionButtonText}>{t('viewings.decline')}</Text>
              </TouchableOpacity>
            </>
          )}
          {!isIncoming && (v.status === 'requested' || v.status === 'confirmed') && (
            <TouchableOpacity style={styles.actionButton} onPress={() => setStatus(v.id, 'cancelled')} activeOpacity={0.7}>
              <MaterialIcons name="close" size={14} color={colors.textPrimary} />
              <Text style={styles.actionButtonText}>{t('viewings.cancel')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <AppHeader onBack={() => router.back()} />

        {/* Matches web's Viewings.jsx screen-kicker/screen-headline hero. */}
        <View style={styles.heroBlock}>
          <View style={styles.kickerRow}>
            <View style={styles.kickerDash} />
            <Text style={styles.kicker}>{t('viewings.kicker')}</Text>
          </View>
          <Text style={styles.headline}>
            {t('viewings.headlinePre')} <Text style={styles.headlineEm}>{t('viewings.headlineEm')}</Text>
          </Text>
        </View>

        {actionError && <Text style={styles.errorBanner}>{t('errors.updateFailed')}</Text>}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : viewings.length === 0 ? (
          <View style={styles.center}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="calendar-today" size={36} color={colors.accent} />
            </View>
            <Text style={styles.subtitle}>{t('viewings.empty')}</Text>
            <Text style={styles.description}>{t('viewings.emptyHint')}</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {mine.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('viewings.mine')}</Text>
                {mine.map((v) => renderRow(v, false))}
              </View>
            )}
            {incoming.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('viewings.incoming')}</Text>
                {incoming.map((v) => renderRow(v, true))}
              </View>
            )}
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
  errorBanner: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.error,
    paddingVertical: 4,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 20,
  },
  section: {
    gap: 10,
  },
  // Matches web's .section-title__bare.
  sectionTitle: {
    fontFamily: Fonts?.serif,
    fontSize: 18,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  card: {
    backgroundColor: colors.primaryLight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 6,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitleWrap: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  statusPill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardMetaText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  cardFrom: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  cardNotes: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  cardActions: {
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
});
