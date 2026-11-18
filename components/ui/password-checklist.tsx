import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Fonts, type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { passwordChecks } from '@/src/features/auth/lib/password';

const RULES = ['length', 'upper', 'lower', 'digit', 'symbol'] as const;

/**
 * The five password requirements under a new-password field, each ticked as
 * it is met (src/features/auth/lib/password.js passwordChecks, the same rule
 * the form enforces). `onDark` for the auth card, which is dark in both
 * themes; otherwise it follows the theme, as in the change-password sheet.
 */
export const PasswordChecklist = memo(function PasswordChecklist({
  password,
  onDark = false,
}: {
  password: string;
  onDark?: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors, onDark), [colors, onDark]);
  const checks = passwordChecks(password);

  return (
    <View style={styles.list} accessibilityLabel={t('auth.pwRules')}>
      {RULES.map((rule) => {
        const met = checks[rule];
        return (
          <View
            key={rule}
            style={styles.row}
            accessible
            accessibilityLabel={`${t(`auth.pwRule.${rule}`)}: ${met ? t('auth.pwRuleMet') : t('auth.pwRuleMissing')}`}>
            <MaterialIcons
              name={met ? 'check-circle' : 'radio-button-unchecked'}
              size={16}
              color={met ? styles.metIcon.color : styles.text.color}
            />
            <Text style={[styles.text, met && styles.textMet]}>{t(`auth.pwRule.${rule}`)}</Text>
          </View>
        );
      })}
    </View>
  );
});

const createStyles = (colors: AtticoPalette, onDark: boolean) =>
  StyleSheet.create({
    list: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: 14,
      rowGap: 6,
      paddingHorizontal: 4,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    text: {
      fontFamily: Fonts?.sans,
      fontSize: 13,
      lineHeight: 18,
      color: onDark ? 'rgba(255,255,255,0.78)' : colors.textSecondary,
    },
    textMet: {
      fontFamily: Fonts?.sansSemiBold,
      color: onDark ? '#ffffff' : colors.textPrimary,
    },
    metIcon: {
      color: onDark ? '#7ee2a8' : colors.ok,
    },
  });
