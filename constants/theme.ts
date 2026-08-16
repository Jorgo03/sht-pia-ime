/**
 * Shtëpia.ime "Editorial Trust" design tokens — the React Native mirror of
 * the web app's `src/styles/theme.css` custom properties and
 * `design-system/MASTER.md`. Keep these two files' values in sync; this is
 * the single source of truth for color/radius/font tokens on mobile.
 */

export const FhoColors = {
  light: {
    bg: '#f1ede6',
    surface: '#faf6ef',
    surface2: '#ffffff',

    text: '#1a1714',
    textMuted: 'rgba(26,23,20,0.55)',
    textFaint: 'rgba(26,23,20,0.4)',
    textOnDark: '#faf6ef',
    textOnLight: '#1a1714',

    border: 'rgba(26,23,20,0.08)',
    borderStrong: 'rgba(26,23,20,0.16)',

    orange1: '#ff7d1a',
    orange2: '#e85d00',
    orangeDeep: '#cc5200',
    orangeTint: '#fff1e6',
    orangeSoft: '#ffb380',

    glassBg: 'rgba(28,24,20,0.62)',
    glassBorder: 'rgba(255,255,255,0.12)',

    inputBg: '#ffffff',
    inputBorder: 'rgba(26,23,20,0.16)',

    navy: '#0a2f63',
    ring: 'rgba(255,125,26,0.45)',

    statusActive: '#27ae60',
    statusPaused: '#f39c12',
    statusSold: '#c0392b',
    statusRented: '#8e44ad',
    statusDraft: '#7f8c8d',

    cardShadowOpacity: 0.2,
    cardShadowOpacityHover: 0.32,
  },
  dark: {
    bg: '#141210',
    surface: '#1e1b18',
    surface2: '#252220',

    text: '#f0ece6',
    textMuted: 'rgba(240,236,230,0.55)',
    textFaint: 'rgba(240,236,230,0.35)',
    textOnDark: '#faf6ef',
    textOnLight: '#1a1714',

    border: 'rgba(255,255,255,0.08)',
    borderStrong: 'rgba(255,255,255,0.14)',

    orange1: '#ff7d1a',
    orange2: '#e85d00',
    orangeDeep: '#cc5200',
    orangeTint: 'rgba(255,125,26,0.12)',
    orangeSoft: '#ffb380',

    glassBg: 'rgba(28,24,20,0.78)',
    glassBorder: 'rgba(255,255,255,0.10)',

    inputBg: '#252220',
    inputBorder: 'rgba(255,255,255,0.14)',

    navy: '#9db8e0',
    ring: 'rgba(255,125,26,0.45)',

    statusActive: '#2ecc71',
    statusPaused: '#f1c40f',
    statusSold: '#e74c3c',
    statusRented: '#9b59b6',
    statusDraft: '#95a5a6',

    cardShadowOpacity: 0.5,
    cardShadowOpacityHover: 0.65,
  },
} as const;

export type FhoThemeName = keyof typeof FhoColors;
export type FhoColorPalette = (typeof FhoColors)[FhoThemeName];

/** Mirrors theme.css's --r-* scale. */
export const Radii = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  xxl: 28,
  pill: 999,
} as const;

/** 4px base spacing scale used across web cards/sections. */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 28,
} as const;

/**
 * Legacy shape kept for React Navigation's theme plumbing and any
 * Colors.light/dark.* consumers — now backed by the fho tokens above
 * instead of the old Expo-template blue.
 */
export const Colors = {
  light: {
    text: FhoColors.light.text,
    background: FhoColors.light.bg,
    tint: FhoColors.light.orange1,
    icon: FhoColors.light.textMuted,
    tabIconDefault: FhoColors.light.textMuted,
    tabIconSelected: FhoColors.light.orange1,
  },
  dark: {
    text: FhoColors.dark.text,
    background: FhoColors.dark.bg,
    tint: FhoColors.dark.orange1,
    icon: FhoColors.dark.textMuted,
    tabIconDefault: FhoColors.dark.textMuted,
    tabIconSelected: FhoColors.dark.orange1,
  },
} as const;

/**
 * Font family names as registered by expo-font in app/_layout.tsx via
 * @expo-google-fonts/{newsreader,manrope,jetbrains-mono} — same three
 * families as theme.css (Newsreader serif / Manrope sans / JetBrains Mono).
 */
export const FontFamilies = {
  serif: 'Newsreader_500Medium',
  serifSemiBold: 'Newsreader_600SemiBold',
  serifItalic: 'Newsreader_500Medium_Italic',
  sans: 'Manrope_400Regular',
  sansMedium: 'Manrope_500Medium',
  sansSemiBold: 'Manrope_600SemiBold',
  sansBold: 'Manrope_700Bold',
  sansExtraBold: 'Manrope_800ExtraBold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
} as const;
