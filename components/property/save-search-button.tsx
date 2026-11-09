import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, InlineTarget, type AtticoPalette } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import type { PropertyFilters } from '@/data/types';
import { supabase } from '@/lib/supabase';
import { hasFacets, savedFromFilters, savedKey, savedLabel } from '@/src/features/saved-searches/lib/fromFilters';
import { countMatches } from '@/src/features/saved-searches/lib/matches';

/** One tap saves what is on the Search screen, with alerts on. */
export function SaveSearchButton({ filters }: { filters: PropertyFilters }) {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const saved = useMemo(() => savedFromFilters(filters), [filters]);
  const queryKey = ['saved-search-keys', user?.id];
  const { data: keys } = useQuery({
    queryKey,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('saved_searches').select('filters').limit(200);
      if (error) throw error;
      return (data ?? []).map((row) => savedKey(row.filters));
    },
  });
  const alreadySaved = keys?.includes(savedKey(saved)) ?? false;

  if (!hasFacets(saved)) return null;

  const save = async () => {
    if (saving) return;
    if (alreadySaved) {
      router.push('/saved-searches' as Href);
      return;
    }
    // Signing in happens on Profile; the filters are still here afterwards.
    if (!user) {
      router.push('/(tabs)/profile' as Href);
      return;
    }
    setSaving(true);
    setFailed(false);
    // Start from what matches today, so only later listings count as new.
    const current = await countMatches(supabase, saved);
    const { error } = await supabase.from('saved_searches').insert({
      user_id: user.id,
      name: savedLabel(saved, t),
      filters: saved,
      alerts_enabled: true,
      last_match_count: current ?? 0,
    });
    setSaving(false);
    if (error) {
      setFailed(true);
      return;
    }
    await queryClient.invalidateQueries({ queryKey });
  };

  const label = saving ? t('common.loading') : alreadySaved ? t('search.searchSaved') : t('search.saveSearch');
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={save} disabled={saving} style={[styles.button, InlineTarget]} hitSlop={6}>
        <MaterialIcons name={alreadySaved ? 'notifications-active' : 'notifications-none'} size={16} color={colors.accentText} />
        <Text style={styles.text}>{label}</Text>
      </Pressable>
      {failed && <Text style={styles.error} accessibilityLiveRegion="polite">{t('errors.generic')}</Text>}
    </View>
  );
}

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, paddingHorizontal: 6, marginBottom: 8 },
    button: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    text: { fontFamily: Fonts.sansSemiBold, fontSize: 13, color: colors.accentText },
    error: { fontFamily: Fonts.sans, fontSize: 12, color: colors.textSecondary },
  });
