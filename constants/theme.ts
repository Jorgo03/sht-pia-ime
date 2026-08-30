/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export type AtticoPalette = typeof AtticoColorsDark;

// Aligned to src/styles/theme.css's [data-theme="dark"] --fho-* tokens — the
// web app's canonical dark palette (see CLAUDE.md: accent #ff7d1a) — so both
// apps render the same brand colors, not a native-only approximation of them.
export const AtticoColorsDark = {
  primary: '#0e0b09', // --fho-bg (dark)
  primaryLight: '#1a1612', // --fho-surface (dark)
  accent: '#ff6b00', // ShtepiaColors.orange (design handoff §4)
  accentEnd: '#e85d00', // --fho-orange-2 — the gradient's end stop + accent text
  accentDeep: '#cc5200', // --fho-orange-deep
  accentTint: 'rgba(255,107,0,0.12)', // dark-theme form of ShtepiaColors.orangeTint
  accentLight: '#ffb380', // --fho-orange-soft
  accentGlow: 'rgba(255,107,0,0.35)',
  surface: '#FFFFFF',
  surface2: '#221d18', // --fho-surface-2 (dark) — inputs / deepest cards
  surfaceAlt: '#F5F5F5',
  // ShtepiaColors.glassBg/glassBorder/cream100 (§4) — the auth hero's
  // translucent form card, which is dark-on-dark in both themes.
  glassBg: 'rgba(28,24,20,0.62)',
  glassOnDarkBorder: 'rgba(255,255,255,0.12)',
  cream100: '#faf6ef',
  glass: 'rgba(255,255,255,0.06)',
  glassBorder: 'rgba(255,255,255,0.08)', // matches --fho-glass-border (dark) exactly — for actual translucent/blurred surfaces only (e.g. liquid-tab-bar's BlurView), NOT a general-purpose border color
  border: 'rgba(255,255,255,0.08)', // --fho-border (dark) — the general card/chip/input border
  borderStrong: 'rgba(255,255,255,0.18)', // --fho-border-strong (dark)
  textPrimary: '#faf6ef', // --fho-text (dark)
  // --fho-text-muted / --fho-text-faint (dark) flattened from rgba to solid
  // native colors. Both are now a WARM cast — rgba(255,235,210,·) rather than
  // the old neutral rgba(240,236,230,·) — composited over the new #0e0b09
  // ground, so they track the web dusk palette instead of the charcoal one.
  textSecondary: '#938678',
  textFaint: '#6e6559',
  textDark: '#1A1A1A',
  // Listing/viewing status colors. Web reads these from --fho-status-* which
  // swap per theme; RN screens used to hardcode the LIGHT values in both
  // themes, so status pills rendered wrong in dark mode.
  statusActive: '#2ecc71',
  statusPaused: '#f1c40f',
  statusSold: '#e74c3c',
  statusRented: '#9b59b6',
  statusDraft: '#95a5a6',
  // ShtepiaColors.danger / .ok (§4).
  error: '#d63a3a',
  ok: '#5b8a5a',
  gradientStart: '#0A0A0A',
  gradientEnd: '#141414',
};

// web's :root/[data-theme="light"] --fho-* tokens, same flattening approach
// as the dark palette above (rgba-over-background composited to a solid hex
// since RN styles are static values, not living over a CSS custom property).
export const AtticoColorsLight: AtticoPalette = {
  primary: '#f1ede6', // --fho-bg (light)
  primaryLight: '#faf6ef', // --fho-surface (light)
  accent: '#ff6b00', // ShtepiaColors.orange (design handoff §4) (same both themes)
  accentEnd: '#e85d00', // --fho-orange-2 (same both themes)
  accentDeep: '#cc5200', // --fho-orange-deep (same both themes)
  accentTint: '#fff1e6', // ShtepiaColors.orangeTint (§4) — a solid cream, not the dark theme's translucent orange
  accentLight: '#ffb380', // --fho-orange-soft (same both themes)
  accentGlow: 'rgba(255,107,0,0.25)',
  surface: '#FFFFFF',
  surface2: '#ffffff', // --fho-surface-2 (light)
  surfaceAlt: '#F5F5F5',
  // Same in both themes — the auth glass card sits on the dark dusk hero
  // regardless of the active theme, so these don't flip.
  glassBg: 'rgba(28,24,20,0.62)',
  glassOnDarkBorder: 'rgba(255,255,255,0.12)',
  cream100: '#faf6ef',
  glass: 'rgba(26,23,20,0.04)',
  // NOT --fho-glass-border (that's rgba(255,255,255,0.12) in light mode — a
  // white-based color meant for a dark translucent surface like the auth
  // glass card, not for chip/card borders on a light cream background).
  // Kept only for whatever few surfaces are genuinely translucent/blurred.
  glassBorder: 'rgba(26,23,20,0.10)',
  border: 'rgba(26,23,20,0.08)', // --fho-border (light) — the general card/chip/input border
  borderStrong: 'rgba(26,23,20,0.16)', // --fho-border-strong (light)
  textPrimary: '#1a1714', // --fho-text (light)
  textSecondary: '#7b7773', // --fho-text-muted (light) flattened
  textFaint: '#96928d', // --fho-text-faint (light) flattened
  textDark: '#1A1A1A',
  // --fho-status-* (light) — see the dark palette's note above. Now the earthy
  // set from IMPLEMENTATION.md §1, muted to sit with the warm cream ground
  // rather than the saturated web-safe values these replace.
  statusActive: '#5b8a5a',
  statusPaused: '#d4a23a',
  statusSold: '#c0392b',
  statusRented: '#8a4d80',
  ok: '#5b8a5a', // ShtepiaColors.ok (§4)
  statusDraft: '#7f7a72',
  error: '#d63a3a', // ShtepiaColors.danger (§4)
  gradientStart: '#faf6ef',
  gradientEnd: '#f1ede6',
};

