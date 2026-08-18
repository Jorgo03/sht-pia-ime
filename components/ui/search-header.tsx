import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Fonts, type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

interface SearchHeaderProps {
  kicker: string;
  headline: string;
  /** Rendered in accent-orange italic, appended after `headline` — mirrors
   *  web's <em> match-count segment in Home.jsx's screen-headline. */
  emphasis?: string;
  onSearchPress?: () => void;
}

/**
 * Home's header: the "editorial" kicker+headline pattern shared by every
 * web screen (screen-kicker / screen-headline in src/styles/globals.css),
 * plus web's full-width tappable home-search-bar — not just a small icon
 * button, so the search entry point actually reads as a search field.
 */
export function SearchHeader({ kicker, headline, emphasis, onSearchPress }: SearchHeaderProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.kickerRow}>
        <View style={styles.kickerDash} />
        <Text style={styles.kicker}>{kicker}</Text>
      </View>
      <Text style={styles.headline}>
        {headline}
        {emphasis ? <Text style={styles.headlineEmphasis}> {emphasis}</Text> : null}
      </Text>

      <TouchableOpacity style={styles.searchBar} onPress={onSearchPress} activeOpacity={0.8}>
        <MaterialIcons name="search" size={18} color={colors.textSecondary} />
        <Text style={styles.searchPlaceholder} numberOfLines={1}>
          {t('home.searchPlaceholder')}
        </Text>
        <View style={styles.filtersChip}>
          <Text style={styles.filtersChipText}>{t('search.filters')}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors: AtticoPalette) => StyleSheet.create({
  container: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
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
  },
  // Matches web's .screen-headline exactly (src/styles/globals.css).
  headline: {
    paddingHorizontal: 20,
    fontFamily: Fonts?.serif,
    fontWeight: '500',
    fontSize: 30,
    lineHeight: 31.5,
    letterSpacing: -0.75,
    color: colors.textPrimary,
  },
  headlineEmphasis: {
    fontFamily: Fonts?.serif,
    fontStyle: 'italic',
    fontWeight: '500',
    color: colors.accent,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
  },
  filtersChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.accentGlow,
  },
  filtersChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },
});
