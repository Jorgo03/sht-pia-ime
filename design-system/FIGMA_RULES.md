# Figma → code rules (Shtëpia.ime)

How to turn a Figma design into code in this repo via the Figma MCP. It covers
what already exists, where it lives, and the rules a translated design must
follow. Visual identity (voice, type scale, motion) is in `MASTER.md`; this file
is the mapping. **The Expo app is the source of truth** (DECISIONS.md W1). The
Vite site in `src/` gets bug fixes only, so new screens from Figma are built in
the Expo app.

## 1. Tokens

| What | Expo app (source of truth) | Vite site (mirror) |
|---|---|---|
| Colours | `constants/theme.ts`: `AtticoColorsLight` / `AtticoColorsDark`, typed `AtticoPalette` | `src/styles/theme.css`: `--fho-*` CSS variables |
| Radii | `Radii` = `sm 8 · md 14 · lg 18 · xl 22 · pill 999` | `--r-*` |
| Spacing | `Spacing` = `xs 4 · sm 8 · md 14 · lg 22 · xl 28` | Tailwind spacing |
| Form controls | `Control` = height 54, side padding 16, gap 10, icon 18 | — |
| Shadows | `Shadows.card / cta / nav` | `--fho-card-shadow` |
| Motion | `Motion.fast 150 · med 280 · slow 420`, `easeOut`, `easeSpring`, `pressScaleCard .98`, `pressScaleButton .96` | `--t-*`, `--ease-*` |
| Type | `Fonts.sans*` (Manrope 400–800), `Fonts.serif` / `serifItalic` / `serifSemiBold` (Newsreader), `Fonts.mono` (JetBrains Mono) | `@import` in `theme.css` |

Plain TypeScript objects; no token pipeline (no Style Dictionary, no Figma
variables sync). When a token changes, update **both** files by hand while both
apps ship.

**Brand values:**
- accent `#ff6b00`, with the CTA gradient `accent → accentEnd #e85d00`;
- canvas `#f1ede6` (light) / `#0e0b09` (dark);
- orange *text* uses `accentText`: `#b34700` light, `#ff7d1a` dark, both
  contrast-checked.

Never put the raw button orange on text.

```tsx
// Always read colours from the theme, never hard-code hex in a screen.
const { colors } = useTheme();                     // contexts/theme-context
const styles = useMemo(() => createStyles(colors), [colors]);
const createStyles = (c: AtticoPalette) => StyleSheet.create({
  card: { backgroundColor: c.primaryLight, borderRadius: Radii.lg, borderColor: c.border, borderWidth: 1 },
  title: { fontFamily: Fonts.serif, fontSize: 30, color: c.textPrimary },
});
```

Mapping from a Figma variable to a token:
- Figma "Orange/500" → `colors.accent`;
- a Figma text colour in orange → `colors.accentText`;
- a Figma gradient button → `PrimaryCTA`.

Fonts are static per-weight files, so pick the matching `Fonts.*` constant
instead of adding `fontWeight`.

## 2. Components (`components/`)

- **`components/ui/`, reuse before building:**

  | Component | File | Notes |
  |---|---|---|
  | `PrimaryCTA` | `buttons.tsx` | gradient pill, `cta` shadow, trailing icon, loading |
  | `GhostBtn` | `buttons.tsx` | |
  | `ActionButton` | `action-button.tsx` | legacy; don't use in new work |
  | `Field` | `field.tsx` | input with icon, `Control` sizing |
  | `SelectField` | `select-field.tsx` | `variant="form"` matches `Field` |
  | `Chip`, `FilterTabs` | | |
  | `BottomSheet`, `SheetCloseButton` | | |
  | `OtpInput` | | |
  | `KeyboardDoneBar` | | the orange "U krye" bar; last child of a screen |
  | `AppHeader`, `ScreenHero`, `DuskHero`, `SearchHeader` | | |
  | `SkeletonCard` | | loading state |
  | `ErrorBoundary` | | |
  | `GradientBackground` | | |
  | `ThemeToggleButton` | | |
  | `GoogleLogo` | | official G mark for "Continue with Google" |
  | `motion.tsx` | | `usePressScale` |

- **Domain components:**
  - `components/property/` (cards, filter sheet, listing assistant);
  - `components/profile/`, `components/listing/`, `components/map/` (native
    `react-native-maps`; web Leaflet under `map/leaflet/`);
  - `components/safety/`, `components/legal/`, `components/web/`.
