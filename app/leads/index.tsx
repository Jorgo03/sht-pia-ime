import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LeadSheet, type Lead } from '@/components/leads/lead-sheet';
import { AppHeader } from '@/components/ui/app-header';
import { GradientBackground } from '@/components/ui/gradient-background';
import { LoadError } from '@/components/ui/load-error';
import { ScreenHero } from '@/components/ui/screen-hero';
import { SignInPrompt } from '@/components/ui/sign-in-prompt';
import { Fonts, Radii, Spacing, type AtticoPalette } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import { PAGE_SIZE } from '@/data/properties';
import { formatDate, telUrl, whatsappUrl } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { LEAD_STATUSES, leadSearchFilter, type LeadRow, type LeadStatus } from '@/src/features/leads/lib/leads';

type Filter = LeadStatus | 'all';

function statusColor(colors: AtticoPalette, status: LeadStatus): string {
  const map: Record<LeadStatus, string> = {
    new: colors.accent,
    contacted: colors.statusPaused,
    qualified: colors.statusActive,
    won: colors.statusActive,
    lost: colors.statusDraft,
  };
  return map[status] ?? colors.statusDraft;
}

/**
 * The agent's leads: everyone who got in touch, where they are in the
 * pipeline, and one tap to call, WhatsApp or email them
 * (docs/BSP_CRM_ANALYSIS.md, phase 1). RLS keeps each agent to their own rows.
 */
