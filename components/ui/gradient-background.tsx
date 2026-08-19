import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, type ViewProps } from 'react-native';

import { useTheme } from '@/contexts/theme-context';

interface GradientBackgroundProps extends ViewProps {
  colors?: [string, string, ...string[]];
}

export function GradientBackground({
  colors,
  style,
  children,
  ...rest
}: GradientBackgroundProps) {
  const { theme, colors: palette } = useTheme();
  const middleStop = theme === 'dark' ? '#1a1000' : '#fbe8d3';

  return (
    <LinearGradient
      colors={colors ?? [palette.gradientStart, middleStop, palette.gradientEnd]}
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
