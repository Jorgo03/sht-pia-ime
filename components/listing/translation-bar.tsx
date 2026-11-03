import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { SOURCE_LANG, SUPPORTED_LANGS, type LangCode } from '@/lib/translate';
import { TranslationState } from '@/src/lib/translationCore';
import type { TranslationStateValue } from '@/src/lib/translationCore';

interface TranslationBarProps {
  activeLang: LangCode;
  onSelect: (lang: LangCode) => void;
  /** Languages that already hold text, shown with a filled outline. */
  filled: (lang: LangCode) => boolean;
  pendingLangs: ReadonlySet<LangCode>;
  state: TranslationStateValue;
  translating: boolean;
  error: string | null;
  /** Which engine produced the current text; `mymemory` is the free one. */
  provider: string | null;
  onRegenerate: () => void;
  onRetry: () => void;
  canRegenerate: boolean;
}

/**
 * The listing form's language selector — and its translation control.
 *
 * One bar for title AND description together, replacing the two independent
 * selectors and the two "Translate <field>" buttons this form used to carry.
 * Selecting a language IS the translate action: there is a single obvious way
 * to get German, rather than a language tab that shows an empty box next to a
 * separate button that fills it.
 */
export function TranslationBar({
  activeLang,
  onSelect,
  filled,
  pendingLangs,
  state,
  translating,
  error,
  provider,
  onRegenerate,
  onRetry,
  canRegenerate,
}: TranslationBarProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const statusLabel =
    state === TranslationState.MANUAL
      ? t('ai.translationManual')
      : state === TranslationState.STALE
        ? t('ai.translationStale')
        : state === TranslationState.CURRENT
          ? // The free engine is visibly rougher than the prompted model, so
            // say which one produced this rather than calling both the same.
            provider === 'mymemory'
            ? t('ai.translationBasic')
            : t('ai.translationAuto')
          : null;

  const statusIcon =
    state === TranslationState.MANUAL
      ? 'edit'
      : state === TranslationState.STALE
        ? 'update'
        : 'auto-awesome';

  return (
    <View style={styles.wrap}>
      <View style={styles.tabs}>
        {SUPPORTED_LANGS.map((lang) => {
          const active = activeLang === lang;
          const busy = pendingLangs.has(lang);
          return (
            <Pressable
              key={lang}
              onPress={() => onSelect(lang)}
              // Blocking only the language already in flight keeps every other
              // tab responsive, which is the difference between a busy form and
              // a frozen one.
              disabled={busy}
              // Taller to the finger only: sideways the 6px gap is all there is,
              // and overlapping slop would send a tap to the neighbour.
              hitSlop={{ top: 6, bottom: 6, left: 3, right: 3 }}
              accessibilityRole="button"
              accessibilityState={{ selected: active, busy }}
              accessibilityLabel={lang.toUpperCase()}
              style={[
                styles.tab,
                filled(lang) && !active && styles.tabFilled,
                active && styles.tabActive,
              ]}>
              {busy ? (
                <ActivityIndicator size="small" color={active ? '#fff' : colors.accent} />
              ) : (
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {lang.toUpperCase()}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* One status line, never more — it sits between the tabs and the input,
          so anything taller would push the field the agent is typing in. */}
      {translating ? (
        <View style={styles.statusRow}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.statusText}>{t('ai.translating')}</Text>
        </View>
      ) : error ? (
        <View style={styles.statusRow}>
          <MaterialIcons name="error-outline" size={14} color={colors.error} />
          <Text style={[styles.statusText, styles.statusError]}>
            {error === 'rate_limited'
              ? t('ai.errorRateLimited')
              : error === 'not_configured'
                ? t('ai.translationNotConfigured')
                : error === 'unavailable'
                  ? t('ai.errorUnavailable')
                  : t('ai.translationFailed')}
          </Text>
          {/* No retry for a rejected server key: the request cannot start
              succeeding until someone changes a secret, so offering "try
              again" would just loop. */}
          {error !== 'not_configured' ? (
            <Pressable onPress={onRetry} hitSlop={8} accessibilityRole="button">
              <Text style={styles.action}>{t('common.retry')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : statusLabel ? (
        <View style={styles.statusRow}>
          <MaterialIcons name={statusIcon} size={14} color={colors.textSecondary} />
          <Text style={styles.statusText}>{statusLabel}</Text>
          {canRegenerate ? (
            <Pressable onPress={onRegenerate} hitSlop={8} accessibilityRole="button">
              <Text style={styles.action}>{t('ai.regenerateTranslation')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : activeLang !== SOURCE_LANG && state === TranslationState.NO_SOURCE ? (
        <View style={styles.statusRow}>
          <Text style={styles.statusText}>{t('ai.translateFirst')}</Text>
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    wrap: {
      gap: 8,
    },
    // Same pill and mono caps as web's .nl-lang-tab, but one equal-width row:
    // wrapping left FR alone on a second line at 320px. Eight two-letter codes
    // fit at ~30px each there; height is fixed so the spinner doesn't jump it.
    tabs: {
      flexDirection: 'row',
      gap: 6,
    },
    tab: {
      flex: 1,
      height: 32,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabActive: {
      backgroundColor: colors.accentEnd,
      borderColor: 'transparent',
    },
    tabFilled: {
      borderColor: colors.accentLight,
    },
    tabText: {
      fontFamily: Fonts?.mono,
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    tabTextActive: {
      color: '#fff',
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
    },
    statusText: {
      fontSize: 12,
      color: colors.textSecondary,
      flexShrink: 1,
    },
    statusError: {
      color: colors.error,
    },
    action: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.accentText,
    },
  });
