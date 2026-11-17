import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

type IconName = keyof typeof MaterialIcons.glyphMap;

const LINKS: { href: string; icon: IconName; title: string; sub: string }[] = [
  { href: '/wanted', icon: 'person-search', title: 'wanted.homeTitle', sub: 'wanted.homeSub' },
  { href: '/guide', icon: 'flight-land', title: 'legal.buyingGuide', sub: 'legal.buyingGuideHint' },
];

/**
 * Two entry points on Home: the wanted-homes board (buyers say what they
 * want) and the guide for buying from abroad. Both are differentiators, so
 * they sit on Home rather than in a menu.
 */
export function DiscoverLinks() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.row}>
      {LINKS.map((l) => (
        <Pressable
          key={l.href}
          accessibilityRole="link"
          accessibilityLabel={`${t(l.title)}. ${t(l.sub)}`}
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          onPress={() => router.push(l.href as Href)}>
          <MaterialIcons name={l.icon} size={22} color={colors.accentText} />
          <Text style={styles.title} numberOfLines={2}>{t(l.title)}</Text>
          <Text style={styles.sub} numberOfLines={3}>{t(l.sub)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    row: { flexDirection: 'row', gap: 12 },
    card: {
      flex: 1,
      minHeight: 44,
      gap: 6,
      padding: 16,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.glass,
    },
    pressed: { opacity: 0.8 },
    title: { fontFamily: Fonts.sansSemiBold, fontSize: 15, color: colors.textPrimary },
    sub: { fontFamily: Fonts.sans, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  });
