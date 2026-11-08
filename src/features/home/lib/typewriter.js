// The Home headline's typewriter: language-independent rules, no text and no
// layout. Pure, for `npm test`; the phone app imports it through typewriter.d.ts.

// Marks that belong to the character before them: combining accents, Arabic
// harakat, Cyrillic titlo marks, variation selectors, skin tones and so on.
const EXTEND_RANGES = [
  [0x0300, 0x036f], [0x0483, 0x0489], [0x0591, 0x05bd], [0x05bf, 0x05bf], [0x05c1, 0x05c2],
  [0x05c4, 0x05c5], [0x05c7, 0x05c7], [0x0610, 0x061a], [0x064b, 0x065f], [0x0670, 0x0670],
  [0x06d6, 0x06dc], [0x06df, 0x06e4], [0x06e7, 0x06e8], [0x06ea, 0x06ed], [0x0e31, 0x0e31],
  [0x0e34, 0x0e3a], [0x0e47, 0x0e4e], [0x1ab0, 0x1aff], [0x1dc0, 0x1dff], [0x200c, 0x200c],
  [0x20d0, 0x20ff], [0xfe00, 0xfe0f], [0xfe20, 0xfe2f], [0x1f3fb, 0x1f3ff], [0xe0020, 0xe007f],
  [0xe0100, 0xe01ef],
]
const ZWJ = 0x200d
const isExtend = (cp) => EXTEND_RANGES.some(([from, to]) => cp >= from && cp <= to)
const isRegional = (cp) => cp >= 0x1f1e6 && cp <= 0x1f1ff

/**
 * The fallback for runtimes without Intl.Segmenter, which includes Hermes, the
 * engine the phone apps run on. Walks code points, never UTF-16 units, so a
 * surrogate pair cannot be split.
 */
export function segmentByRules(text) {
  const out = []
  let afterZwj = false
  let regionals = 0
  for (const ch of String(text ?? '')) {
    const cp = ch.codePointAt(0)
    const attach = out.length > 0 && (isExtend(cp) || cp === ZWJ || afterZwj || (isRegional(cp) && regionals % 2 === 1))
    if (attach) out[out.length - 1] += ch
    else out.push(ch)
    afterZwj = cp === ZWJ
    regionals = isRegional(cp) ? regionals + 1 : 0
  }
  return out
}

let segmenter
/** Whole user-visible characters, never a split accent or letter. */
export function segmentGraphemes(text) {
  const value = String(text ?? '')
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    segmenter ??= new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    return Array.from(segmenter.segment(value), (s) => s.segment)
  }
  return segmentByRules(value)
}

/**
 * Phrases from the translation files, as `{ lead, accent }`. Bad entries are
 * dropped, so a missing translation can only shorten the loop.
 */
export function preparePhrases(phrases) {
  if (!Array.isArray(phrases)) return []
  return phrases
    .map((p) => ({ lead: String(p?.lead ?? '').trim(), accent: String(p?.accent ?? '').trim() }))
    .filter((p) => p.lead || p.accent)
    .map((p) => {
      const lead = p.lead && p.accent ? `${p.lead} ` : p.lead
      const leadGraphemes = segmentGraphemes(lead)
      const graphemes = [...leadGraphemes, ...segmentGraphemes(p.accent)]
      return { lead: p.lead, accent: p.accent, full: lead + p.accent, graphemes, leadLength: leadGraphemes.length }
    })
}

/** What is on screen for a phrase with `count` characters typed. */
export function visibleParts(phrase, count) {
  const n = Math.max(0, Math.min(count, phrase.graphemes.length))
  return {
    lead: phrase.graphemes.slice(0, Math.min(n, phrase.leadLength)).join(''),
    accent: phrase.graphemes.slice(phrase.leadLength, Math.max(n, phrase.leadLength)).join(''),
  }
}

/** The next step. Empties completely before the next phrase, so nothing jumps. */
export function advance(state, phrases) {
  const phrase = phrases[state.index]
  switch (state.phase) {
    case 'typing':
      return state.count + 1 >= phrase.graphemes.length
        ? { ...state, count: phrase.graphemes.length, phase: 'pause' }
        : { ...state, count: state.count + 1 }
    case 'pause':
      return { ...state, phase: 'deleting' }
    case 'deleting':
      return state.count <= 1 ? { ...state, count: 0, phase: 'gap' } : { ...state, count: state.count - 1 }
    default:
      return { index: (state.index + 1) % phrases.length, count: 0, phase: 'typing' }
  }
}

// Sentence punctuation in the scripts in use, including Arabic ، ؛ ؟.
const PAUSES_AFTER = /[.,;:!?…،؛؟。、]$/u

/**
 * How long before the next step, in ms. Slightly uneven on purpose, with a
 * short breath after a word and a longer one after punctuation. `random` is
 * 0..1, passed in so a test can pin it.
 */
export function stepDelay(state, phrases, random) {
  switch (state.phase) {
    case 'typing': {
      const last = state.count > 0 ? phrases[state.index].graphemes[state.count - 1] : ''
      const base = 46 + random * 44
      if (PAUSES_AFTER.test(last)) return base + 190
      if (/^\s$/u.test(last)) return base + 45
      return base
    }
    case 'pause':
      return 2300 + random * 700
    case 'deleting':
      return 24 + random * 18
    default:
      return 320 + random * 160
  }
}

const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur'])
/** Whether a language is written right to left. */
export function isRtlLanguage(language) {
  return RTL_LANGUAGES.has(String(language ?? '').toLowerCase().split(/[-_]/)[0])
}
