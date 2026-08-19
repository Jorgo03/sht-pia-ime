import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppHeader } from '@/components/ui/app-header';
import { GradientBackground } from '@/components/ui/gradient-background';
import { type AtticoPalette } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';
import { formatPrice, getLocalizedText } from '@/lib/format';
import { Property } from '@/data/types';

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
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const [listings, setListings] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState(false);

  const flashError = () => {
    setActionError(true);
    setTimeout(() => setActionError(false), 3000);
  };

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('properties')
      .select('*')
      .or(`owner_id.eq.${user.id},agent_id.eq.${user.id}`)
      .order('created_at', { ascending: false });
    setListings(data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleStatus = async (id: string, current: string) => {
    const next = current === 'active' ? 'paused' : 'active';
    const { error } = await supabase.from('properties').update({ status: next }).eq('id', id);
    if (error) {
      flashError();
      return;
    }
    setListings((prev) => prev.map((p) => (p.id === id ? { ...p, status: next as Property['status'] } : p)));
    // A paused listing must disappear from Explore/Home/Map's cached
    // results (and a re-activated one must reappear) — without this, those
    // screens would keep showing the pre-mutation cached list for up to
    // staleTime.
    queryClient.invalidateQueries({ queryKey: ['properties'] });
  };

  const confirmDelete = (id: string) => {
    Alert.alert(t('listing.confirmDelete'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('listing.delete'),
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('properties').delete().eq('id', id);
          if (error) {
            flashError();
            return;
          }
          setListings((prev) => prev.filter((p) => p.id !== id));
          queryClient.invalidateQueries({ queryKey: ['properties'] });
        },
      },
    ]);
  };

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <AppHeader onBack={() => router.back()} />

        {/* Matches web's MyListings.jsx: plain .page-title (not the
            kicker/headline hero — this page doesn't use that pattern) plus
            a gradient "+ New Listing" pill, not a bare icon button. */}
        <View style={styles.titleRow}>
          <Text style={styles.pageTitle}>{t('listing.myListings')}</Text>
          <TouchableOpacity onPress={() => router.push('/listing/new' as Href)} activeOpacity={0.85}>
            <LinearGradient colors={[colors.accent, colors.accentEnd]} style={styles.newListingPill}>
              <MaterialIcons name="add" size={16} color="#fff" />
              <Text style={styles.newListingPillText}>{t('listing.newListing')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {actionError && <Text style={styles.errorBanner}>{t('errors.updateFailed')}</Text>}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
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
            renderItem={({ item }) => {
              const title = getLocalizedText(item.title_i18n, i18n.language) || item.title;
              const color = statusColor(colors, item.status);
              return (
                <View style={styles.row}>
                  <TouchableOpacity onPress={() => router.push(`/property/${item.id}` as Href)} activeOpacity={0.8}>
                    {item.image_urls?.[0] ? (
                      <Image source={{ uri: item.image_urls[0] }} style={styles.thumb} contentFit="cover" />
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
                        activeOpacity={0.7}>
                        <MaterialIcons name="visibility" size={16} color={colors.textPrimary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => router.push(`/listing/${item.id}/analytics` as Href)}
                        activeOpacity={0.7}>
                        <MaterialIcons name="bar-chart" size={16} color={colors.textPrimary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => toggleStatus(item.id, item.status)}
                        activeOpacity={0.7}>
                        <MaterialIcons
                          name={item.status === 'active' ? 'pause' : 'play-arrow'}
                          size={16}
                          color={colors.textPrimary}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => confirmDelete(item.id)}
                        activeOpacity={0.7}>
                        <MaterialIcons name="delete-outline" size={16} color="#e74c3c" />
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.textPrimary,
  },
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
    fontWeight: '600',
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
  list: {
    paddingHorizontal: 16,
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
  rowPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.accent,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
