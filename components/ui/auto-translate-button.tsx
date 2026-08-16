import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { useFhoTheme } from '@/hooks/use-fho-theme';
import { translateAll, type I18nMap } from '@/lib/translate';

interface AutoTranslateButtonProps {
  sourceText: string;
  onResult: (translations: I18nMap) => void;
  fieldLabel: string;
}

/** Styled after web's `.ai-panel__btn` gradient chip. */
export function AutoTranslateButton({
  sourceText,
  onResult,
  fieldLabel,
}: AutoTranslateButtonProps) {
  const { t } = useTranslation();
  const { colors, radii, fonts } = useFhoTheme();
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
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.8}
      style={disabled && styles.disabled}>
      <LinearGradient
        colors={[colors.orange1, colors.orange2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.button, { borderRadius: radii.sm }]}>
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <MaterialIcons name="translate" size={16} color="#fff" />
        )}
        <Text style={[styles.text, { fontFamily: fonts.sansSemiBold }]}>
          {loading ? 'Translating...' : `Translate ${fieldLabel}`}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  disabled: {
    opacity: 0.4,
  },
  text: {
    fontSize: 13,
    color: '#fff',
  },
});
