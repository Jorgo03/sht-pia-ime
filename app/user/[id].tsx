import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
  FlatList,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type DimensionValue,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ActionButton } from '@/components/ui/action-button';
import { AppHeader } from '@/components/ui/app-header';
import { GradientBackground } from '@/components/ui/gradient-background';
import { LoadError } from '@/components/ui/load-error';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import { PropertyCard } from '@/components/property/property-card';
import { PageHead } from '@/components/web/page-head';
import { type AtticoPalette, Fonts } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import type { Property } from '@/data/types';
import { useHydrated } from '@/hooks/use-hydrated';
import { useResponsive } from '@/hooks/use-responsive';
import { telUrl } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import {
  PROFILE_PAGE_SIZE,
  fetchPublicProfile,
  fetchPublisherListings,
  isUserId,
  profileInitials,
  publicProfileView,
} from '@/src/features/profiles/lib/publicProfile';

/**
 * A person's public profile: who they are (agent or client) and the listings
 * they publish. Opened from a chat's header, the agent rail and a listing's
 * "Published by" card. The person is the id in the address, never the viewer;
 * what may be shown is decided by public_profile() on the server, and only
 * active listings are listed (src/features/profiles/lib/publicProfile.js).
 */
export default function PublicProfileScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const valid = isUserId(id);
  // Until then the page shows the loading state whatever the address says:
  // the website's pre-render does not know the real id (hooks/use-hydrated).
  const hydrated = useHydrated();
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { columns } = useResponsive();
  // A lone card in a trailing row keeps one column's width (same as Explore).
  const gridItemStyle = useMemo<ViewStyle>(
    () => ({ flex: 1, maxWidth: `${100 / columns}%` as DimensionValue }),
    [columns],
  );

  const profileQuery = useQuery({
    queryKey: ['profiles', 'public', id],
    queryFn: () => fetchPublicProfile(supabase, id),
    enabled: valid,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const listingsQuery = useInfiniteQuery({
    queryKey: ['properties', 'publisher', id],
    queryFn: ({ pageParam }) => fetchPublisherListings<Property>(supabase, id, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, page) => n + page.rows.length, 0);
      return last.rows.length === PROFILE_PAGE_SIZE && loaded < last.total ? all.length : undefined;
    },
    enabled: valid,
    staleTime: 60 * 1000,
    // supabase-js already retries a failed read 3 times (1 s, 2 s, 4 s); a
    // second round here made an offline visitor wait ~15 s for the retry button.
    retry: false,
  });

  const person = publicProfileView(profileQuery.data ?? null);
  const listings = useMemo(
    () => listingsQuery.data?.pages.flatMap((page) => page.rows) ?? [],
    [listingsQuery.data],
  );
  const total = listingsQuery.data?.pages[0]?.total ?? person?.listingCount ?? 0;
  const name = person?.name ?? t('publicProfile.unnamed');

  // Opened from a link with nothing behind it: go Home rather than nowhere.
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/' as Href);
  };

  const call = () => {
    if (person?.phone) Linking.openURL(telUrl(person.phone)).catch(() => {});
  };

  const header = (
    <AppHeader onBack={goBack} showControls={false} title={person?.name ?? t('common.profile')} titleIsHeading={false} />
  );

  if (hydrated && (!valid || (profileQuery.isSuccess && !person))) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.container} edges={['top']}>
          {header}
          <View style={styles.center}>
            <MaterialIcons name="person-off" size={36} color={colors.textSecondary} />
            <Text style={styles.centerText} accessibilityLiveRegion="polite">{t('publicProfile.unavailable')}</Text>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  if (profileQuery.isError) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.container} edges={['top']}>
          {header}
          <View style={styles.center}>
            <LoadError onRetry={() => void profileQuery.refetch()} />
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  const personCard = person ? (
    <View style={styles.card}>
      <View style={styles.identity}>
        {person.avatarUrl ? (
          <Image source={{ uri: person.avatarUrl }} style={styles.avatar} contentFit="cover" accessibilityIgnoresInvertColors />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{profileInitials(person.name)}</Text>
          </View>
        )}
        <View style={styles.identityText}>
          <Text style={styles.name} accessibilityRole="header" numberOfLines={2}>
            {name}
          </Text>
          <View style={[styles.kindPill, person.kind === 'agent' && styles.kindPillAgent]}>
            <MaterialIcons
              name={person.kind === 'agent' ? 'verified' : 'person'}
              size={12}
              color={person.kind === 'agent' ? colors.accent : colors.textSecondary}
            />
            <Text style={[styles.kindText, person.kind === 'agent' && styles.kindTextAgent]}>
              {person.kind === 'agent' ? t('publicProfile.agent') : t('auth.roleClient')}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.facts}>
        {person.kind === 'agent' && person.office ? (
          <View style={styles.fact}>
            <MaterialIcons name="business" size={16} color={colors.textSecondary} />
            <Text style={styles.factText} numberOfLines={2}>{person.office}</Text>
          </View>
        ) : null}
        {person.phone ? (
          <TouchableOpacity
            style={styles.fact}
            onPress={call}
            accessibilityRole="link"
            accessibilityLabel={t('publicProfile.call', { phone: person.phone })}
            hitSlop={6}>
            <MaterialIcons name="phone" size={16} color={colors.accent} />
            <Text style={[styles.factText, styles.phoneText]}>{person.phone}</Text>
          </TouchableOpacity>
        ) : null}
        <View style={styles.fact}>
          <MaterialIcons name="home-work" size={16} color={colors.textSecondary} />
          <Text style={styles.factText}>{t('publicProfile.published', { n: total })}</Text>
        </View>
      </View>
    </View>
  ) : (
    <View style={[styles.card, styles.cardLoading]} accessibilityLabel={t('common.loading')}>
      <View style={[styles.avatar, styles.placeholder]} />
      <View style={styles.identityText}>
        <View style={[styles.bar, { width: '60%' }]} />
        <View style={[styles.bar, { width: '35%' }]} />
      </View>
    </View>
  );

  const sectionHead = (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle} accessibilityRole="header">{t('publicProfile.listingsTitle')}</Text>
      {listingsQuery.isSuccess ? (
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{total}</Text>
        </View>
      ) : null}
    </View>
  );

  const empty = listingsQuery.isPending ? (
    <View style={styles.skeletons}>
      <SkeletonCard />
    </View>
  ) : listingsQuery.isError ? (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyText}>{t('publicProfile.listingsFailed')}</Text>
      <LoadError onRetry={() => void listingsQuery.refetch()} />
    </View>
  ) : (
    <View style={styles.emptyCard}>
      <MaterialIcons name="holiday-village" size={28} color={colors.textSecondary} />
      <Text style={styles.emptyText}>{t('publicProfile.empty')}</Text>
    </View>
  );

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <PageHead title={person?.name ?? t('common.profile')} />
        {header}
        <FlatList
          key={`cols-${columns}`}
          testID="public-profile"
          data={listings}
          keyExtractor={(item) => item.id}
          numColumns={columns}
          contentContainerStyle={[styles.list, { paddingBottom: 24 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              {personCard}
              {sectionHead}
            </View>
          }
          ListEmptyComponent={empty}
          ListFooterComponent={
            listingsQuery.hasNextPage ? (
              <View style={styles.footer}>
                <ActionButton
                  variant="secondary"
                  title={listingsQuery.isFetchingNextPage ? t('common.loading') : t('agents.loadMore')}
                  disabled={listingsQuery.isFetchingNextPage}
                  onPress={() => void listingsQuery.fetchNextPage()}
                />
              </View>
            ) : undefined
          }
          renderItem={({ item }) => (
            <View style={gridItemStyle}>
              <PropertyCard property={item} detailed />
            </View>
          )}
        />
      </SafeAreaView>
    </GradientBackground>
  );
}

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, paddingHorizontal: 32 },
    centerText: { fontFamily: Fonts.sans, fontSize: 15, color: colors.textSecondary, textAlign: 'center' },
    list: { paddingHorizontal: 14, paddingTop: 8 },
    card: {
      backgroundColor: colors.primaryLight,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
      marginHorizontal: 6,
      marginBottom: 22,
      gap: 16,
    },
    cardLoading: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    identity: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    identityText: { flex: 1, gap: 8, alignItems: 'flex-start' },
    avatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    avatarText: { fontFamily: Fonts.sansBold, fontSize: 24, color: '#fff' },
    placeholder: { backgroundColor: colors.border },
    bar: { height: 12, borderRadius: 6, backgroundColor: colors.border },
    name: { fontFamily: Fonts.serifSemiBold, fontSize: 24, lineHeight: 30, color: colors.textPrimary },
    kindPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
    },
    kindPillAgent: { borderColor: colors.accent },
    kindText: { fontFamily: Fonts.sansSemiBold, fontSize: 12, color: colors.textSecondary },
    kindTextAgent: { color: colors.accent },
    facts: { gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 14 },
    fact: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 24 },
    factText: { flex: 1, fontFamily: Fonts.sans, fontSize: 14, color: colors.textPrimary },
    phoneText: { color: colors.accent, fontFamily: Fonts.sansSemiBold },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 6,
      marginBottom: 12,
    },
    sectionTitle: { flexShrink: 1, fontFamily: Fonts.sansBold, fontSize: 16, color: colors.textPrimary },
    countBadge: {
      minWidth: 24,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: colors.accent,
      alignItems: 'center',
    },
    countText: { fontFamily: Fonts.sansBold, fontSize: 12, color: '#fff' },
    skeletons: { marginHorizontal: 6 },
    emptyCard: {
      backgroundColor: colors.primaryLight,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 24,
      marginHorizontal: 6,
      alignItems: 'center',
      gap: 10,
    },
    emptyText: { fontFamily: Fonts.sans, fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
    footer: { paddingHorizontal: 6, paddingTop: 8 },
  });
