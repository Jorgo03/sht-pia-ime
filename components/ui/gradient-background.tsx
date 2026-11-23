import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { IS_WEB } from '@/constants/web-frame';

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

  // Website: no panel of its own. The page's ground (the root layout's web
  // column) runs the full width of the browser, so a screen no longer reads
  // as a lighter phone-shaped panel in the middle of a desktop window.
  if (IS_WEB && !colors) {
    return (
      <View style={[styles.container, style]} {...rest}>
        {children}
      </View>
    );
  }

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
