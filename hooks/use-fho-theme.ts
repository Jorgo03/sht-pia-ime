import { FontFamilies, Radii, Spacing } from '@/constants/theme';
import { useFhoTheme as useThemeContext } from '@/contexts/theme-context';

/**
 * One-stop hook for themed styling: current palette (colors), plus the
 * theme-independent radius/spacing/font tokens shared with the web app.
 * Prefer this over importing constants/theme directly in components.
 */
export function useFhoTheme() {
  const { colors, theme, isDark, isReady, toggle, setTheme } = useThemeContext();
  return { colors, radii: Radii, spacing: Spacing, fonts: FontFamilies, theme, isDark, isReady, toggle, setTheme };
}
