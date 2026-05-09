import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { AtticoColors } from '@/constants/theme';

interface ActionButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}

export function ActionButton({
  title,
  onPress,
  variant = 'primary',
}: ActionButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.button, variant === 'secondary' && styles.secondary]}
      onPress={onPress}
      activeOpacity={0.8}>
      <Text
        style={[styles.text, variant === 'secondary' && styles.secondaryText]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: AtticoColors.accentLight,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 28,
    alignItems: 'center',
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: AtticoColors.textPrimary,
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
    color: AtticoColors.primary,
  },
  secondaryText: {
    color: AtticoColors.textPrimary,
  },
});
