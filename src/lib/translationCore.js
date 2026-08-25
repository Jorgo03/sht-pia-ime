// src/lib/translationCore.js
//
// Pure logic behind automatic listing translation. No React, no Supabase, no
// platform imports — which is what lets the web app (src/), the Expo app
// (imported as `@/src/lib/translationCore`, the same cross-import
// src/features/properties/data/locations already uses) and the Node test
// runner all share one copy.
//
// Sharing rather than mirroring is deliberate here, and is the one place this
// repo's "two files with parallel APIs" convention (CLAUDE.md, lib/format.ts)
// would actively cause bugs: `sourceFingerprint` decides whether a stored
// translation is still current. Two implementations that drift by a single
// whitespace rule would make every listing translated on mobile look stale on
// web, silently re-billing an API call on every language tap.

/** Languages the marketplace ships. Order is the order the tabs render in. */
export const SUPPORTED_LANGS = ['sq', 'en', 'de', 'it', 'es', 'pl', 'ru', 'fr']

/**
 * Albanian is the canonical source: every other entry in title_i18n /
 * description_i18n is a translation OF this one, never of each other. That
 * rule is what keeps errors from compounding (sq->de, never sq->en->de) and
 * it matches the `source_language` column's default.
 */
export const SOURCE_LANG = 'sq'

/** Per-language state the form UI branches on. */
export const TranslationState = {
  /** This is the source language — nothing to translate. */
  SOURCE: 'source',
  /** No source text at all, so there is nothing to translate yet. */
  NO_SOURCE: 'no_source',
  /** Never translated, and no text present. */
  MISSING: 'missing',
  /** Translated from exactly the current Albanian text. */
  CURRENT: 'current',
  /** Translated, but the Albanian has changed since. */
  STALE: 'stale',
  /** A human wrote or edited this text — never auto-overwrite it. */
  MANUAL: 'manual',
}

/**
 * cyrb53 — a well-known non-cryptographic 53-bit string hash.
 *
 * Not crypto: this only answers "is this the same text as last time", so
 * collision resistance against an adversary is irrelevant, and the properties
 * that DO matter are that it is synchronous and dependency-free. Hermes has no
 * synchronous SubtleCrypto and expo-crypto's digest is async, so a real digest
 * would force this whole path to become asynchronous for no benefit.
 */
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

/**
 * Collapses differences that do not change meaning, so cosmetic edits do not
 * invalidate a perfectly good translation and re-bill an API call.
 *
 * Deliberately NOT collapsed: blank lines (up to one) and line breaks, because
 * the description is a formatted block — bullet lists and paragraphs are
 * content the translation is required to preserve (see the edge function's
 * prompt), so a change to them is a real change.
 */
export function normalizeForHash(value) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Fingerprint of the Albanian source, covering title AND description together.
 *
 * One hash for both fields, not one each, because they are translated in a
 * single request and read as one piece of copy — a title edit can change how
 * the description should be phrased. The cost is that editing only the title
 * also re-translates the description; that is the intended trade, since the
 * pair is what the model actually saw.
 *
 * Returns '' when there is no source text, which callers read as "nothing to
 * translate" rather than as a real fingerprint.
 */
export function sourceFingerprint(title, description) {
  const t = normalizeForHash(title)
  const d = normalizeForHash(description)
  if (!t && !d) return ''
  // Length-prefixed rather than joined by a separator character: any
  // separator we could pick is a character a real listing may contain, and
  // then ('a', 'b c') and ('a b', 'c') hash the same and a genuinely stale
  // translation looks current. Encoding the split point removes the class.
  return cyrb53(`${t.length}:${t}${d}`).toString(36)
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0
}

/** Reads one language's entry out of a translation_meta object, safely. */
export function metaFor(meta, lang) {
  const entry = meta && typeof meta === 'object' ? meta[lang] : null
  if (!entry || typeof entry !== 'object') return null
  return {
    sourceHash: typeof entry.sourceHash === 'string' ? entry.sourceHash : '',
    manual: entry.manual === true,
    updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : null,
  }
}

