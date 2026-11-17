import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Link, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppHeader } from '@/components/ui/app-header';
import { GradientBackground } from '@/components/ui/gradient-background';
import { type AtticoPalette, Fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import { formatDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import {
  QUEUES,
  isModerator,
  loadReports,
  resolveReport,
  setListingHidden,
  type ModerationReport,
} from '@/src/features/moderation/lib/moderation';

// Moderation queue for reported listings and users (docs/LAUNCH_TASKS.md F3),
// ported from the Vite site. Website only (app/moderation.tsx sends the phone
// apps home). Only people the owner added to public.moderators get past the
// check, and the database enforces the same rule on every read and action.

type Queue = 'open' | 'closed';
type Styles = ReturnType<typeof createStyles>;

export default function ModerationScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [queue, setQueue] = useState<Queue>('open');
  const [rows, setRows] = useState<ModerationReport[]>([]);
  const [more, setMore] = useState(false);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    (user ? isModerator(supabase) : Promise.resolve(false)).then((ok) => {
      if (active) setAllowed(ok);
    });
    return () => {
      active = false;
    };
  }, [user, authLoading]);

  const apply = useCallback((result: Awaited<ReturnType<typeof loadReports>>) => {
    if (!result) {
      setState('error');
      return;
    }
    setRows(result.rows);
    setMore(result.more);
    setState('ready');
  }, []);

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    loadReports(supabase, { queue }).then((result) => {
      if (active) apply(result);
    });
    return () => {
      active = false;
    };
  }, [allowed, queue, apply]);

  const switchQueue = (next: Queue) => {
    if (next === queue) return;
    setState('loading');
    setRows([]);
    setQueue(next);
  };

  const retry = () => {
    setState('loading');
    loadReports(supabase, { queue }).then(apply);
  };

  const loadMore = async () => {
    setLoadingMore(true);
    const result = await loadReports(supabase, { queue, offset: rows.length });
    setLoadingMore(false);
    if (!result) {
      setState('error');
      return;
    }
    setRows((prev) => [...prev, ...result.rows]);
    setMore(result.more);
  };

  // A resolved report leaves the open queue; a hidden or restored listing is
  // updated on every report about it.
  const onResolved = (id: string) => setRows((prev) => (queue === 'open' ? prev.filter((r) => r.id !== id) : prev));
  const onListingChanged = (propertyId: string, hidden: boolean) =>
    setRows((prev) =>
      prev.map((r) =>
        r.property_id === propertyId && r.listing
          ? {
              ...r,
              listing: {
                ...r.listing,
                moderation_hold: hidden,
                status: hidden ? 'pending_review' : r.listing.status === 'pending_review' ? 'active' : r.listing.status,
              },
            }
          : r,
      ),
    );

  const back = () => (router.canGoBack() ? router.back() : router.replace('/profile'));

  let body;
  if (allowed === null) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  } else if (!allowed) {
    body = (
      <View style={styles.center}>
        <View style={styles.emptyIcon}>
          <MaterialIcons name="verified-user" size={34} color={colors.accent} />
        </View>
        <Text style={styles.emptyTitle}>{t('moderation.notAllowed')}</Text>
      </View>
    );
  } else {
    body = (
      <>
        <View style={styles.segment} accessibilityRole="tablist" accessibilityLabel={t('moderation.title')}>
          {QUEUES.map((q) => {
            const on = q === queue;
            return (
              <Pressable
                key={q}
                style={[styles.segmentItem, on && styles.segmentItemOn]}
                onPress={() => switchQueue(q)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}>
                <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{t(`moderation.queue.${q}`)}</Text>
              </Pressable>
            );
          })}
        </View>
        {state === 'loading' ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : state === 'error' ? (
          <View style={styles.center} accessibilityRole="alert">
            <Text style={styles.emptyTitle}>{t('moderation.loadFailed')}</Text>
            <TouchableOpacity style={styles.pill} onPress={retry} accessibilityRole="button">
              <MaterialIcons name="refresh" size={16} color={colors.textPrimary} />
              <Text style={styles.pillText}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.center}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="verified-user" size={34} color={colors.accent} />
            </View>
            <Text style={styles.emptyTitle}>{t(queue === 'open' ? 'moderation.empty' : 'moderation.emptyClosed')}</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {rows.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                lang={i18n.language}
                styles={styles}
                colors={colors}
                onResolved={onResolved}
                onListingChanged={onListingChanged}
              />
            ))}
            {more && (
              <TouchableOpacity style={[styles.pill, styles.loadMore]} onPress={loadMore} disabled={loadingMore} accessibilityRole="button">
                <Text style={styles.pillText}>{loadingMore ? t('common.loading') : t('moderation.loadMore')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </>
    );
  }

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <AppHeader onBack={back} />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <Text style={styles.title} accessibilityRole="header">{t('moderation.title')}</Text>
            {allowed ? <Text style={styles.subtitle}>{t('moderation.subtitle')}</Text> : null}
          </View>
          {body}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

function ReportCard({
  report,
  lang,
  styles,
  colors,
  onResolved,
  onListingChanged,
}: {
  report: ModerationReport;
  lang: string;
  styles: Styles;
  colors: AtticoPalette;
  onResolved: (id: string) => void;
  onListingChanged: (propertyId: string, hidden: boolean) => void;
}) {
  const { t } = useTranslation();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const { listing, person } = report;
  const open = report.status === 'open';

  const run = async (action: () => Promise<boolean>) => {
    setBusy(true);
    setFailed(false);
    const ok = await action();
    setBusy(false);
    if (!ok) setFailed(true);
  };

  const toggleHidden = () =>
    run(async () => {
      if (!listing || !report.property_id) return false;
      const hide = !listing.moderation_hold;
      const ok = await setListingHidden(supabase, report.property_id, hide);
      if (ok) onListingChanged(report.property_id, hide);
      return ok;
    });

  const resolve = (status: 'actioned' | 'dismissed') =>
    run(async () => {
      const ok = await resolveReport(supabase, report.id, status, note);
      if (ok) onResolved(report.id);
      return ok;
    });

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.reason} accessibilityRole="header">{t(`safety.reason.${report.reason}`)}</Text>
        <Text style={styles.meta}>{t('moderation.reportedOn', { date: formatDate(report.created_at, lang) })}</Text>
      </View>

      {report.property_id ? (
        <View style={styles.targetRow}>
          <MaterialIcons name="apartment" size={16} color={colors.textSecondary} accessibilityLabel={t('moderation.listing')} />
          {listing ? (
            <Link href={`/property/${listing.id}`} style={styles.targetLink}>{listing.title || listing.id}</Link>
          ) : (
            <Text style={styles.meta}>{t('moderation.missingTarget')}</Text>
          )}
          {listing?.moderation_hold ? <Text style={styles.badge}>{t('moderation.hiddenBadge')}</Text> : null}
        </View>
      ) : null}
      {report.reported_user_id ? (
        <View style={styles.targetRow}>
          <MaterialIcons name="person" size={16} color={colors.textSecondary} accessibilityLabel={t('moderation.user')} />
          {person ? (
            person.role === 'agent' ? (
              <Link href={`/agent/${person.id}`} style={styles.targetLink}>{person.full_name || person.id}</Link>
            ) : (
              <Text style={styles.targetText}>{person.full_name || person.id}</Text>
            )
          ) : (
            <Text style={styles.meta}>{t('moderation.missingTarget')}</Text>
          )}
        </View>
      ) : null}

      {report.details ? <Text style={styles.details}>{report.details}</Text> : null}

      {!open ? (
        <Text style={styles.meta}>
          {t(`moderation.status.${report.status}`)}
          {report.reviewed_at ? ` · ${formatDate(report.reviewed_at, lang)}` : ''}
          {report.resolution_note ? ` · ${report.resolution_note}` : ''}
        </Text>
      ) : (
        <View style={styles.noteBlock}>
          <Text style={styles.meta} nativeID={`note-${report.id}`}>{t('moderation.note')}</Text>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            maxLength={1000}
            multiline
            accessibilityLabel={t('moderation.note')}
          />
        </View>
      )}

      <View style={styles.actions}>
        {listing ? (
          <TouchableOpacity style={styles.pill} disabled={busy} onPress={toggleHidden} accessibilityRole="button">
            <MaterialIcons name={listing.moderation_hold ? 'visibility' : 'visibility-off'} size={15} color={colors.textPrimary} />
            <Text style={styles.pillText}>{t(listing.moderation_hold ? 'moderation.restore' : 'moderation.hide')}</Text>
          </TouchableOpacity>
        ) : null}
        {open ? (
          <>
            <TouchableOpacity style={styles.pill} disabled={busy} onPress={() => resolve('actioned')} accessibilityRole="button">
              <Text style={styles.pillText}>{t('moderation.markActioned')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pill} disabled={busy} onPress={() => resolve('dismissed')} accessibilityRole="button">
              <Text style={styles.pillText}>{t('moderation.dismiss')}</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>
      {failed ? <Text style={styles.error} accessibilityRole="alert">{t('moderation.actionFailed')}</Text> : null}
    </View>
  );
}

const createStyles = (colors: AtticoPalette) => StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 48, gap: 14 },
  hero: { gap: 6, paddingTop: 8 },
  title: { fontFamily: Fonts?.serif, fontSize: 28, fontWeight: '500', color: colors.textPrimary },
  subtitle: { fontFamily: Fonts?.sans, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  center: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 48, paddingHorizontal: 16 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: { fontFamily: Fonts?.sansSemiBold, fontSize: 17, color: colors.textPrimary, textAlign: 'center' },
  segment: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.glass,
  },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10 },
  segmentItemOn: { backgroundColor: colors.accent },
  segmentText: { fontFamily: Fonts?.sansSemiBold, fontSize: 13, color: colors.textSecondary },
  segmentTextOn: { color: '#fff' },
  list: { gap: 12 },
  card: { gap: 8, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.glass },
  cardHead: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  reason: { fontFamily: Fonts?.sansBold, fontSize: 15, color: colors.textPrimary },
  meta: { fontFamily: Fonts?.sans, fontSize: 12, color: colors.textSecondary },
  targetRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  targetLink: { fontFamily: Fonts?.sans, fontSize: 14, color: colors.textPrimary, textDecorationLine: 'underline' },
  targetText: { fontFamily: Fonts?.sans, fontSize: 14, color: colors.textPrimary },
  badge: {
    fontFamily: Fonts?.sansSemiBold,
    fontSize: 11,
    color: colors.textPrimary,
    backgroundColor: colors.primaryLight,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  details: { fontFamily: Fonts?.sans, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  noteBlock: { gap: 4 },
  noteInput: {
    minHeight: 64,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.primaryLight,
    padding: 10,
    fontFamily: Fonts?.sans,
    fontSize: 14,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.glass,
  },
  pillText: { fontFamily: Fonts?.sansSemiBold, fontSize: 13, color: colors.textPrimary },
  loadMore: { alignSelf: 'center' },
  error: { fontFamily: Fonts?.sans, fontSize: 13, color: colors.error },
});
