import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter, type Href } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/ui/action-button';
import { AppHeader } from '@/components/ui/app-header';
import { GradientBackground } from '@/components/ui/gradient-background';
import { ScreenHero } from '@/components/ui/screen-hero';
import { SignInPrompt } from '@/components/ui/sign-in-prompt';
import { Fonts, type AtticoPalette } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import { useReadableColumn } from '@/hooks/use-responsive';
import { supabase } from '@/lib/supabase';
import {
  batches,
  buildImport,
  COLUMN_NAMES,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  REQUIRED_COLUMNS,
  type ImportError,
  type ImportRow,
} from '@/src/features/listings/lib/bulkImport';

const ERRORS_SHOWN = 30;
const OPTIONAL_COLUMNS = Object.keys(COLUMN_NAMES).filter((c) => !REQUIRED_COLUMNS.includes(c));

export default function ImportListingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const readable = useReadableColumn();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user, isAgent } = useAuth();

  const [reading, setReading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ ok: number; failed: number } | null>(null);
  // Set before the button re-renders as busy: a double tap must not publish twice.
  const publishing = useRef(false);

  if (!user) return <SignInPrompt />;

  const ready = rows?.filter((r) => r.columns) ?? [];
  const withErrors = rows?.filter((r) => !r.columns) ?? [];

  const describe = (e: ImportError) =>
    e.kind === 'required' || e.kind === 'invalid'
      ? t(`import.err.${e.kind}`, { field: COLUMN_NAMES[e.field ?? ''] ?? e.field })
      : t(`import.err.${e.kind}`);

  const pick = async () => {
    setProblem(null);
    setRows(null);
    setResult(null);
    setReading(true);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/csv', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
      });
      if (picked.canceled) return;
      const asset = picked.assets[0];
      if ((asset.size ?? 0) > MAX_IMPORT_BYTES) {
        setProblem(t('import.fileTooBig'));
        return;
      }
      const text = await (await fetch(asset.uri)).text();
      const { data: mine, error } = await supabase.from('properties').select('title, address, price').eq('owner_id', user.id).limit(5000);
      if (error) throw error;
      const parsed = buildImport(text, mine ?? []);
      if (parsed.problem === 'columns') {
        setProblem(t('import.missingColumns', { list: (parsed.missing ?? []).map((c) => COLUMN_NAMES[c]).join(', ') }));
      } else if (parsed.problem === 'tooMany') {
        setProblem(t('import.tooMany', { max: MAX_IMPORT_ROWS }));
      } else if (parsed.problem) {
        setProblem(t(`import.${parsed.problem === 'excel' ? 'fileExcel' : 'fileEmpty'}`));
      } else {
        setRows(parsed.rows);
      }
    } catch {
      setProblem(t('import.readFailed'));
    } finally {
      setReading(false);
    }
  };

  const insertAll = async (items: Record<string, unknown>[]) => {
    const { error } = await supabase.from('properties').insert(items);
    return !error;
  };

  const publish = async () => {
    if (publishing.current || ready.length === 0) return;
    publishing.current = true;
    let ok = 0;
    let failed = 0;
    setProgress({ done: 0, total: ready.length });
    const owned = ready.map((r) => ({
      ...r.columns,
      owner_id: user.id,
      agent_id: user.id,
      owner_type: 'agent',
      status: 'active',
    }));
    for (const group of batches(owned)) {
      if (await insertAll(group)) ok += group.length;
      else {
        // One bad row must not sink the 24 beside it.
        for (const item of group) {
          if (await insertAll([item])) ok += 1;
          else failed += 1;
        }
      }
      setProgress({ done: ok + failed, total: owned.length });
    }
    setProgress(null);
    setRows(null);
    setResult({ ok, failed });
    publishing.current = false;
    await queryClient.invalidateQueries({ queryKey: ['properties'] });
  };

  return (
    <GradientBackground>
      <SafeAreaView style={[styles.container, readable]} edges={['top']}>
        <AppHeader onBack={() => (router.canGoBack() ? router.back() : router.replace('/' as Href))} />
        <ScreenHero pre={t('import.headlinePre')} em={t('import.headlineEm')} />

        {!isAgent ? (
          <View style={styles.center}>
            <Text style={styles.centerText}>{t('import.agentsOnly')}</Text>
          </View>
        ) : progress ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.centerText} accessibilityLiveRegion="polite">
              {t('import.publishing', { done: progress.done, total: progress.total })}
            </Text>
          </View>
        ) : result ? (
          <View style={styles.center}>
            <MaterialIcons name="check-circle" size={44} color={colors.accentText} />
            <Text style={styles.centerText}>{t('import.doneBody', { ok: result.ok })}</Text>
            {result.failed > 0 && <Text style={styles.centerHint}>{t('import.doneFailed', { total: result.failed })}</Text>}
            <ActionButton title={t('listing.myListings')} onPress={() => router.replace('/my-listings' as Href)} />
            <ActionButton variant="secondary" title={t('import.another')} onPress={() => setResult(null)} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 28 + insets.bottom }]} showsVerticalScrollIndicator={false}>
            {problem && (
              <Text style={styles.problem} accessibilityRole="alert">{problem}</Text>
            )}

            {rows ? (
              <>
                <View style={styles.summary}>
                  <View style={styles.summaryCell}>
                    <Text style={[styles.summaryNumber, styles.summaryGood]}>{ready.length}</Text>
                    <Text style={styles.summaryLabel}>{t('import.ready')}</Text>
                  </View>
                  <View style={styles.summaryCell}>
                    <Text style={styles.summaryNumber}>{withErrors.length}</Text>
                    <Text style={styles.summaryLabel}>{t('import.withErrors')}</Text>
                  </View>
                </View>

                {withErrors.length > 0 && (
                  <View style={styles.card}>
                    {withErrors.slice(0, ERRORS_SHOWN).map((row, i) => (
                      <View key={row.line} style={[styles.errorRow, i > 0 && styles.divider]}>
                        <Text style={styles.errorLine}>{t('import.line', { n: row.line })}</Text>
                        <Text style={styles.errorText}>{row.errors.map(describe).join(' · ')}</Text>
                      </View>
                    ))}
                    {withErrors.length > ERRORS_SHOWN && (
                      <Text style={styles.more}>{t('import.more', { total: withErrors.length - ERRORS_SHOWN })}</Text>
                    )}
                  </View>
                )}

                {ready.length > 0 && <ActionButton title={t('import.publish', { total: ready.length })} onPress={publish} />}
                <ActionButton variant="secondary" title={t('import.chooseAnother')} onPress={pick} disabled={reading} />
              </>
            ) : (
              <>
                <Text style={styles.intro}>{t('import.intro')}</Text>
                <ActionButton title={reading ? t('common.loading') : t('import.pick')} onPress={pick} disabled={reading} />

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{t('import.required')}</Text>
                  <Text style={styles.columns}>{REQUIRED_COLUMNS.map((c) => COLUMN_NAMES[c]).join(', ')}</Text>
                  <Text style={[styles.cardTitle, styles.spaced]}>{t('import.optional')}</Text>
                  <Text style={styles.columns}>{OPTIONAL_COLUMNS.map((c) => COLUMN_NAMES[c]).join(', ')}</Text>
                  <Text style={[styles.hint, styles.spaced]}>{t('import.valuesHint')}</Text>
                  <Text style={[styles.hint, styles.spaced]}>{t('import.photosHint')}</Text>
                  <Text style={[styles.hint, styles.spaced]}>{t('import.rightsHint')}</Text>
                </View>
              </>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
    centerText: { fontSize: 16, lineHeight: 22, fontFamily: Fonts.sansSemiBold, color: colors.textPrimary, textAlign: 'center' },
    centerHint: { fontSize: 14, lineHeight: 20, fontFamily: Fonts.sans, color: colors.textSecondary, textAlign: 'center' },
    scroll: { paddingHorizontal: 20, gap: 14 },
    intro: { fontFamily: Fonts.sans, fontSize: 15, lineHeight: 22, color: colors.textSecondary },
    problem: { fontFamily: Fonts.sansMedium, fontSize: 14, lineHeight: 20, color: colors.accentText },
    card: { borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.primaryLight, padding: 16 },
    cardTitle: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.textPrimary, marginBottom: 4 },
    columns: { fontFamily: Fonts.mono, fontSize: 13, lineHeight: 20, color: colors.textSecondary },
    hint: { fontFamily: Fonts.sans, fontSize: 13, lineHeight: 19, color: colors.textSecondary },
    spaced: { marginTop: 12 },
    summary: { flexDirection: 'row', gap: 10 },
    summaryCell: { flex: 1, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.primaryLight, padding: 16, alignItems: 'center' },
    summaryNumber: { fontFamily: Fonts?.serif, fontSize: 32, color: colors.textPrimary },
    summaryGood: { color: colors.accentText },
    summaryLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
    errorRow: { paddingVertical: 10, gap: 2 },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    errorLine: { fontFamily: Fonts.sansSemiBold, fontSize: 13, color: colors.textPrimary },
    errorText: { fontFamily: Fonts.sans, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
    more: { fontFamily: Fonts.sans, fontSize: 13, color: colors.textSecondary, paddingTop: 10 },
  });