export default function LeadsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Lead | 'new' | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  // The answer to an older search or filter must not overwrite a newer one.
  const requestId = useRef(0);

  // Typing settles for 300 ms before it becomes a query.
  useEffect(() => {
    const id = setTimeout(() => setSearch(query), 300);
    return () => clearTimeout(id);
  }, [query]);

  const fetchPage = useCallback(
    async (offset: number) => {
      if (!user) return null;
      let q = supabase
        .from('leads')
        .select('*')
        .eq('agent_id', user.id)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (filter !== 'all') q = q.eq('status', filter);
      const or = leadSearchFilter(search);
      if (or) q = q.or(or);
      const { data, error } = await q;
      return error ? null : ((data ?? []) as Lead[]);
    },
    [user, filter, search],
  );

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setLoadError(false);
    const rows = await fetchPage(0);
    if (id !== requestId.current) return;
    if (!rows) setLoadError(true);
    else {
      setLeads(rows);
      setHasMore(rows.length === PAGE_SIZE);
    }
    setLoading(false);
  }, [fetchPage]);

  useEffect(() => {
    if (user) load();
  }, [load, user]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    const id = requestId.current;
    setLoadingMore(true);
    const rows = await fetchPage(leads.length);
    if (id !== requestId.current) return;
    setLoadingMore(false);
    if (!rows) {
      setHasMore(false);
      return;
    }
    // A lead added meanwhile shifts the offsets; never show one twice.
    setLeads((prev) => [...prev, ...rows.filter((r) => !prev.some((p) => p.id === r.id))]);
    setHasMore(rows.length === PAGE_SIZE);
  }, [fetchPage, hasMore, leads.length, loading, loadingMore]);

  const flash = (key: string) => {
    setActionError(key);
    setTimeout(() => setActionError(null), 3000);
  };

  const save = async (row: LeadRow): Promise<boolean> => {
    if (!user) return false;
    if (editing && editing !== 'new') {
      const { data, error } = await supabase.from('leads').update(row).eq('id', editing.id).select('*').single();
      if (error || !data) return false;
      setLeads((prev) => prev.map((l) => (l.id === editing.id ? (data as Lead) : l)));
      return true;
    }
    const { data, error } = await supabase.from('leads').insert({ ...row, agent_id: user.id }).select('*').single();
    if (error || !data) return false;
    if (filter === 'all' || filter === row.status) setLeads((prev) => [data as Lead, ...prev]);
    return true;
  };

  const setStatus = async (lead: Lead, status: LeadStatus) => {
    if (lead.status === status) return;
    const { error } = await supabase.from('leads').update({ status }).eq('id', lead.id);
    if (error) {
      flash('leads.saveFailed');
      return;
    }
    setLeads((prev) =>
      filter === 'all' || filter === status
        ? prev.map((l) => (l.id === lead.id ? { ...l, status } : l))
        : prev.filter((l) => l.id !== lead.id),
    );
  };

  const remove = async (id: string) => {
    setConfirmingDelete(null);
    const { error } = await supabase.from('leads').delete().eq('id', id);
    if (error) {
      flash('leads.deleteFailed');
      return;
    }
    setLeads((prev) => prev.filter((l) => l.id !== id));
  };

  const open = (url: string) => Linking.openURL(url).catch(() => flash('errors.generic'));

  const renderItem = useCallback(
    ({ item }: { item: Lead }) => (
      <LeadCard
        lead={item}
        styles={styles}
        colors={colors}
        confirming={confirmingDelete === item.id}
        onEdit={() => setEditing(item)}
        onStatus={(s) => setStatus(item, s)}
        onCall={() => item.phone && open(telUrl(item.phone))}
        onWhatsApp={() => item.phone && open(whatsappUrl(item.phone, t('leads.greeting', { name: item.name.split(' ')[0] })))}
        onEmail={() => item.email && open(`mailto:${item.email}`)}
        onAskDelete={() => setConfirmingDelete(item.id)}
        onCancelDelete={() => setConfirmingDelete(null)}
        onDelete={() => remove(item.id)}
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the handlers read current state through setters; listing them re-renders every card on each keystroke.
    [styles, colors, confirmingDelete, filter, t],
  );

  if (!user) return authLoading ? null : <SignInPrompt />;

  const filters: Filter[] = ['all', ...LEAD_STATUSES];

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <AppHeader onBack={() => router.back()} />
        <ScreenHero kicker={t('leads.kicker')} pre={t('leads.headlinePre')} em={t('leads.headlineEm')} />

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={18} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder={t('leads.search')}
              placeholderTextColor={colors.textSecondary}
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel={t('leads.search')}
            />
            {query ? (
              <Pressable accessibilityRole="button" accessibilityLabel={t('search.reset')} onPress={() => setQuery('')} hitSlop={10}>
                <MaterialIcons name="close" size={16} color={colors.textSecondary} />
              </Pressable>
            ) : null}
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('leads.add')}
            style={styles.addButton}
            onPress={() => setEditing('new')}
            activeOpacity={0.8}>
            <MaterialIcons name="person-add-alt-1" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <FlatList
          horizontal
          data={filters}
          keyExtractor={(f) => f}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
          style={styles.filtersList}
          renderItem={({ item: f }) => {
            const active = f === filter;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setFilter(f)}
                style={[styles.filterChip, active && styles.filterChipActive]}>
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {f === 'all' ? t('leads.all') : t(`leads.status.${f}`)}
                </Text>
              </Pressable>
            );
          }}
        />

        {actionError ? <Text style={styles.errorBanner}>{t(actionError)}</Text> : null}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : loadError ? (
          <LoadError onRetry={load} />
        ) : leads.length === 0 ? (
          <View style={styles.center}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="people-outline" size={36} color={colors.accent} />
            </View>
            {search || filter !== 'all' ? (
              <Text style={styles.subtitle}>{t('leads.noResults')}</Text>
            ) : (
              <>
                <Text style={styles.subtitle}>{t('leads.empty')}</Text>
                <Text style={styles.description}>{t('leads.emptyHint')}</Text>
                <TouchableOpacity accessibilityRole="button" style={styles.emptyCta} onPress={() => setEditing('new')} activeOpacity={0.8}>
                  <Text style={styles.emptyCtaText}>{t('leads.add')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : (
          <FlatList
            data={leads}
            keyExtractor={(l) => l.id}
            renderItem={renderItem}
            extraData={confirmingDelete}
            contentContainerStyle={styles.list}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            keyboardShouldPersistTaps="handled"
            ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.more} color={colors.accent} /> : undefined}
          />
        )}

        {editing ? (
          <LeadSheet lead={editing === 'new' ? null : editing} onSave={save} onClose={() => setEditing(null)} />
        ) : null}
      </SafeAreaView>
    </GradientBackground>
  );
}

type Styles = ReturnType<typeof createStyles>;

