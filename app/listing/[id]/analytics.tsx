import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppHeader } from '@/components/ui/app-header';
import { GradientBackground } from '@/components/ui/gradient-background';
import { type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/format';

type ActivityType = 'view' | 'call' | 'message' | 'meeting' | 'favourite';

interface PropertyActivity {
  id: string;
  type: ActivityType;
  created_at: string;
}

// Same five metric types, same order, and the same 30-day window as web's
// PropertyDashboard.jsx — this screen queries the identical property_activity
// rows, just renders them with plain Views instead of recharts.
const TYPES: ActivityType[] = ['view', 'call', 'message', 'meeting', 'favourite'];

const TYPE_ICONS: Record<ActivityType, keyof typeof MaterialIcons.glyphMap> = {
  view: 'visibility',
  call: 'call',
  message: 'chat-bubble-outline',
  meeting: 'event',
  favourite: 'favorite-border',
};

// Mirrors web's --fho-dash-* custom-property fallbacks exactly, so a metric
// reads as the same color on both platforms.
const TYPE_COLORS: Record<ActivityType, string> = {
  view: '#3498db',
  call: '#27ae60',
  message: '#f39c12',
  meeting: '#8e44ad',
  favourite: '#e74c3c',
};

const DAYS_WINDOW = 30;
const BAR_WIDTH = 8;
const BAR_GAP = 4;
const CHART_HEIGHT = 140;

export default function PropertyAnalyticsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [activity, setActivity] = useState<PropertyActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [metric, setMetric] = useState<ActivityType>('view');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(false);

    const since = new Date();
    since.setDate(since.getDate() - DAYS_WINDOW);

    supabase
      .from('property_activity')
      .select('id, type, created_at')
      .eq('property_id', id)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          setError(true);
        } else {
          setActivity((data ?? []) as PropertyActivity[]);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const counts = useMemo(() => {
    const c: Record<ActivityType, number> = { view: 0, call: 0, message: 0, meeting: 0, favourite: 0 };
    activity.forEach((a) => {
      if (a.type in c) c[a.type] += 1;
    });
    return c;
  }, [activity]);

  const dailySeries = useMemo(() => {
    const days: { key: string; label: string; count: number }[] = [];
    for (let i = DAYS_WINDOW - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ key, label: key.slice(5), count: 0 });
    }
    const byKey = Object.fromEntries(days.map((d) => [d.key, d]));
    activity
      .filter((a) => a.type === metric)
      .forEach((a) => {
        const key = a.created_at.slice(0, 10);
        if (byKey[key]) byKey[key].count += 1;
      });
    return days;
  }, [activity, metric]);

  const maxCount = Math.max(1, ...dailySeries.map((d) => d.count));
  const recent = activity.slice(0, 50);

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <AppHeader onBack={() => router.back()} title={t('dashboard.title')} />

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.description}>{t('common.error')}</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.statGrid}>
              {TYPES.map((type) => (
                <View key={type} style={styles.statCard}>
                  <MaterialIcons name={TYPE_ICONS[type]} size={20} color={TYPE_COLORS[type]} />
                  <Text style={styles.statValue}>{counts[type]}</Text>
                  <Text style={styles.statLabel}>{t(`dashboard.${type}s`)}</Text>
                </View>
              ))}
            </View>

            <View style={styles.chartCard}>
              <View style={styles.metricRow}>
                {TYPES.map((type) => {
                  const active = metric === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      onPress={() => setMetric(type)}
                      activeOpacity={0.7}
                      style={[
                        styles.metricPill,
                        active
                          ? { backgroundColor: TYPE_COLORS[type], borderColor: TYPE_COLORS[type] }
                          : { borderColor: colors.border },
                      ]}>
                      <Text style={[styles.metricPillText, { color: active ? '#fff' : colors.textPrimary }]}>
                        {t(`dashboard.${type}s`)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartScroll}>
                <View style={styles.chart}>
                  {dailySeries.map((d) => (
                    <View key={d.key} style={styles.barColumn}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: Math.max(2, (d.count / maxCount) * CHART_HEIGHT),
                            backgroundColor: TYPE_COLORS[metric],
                          },
                        ]}
                      />
                    </View>
                  ))}
                </View>
              </ScrollView>
              <Text style={styles.chartHint}>
                {t('dashboard.recentActivity')} · {DAYS_WINDOW}d
              </Text>
            </View>

            <View style={styles.listCard}>
              <Text style={styles.listCardHeader}>{t('dashboard.recentActivity')}</Text>
              {recent.length === 0 ? (
                <View style={styles.emptyRow}>
                  <Text style={styles.emptyText}>{t('dashboard.noActivity')}</Text>
                </View>
              ) : (
                recent.map((a) => (
                  <View key={a.id} style={styles.activityRow}>
                    <MaterialIcons name={TYPE_ICONS[a.type] ?? 'visibility'} size={14} color={TYPE_COLORS[a.type]} />
                    <Text style={styles.activityType}>{t(`dashboard.${a.type}s`)}</Text>
                    <Text style={styles.activityDate}>{formatDate(a.created_at, i18n.language)}</Text>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
    },
    description: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 40,
      gap: 20,
    },
    statGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    statCard: {
      flexGrow: 1,
      flexBasis: '28%',
      backgroundColor: colors.primaryLight,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      alignItems: 'center',
      gap: 4,
    },
    statValue: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    statLabel: {
      fontSize: 10,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    chartCard: {
      backgroundColor: colors.primaryLight,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 10,
    },
    metricRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    metricPill: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      borderWidth: 1,
    },
    metricPillText: {
      fontSize: 11,
      fontWeight: '600',
    },
    chartScroll: {
      marginTop: 4,
    },
    chart: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      height: CHART_HEIGHT,
      gap: BAR_GAP,
      paddingHorizontal: 2,
    },
    barColumn: {
      width: BAR_WIDTH,
      justifyContent: 'flex-end',
      height: CHART_HEIGHT,
    },
    bar: {
      width: BAR_WIDTH,
      borderRadius: 3,
    },
    chartHint: {
      fontSize: 11,
      color: colors.textSecondary,
      textAlign: 'right',
    },
    listCard: {
      backgroundColor: colors.primaryLight,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    listCardHeader: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    emptyRow: {
      padding: 20,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    activityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    activityType: {
      flex: 1,
      fontSize: 13,
      color: colors.textPrimary,
    },
    activityDate: {
      fontSize: 11,
      color: colors.textSecondary,
    },
  });
