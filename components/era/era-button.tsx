import { useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EraAvatar } from '@/components/era/era-avatar';
import { TAB_BAR_BOTTOM_OFFSET, TAB_BAR_HEIGHT } from '@/components/liquid-tab-bar';
import { AI_CHAT_ENABLED } from '@/constants/features';
import { Shadows, type AtticoPalette } from '@/constants/theme';
import { IS_WEB } from '@/constants/web-frame';
import { useCompare } from '@/contexts/compare-context';
import { useTheme } from '@/contexts/theme-context';

const SIZE = 58;

/**
 * Era, the assistant, as a round portrait in the bottom-right corner of the
 * tab screens, just above the tab bar (and above the Compare pill when that
 * is showing, which sits in the same corner). Opens the chat with her.
 */
export function EraButton() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { ids } = useCompare();

  if (!AI_CHAT_ENABLED || IS_WEB) return null;
  const aboveTabBar = insets.bottom + TAB_BAR_BOTTOM_OFFSET + TAB_BAR_HEIGHT + 12;
  const bottom = ids.length > 0 ? aboveTabBar + 56 : aboveTabBar;

  return (
    <Pressable
      style={({ pressed }) => [styles.button, { bottom, right: Math.max(16, insets.right + 16) }, pressed && styles.pressed]}
      onPress={() => router.push('/assistant' as Href)}
      accessibilityRole="button"
      accessibilityLabel={`${t('era.name')}, ${t('era.cta')}`}
      hitSlop={6}>
      <EraAvatar size={SIZE} />
      <View style={styles.online} />
    </Pressable>
  );
}

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    button: {
      position: 'absolute',
      width: SIZE + 6,
      height: SIZE + 6,
      borderRadius: (SIZE + 6) / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...Shadows.nav,
    },
    pressed: { transform: [{ scale: 0.94 }] },
    online: {
      position: 'absolute',
      right: 4,
      bottom: 5,
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: '#22a55a',
      borderWidth: 2.5,
      borderColor: colors.surface,
    },
  });
