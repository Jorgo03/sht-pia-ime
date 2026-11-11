// Headline font per language, for the phone app (constants/theme.ts Fonts).
// Pure, for `npm test`.
//
// Newsreader, the brand's headline serif, has no Cyrillic. In Russian every
// headline fell back to the phone's own system font, so iPhone and Samsung
// drew them differently (docs/TYPOGRAPHY_REPORT.md). Manrope, the brand's
// interface font, has Cyrillic and is already loaded, so Russian headlines
// use it: the same file on both phones and no new font. Everything else
// keeps Newsreader.

const NEWSREADER = {
  serif: 'Newsreader_500Medium',
  serifSemiBold: 'Newsreader_600SemiBold',
  serifItalic: 'Newsreader_500Medium_Italic',
}

// The same weight as the serif it replaces. It was one step heavier at first
// (600 for 500, 700 for 600), on the idea that a sans reads lighter at
// headline sizes, but "serif" also sets prices, names and card titles, so in
// Russian everything looked bolder (owner, 2026-11-12). Manrope has no
// italic, so the italic accent becomes upright.
const MANROPE = {
  serif: 'Manrope_500Medium',
  serifSemiBold: 'Manrope_600SemiBold',
  serifItalic: 'Manrope_500Medium',
}

/** True for a language written in a script Newsreader lacks. */
export function needsHeadlineFallback(language) {
  const base = String(language ?? '').toLowerCase().split(/[-_]/)[0]
  return base === 'ru'
}

/** The font file a headline role uses in this language. */
export function headlineFont(role, language) {
  return (needsHeadlineFallback(language) ? MANROPE : NEWSREADER)[role]
}

/** Every file headlineFont can return, for the font-loading check. */
export const HEADLINE_FONT_FILES = [...new Set([...Object.values(NEWSREADER), ...Object.values(MANROPE)])]