/**
 * Classifies one language, which is the single decision the whole feature
 * turns on: whether tapping that tab should fire a request.
 *
 * The subtle case is text-without-metadata. Listings created before this
 * feature — and anything the retired "Translate all" button filled in — have
 * entries in title_i18n with no matching metadata, so there is no way to tell
 * a machine translation from something an agent typed by hand. It is treated
 * as MANUAL: preserving a human's words costs one explicit Regenerate tap,
 * while guessing the other way silently destroys them.
 */
export function translationStateFor({ lang, title, description, meta, fingerprint }) {
  if (lang === SOURCE_LANG) return TranslationState.SOURCE
  if (!fingerprint) return TranslationState.NO_SOURCE

  const entry = metaFor(meta, lang)
  const present = hasText(title) || hasText(description)

  if (!entry) return present ? TranslationState.MANUAL : TranslationState.MISSING
  if (entry.manual) return TranslationState.MANUAL
  if (!present) return TranslationState.MISSING
  return entry.sourceHash === fingerprint ? TranslationState.CURRENT : TranslationState.STALE
}

/**
 * Whether selecting `lang` should fire a translation request.
 *
 * MANUAL and CURRENT both answer no — that is Phase 8's cache and Phase 10's
 * "never clobber a manual edit" in one place. `force` is the explicit
 * Regenerate action, which overrides both but still refuses to invent a
 * translation with no source to work from.
 */
export function shouldTranslate({ lang, title, description, meta, fingerprint, force = false }) {
  if (lang === SOURCE_LANG) return false
  if (!fingerprint) return false
  if (force) return true
  const state = translationStateFor({ lang, title, description, meta, fingerprint })
  return state === TranslationState.MISSING || state === TranslationState.STALE
}

/**
 * Merges one language's result into an i18n map without touching the others.
 *
 * Phase 17's requirement in code form: generating ES must never be able to
 * drop EN/DE/IT. Empty incoming values are skipped rather than written, so a
 * partial result (title translated, description was blank) cannot blank a
 * field that already had content.
 */
export function mergeTranslation(existing, lang, value) {
  const base = existing && typeof existing === 'object' ? existing : {}
  if (!hasText(value)) return base
  return { ...base, [lang]: value }
}

/** Records that `lang` was machine-generated from the given source. */
export function markGenerated(meta, lang, fingerprint, now = new Date()) {
  const base = meta && typeof meta === 'object' ? meta : {}
  return {
    ...base,
    [lang]: { sourceHash: fingerprint, manual: false, updatedAt: now.toISOString() },
  }
}

/**
 * Records that a human edited `lang`, pinning it against future regeneration.
 *
 * Editing the source language is not a "manual translation" — it changes the
 * fingerprint instead, which is what makes every other language stale.
 */
export function markManual(meta, lang, fingerprint, now = new Date()) {
  if (lang === SOURCE_LANG) return meta && typeof meta === 'object' ? meta : {}
  const base = meta && typeof meta === 'object' ? meta : {}
  return {
    ...base,
    [lang]: { sourceHash: fingerprint, manual: true, updatedAt: now.toISOString() },
  }
}

/**
 * Validates what came back from the edge function before it reaches an input.
 *
 * The trust boundary between model output and the form, same role
 * src/lib/aiSchemas.js plays for the other AI features. Returns null rather
 * than throwing so callers can fail safe and leave the existing text alone.
 */
export function sanitizeTranslationResponse(raw, { wantTitle, wantDescription }) {
  if (!raw || typeof raw !== 'object') return null

  const title = typeof raw.title === 'string' ? raw.title.trim() : ''
  const description = typeof raw.description === 'string' ? raw.description.trim() : ''

  // A field that was asked for and came back empty means the call did not
  // actually do its job; treating that as success would write a blank over
  // whatever the input already held.
  if (wantTitle && !title) return null
  if (wantDescription && !description) return null

  return {
    title: wantTitle ? title : '',
    description: wantDescription ? description : '',
  }
}
