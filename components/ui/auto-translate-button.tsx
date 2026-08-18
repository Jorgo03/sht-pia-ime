import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { translateAll, type I18nMap } from '@/lib/translate';

interface AutoTranslateButtonProps {
  sourceText: string;
  onResult: (translations: I18nMap) => void;
  fieldLabel: string;
}

export function AutoTranslateButton({
  sourceText,
  onResult,
  fieldLabel,
}: AutoTranslateButtonProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    if (!sourceText?.trim()) {
      Alert.alert(t('common.error'), t('errors.generic'));
      return;
    }
    setLoading(true);
    try {
      const result = await translateAll(sourceText, 'sq');
      onResult(result);
    } catch (err: any) {
      Alert.alert('Translation Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const disabled = loading || !sourceText?.trim();

  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.disabled]}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}>
      {loading ? (
        <ActivityIndicator size="small" color={colors.accent} />
      ) : (
        <MaterialIcons name="translate" size={16} color={colors.accent} />
      )}
      <Text style={styles.text}>
        {loading ? 'Translating...' : `Translate ${fieldLabel}`}
      </Text>
    </TouchableOpacity>
  );
}

const createStyles = (colors: AtticoPalette) => StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: colors.glass,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  disabled: {
    opacity: 0.4,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
  },
});
