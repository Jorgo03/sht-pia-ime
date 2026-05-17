import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, type ViewProps } from 'react-native';

import { AtticoColors } from '@/constants/theme';

interface GradientBackgroundProps extends ViewProps {
  colors?: [string, string, ...string[]];
}

export function GradientBackground({
  colors,
  style,
  children,
  ...rest
}: GradientBackgroundProps) {
  return (
    <LinearGradient
      colors={colors ?? [AtticoColors.gradientStart, '#1a1000', AtticoColors.gradientEnd]}
      style={[styles.container, style]}
      {...rest}>
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