- **Architecture:** function components with `StyleSheet.create` inside a
  `createStyles(colors)` factory, memoised on `colors`. List items are wrapped in
  `React.memo`. There's no Storybook; the e2e suites (`e2e-expo/`) are the
  living reference.
- **Routes** are files under `app/` (expo-router). Web-only pages are
  `*.web.tsx` with a native file that redirects home.

## 3. Frameworks

- Expo SDK 58, React Native 0.88, React 19.3, expo-router 58 (typed routes),
  Metro bundler.
- `react-native-reanimated` 4 + `react-native-gesture-handler` 3 for motion.
- `expo-image` for every image. `expo-linear-gradient` for gradients;
  `expo-blur` for glass.
- Website: Vite 6 + React 19 + React Router 7 + Tailwind 4.

## 4. Assets

- **App identity** is in `assets/images/`:
  - `icon-light.png` / `icon-dark.png` / `icon-tinted.png` (iOS 18 variants,
    1024², no alpha);
  - `android-icon-{foreground,background,monochrome}.png`;
  - `favicon.png`;
  - `splash-door.png`, the splash mark.
- `app.json` wires them up:
  - `expo-splash-screen`: `imageWidth 200`, `contain`, background `#f1ede6`,
    dark `#0e0b09`;
  - `ios.icon` with light, dark and tinted variants.
- `scripts/make-store-icons.cjs` regenerates the store icons from `icon-light.png`.
- Remote images (listing photos, avatars) come from Supabase Storage.
  - Load them with `expo-image`, using `contentFit="cover"` and a placeholder.
  - Uploads are resized before upload in `lib/upload.ts`.
- No CDN beyond Supabase's storage URLs and Vercel's static hosting.

Exporting from Figma:
- app icons as 1024×1024 PNG without transparency;
- the Android adaptive foreground inside the 66% safe zone;
- the splash mark as a transparent PNG, roughly 600px wide (it's shown at 200pt).

## 5. Icons

- `@expo/vector-icons/MaterialIcons` (38 files) is the standard set; a few
  screens use `Ionicons` and `Feather`.
- Import per family and use the glyph names:
  `import MaterialIcons from '@expo/vector-icons/MaterialIcons'` →
  `<MaterialIcons name="payments" size={Control.iconSize} color={colors.textSecondary} />`.
- Brand marks that aren't in an icon font, such as Google, are components in
  `components/ui/`.
- **Map Figma icons to the nearest MaterialIcons glyph** rather than importing
  SVGs. Add an SVG component (with `react-native-svg`) only for brand or
  custom art.

## 6. Styling

- The app uses React Native `StyleSheet` with theme tokens. No CSS-in-JS
  library, no Tailwind in the app.
- **Light and dark themes are both required.** Every colour comes from
  `useTheme().colors`, and the theme is persisted.
- **Responsive:**
  - phone-first;
  - `hooks/use-responsive.ts` for tablet split views;
  - on the web the app is drawn in a 480px column (`constants/web-frame.ts`,
    `hooks/use-app-dimensions.ts`);
  - safe areas via `react-native-safe-area-context`.
- **Touch targets** are at least 44pt. Every data screen has loading
  (skeleton), error (retry) and empty states.
- **Text:**
  - every string goes through `t('…')`, from the shared
    `src/i18n/locales/*.json` (8 languages; add the key to all of them);
  - limit Dynamic Type growth with `maxFontSizeMultiplier` on dense controls.
- Website: Tailwind 4 utilities over `@layer components` legacy CSS (see
  CLAUDE.md). Bug fixes only.

## 7. Structure

```
app/            routes (expo-router); (tabs)/ index, explore, profile; listing/, property/, messages/ …
components/     ui/ (design system) + domain folders
constants/      theme.ts (tokens), web-frame.ts
contexts/       auth, favorites, filters, theme
hooks/          responsive, queries, app dimensions
lib/            supabase.ts, upload.ts, push.ts, format.ts …
src/            Vite website (features/<domain>/…) and shared pure logic + locale files
```

## Rules for a Figma-to-code translation

1. Reuse `components/ui/` first. Add a new UI component only when nothing
   fits, and put it in `components/ui/` with a `createStyles(colors)` factory.
2. Use tokens only, no raw hex or font weights, in both themes. Check that
   text contrast is at least 4.5:1.
3. Translate Figma spacing to `Spacing` and `Control`, and radii to `Radii`;
   round to the nearest token rather than adding one-off numbers.
4. All text goes through i18n, with keys in all 8 locale files.
5. New screens are built in the Expo app. Don't add new design to `src/`.
6. Verify the result in Expo Go (`npm start`) and with the e2e suites before
   calling it done.
