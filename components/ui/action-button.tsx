import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { useFhoTheme } from '@/hooks/use-fho-theme';

interface ActionButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}

/** Mirrors web's .cta-pill (primary) / .ghost-btn (secondary). */
export function ActionButton({ title, onPress, variant = 'primary' }: ActionButtonProps) {
  const { colors, radii, fonts } = useFhoTheme();

  if (variant === 'secondary') {
    return (
      <TouchableOpacity
        style={[
          styles.ghost,
          { borderRadius: radii.pill, borderColor: colors.borderStrong },
        ]}
        onPress={onPress}
        activeOpacity={0.8}>
        <Text style={[styles.ghostText, { fontFamily: fonts.sansSemiBold, color: colors.text }]}>
          {title}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <LinearGradient
        colors={[colors.orange1, colors.orange2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.cta, { borderRadius: radii.pill, shadowColor: colors.orange1 }]}>
        <Text style={[styles.ctaText, { fontFamily: fonts.sansBold }]}>{title}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cta: {
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 6,
  },
  ctaText: {
    fontSize: 16,
    color: '#fff',
  },
  ghost: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 1,
    alignItems: 'center',
  },
  ghostText: {
    fontSize: 14,
  },
});
