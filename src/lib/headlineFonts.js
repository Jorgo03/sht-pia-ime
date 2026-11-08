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

// One step heavier than the serif it replaces: a sans at the same weight
// reads lighter at headline sizes. Manrope has no italic, so the italic
// accent becomes upright.
const MANROPE = {
  serif: 'Manrope_600SemiBold',
  serifSemiBold: 'Manrope_700Bold',
  serifItalic: 'Manrope_600SemiBold',
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
