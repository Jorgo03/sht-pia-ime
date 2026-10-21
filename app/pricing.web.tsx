import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppHeader } from '@/components/ui/app-header';
import { PrimaryCTA } from '@/components/ui/buttons';
import { GradientBackground } from '@/components/ui/gradient-background';
import { type AtticoPalette, Fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import { formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { groupPlans, perMonth, planName, type PlanCard } from '@/src/features/billing/lib/plans';

// Website pricing page (docs/LAUNCH_TASKS.md F15), ported from the Vite site.
// Web only (app/pricing.tsx sends the phone apps home): App Store guideline
// 3.1.1 and Google Play's billing rules. Buying stays off until
// EXPO_PUBLIC_CHECKOUT_ENABLED=true and the payment backend is live. Coming
// back from the payment page never claims the plan is active: only the
// provider's verified callback activates it, on the server.
const CHECKOUT_ENABLED = process.env.EXPO_PUBLIC_CHECKOUT_ENABLED === 'true';

type State = 'loading' | 'ready' | 'error';

const fetchPlans = () => supabase.from('plans').select('*').order('sort_order', { ascending: true });

export default function PricingScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { checkout: returned } = useLocalSearchParams<{ checkout?: string }>();
  const [cards, setCards] = useState<PlanCard[]>([]);
  const [state, setState] = useState<State>('loading');
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState(false);

  // State is only set when the request settles; retry resets it itself.
  const apply = useCallback(({ data, error }: { data: unknown[] | null; error: unknown }) => {
    if (error) {
      setState('error');
      return;
    }
    setCards(groupPlans(data));
    setState('ready');
  }, []);

  useEffect(() => {
    let active = true;
    fetchPlans().then((res) => {
      if (active) apply(res);
    });
    return () => {
      active = false;
    };
  }, [apply]);

  const retry = () => {
    setState('loading');
    fetchPlans().then(apply);
  };

  const buy = async (optionId: string) => {
    if (!CHECKOUT_ENABLED || starting) return;
    setStarting(true);
    setStartError(false);
    const { data, error } = await supabase.functions.invoke('checkout-start', {
      body: { plan_id: optionId, lang: i18n.language },
    });
    setStarting(false);
    if (error || !data?.url) {
      setStartError(true);
      return;
    }
    window.location.assign(data.url);
  };

  const price = (cents: number, currency: string) => formatPrice(cents / 100, i18n.language, currency);

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <AppHeader onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <Text style={styles.title} accessibilityRole="header">{t('pricing.title')}</Text>
            <Text style={styles.subtitle}>{t('pricing.subtitle')}</Text>
          </View>

          {returned === 'done' && (
            <Text style={styles.notice} accessibilityLiveRegion="polite">{t('pricing.returnedDone')}</Text>
          )}
          {returned === 'cancelled' && (
            <Text style={styles.notice} accessibilityLiveRegion="polite">{t('pricing.returnedCancelled')}</Text>
          )}

          {state === 'loading' ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          ) : state === 'error' ? (
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>{t('pricing.loadFailed')}</Text>
              <TouchableOpacity style={styles.pill} onPress={retry} accessibilityRole="button">
                <MaterialIcons name="refresh" size={16} color={colors.textPrimary} />
                <Text style={styles.pillText}>{t('common.retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : cards.length === 0 ? (
            <View style={styles.center}>
              <View style={styles.emptyIcon}>
                <MaterialIcons name="verified" size={34} color={colors.accent} />
              </View>
              <Text style={styles.emptyTitle}>{t('pricing.comingSoon')}</Text>
              <Text style={styles.emptyHint}>{t('pricing.comingSoonHint')}</Text>
            </View>
          ) : (
            cards.map((card) => {
              const option = card.options.find((o) => o.id === selected[card.key]) ?? card.options[0];
              const monthly = perMonth(option);
              const promo = card.kind === 'promotion';
              return (
                <View key={card.key} style={styles.card}>
                  <View style={styles.kindRow}>
                    <MaterialIcons name={promo ? 'campaign' : 'verified'} size={16} color={colors.textSecondary} />
                    <Text style={styles.kind}>{promo ? t('pricing.kindPromotion') : t('pricing.kindPlan')}</Text>
                  </View>
                  <Text style={styles.planName} accessibilityRole="header">{planName(card, i18n.language)}</Text>
                  {card.options.length > 1 && (
                    <View style={styles.segment} accessibilityRole="radiogroup" accessibilityLabel={t('pricing.period')}>
                      {card.options.map((o) => {
                        const on = o.id === option.id;
                        return (
                          <Pressable
                            key={o.id}
                            style={[styles.segmentItem, on && styles.segmentItemOn]}
                            onPress={() => setSelected((s) => ({ ...s, [card.key]: o.id }))}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: on }}>
                            <Text style={[styles.segmentText, on && styles.segmentTextOn]}>
                              {t('pricing.months', { n: o.months })}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                  <Text style={styles.price}>{price(option.priceCents, option.currency)}</Text>
                  {monthly !== null && (option.months ?? 0) > 1 && (
                    <Text style={styles.perMonth}>{t('pricing.perMonth', { price: price(monthly, option.currency) })}</Text>
                  )}
                  <View style={styles.features}>
                    {card.listingCap ? <Text style={styles.feature}>• {t('pricing.listingCap', { n: card.listingCap })}</Text> : null}
                    {card.credits ? <Text style={styles.feature}>• {t('pricing.credits', { n: card.credits })}</Text> : null}
                    <Text style={styles.feature}>• {t('pricing.prepaid')}</Text>
                  </View>
                  {CHECKOUT_ENABLED && user ? (
                    <PrimaryCTA
                      label={starting ? t('common.loading') : t('pricing.buy')}
                      onPress={() => buy(option.id)}
                      disabled={starting}
                    />
                  ) : (
                    <Text style={styles.muted}>{CHECKOUT_ENABLED ? t('pricing.signInToBuy') : t('pricing.notYet')}</Text>
                  )}
                </View>
              );
            })
          )}
          {startError && (
            <Text style={styles.error} accessibilityRole="alert">{t('pricing.startFailed')}</Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const createStyles = (colors: AtticoPalette) => StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 48, gap: 14 },
  hero: { gap: 6, paddingTop: 8 },
  title: { fontFamily: Fonts?.serif, fontSize: 28, fontWeight: '500', color: colors.textPrimary },
  subtitle: { fontFamily: Fonts?.sans, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  notice: {
    fontFamily: Fonts?.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
  },
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
  emptyHint: { fontFamily: Fonts?.sans, fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.glass,
  },
  pillText: { fontFamily: Fonts?.sansSemiBold, fontSize: 14, color: colors.textPrimary },
  card: {
    gap: 10,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.glass,
  },
  kindRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kind: { fontFamily: Fonts?.mono, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.textSecondary },
  planName: { fontFamily: Fonts?.serif, fontSize: 22, fontWeight: '500', color: colors.textPrimary },
  segment: { flexDirection: 'row', gap: 4, padding: 3, borderRadius: 12, backgroundColor: colors.primaryLight },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10 },
  segmentItemOn: { backgroundColor: colors.accent },
  segmentText: { fontFamily: Fonts?.sansSemiBold, fontSize: 13, color: colors.textSecondary },
  segmentTextOn: { color: '#fff' },
  price: { fontFamily: Fonts?.sansBold, fontSize: 26, color: colors.textPrimary },
  perMonth: { fontFamily: Fonts?.sans, fontSize: 13, color: colors.textSecondary },
  features: { gap: 4 },
  feature: { fontFamily: Fonts?.sans, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  muted: { fontFamily: Fonts?.sans, fontSize: 13, color: colors.textSecondary },
  error: { fontFamily: Fonts?.sans, fontSize: 13, color: colors.error, textAlign: 'center' },
});