/**
 * @deprecated Static dark-only export, kept for any call site not yet
 * converted to the reactive useAtticoColors() hook (contexts/theme-context)
 * — never remove until every screen reads colors through the hook instead.
 */
export const AtticoColors = AtticoColorsDark;

/**
 * Corner radii — ShtepiaRadii from the design handoff §4. Note `sm` is 8 here,
 * not web's `--r-sm: 10px`: the handoff's scale is the authority for the app.
 * `2xl` has no counterpart in the handoff and is kept for the sheet radius
 * that already used it.
 */
export const Radii = {
  sm: 8,
  md: 14,
  lg: 18,
  xl: 22,
  '2xl': 28,
  pill: 999,
} as const;

/**
 * Spacing — ShtepiaSpacing from §4. Coarser than the values web's stylesheets
 * happen to repeat (12/16/20/24), so prefer these for new work rather than
 * mixing the two rhythms.
 */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 22,
  xl: 28,
} as const;

/**
 * Shadows — ShtepiaShadows from §4, used verbatim (these are already written
 * as RN shadow props in the handoff, not CSS, so no translation needed).
 */
export const Shadows = {
  card: {
    shadowColor: '#281400',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 18 },
    elevation: 4,
  },
  cta: {
    shadowColor: '#ff6b00',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  nav: {
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 16 },
    elevation: 8,
  },
} as const;

/**
 * Motion. Web's easing is cubic-bezier(.2,.7,.3,1) everywhere (--ease-out);
 * RN's Easing.bezier takes the same four control points, so the curve is
 * identical rather than an approximation.
 */
export const Motion = {
  fast: 150, // --t-fast
  med: 280, // --t-med
  slow: 420, // --t-slow
  easeOut: [0.2, 0.7, 0.3, 1] as const, // --ease-out
  easeSpring: [0.34, 1.3, 0.5, 1] as const, // --ease-spring (overshoots past 1)
  /** polish.css's press-feedback scales: cards compress slightly less than
   *  buttons (:active { transform: scale(...) }). */
  pressScaleCard: 0.98,
  pressScaleButton: 0.96,
} as const;

// The web app's actual type pairing (CLAUDE_CODE_BRIEF.md §1.1): Newsreader
// for headlines, Manrope for UI, JetBrains Mono for labels/kickers — loaded
// as real font files via app/_layout.tsx's useFonts() call (which also
// gates first paint on them finishing), not approximated with a platform
// system-font stand-in. `rounded` has no equivalent in that pairing and
// stays a platform design, used only where iOS's rounded system font was
// already in use before this pass.
export const Fonts = {
  sans: 'Manrope_400Regular',
  sansMedium: 'Manrope_500Medium',
  sansSemiBold: 'Manrope_600SemiBold',
  sansBold: 'Manrope_700Bold',
  sansExtraBold: 'Manrope_800ExtraBold',
  serif: 'Newsreader_500Medium',
  /** True italic glyphs — pair with this instead of `fontStyle: 'italic'`
   *  on `serif`, which only synthesizes a slant on the upright font. */
  serifItalic: 'Newsreader_500Medium_Italic',
  /** Brand wordmark weight (CLAUDE_CODE_BRIEF.md §3.7: serif/600). */
  serifSemiBold: 'Newsreader_600SemiBold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  rounded: Platform.select({
    ios: 'ui-rounded',
    web: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    default: 'normal',
  }),
};
