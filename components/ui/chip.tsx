import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, Radii, Spacing, type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

/**
 * Chip / SectionLabel / StatChip from the design handoff §17.
 *
 * These three existed as private copies inside filter-sheet.tsx and
 * listing/create.tsx — the same pill, the same mono-caps label, written twice
 * with slightly different padding. §17 calls for one of each, so these are
 * the shared versions; the local copies should be replaced by these as each
 * screen is touched.
 */

/** Pill button with on/off state — orange tint when on (never a solid fill;
 *  that treatment belongs to the segmented control). */
export function Chip({
  label,
  on,
  onPress,
  /** Small leading dot, used by the listing wizard's type chips. */
  withDot = false,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  withDot?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={[styles.chip, on && styles.chipOn]}>
      {withDot && <View style={[styles.chipDot, on && styles.chipDotOn]} />}
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

/** Mono caps label with a leading 14px orange dash (§17). The dash width is
 *  from web's `.screen-kicker__dash` / `.nl-section-label`. */
export function SectionLabel({ label }: { label: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.sectionLabelRow}>
      <View style={styles.sectionLabelDash} />
      <Text style={styles.sectionLabelText}>{label.toUpperCase()}</Text>
    </View>
  );
}

/** Pill with icon + value + unit — property cards and the detail header. */
export function StatChip({
  icon,
  value,
  unit,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  value: string | number;
  unit?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.statChip}>
      <MaterialIcons name={icon} size={14} color={colors.accent} />
      <Text style={styles.statChipText}>
        {value}
        {unit ? ` ${unit}` : ''}
      </Text>
    </View>
  );
}

const createStyles = (colors: AtticoPalette) => StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.glass,
  },
  chipOn: {
    backgroundColor: colors.accentTint,
    borderColor: colors.accent,
  },
  chipText: {
    fontFamily: Fonts?.sansMedium,
    fontSize: 13,
    color: colors.textPrimary,
  },
  chipTextOn: {
    color: colors.accentEnd,
  },
  chipDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.textFaint,
  },
  chipDotOn: {
    backgroundColor: colors.accent,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: Spacing.sm,
  },
  sectionLabelDash: {
    width: 14,
    height: 1,
    backgroundColor: colors.accent,
  },
  sectionLabelText: {
    fontFamily: Fonts?.mono,
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.textSecondary,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.pill,
    backgroundColor: colors.glass,
  },
  statChipText: {
    fontFamily: Fonts?.sans,
    fontSize: 12,
    color: colors.textSecondary,
  },
});
