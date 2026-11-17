import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/contexts/theme-context';

/**
 * The ✕ in a bottom sheet's title row. A real 44×44 target (hitSlop does not
 * exist on the web), pulled back by the same 11px on every side so the 22px
 * glyph still lines up with the title and the sheet's gutter, and the row
 * keeps its height.
 */
export function SheetCloseButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.button} accessibilityRole="button" accessibilityLabel={t('common.close')}>
      <MaterialIcons name="close" size={22} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    margin: -11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
