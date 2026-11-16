import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/ui/action-button';
import { AppHeader } from '@/components/ui/app-header';
import { GradientBackground } from '@/components/ui/gradient-background';
import { ScreenHero } from '@/components/ui/screen-hero';
import { SiteFooter } from '@/components/web/site-footer';
import { Fonts, type AtticoPalette } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import { PAGE_SIZE } from '@/data/properties';
import { useReadableColumn } from '@/hooks/use-responsive';
import { formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';

interface WantedRow {
  id: string;
  city: string;
  listing_type: string;
  max_price: number | null;
  min_bedrooms: number | null;
  notes: string | null;
  created_at: string;
}

/**
 * The "wanted homes" board: buyers say what they are looking for, agents see
 * the open requests. Who sees what is the database's rule (RLS): an agent
 * reads every open request; anyone else reads none, so for them this page
 * explains the idea and lets them post their own. A request's buyer is told
 * automatically when a matching listing is published (AUDIT-025).
 */
export default function WantedBoardScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const readable = useReadableColumn();
  const insets = useSafeAreaInsets();
  const { user, isAgent, loading: authLoading } = useAuth();

  const board = useInfiniteQuery({
    queryKey: ['wanted-board', user?.id ?? null],
    enabled: !!user && isAgent,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase
        .from('wanted_homes')
        .select('id, city, listing_type, max_price, min_bedrooms, notes, created_at')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);
      if (error) throw error;
      return (data ?? []) as WantedRow[];
    },
    getNextPageParam: (last, pages) => (last.length < PAGE_SIZE ? undefined : pages.length * PAGE_SIZE),
  });
  const rows = useMemo(() => board.data?.pages.flat() ?? [], [board.data]);

  // Signed out: posting needs an account, so the button goes to sign-in.
  const postRequest = () => router.push((user ? '/saved-searches?tab=wanted&new=1' : '/(tabs)/profile') as Href);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/' as Href));

  const explainer = (
    <View style={styles.intro}>
      <Text style={styles.introText}>{t('wanted.boardIntro')}</Text>
      {!isAgent && <ActionButton title={t('wanted.postCta')} onPress={postRequest} />}
      {isAgent && <Text style={styles.introHint}>{t('wanted.agentHint')}</Text>}
    </View>
  );

  return (
    <GradientBackground>
      <SafeAreaView style={[styles.container, readable]} edges={['top']}>
        <AppHeader onBack={back} />
        <ScreenHero pre={t('wanted.boardPre')} em={t('wanted.boardEm')} />
        {authLoading || (isAgent && board.isLoading) ? (
          <View style={styles.list}>
            {[0, 1, 2, 3].map((i) => <View key={i} style={styles.skeleton} />)}
          </View>
        ) : !isAgent ? (
          <ScrollView contentContainerStyle={[styles.list, { paddingBottom: 24 + insets.bottom }]}>
            {explainer}
            <Steps styles={styles} />
            <SiteFooter />
          </ScrollView>
        ) : board.isError ? (
          <View style={styles.center}>
            <Text style={styles.centerText} accessibilityLiveRegion="polite">{t('common.error')}</Text>
            <ActionButton title={t('common.retry')} onPress={() => void board.refetch()} />
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(r) => r.id}
            contentContainerStyle={[styles.list, { paddingBottom: 24 + insets.bottom }]}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={explainer}
            ListEmptyComponent={
              <View style={styles.center}>
                <MaterialIcons name="person-search" size={40} color={colors.textSecondary} />
                <Text style={styles.centerText}>{t('agentDashboard.wantedEmpty')}</Text>
              </View>
            }
            ListFooterComponent={
              <>
                {board.hasNextPage ? (
                  <ActionButton
                    variant="secondary"
                    title={board.isFetchingNextPage ? t('common.loading') : t('agents.loadMore')}
                    onPress={() => void board.fetchNextPage()}
                  />
                ) : null}
                <SiteFooter />
              </>
            }
            renderItem={({ item }) => (
              <WantedCard row={item} lang={i18n.language} styles={styles} iconColor={colors.textSecondary} />
            )}
          />
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}

function Steps({ styles }: { styles: Styles }) {
  const { t } = useTranslation();
  return (
    <View style={styles.steps}>
      {(['step1', 'step2', 'step3'] as const).map((k, i) => (
        <View key={k} style={styles.step}>
          <Text style={styles.stepNum}>{i + 1}</Text>
          <Text style={styles.stepText}>{t(`wanted.${k}`)}</Text>
        </View>
      ))}
    </View>
  );
}

const WantedCard = memo(function WantedCard({ row, lang, styles, iconColor }: {
  row: WantedRow;
  lang: string;
  styles: Styles;
  iconColor: string;
}) {
  const { t } = useTranslation();
  const date = new Date(row.created_at).toLocaleDateString(lang);
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <MaterialIcons name="place" size={15} color={iconColor} />
        <Text style={styles.cardTitle} numberOfLines={1}>
          {row.city} · {t(`listing.type.${row.listing_type}`, row.listing_type)}
        </Text>
        <Text style={styles.cardDate}>{date}</Text>
      </View>
      <View style={styles.metaRow}>
        {row.max_price ? <Text style={styles.meta}>{t('addSheet.maxPrice')}: {formatPrice(row.max_price, lang)}</Text> : null}
        {row.min_bedrooms ? <Text style={styles.meta}>{t('addSheet.minBedrooms')}: {row.min_bedrooms}+</Text> : null}
      </View>
      {row.notes ? <Text style={styles.notes}>{row.notes}</Text> : null}
    </View>
  );
});

type Styles = ReturnType<typeof createStyles>;

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    container: { flex: 1 },
    list: { paddingHorizontal: 20, gap: 10 },
    skeleton: { height: 96, borderRadius: 18, backgroundColor: colors.glass },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
    centerText: { fontSize: 16, fontFamily: Fonts.sansSemiBold, color: colors.textPrimary, textAlign: 'center' },
    intro: { gap: 12, marginBottom: 6 },
    introText: { fontFamily: Fonts.sans, fontSize: 15, lineHeight: 22, color: colors.textSecondary },
    introHint: { fontFamily: Fonts.sans, fontSize: 13, lineHeight: 19, color: colors.textFaint },
    steps: { gap: 10, marginTop: 8 },
    step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    stepNum: {
      width: 28,
      height: 28,
      borderRadius: 14,
      textAlign: 'center',
      lineHeight: 28,
      overflow: 'hidden',
      fontFamily: Fonts.sansBold,
      fontSize: 14,
      color: colors.accentText,
      backgroundColor: colors.glass,
    },
    stepText: { flex: 1, fontFamily: Fonts.sans, fontSize: 15, lineHeight: 22, color: colors.textPrimary },
    card: { gap: 6, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.glass },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    cardTitle: { flex: 1, fontFamily: Fonts.sansSemiBold, fontSize: 15, color: colors.textPrimary },
    cardDate: { fontFamily: Fonts.sans, fontSize: 12, color: colors.textFaint },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    meta: { fontFamily: Fonts.sans, fontSize: 13, color: colors.textSecondary },
    notes: { fontFamily: Fonts.sans, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  });
