import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, Radii, type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

/** Home's way into the assistant: one row under the search bar, with an example question. */
export function AssistantEntry() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable
      style={styles.row}
      onPress={() => router.push('/assistant' as Href)}
      accessibilityRole="button"
      accessibilityLabel={t('aiAssistant.entry')}
      accessibilityHint={t('aiAssistant.entryHint')}>
      <View style={styles.icon}>
        <LinearGradient colors={[colors.accent, colors.accentEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <MaterialIcons name="auto-awesome" size={16} color="#fff" />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{t('aiAssistant.entry')}</Text>
        <Text style={styles.hint} numberOfLines={1}>
          {t('aiAssistant.entryHint')}
        </Text>
      </View>
      <MaterialIcons name="chevron-right" size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 56,
      marginTop: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.glass,
    },
    icon: { width: 34, height: 34, borderRadius: 17, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    text: { flex: 1, minWidth: 0 },
    title: { fontFamily: Fonts.sansBold, fontSize: 14, color: colors.textPrimary },
    hint: { fontFamily: Fonts.sans, fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  });
