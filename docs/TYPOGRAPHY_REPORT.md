# Same typography on iPhone and Samsung: report, 2026-11-08

## Decision

The request asked for Inter. The owner chose instead to **keep the brand
fonts**: Manrope for interface text, Newsreader for headlines, JetBrains
Mono for small labels. These are already the same files on both phones and
on the website, and the inconsistency came from text that used none of them
(below). No new font was installed; brand, colours, sizes and layouts are
unchanged.

## Why Samsung and iPhone looked different

1. **167 of the 348 text styles in the phone app named no font** (27
   files; the listing page alone had 25). React Native then uses each
   phone's system font: **Roboto on Samsung, San Francisco on iPhone**.
   Different letter shapes, widths and line breaks.
2. **A weight on top of a single-weight font file.** Expo loads each weight
   as its own file, so `fontWeight: '700'` on a 500-weight file is **faked
   bold on Android and ignored on iOS**. 90 of the styles in point 1 set a
   weight, and 28 headline and label styles set one on top of their font.
3. Nothing else leaks: all 22 stack screens and the tab layout hide the
   navigation library's header (the app draws its own), the tab bar is the
   app's own, and there is no `<Text>` without a style.

## What changed

| Change | Count |
|---|---|
| Text styles given the Manrope file for their weight (none/400 → `Fonts.sans`, 500 → `sansMedium`, 600 → `sansSemiBold`, 700 → `sansBold`); `fontWeight` removed | 164 by script + 3 by hand |
| Headline styles: a `fontWeight: '500'` on the 500 Newsreader file removed (no visible change) | 22 |
| A weight heavier than the loaded file replaced by the real heavier file: Newsreader 700 → `serifSemiBold` (600), JetBrains Mono 600/700 → `monoMedium` (500). Both phones now draw the same real weight instead of Android's fake bold | 6 |
| `fontWeight` left anywhere in the phone app | 0 |

How it is configured, unchanged in structure: the font names live in
`constants/theme.ts` (`Fonts`), the files load in `app/_layout.tsx`
(`useFonts`, behind the splash screen, so the system font never flashes
first; the medium, extra-bold and italic files follow right after first
paint), and each style names the file for its weight. The theme file's own
rule says this ("pick the matching weight constant rather than layering a
fontWeight override").

New guard: `tests/typography.test.mjs` (in `npm test`) fails if a
phone-app text style has a size but no font, if any style sets
`fontWeight`, or if a font name in `Fonts` is not loaded.

**Files:** 31 under `app/` and `components/` (styles only), plus
`tests/typography.test.mjs` and this report. Website-only `.web.tsx` files
and the Vite site were not touched: they use CSS fonts.

## Characters

Read from each font file's character table: **ë Ë ç Ç** and the German,
Italian, Spanish, French and Polish letters, €, £, curly quotes and dashes
are present in all 10 files.

Newsreader (headlines) has **no Cyrillic**, so Russian headlines used to
fall back to each phone's system font and differed between iPhone and
Samsung. Manrope and JetBrains Mono do have Cyrillic.

**Fixed (2026-11-08, owner: "Yes, fix it"), no new font:** in Russian,
headlines use the brand's Manrope (SemiBold for Newsreader Medium, Bold for
Newsreader SemiBold; the italic accent becomes upright, as Manrope has no
italic). Every other language keeps Newsreader.

- `src/lib/headlineFonts.js`: the rule (`headlineFont(role, language)`).
- `constants/theme.ts`: `Fonts.serif`, `serifSemiBold` and `serifItalic`
  are getters that ask it for the current language.
- `contexts/theme-context.tsx`: on a switch into or out of Russian, hands
  out a fresh copy of the same colour palette, so every screen (they
  rebuild their styles when `colors` changes) redraws its headlines at
  once, without a restart.
- `components/ui/error-boundary.tsx`: the crash screen builds its styles
  once at start-up, so its title takes the headline font when drawn.

Tests: unit `tests/headlineFonts.test.mjs` (3: Russian → Manrope, the other
seven → Newsreader, every file loaded, `ru` is the only locale needing it);
e2e-expo **X64**: on Home, switching to Русский through the app's menu
leaves no element drawn in Newsreader and none of Newsreader's text is
Cyrillic; switching back to Shqip brings Newsreader back; no reload
(browser rendering, phone and desktop widths). Full Expo-web e2e suite after
this change: **188 passed, 0 failed**, 36 skipped. Unit 446/446.

## Tests

| Test | Result |
|---|---|
| `tests/typography.test.mjs` | 3/3 |
| Unit `npm test` | 443/443 |
| `tsc --noEmit` | clean |
| ESLint `app/` `components/` | 0 errors (11 old `setState`-in-effect warnings) |
| Expo-web e2e (every screen, phone and desktop widths, axe) | 185 passed, 36 skipped, 1 failed: X35 on phone, a 200 ms timing check. Re-run alone 4× per viewport: **8/8 passed**, so it is timing under the full suite's load, not the fonts |
| **On a Samsung, an iPhone or an emulator** | **NOT TESTED**: no device or emulator here. Compare the same screens on both phones to confirm |

Not changed, by design: Android's extra font padding
(`includeFontPadding`) can still shift text by a pixel or two vertically
compared with iOS. Switching it off everywhere is a layout change on every
Android screen, so it is left for a device comparison first. Native system
dialogs (alerts, the date picker) always use the phone's own font.
