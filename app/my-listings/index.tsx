import { LoadError } from '@/components/ui/load-error';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
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
import { formatPrice, getLocalizedText } from '@/lib/format';
import { Property } from '@/data/types';
import { closedStatusFor } from '@/src/features/listings/lib/listingForm';
import { useReadableColumn } from '@/hooks/use-responsive';
import { confirmAction } from '@/lib/confirm';
import { LIST_PAGE_SIZE, pageWindow } from '@/src/lib/pageWindow';
import { ActionButton } from '@/components/ui/action-button';

// Reads the theme's status tokens rather than hardcoding the light-theme
// hexes — web pulls these from --fho-status-*, which swap in dark mode, so a
// fixed map rendered the wrong colors on a dark background.
function statusColor(colors: AtticoPalette, status: string): string {
  const map: Record<string, string> = {
    active: colors.statusActive,
    paused: colors.statusPaused,
    sold: colors.statusSold,
    rented: colors.statusRented,
    draft: colors.statusDraft,
  };
  return map[status] ?? colors.statusDraft;
}

export default function MyListingsScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { user, isAgent } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // A centred column on an unfolded Fold or a spanned Duo (hooks/use-responsive).
  const readable = useReadableColumn();
  const queryClient = useQueryClient();
  const [listings, setListings] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  // A failed read: shown with a retry rather than as an empty list.
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState(false);
  // 24 at a time; "Load more" raises the window (AUDIT-015).
  const [limit, setLimit] = useState(LIST_PAGE_SIZE);
  const [hasMore, setHasMore] = useState(false);

  const flashError = () => {
    setActionError(true);
    setTimeout(() => setActionError(false), 3000);
  };

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoadError(false);
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .or(`owner_id.eq.${user.id},agent_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(limit + 1);
    if (error) {
      setLoadError(true);
      setLoading(false);
      return;
    }
    const page = pageWindow(data, limit);
    setListings(page.items);
    setHasMore(page.hasMore);
    setLoading(false);
  }, [user, limit]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (id: string, next: Property['status']) => {
    const { error } = await supabase.from('properties').update({ status: next }).eq('id', id);
    if (error) {
      flashError();
      return;
    }
    setListings((prev) => prev.map((p) => (p.id === id ? { ...p, status: next } : p)));
    // A paused listing must disappear from Explore/Home/Map's cached
    // results (and a re-activated one must reappear) — without this, those
    // screens would keep showing the pre-mutation cached list for up to
    // staleTime.
    queryClient.invalidateQueries({ queryKey: ['properties'] });
  };

  // Pause <-> activate. A sold or rented listing reactivates the same way.
  const toggleStatus = (id: string, current: string) =>
    setStatus(id, current === 'active' ? 'paused' : 'active');

  // Sold / rented counts as a completed transaction in the agent's report,
  // so it is asked for, not one tap (docs/PERFORMANCE_REPORT.md).
  const confirmClosed = (id: string, next: 'sold' | 'rented') =>
    confirmAction({
      title: next === 'sold' ? t('listing.confirmSoldTitle') : t('listing.confirmRentedTitle'),
      message: t('listing.confirmClosedHint'),
      confirmText: next === 'sold' ? t('listing.markSold') : t('listing.markRented'),
      cancelText: t('common.cancel'),
      onConfirm: () => setStatus(id, next),
    });

  const confirmDelete = (id: string) =>
    confirmAction({
      title: t('listing.confirmDelete'),
      confirmText: t('listing.delete'),
      cancelText: t('common.cancel'),
      destructive: true,
      onConfirm: async () => {
        const { error } = await supabase.from('properties').delete().eq('id', id);
        if (error) {
          flashError();
          return;
        }
        setListings((prev) => prev.filter((p) => p.id !== id));
        queryClient.invalidateQueries({ queryKey: ['properties'] });
      },
    });

  return (
    <GradientBackground>
      <SafeAreaView style={[styles.container, readable]} edges={['top']}>
        <AppHeader onBack={() => router.back()} />

        {/* Matches web's MyListings.jsx: plain .page-title (not the
            kicker/headline hero — this page doesn't use that pattern) plus
            a gradient "+ New Listing" pill, not a bare icon button. */}
        <View style={styles.titleRow}>
          <Text style={styles.pageTitle} accessibilityRole="header">{t('listing.myListings')}</Text>
          <View style={styles.titleActions}>
            {isAgent && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t('import.entry')}
                onPress={() => router.push('/listing/import' as Href)}
                activeOpacity={0.75}
                style={styles.importButton}>
                <MaterialIcons name="upload-file" size={20} color={colors.accentText} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => router.push('/listing/new' as Href)}
              activeOpacity={0.85}
              style={styles.newListingTouch}
              hitSlop={6}>
              <LinearGradient colors={[colors.accent, colors.accentEnd]} style={styles.newListingPill}>
                <MaterialIcons name="add" size={16} color="#fff" />
                <Text style={styles.newListingPillText}>{t('listing.newListing')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {actionError && <Text style={styles.errorBanner}>{t('errors.updateFailed')}</Text>}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : loadError ? (
          <LoadError
            onRetry={() => {
              setLoading(true);
              load();
            }}
          />
        ) : listings.length === 0 ? (
          <View style={styles.center}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="home-work" size={36} color={colors.accent} />
            </View>
            <Text style={styles.subtitle}>{t('listing.noListings')}</Text>
            <Text style={styles.description}>{t('listing.noListingsDesc')}</Text>
          </View>
        ) : (
          <FlatList
            data={listings}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={
              hasMore ? (
                <ActionButton variant="secondary" title={t('common.loadMore')} onPress={() => setLimit((n) => n + LIST_PAGE_SIZE)} />
              ) : undefined
            }
            renderItem={({ item }) => {
              const title = getLocalizedText(item.title_i18n, i18n.language) || item.title;
              const color = statusColor(colors, item.status);
              return (
                <View style={styles.row}>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel={title} onPress={() => router.push(`/property/${item.id}` as Href)} activeOpacity={0.8}>
                    {item.image_urls?.[0] ? (
                      <Image accessibilityLabel={title} source={{ uri: item.image_urls[0] }} style={styles.thumb} contentFit="cover" />
                    ) : (
                      <View style={[styles.thumb, styles.thumbPlaceholder]}>
                        <MaterialIcons name="home" size={22} color={colors.textSecondary} />
                      </View>
                    )}
                  </TouchableOpacity>
                  <View style={styles.rowBody}>
                    <View style={styles.rowTop}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
                      <View style={[styles.statusPill, { backgroundColor: `${color}33` }]}>
                        <Text style={[styles.statusPillText, { color }]}>{t(`listing.status.${item.status}`, item.status)}</Text>
                      </View>
                    </View>
                    <Text style={styles.rowPrice}>{formatPrice(item.price, i18n.language, item.currency)}</Text>
                    <View style={styles.rowActions}>
                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => router.push(`/property/${item.id}` as Href)}
                        accessibilityRole="button"
                        accessibilityLabel={t('listing.viewPublic')}
                        activeOpacity={0.7}>
                        <MaterialIcons name="visibility" size={20} color={colors.textPrimary} />
                        <Text style={styles.actionLabel} numberOfLines={1}>{t('listing.actionView')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => router.push(`/listing/${item.id}/edit` as Href)}
                        accessibilityRole="button"
                        accessibilityLabel={t('listing.edit')}
                        activeOpacity={0.7}>
                        <MaterialIcons name="edit" size={20} color={colors.textPrimary} />
                        <Text style={styles.actionLabel} numberOfLines={1}>{t('listing.edit')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => router.push(`/listing/${item.id}/analytics` as Href)}
                        accessibilityRole="button"
                        accessibilityLabel={t('listing.viewDashboard')}
                        activeOpacity={0.7}>
                        <MaterialIcons name="bar-chart" size={20} color={colors.textPrimary} />
                        <Text style={styles.actionLabel} numberOfLines={1}>{t('listing.actionStats')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => toggleStatus(item.id, item.status)}
                        accessibilityRole="button"
                        accessibilityLabel={item.status === 'active' ? t('listing.pause') : t('listing.activate')}
                        activeOpacity={0.7}>
                        <MaterialIcons
                          name={item.status === 'active' ? 'pause' : 'play-arrow'}
                          size={20}
                          color={colors.textPrimary}
                        />
                        <Text style={styles.actionLabel} numberOfLines={1}>
                          {item.status === 'active' ? t('listing.pause') : t('listing.activate')}
                        </Text>
                      </TouchableOpacity>
                      {/* Sale -> Sold, rental -> Rented. Closed listings leave
                          search (only active ones are public) and come back
                          with the play button. */}
                      {(item.status === 'active' || item.status === 'paused') && (
                        <TouchableOpacity
                          style={styles.iconButton}
                          onPress={() => confirmClosed(item.id, closedStatusFor(item.listing_type))}
                          accessibilityRole="button"
                          accessibilityLabel={
                            closedStatusFor(item.listing_type) === 'sold'
                              ? t('listing.markSold')
                              : t('listing.markRented')
                          }
                          activeOpacity={0.7}>
                          <MaterialIcons name="check-circle-outline" size={20} color={colors.textPrimary} />
                          <Text style={styles.actionLabel} numberOfLines={1}>
                            {closedStatusFor(item.listing_type) === 'sold' ? t('listing.actionSold') : t('listing.actionRented')}
                          </Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => confirmDelete(item.id)}
                        accessibilityRole="button"
                        accessibilityLabel={t('listing.delete')}
                        activeOpacity={0.7}>
                        <MaterialIcons name="delete-outline" size={20} color="#e74c3c" />
                        <Text style={[styles.actionLabel, styles.actionLabelDanger]} numberOfLines={1}>{t('listing.delete')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
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
  // Matches web's .page-title exactly — plain bold sans, not the serif
  // kicker/headline hero this app uses elsewhere.
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  pageTitle: {
    flexShrink: 1,
    fontSize: 26,
    fontFamily: Fonts.sansBold,
    color: colors.textPrimary,
  },
  // Never squeezed by a long title in another language: the title wraps.
  titleActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  importButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.glass,
  },
  newListingTouch: { flexShrink: 0 },
  newListingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  newListingPillText: {
    fontSize: 13,
    fontFamily: Fonts.sansSemiBold,
    color: '#fff',
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
    fontFamily: Fonts.sansSemiBold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  description: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  errorBanner: {
    textAlign: 'center',
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: colors.error,
    paddingVertical: 4,
  },
  // Same 20px gutter as the title row and the header above it.
  list: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.primaryLight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
  },
  // Matches web's row thumbnail: 100x90, not a square 84x84.
  thumb: {
    width: 100,
    height: 90,
    borderRadius: 12,
  },
  thumbPlaceholder: {
    backgroundColor: colors.glass,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowBody: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 4,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowTitle: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.sansSemiBold,
    color: colors.textPrimary,
  },
  statusPill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusPillText: {
    fontSize: 12,
    fontFamily: Fonts.sansBold,
  },
  rowPrice: {
    fontSize: 15,
    fontFamily: Fonts.sansBold,
    color: colors.accentText,
  },
  // Six 30px actions need 220px; the column beside the photo is ~148px on a
  // 320px phone, so they wrap to a second line instead of running off the card.
  rowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  // A picture and a word, big enough for any finger.
  iconButton: {
    minWidth: 64,
    minHeight: 52,
    paddingHorizontal: 6,
    paddingVertical: 6,
    gap: 2,
    borderRadius: 10,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: 12,
    fontFamily: Fonts.sansSemiBold,
    color: colors.textPrimary,
  },
  actionLabelDanger: {
    color: colors.error,
  },
});
