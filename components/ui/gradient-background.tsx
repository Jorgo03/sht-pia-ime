import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, type ViewProps } from 'react-native';

import { useFhoTheme } from '@/hooks/use-fho-theme';

interface GradientBackgroundProps extends ViewProps {
  colors?: [string, string, ...string[]];
}

/** Full-screen canvas: a barely-there top-to-bottom fade from surface to bg,
 * matching the flat --fho-bg canvas web sits on, with a hint of depth. */
export function GradientBackground({
  colors,
  style,
  children,
  ...rest
}: GradientBackgroundProps) {
  const { colors: theme } = useFhoTheme();
  return (
    <LinearGradient
      colors={colors ?? [theme.surface, theme.bg]}
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
