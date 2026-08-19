import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppHeader } from '@/components/ui/app-header';
import { PrimaryCTA } from '@/components/ui/buttons';
import { GradientBackground } from '@/components/ui/gradient-background';
import { type AtticoPalette, Fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useFilters } from '@/contexts/filters-context';
import { useTheme } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';
import { formatDate, formatPrice } from '@/lib/format';
import { PropertyFilters } from '@/data/types';

type Tab = 'searches' | 'wanted';
type ListingType = 'sale' | 'rent';

interface SavedSearch {
  id: string;
  name: string;
  // Mirrors src/features/saved-searches/pages/SavedSearches.jsx's
  // filtersToParams: only city + listing_type are ever written today (by
  // AddSheet.jsx's SaveSearchForm), but type/minPrice/maxPrice/beds are
  // read defensively so a saved search stays fully replayable if the web
  // create form grows those fields later.
  filters: {
    city?: string | null;
    listing_type?: ListingType | null;
    type?: string | null;
    minPrice?: number | null;
    maxPrice?: number | null;
    beds?: number | null;
  } | null;
  alerts_enabled: boolean;
  created_at: string;
}

interface WantedHome {
  id: string;
  city: string;
  listing_type: ListingType;
  max_price: number | null;
  min_bedrooms: number | null;
  notes: string | null;
  status: 'open' | 'closed';
  created_at: string;
}