const LeadCard = memo(function LeadCard({
  lead,
  styles,
  colors,
  confirming,
  onEdit,
  onStatus,
  onCall,
  onWhatsApp,
  onEmail,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  lead: Lead;
  styles: Styles;
  colors: AtticoPalette;
  confirming: boolean;
  onEdit: () => void;
  onStatus: (s: LeadStatus) => void;
  onCall: () => void;
  onWhatsApp: () => void;
  onEmail: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  const { t, i18n } = useTranslation();
  const color = statusColor(colors, lead.status);
  const next = LEAD_STATUSES[LEAD_STATUSES.indexOf(lead.status) + 1];
  return (
    <View style={styles.card}>
      <Pressable accessibilityRole="button" onPress={onEdit} style={styles.cardHead} accessibilityHint={t('leads.editTitle')}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(lead.name.trim()[0] ?? '?').toUpperCase()}</Text>
        </View>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.cardTitle} numberOfLines={1}>{lead.name}</Text>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {[lead.phone, lead.email].filter(Boolean).join(' · ') || t('leads.added', { date: formatDate(lead.created_at, i18n.language) })}
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: `${color}26` }]}>
          <Text style={[styles.statusPillText, { color }]}>{t(`leads.status.${lead.status}`)}</Text>
        </View>
      </Pressable>

      {lead.notes ? <Text style={styles.cardNotes} numberOfLines={3}>{lead.notes}</Text> : null}

      {confirming ? (
        <View style={styles.confirmRow}>
          <Text style={styles.confirmText}>{t('leads.deleteTitle')}</Text>
          <View style={styles.actions}>
            <TouchableOpacity accessibilityRole="button" style={styles.action} onPress={onCancelDelete} activeOpacity={0.7}>
              <Text style={styles.actionText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={[styles.action, styles.actionDanger]} onPress={onDelete} activeOpacity={0.7}>
              <MaterialIcons name="delete-outline" size={15} color="#fff" />
              <Text style={[styles.actionText, styles.actionDangerText]}>{t('leads.delete')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          {lead.phone ? (
            <>
              <TouchableOpacity accessibilityRole="button" style={styles.action} onPress={onCall} activeOpacity={0.7}>
                <MaterialIcons name="call" size={15} color={colors.textPrimary} />
                <Text style={styles.actionText}>{t('leads.call')}</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" style={styles.action} onPress={onWhatsApp} activeOpacity={0.7}>
                <MaterialIcons name="chat" size={15} color={colors.textPrimary} />
                <Text style={styles.actionText}>{t('leads.whatsapp')}</Text>
              </TouchableOpacity>
            </>
          ) : null}
          {lead.email ? (
            <TouchableOpacity accessibilityRole="button" style={styles.action} onPress={onEmail} activeOpacity={0.7}>
              <MaterialIcons name="mail-outline" size={15} color={colors.textPrimary} />
              <Text style={styles.actionText}>{t('leads.sendEmail')}</Text>
            </TouchableOpacity>
          ) : null}
          {next && lead.status !== 'lost' ? (
            <TouchableOpacity accessibilityRole="button" style={styles.action} onPress={() => onStatus(next)} activeOpacity={0.7}>
              <MaterialIcons name="arrow-forward" size={15} color={colors.accentText} />
              <Text style={[styles.actionText, { color: colors.accentText }]}>{t(`leads.status.${next}`)}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('leads.delete')}
            style={[styles.action, styles.iconAction]}
            onPress={onAskDelete}
            activeOpacity={0.7}>
            <MaterialIcons name="delete-outline" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, paddingHorizontal: 32 },
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
    subtitle: { fontSize: 17, fontWeight: '600', color: colors.textPrimary, textAlign: 'center' },
    description: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
    emptyCta: { marginTop: 12, minHeight: 44, justifyContent: 'center', paddingHorizontal: 20, borderRadius: 999, backgroundColor: colors.accent },
    emptyCtaText: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: '#fff' },
    searchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: 20 },
    searchBox: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 48,
      paddingHorizontal: 14,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.glass,
    },
    searchInput: { flex: 1, fontFamily: Fonts.sans, fontSize: 15, color: colors.textPrimary, paddingVertical: 10 },
    addButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
    // Never squeezed by the list below it.
    filtersList: { flexGrow: 0, flexShrink: 0, marginTop: 12 },
    filters: { paddingHorizontal: 20, gap: 8 },
    filterChip: {
      minHeight: 36,
      justifyContent: 'center',
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.glass,
    },
    filterChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    filterText: { fontFamily: Fonts.sansSemiBold, fontSize: 13, color: colors.textPrimary },
    filterTextActive: { color: '#fff' },
    errorBanner: { textAlign: 'center', fontSize: 12, color: colors.error, paddingTop: 8 },
    list: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, gap: 12 },
    more: { marginVertical: 16 },
    card: { backgroundColor: colors.primaryLight, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10 },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontFamily: Fonts.sansBold, fontSize: 16, color: '#fff' },
    cardTitleWrap: { flex: 1, gap: 2 },
    cardTitle: { fontFamily: Fonts.sansSemiBold, fontSize: 15, color: colors.textPrimary },
    cardMeta: { fontFamily: Fonts.sans, fontSize: 13, color: colors.textSecondary },
    statusPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    statusPillText: { fontSize: 11, fontWeight: '700' },
    cardNotes: { fontFamily: Fonts.sans, fontSize: 13, color: colors.textSecondary },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    action: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 36,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
    },
    iconAction: { paddingHorizontal: 10, marginLeft: 'auto' },
    actionText: { fontFamily: Fonts.sansSemiBold, fontSize: 12, color: colors.textPrimary },
    actionDanger: { backgroundColor: colors.error, borderColor: colors.error },
    actionDangerText: { color: '#fff' },
    confirmRow: { gap: 8 },
    confirmText: { fontFamily: Fonts.sansSemiBold, fontSize: 13, color: colors.textPrimary },
  });
