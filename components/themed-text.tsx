import { StyleSheet, Text, type TextProps } from 'react-native';

import { useFhoTheme } from '@/hooks/use-fho-theme';
import { useThemeColor } from '@/hooks/use-theme-color';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');
  const { colors, fonts } = useFhoTheme();

  return (
    <Text
      style={[
        { color },
        type === 'default' ? [styles.default, { fontFamily: fonts.sans }] : undefined,
        type === 'title' ? [styles.title, { fontFamily: fonts.serifSemiBold }] : undefined,
        type === 'defaultSemiBold'
          ? [styles.defaultSemiBold, { fontFamily: fonts.sansSemiBold }]
          : undefined,
        type === 'subtitle' ? [styles.subtitle, { fontFamily: fonts.serif }] : undefined,
        type === 'link' ? [styles.link, { fontFamily: fonts.sansMedium, color: colors.orange1 }] : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
  },
  title: {
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 20,
    lineHeight: 26,
  },
  link: {
    lineHeight: 30,
    fontSize: 16,
  },
});