export default function SavedSearchesScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { setFilter, reset: resetFilters } = useFilters();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [tab, setTab] = useState<Tab>('searches');
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [wanted, setWanted] = useState<WantedHome[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  // New-search form fields
  const [searchName, setSearchName] = useState('');
  const [searchCity, setSearchCity] = useState('');
  const [searchType, setSearchType] = useState<ListingType>('sale');

  // New-wanted form fields
  const [wantedCity, setWantedCity] = useState('');
  const [wantedType, setWantedType] = useState<ListingType>('sale');
  const [wantedMaxPrice, setWantedMaxPrice] = useState('');
  const [wantedMinBeds, setWantedMinBeds] = useState('');
  const [wantedNotes, setWantedNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const flashError = () => {
    setActionError(true);
    setTimeout(() => setActionError(false), 3000);
  };

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    const [s, w] = await Promise.all([
      supabase.from('saved_searches').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('wanted_homes').select('*').eq('client_id', user.id).order('created_at', { ascending: false }),
    ]);
    setSearches(s.data ?? []);
    setWanted(w.data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleAlerts = async (row: SavedSearch) => {
    const next = !row.alerts_enabled;
    const { error } = await supabase.from('saved_searches').update({ alerts_enabled: next }).eq('id', row.id);
    if (error) return flashError();
    setSearches((prev) => prev.map((s) => (s.id === row.id ? { ...s, alerts_enabled: next } : s)));
  };

  const deleteSearch = async (id: string) => {
    const { error } = await supabase.from('saved_searches').delete().eq('id', id);
    if (error) return flashError();
    setSearches((prev) => prev.filter((s) => s.id !== id));
  };

  const runSearch = (row: SavedSearch) => {
    resetFilters();
    const f = row.filters;
    if (f?.city) setFilter('city', f.city);
    if (f?.listing_type) setFilter('listingType', f.listing_type);
    if (f?.type) setFilter('propertyType', f.type as PropertyFilters['propertyType']);
    if (f?.minPrice) setFilter('minPrice', f.minPrice);
    if (f?.maxPrice) setFilter('maxPrice', f.maxPrice);
    if (f?.beds) setFilter('beds', f.beds);
    router.push('/(tabs)/explore' as Href);
  };

  const closeWanted = async (row: WantedHome) => {
    const next = row.status === 'open' ? 'closed' : 'open';
    const { error } = await supabase.from('wanted_homes').update({ status: next }).eq('id', row.id);
    if (error) return flashError();
    setWanted((prev) => prev.map((w) => (w.id === row.id ? { ...w, status: next } : w)));
  };

  const deleteWanted = async (id: string) => {
    const { error } = await supabase.from('wanted_homes').delete().eq('id', id);
    if (error) return flashError();
    setWanted((prev) => prev.filter((w) => w.id !== id));
  };

  const submitSearch = async () => {
    if (!searchName.trim() || !user) return;
    setSaving(true);
    const { error } = await supabase.from('saved_searches').insert({
      user_id: user.id,
      name: searchName.trim(),
      filters: { city: searchCity.trim() || null, listing_type: searchType },
      alerts_enabled: true,
    });
    setSaving(false);
    if (error) return flashError();
    setSearchName('');
    setSearchCity('');
    setFormOpen(false);
    load();
  };

  const submitWanted = async () => {
    if (!wantedCity.trim() || !user) return;
    setSaving(true);
    const { error } = await supabase.from('wanted_homes').insert({
      client_id: user.id,
      city: wantedCity.trim(),
      listing_type: wantedType,
      max_price: wantedMaxPrice ? Number(wantedMaxPrice) : null,
      min_bedrooms: wantedMinBeds ? Number(wantedMinBeds) : null,
      notes: wantedNotes.trim() || null,
    });
    setSaving(false);
    if (error) return flashError();
    setWantedCity('');
    setWantedMaxPrice('');
    setWantedMinBeds('');
    setWantedNotes('');
    setFormOpen(false);
    load();
  };

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <AppHeader onBack={() => router.back()} />

        {/* Matches web's SavedSearches.jsx screen-kicker/screen-headline hero. */}
        <View style={styles.heroBlock}>
          <View style={styles.kickerRow}>
            <View style={styles.kickerDash} />
            <Text style={styles.kicker}>{t('saved.kicker')}</Text>
          </View>
          <Text style={styles.headline}>
            {t('saved.headlinePre')} <Text style={styles.headlineEm}>{t('saved.headlineEm')}</Text>
          </Text>
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity onPress={() => setTab('searches')} activeOpacity={0.85} style={styles.segmentWrap}>
            {tab === 'searches' ? (
              <LinearGradient colors={[colors.accent, colors.accentEnd]} style={styles.tab}>
                <Text style={[styles.tabText, styles.tabTextActive]}>
                  {t('saved.tabSearches')} ({searches.length})
                </Text>
              </LinearGradient>
            ) : (
              <View style={styles.tab}>
                <Text style={styles.tabText}>{t('saved.tabSearches')} ({searches.length})</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTab('wanted')} activeOpacity={0.85} style={styles.segmentWrap}>
            {tab === 'wanted' ? (
              <LinearGradient colors={[colors.accent, colors.accentEnd]} style={styles.tab}>
                <Text style={[styles.tabText, styles.tabTextActive]}>
                  {t('saved.tabWanted')} ({wanted.length})
                </Text>
              </LinearGradient>
            ) : (
              <View style={styles.tab}>
                <Text style={styles.tabText}>{t('saved.tabWanted')} ({wanted.length})</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Matches web's .pill-btn "+ New Search/Wanted" placed below the
            tabs, not a corner icon button in the header. */}
        <TouchableOpacity style={styles.addPill} onPress={() => setFormOpen(true)} activeOpacity={0.7}>
          <MaterialIcons name="add" size={14} color={colors.textPrimary} />
          <Text style={styles.addPillText}>
            {tab === 'searches' ? t('saved.newSearch') : t('saved.newWanted')}
          </Text>
        </TouchableOpacity>

        {actionError && <Text style={styles.errorBanner}>{t('errors.updateFailed')}</Text>}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {tab === 'searches' ? (
              searches.length === 0 ? (
                <View style={styles.emptyCard}>
                  <MaterialIcons name="search" size={28} color={colors.accent} />
                  <Text style={styles.emptyTitle}>{t('saved.emptySearches')}</Text>
                  <Text style={styles.emptyHint}>{t('saved.emptySearchesHint')}</Text>
                </View>
              ) : (
                searches.map((s) => (
                  <View key={s.id} style={styles.card}>
                    <View style={styles.cardHead}>
                      <Text style={styles.cardTitle}>{s.name}</Text>
                      <Text style={styles.cardDate}>{formatDate(s.created_at, i18n.language)}</Text>
                    </View>
                    <View style={styles.cardMetaRow}>
                      {s.filters?.city ? (
                        <Text style={styles.cardMeta}>
                          <MaterialIcons name="location-on" size={12} /> {s.filters.city}
                        </Text>
                      ) : null}
                      {s.filters?.listing_type ? (
                        <Text style={styles.cardMeta}>{t(`listing.type.${s.filters.listing_type}`, s.filters.listing_type)}</Text>
                      ) : null}
                    </View>
                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => runSearch(s)}
                        activeOpacity={0.7}
                        accessibilityLabel={t('saved.run')}>
                        <MaterialIcons name="play-arrow" size={14} color={colors.textPrimary} />
                        <Text style={styles.actionButtonText}>{t('saved.run')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => toggleAlerts(s)}
                        activeOpacity={0.7}
                        accessibilityLabel={s.alerts_enabled ? t('saved.alertsOff') : t('saved.alertsOn')}>
                        <MaterialIcons
                          name={s.alerts_enabled ? 'notifications' : 'notifications-off'}
                          size={16}
                          color={colors.textPrimary}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => deleteSearch(s.id)}
                        activeOpacity={0.7}
                        accessibilityLabel={t('saved.delete')}>
                        <MaterialIcons name="delete-outline" size={16} color="#e74c3c" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )
            ) : wanted.length === 0 ? (
              <View style={styles.emptyCard}>
                <MaterialIcons name="favorite-border" size={28} color={colors.accent} />
                <Text style={styles.emptyTitle}>{t('saved.emptyWanted')}</Text>
                <Text style={styles.emptyHint}>{t('saved.emptyWantedHint')}</Text>
              </View>
            ) : (
              wanted.map((w) => {
                const statusColor = w.status === 'open' ? colors.statusActive : colors.statusDraft;
                return (
                  <View key={w.id} style={styles.card}>
                    <View style={styles.cardHead}>
                      <Text style={styles.cardTitle}>
                        {w.city} · {t(`listing.type.${w.listing_type}`, w.listing_type)}
                      </Text>
                      <View style={[styles.statusPill, { backgroundColor: `${statusColor}33` }]}>
                        <Text style={[styles.statusPillText, { color: statusColor }]}>
                          {t(`saved.wantedStatus.${w.status}`, w.status)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.cardMetaRow}>
                      {w.max_price ? (
                        <Text style={styles.cardMeta}>
                          {t('addSheet.maxPrice')}: {formatPrice(w.max_price, i18n.language)}
                        </Text>
                      ) : null}
                      {w.min_bedrooms ? (
                        <Text style={styles.cardMeta}>
                          {t('addSheet.minBedrooms')}: {w.min_bedrooms}
                        </Text>
                      ) : null}
                    </View>
                    {w.notes ? <Text style={styles.cardMeta}>{w.notes}</Text> : null}
                    <View style={styles.cardActions}>
                      <TouchableOpacity style={styles.actionButton} onPress={() => closeWanted(w)} activeOpacity={0.7}>
                        <Text style={styles.actionButtonText}>
                          {w.status === 'open' ? t('saved.markClosed') : t('saved.markOpen')}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => deleteWanted(w.id)}
                        activeOpacity={0.7}
                        accessibilityLabel={t('saved.delete')}>
                        <MaterialIcons name="delete-outline" size={16} color="#e74c3c" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      <Modal visible={formOpen} transparent animationType="slide" onRequestClose={() => setFormOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {tab === 'searches' ? t('saved.newSearch') : t('saved.newWanted')}
              </Text>
              <TouchableOpacity onPress={() => setFormOpen(false)} hitSlop={8}>
                <MaterialIcons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {tab === 'searches' ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder={t('addSheet.searchName')}
                  placeholderTextColor={colors.textSecondary}
                  value={searchName}
                  onChangeText={setSearchName}
                />
                <TextInput
                  style={styles.input}
                  placeholder={t('listing.city')}
                  placeholderTextColor={colors.textSecondary}
                  value={searchCity}
                  onChangeText={setSearchCity}
                />
                <View style={styles.toggleRow}>
                  {(['sale', 'rent'] as const).map((typ) => (
                    <TouchableOpacity
                      key={typ}
                      style={[styles.toggle, searchType === typ && styles.toggleActive]}
                      onPress={() => setSearchType(typ)}
                      activeOpacity={0.7}>
                      <Text style={[styles.toggleText, searchType === typ && styles.toggleTextActive]}>
                        {typ === 'sale' ? t('search.sale') : t('search.rent')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {/* Web's AddSheet submits are `.cta-pill`, no trailing glyph. */}
                <PrimaryCTA
                  label={saving ? t('common.loading') : t('common.save')}
                  icon={null}
                  loading={saving}
                  onPress={submitSearch}
                  disabled={saving || !searchName.trim()}
                />
              </>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  placeholder={t('listing.city')}
                  placeholderTextColor={colors.textSecondary}
                  value={wantedCity}
                  onChangeText={setWantedCity}
                />
                <View style={styles.toggleRow}>
                  {(['sale', 'rent'] as const).map((typ) => (
                    <TouchableOpacity
                      key={typ}
                      style={[styles.toggle, wantedType === typ && styles.toggleActive]}
                      onPress={() => setWantedType(typ)}
                      activeOpacity={0.7}>
                      <Text style={[styles.toggleText, wantedType === typ && styles.toggleTextActive]}>
                        {typ === 'sale' ? t('search.sale') : t('search.rent')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.rowInputs}>
                  <TextInput
                    style={[styles.input, styles.rowInput]}
                    placeholder={t('addSheet.maxPrice')}
                    placeholderTextColor={colors.textSecondary}
                    value={wantedMaxPrice}
                    onChangeText={setWantedMaxPrice}
                    keyboardType="numeric"
                  />
                  <TextInput
                    style={[styles.input, styles.rowInput]}
                    placeholder={t('addSheet.minBedrooms')}
                    placeholderTextColor={colors.textSecondary}
                    value={wantedMinBeds}
                    onChangeText={setWantedMinBeds}
                    keyboardType="numeric"
                  />
                </View>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder={t('addSheet.notes')}
                  placeholderTextColor={colors.textSecondary}
                  value={wantedNotes}
                  onChangeText={setWantedNotes}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
                <PrimaryCTA
                  label={saving ? t('common.loading') : t('common.save')}
                  icon={null}
                  loading={saving}
                  onPress={submitWanted}
                  disabled={saving || !wantedCity.trim()}
                />
              </>
            )}
          </View>
        </View>
      </Modal>
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
  // Matches web's .segment-control / .segment — bordered track, gradient
  // fill on the active tab (not a flat accent fill).
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    padding: 4,
    gap: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentWrap: {
    flex: 1,
  },
  tab: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: '#fff',
  },
  // Matches web's .pill-btn "+ New Search/Wanted" trigger below the tabs.
  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginHorizontal: 20,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  errorBanner: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.error,
    paddingVertical: 4,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 12,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryLight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  emptyHint: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
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
  cardTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  cardDate: {
    fontSize: 11,
    color: colors.textSecondary,
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
    flexWrap: 'wrap',
    gap: 10,
  },
  cardMeta: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  // Matches web's .pill-btn — transparent, pill radius, not a filled glass
  // chip.
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.primaryLight,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  input: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    height: 90,
    paddingTop: 14,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 10,
  },
  rowInput: {
    flex: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggle: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: '#fff',
  },
});
