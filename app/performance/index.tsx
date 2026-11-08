import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BaselineSheet } from '@/components/performance/baseline-sheet';
import { DateField } from '@/components/performance/date-field';
import { AppHeader } from '@/components/ui/app-header';
import { Chip } from '@/components/ui/chip';
import { GradientBackground } from '@/components/ui/gradient-background';
import { ScreenHero } from '@/components/ui/screen-hero';
import { SignInPrompt } from '@/components/ui/sign-in-prompt';
import { Fonts, Radii, type AtticoPalette } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import { usePerformanceReport, useSaveBaseline, type PerformanceReport } from '@/hooks/use-performance-report';
import { useReadableColumn } from '@/hooks/use-responsive';
import { formatDate } from '@/lib/format';
import {
  PERIODS,
  achievements,
  compareToBaseline,
  monthsActive,
  periodRange,
  recentMonths,
  type MonthPoint,
  type Period,
} from '@/src/lib/performanceReport';

type ChartMetric = 'listings' | 'transactions' | 'viewings' | 'inquiries';
const CHART_METRICS: ChartMetric[] = ['transactions', 'listings', 'viewings', 'inquiries'];

/** Decimal comma everywhere but English, matching how each language writes it. */
function formatNumber(n: number, lang: string): string {
  const s = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return lang === 'en' ? s : s.replace('.', ',');
}
const signed = (n: number, lang: string) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatNumber(Math.abs(n), lang)}`;

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

/**
 * Raporti im: the signed-in agent's private performance report
 * (docs/PERFORMANCE_REPORT.md). Every number comes from
 * my_performance_report(), which answers only for the caller; nothing here
 * names a client, shows a message or lists a transaction.
 */
export default function PerformanceScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { user, isAgent, profile, loading: authLoading } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const readable = useReadableColumn();
  const lang = i18n.language;

  const [period, setPeriod] = useState<Period>('month');
  const [customFrom, setCustomFrom] = useState(() => daysAgo(30));
  const [customTo, setCustomTo] = useState(() => new Date());
  const [chartMetric, setChartMetric] = useState<ChartMetric>('transactions');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetKey, setSheetKey] = useState(0);
  const openSheet = () => {
    setSheetKey((k) => k + 1);
    setSheetOpen(true);
  };

  // Day-granular, so the query key stays the same across renders.
  const range = periodRange(period, new Date(), { from: customFrom, to: customTo });
  const { data: report, isLoading, isError, refetch, isFetching } = usePerformanceReport(isAgent ? user?.id : undefined, range);
  const save = useSaveBaseline(user?.id);

  if (!user) return authLoading ? null : <SignInPrompt />;

  return (
    <GradientBackground>
      <SafeAreaView style={[styles.container, readable]} edges={['top']}>
        <AppHeader onBack={() => router.back()} />
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <ScreenHero kicker={t('performance.kicker')} pre={t('performance.headlinePre')} em={t('performance.headlineEm')} />

          {profile && !isAgent ? (
            <View style={styles.card}>
              <Text style={styles.body}>{t('performance.agentsOnly')}</Text>
            </View>
          ) : (
            <View style={styles.content}>
              <View style={styles.privacy}>
                <MaterialIcons name="lock-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.privacyText}>{t('performance.privateNote')}</Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>{t('performance.period')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  {PERIODS.map((p) => (
                    <Chip key={p} label={t(`performance.periods.${p}`)} on={period === p} onPress={() => setPeriod(p)} />
                  ))}
                </ScrollView>
                {period === 'custom' && (
                  <View style={styles.dates}>
                    <DateField label={t('performance.from')} value={customFrom} onChange={setCustomFrom} maximumDate={new Date()} />
                    <DateField label={t('performance.to')} value={customTo} onChange={setCustomTo} maximumDate={new Date()} />
                  </View>
                )}
                {period === 'custom' && !range && (
                  <Text style={styles.error} accessibilityLiveRegion="polite">
                    {t('performance.customInvalid')}
                  </Text>
                )}
              </View>

              {!range ? null : isLoading ? (
                <ReportSkeleton styles={styles} />
              ) : isError || !report ? (
                <View style={styles.card}>
                  <Text style={styles.body}>{t('common.error')}</Text>
                  <TouchableOpacity accessibilityRole="button" style={styles.retry} onPress={() => refetch()} activeOpacity={0.8}>
                    <Text style={styles.retryText}>{t('common.retry')}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={[styles.content, isFetching && styles.refreshing]}>
                  <Section title={t('performance.sections.properties')} note={t('performance.notes.snapshot')} styles={styles}>
                    <Stat label={t('performance.metrics.published')} value={report.listings.published} styles={styles} />
                    <Stat label={t('performance.metrics.activeNow')} value={report.listings.active_now} styles={styles} />
                    <Stat label={t('performance.metrics.pausedNow')} value={report.listings.paused_now} styles={styles} />
                  </Section>

                  <Section title={t('performance.sections.deals')} note={t('performance.notes.deals')} styles={styles}>
                    <Stat label={t('performance.metrics.sales')} value={report.deals.sales} styles={styles} />
                    <Stat label={t('performance.metrics.rentals')} value={report.deals.rentals} styles={styles} />
                    <Stat label={t('performance.metrics.transactions')} value={report.deals.sales + report.deals.rentals} styles={styles} strong />
                  </Section>

                  <Section title={t('performance.sections.clients')} note={t('performance.notes.leadsWon')} styles={styles}>
                    <Stat label={t('performance.metrics.inquiries')} value={report.contact.inquiries} styles={styles} />
                    <Stat label={t('performance.metrics.viewingsScheduled')} value={report.viewings.scheduled} styles={styles} />
                    <Stat label={t('performance.metrics.viewingsCompleted')} value={report.viewings.completed} styles={styles} />
                    <Stat label={t('performance.metrics.viewingsCancelled')} value={report.viewings.cancelled} styles={styles} />
                    <Stat label={t('performance.metrics.leadsAdded')} value={report.leads.added} styles={styles} />
                    <Stat label={t('performance.metrics.leadsWon')} value={report.leads.won} styles={styles} />
                  </Section>

                  <Section title={t('performance.sections.activity')} styles={styles}>
                    <Stat label={t('performance.metrics.messagesSent')} value={report.contact.messages_sent} styles={styles} />
                    <Stat label={t('performance.metrics.clientsAnswered')} value={report.contact.clients_answered} styles={styles} />
                  </Section>

                  <History
                    report={report}
                    metric={chartMetric}
                    onMetric={setChartMetric}
                    styles={styles}
                    colors={colors}
                  />

                  <Impact report={report} lang={lang} onEdit={openSheet} styles={styles} colors={colors} />

                  <Achievements report={report} styles={styles} colors={colors} />
                </View>
              )}
            </View>
          )}
        </ScrollView>

        <BaselineSheet
          key={sheetKey}
          visible={sheetOpen}
          initial={report?.baseline ?? null}
          saving={save.isPending}
          failed={save.isError}
          onClose={() => {
            save.reset();
            setSheetOpen(false);
          }}
          onSave={(values) => save.mutate(values, { onSuccess: () => setSheetOpen(false) })}
        />
      </SafeAreaView>
    </GradientBackground>
  );
}

type Styles = ReturnType<typeof createStyles>;

function Section({ title, note, styles, children }: { title: string; note?: string; styles: Styles; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.grid}>{children}</View>
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

const Stat = memo(function Stat({ label, value, styles, strong = false }: { label: string; value: number; styles: Styles; strong?: boolean }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[styles.statValue, strong && styles.statValueStrong]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
});

function ReportSkeleton({ styles }: { styles: Styles }) {
  return (
    <View style={styles.content} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[0, 1, 2].map((s) => (
        <View key={s} style={styles.section}>
          <View style={[styles.skeleton, styles.skeletonTitle]} />
          <View style={styles.grid}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.stat, styles.skeleton, styles.skeletonStat]} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function History({
  report,
  metric,
  onMetric,
  styles,
  colors,
}: {
  report: PerformanceReport;
  metric: ChartMetric;
  onMetric: (m: ChartMetric) => void;
  styles: Styles;
  colors: AtticoPalette;
}) {
  const { t } = useTranslation();
  const months = recentMonths(report.monthly);
  const values = months.map((m) => Number(m[metric]) || 0);
  const max = Math.max(1, ...values);
  const any = values.some((v) => v > 0);
  const metricLabel = t(`performance.history.${metric}`);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {t('performance.sections.history')}
      </Text>
      <Text style={styles.note}>{t('performance.history.since', { date: formatDate(report.since) })}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {CHART_METRICS.map((m) => (
          <Chip key={m} label={t(`performance.history.${m}`)} on={metric === m} onPress={() => onMetric(m)} />
        ))}
      </ScrollView>
      <View style={styles.card}>
        <Text style={styles.chartTitle}>{t('performance.history.chartLabel', { metric: metricLabel })}</Text>
        {any ? (
          <View
            style={styles.chart}
            accessible
            accessibilityLabel={`${t('performance.history.chartLabel', { metric: metricLabel })}: ${months
              .map((m: MonthPoint, i) => `${m.month} ${values[i]}`)
              .join(', ')}`}>
            {months.map((m: MonthPoint, i) => (
              <View key={m.month} style={styles.barCol}>
                <Text style={styles.barValue}>{values[i] > 0 ? values[i] : ''}</Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.bar,
                      { height: `${(values[i] / max) * 100}%`, backgroundColor: values[i] > 0 ? colors.accent : 'transparent' },
                    ]}
                  />
                </View>
                <Text style={styles.barLabel}>{m.month.slice(5)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.body}>{t('performance.history.empty')}</Text>
        )}
      </View>
    </View>
  );
}

const IMPACT_ROWS = [
  { key: 'rentals', baseline: 'monthly_rentals', total: (r: PerformanceReport) => r.deals.rentals_total },
  { key: 'sales', baseline: 'monthly_sales', total: (r: PerformanceReport) => r.deals.sales_total },
  { key: 'inquiries', baseline: 'monthly_inquiries', total: (r: PerformanceReport) => r.contact.inquiries_total },
  { key: 'viewings', baseline: 'monthly_viewings', total: (r: PerformanceReport) => r.viewings.completed_total },
] as const;

function Impact({
  report,
  lang,
  onEdit,
  styles,
  colors,
}: {
  report: PerformanceReport;
  lang: string;
  onEdit: () => void;
  styles: Styles;
  colors: AtticoPalette;
}) {
  const { t } = useTranslation();
  const months = monthsActive(report.since);
  const baseline = report.baseline;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {t('performance.sections.impact')}
      </Text>
      <Text style={styles.note}>{t('performance.impact.intro')}</Text>
      <View style={styles.card}>
        {IMPACT_ROWS.map((row) => {
          const c = compareToBaseline(baseline?.[row.baseline] ?? null, row.total(report), months);
          const top = Math.max(1, c.previous ?? 0, c.current);
          return (
            <View key={row.key} style={styles.impactRow}>
              <Text style={styles.impactTitle}>{t(`performance.impact.rows.${row.key}`)}</Text>
              <View style={styles.impactBars}>
                <View style={styles.impactLine}>
                  <Text style={styles.impactWho}>{t('performance.impact.before')}</Text>
                  <View style={styles.impactTrack}>
                    {c.previous !== null && (
                      <View style={[styles.impactBar, styles.impactBarBefore, { width: `${(c.previous / top) * 100}%` }]} />
                    )}
                  </View>
                  <Text style={styles.impactValue}>
                    {c.previous === null ? t('performance.impact.notEntered') : formatNumber(c.previous, lang)}
                  </Text>
                </View>
                <View style={styles.impactLine}>
                  <Text style={styles.impactWho}>{t('performance.impact.now')}</Text>
                  <View style={styles.impactTrack}>
                    <View style={[styles.impactBar, { width: `${(c.current / top) * 100}%`, backgroundColor: colors.accent }]} />
                  </View>
                  <Text style={styles.impactValue}>{formatNumber(c.current, lang)}</Text>
                </View>
              </View>
              {c.difference !== null && (
                <Text style={styles.impactDiff}>
                  {t('performance.impact.difference')}: {signed(c.difference, lang)}
                  {c.percent !== null ? ` (${signed(c.percent, lang)}%)` : ''}
                </Text>
              )}
            </View>
          );
        })}
        <Text style={styles.disclaimer}>{t('performance.impact.disclaimer')}</Text>
        {baseline?.updated_at ? (
          <Text style={styles.note}>{t('performance.impact.updated', { date: formatDate(baseline.updated_at) })}</Text>
        ) : null}
        <Pressable style={styles.secondaryBtn} onPress={onEdit} accessibilityRole="button">
          <MaterialIcons name={baseline ? 'edit' : 'add'} size={16} color={colors.accentText} />
          <Text style={styles.secondaryBtnText}>{baseline ? t('performance.impact.edit') : t('performance.impact.enter')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Achievements({ report, styles, colors }: { report: PerformanceReport; styles: Styles; colors: AtticoPalette }) {
  const { t } = useTranslation();
  const list = achievements({
    listings: report.listings.published_total,
    transactions: report.deals.sales_total + report.deals.rentals_total,
    viewings: report.viewings.completed_total,
  });
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {t('performance.sections.achievements')}
      </Text>
      <View style={styles.card}>
        {list.map((a) => (
          <View key={a.key} style={styles.achievement}>
            <MaterialIcons
              name={a.done ? 'emoji-events' : 'radio-button-unchecked'}
              size={22}
              color={a.done ? colors.accent : colors.textSecondary}
            />
            <View style={styles.achievementText}>
              <Text style={[styles.achievementTitle, !a.done && styles.muted]}>{t(`performance.achievements.${a.key}`)}</Text>
              <Text style={styles.note}>
                {a.done
                  ? t('performance.achievements.done')
                  : t('performance.achievements.progress', { value: a.progress, target: a.target })}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    container: { flex: 1 },
    scroll: { paddingBottom: 48 },
    content: { paddingHorizontal: 20, gap: 28 },
    refreshing: { opacity: 0.6 },
    privacy: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: -8 },
    privacyText: { flex: 1, fontFamily: Fonts.sans, fontSize: 13, lineHeight: 19, color: colors.textSecondary },
    section: { gap: 10 },
    label: { fontFamily: Fonts.sansSemiBold, fontSize: 12, color: colors.textSecondary },
    chips: { gap: 8, paddingRight: 20 },
    dates: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    error: { fontFamily: Fonts.sans, fontSize: 13, color: colors.error },
    sectionTitle: { fontFamily: Fonts.serif, fontSize: 20, color: colors.textPrimary },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    stat: {
      flexGrow: 1,
      flexBasis: '30%',
      minWidth: 96,
      backgroundColor: colors.primaryLight,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 14,
      paddingHorizontal: 12,
      gap: 4,
    },
    statValue: { fontFamily: Fonts.sansBold, fontSize: 24, color: colors.textPrimary },
    statValueStrong: { color: colors.accentText },
    statLabel: { fontFamily: Fonts.sans, fontSize: 12, lineHeight: 16, color: colors.textSecondary },
    note: { fontFamily: Fonts.sans, fontSize: 12, lineHeight: 17, color: colors.textSecondary },
    card: {
      backgroundColor: colors.primaryLight,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 14,
    },
    body: { fontFamily: Fonts.sans, fontSize: 14, lineHeight: 20, color: colors.textPrimary },
    retry: { alignSelf: 'flex-start', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.accent },
    retryText: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: '#fff' },
    chartTitle: { fontFamily: Fonts.sansSemiBold, fontSize: 13, color: colors.textPrimary },
    chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 150 },
    barCol: { flex: 1, alignItems: 'center', gap: 4, height: '100%' },
    barValue: { fontFamily: Fonts.mono, fontSize: 10, color: colors.textSecondary, minHeight: 13 },
    barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end', borderRadius: 6, backgroundColor: colors.glass },
    bar: { width: '100%', borderRadius: 6 },
    barLabel: { fontFamily: Fonts.mono, fontSize: 10, color: colors.textSecondary },
    impactRow: { gap: 8 },
    impactTitle: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.textPrimary },
    impactBars: { gap: 6 },
    impactLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    impactWho: { width: 112, fontFamily: Fonts.sans, fontSize: 12, color: colors.textSecondary },
    impactTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.glass, overflow: 'hidden' },
    impactBar: { height: '100%', borderRadius: 5 },
    impactBarBefore: { backgroundColor: colors.textSecondary },
    impactValue: { minWidth: 56, textAlign: 'right', fontFamily: Fonts.sansSemiBold, fontSize: 12, color: colors.textPrimary },
    impactDiff: { fontFamily: Fonts.sansSemiBold, fontSize: 12, color: colors.accentText },
    disclaimer: { fontFamily: Fonts.sans, fontSize: 12, lineHeight: 17, color: colors.textSecondary },
    secondaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      minHeight: 44,
      paddingHorizontal: 14,
      borderRadius: Radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.glass,
    },
    secondaryBtnText: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.accentText },
    achievement: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    achievementText: { flex: 1, gap: 2 },
    achievementTitle: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.textPrimary },
    muted: { color: colors.textSecondary },
    skeleton: { backgroundColor: colors.glass, borderColor: 'transparent' },
    skeletonTitle: { height: 20, width: '50%', borderRadius: 6 },
    skeletonStat: { height: 72 },
  });
