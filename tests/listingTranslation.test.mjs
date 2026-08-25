// Unit tests for the automatic listing-translation decision logic — the part
// that decides whether tapping a language costs an API call, whether a stored
// translation is still valid, and whether a human's words are protected.
//
// Everything here is shared by the web wizard and the Expo wizard (both import
// src/lib/translationCore.js), so a regression in any of it would show up on
// both platforms at once. Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SOURCE_LANG,
  TranslationState,
  markGenerated,
  markManual,
  mergeTranslation,
  normalizeForHash,
  sanitizeTranslationResponse,
  shouldTranslate,
  sourceFingerprint,
  translationStateFor,
} from '../src/lib/translationCore.js'

const SQ_TITLE = 'Apartament 2+1 modern në Bllok'
const SQ_DESC = 'Apartament modern me 2 dhoma gjumi, sallon dhe kuzhinë.'

// ---------- sourceFingerprint ----------

test('the same source always fingerprints the same', () => {
  assert.equal(sourceFingerprint(SQ_TITLE, SQ_DESC), sourceFingerprint(SQ_TITLE, SQ_DESC))
})

test('cosmetic whitespace does not invalidate a good translation', () => {
  // Re-billing seven languages because the agent hit space twice would be a
  // real cost, and nothing about the meaning changed.
  assert.equal(
    sourceFingerprint('  Apartament  2+1   modern ', SQ_DESC),
    sourceFingerprint('Apartament 2+1 modern', SQ_DESC),
  )
})

test('a real edit to either field changes the fingerprint', () => {
  const base = sourceFingerprint(SQ_TITLE, SQ_DESC)
  assert.notEqual(sourceFingerprint(SQ_TITLE + ' me ballkon', SQ_DESC), base)
  assert.notEqual(sourceFingerprint(SQ_TITLE, SQ_DESC + ' Ka ashensor.'), base)
})

test('the title/description split cannot be blurred into a collision', () => {
  // Joining the two fields with a separator character would make these two
  // different listings hash identically, and a genuinely stale translation
  // would then read as current. Length-prefixing is what rules it out.
  assert.notEqual(sourceFingerprint('a', 'b c'), sourceFingerprint('a b', 'c'))
  assert.notEqual(sourceFingerprint('ab', ''), sourceFingerprint('a', 'b'))
})

test('no source text yields no fingerprint, which is how "do not call" is expressed', () => {
  assert.equal(sourceFingerprint('', ''), '')
  assert.equal(sourceFingerprint('   ', '\n\n'), '')
  assert.notEqual(sourceFingerprint('', SQ_DESC), '')
  assert.notEqual(sourceFingerprint(SQ_TITLE, ''), '')
})

test('paragraph and bullet structure is part of the source, not noise', () => {
  // The prompt requires bullets to survive translation, so a change to them is
  // a real content change that must invalidate the translation.
  assert.notEqual(
    sourceFingerprint('t', '• Ballkon\n• Ashensor'),
    sourceFingerprint('t', '• Ballkon • Ashensor'),
  )
  // ...but CRLF vs LF is a platform artefact, not an edit.
  assert.equal(normalizeForHash('a\r\nb'), normalizeForHash('a\nb'))
})

// ---------- shouldTranslate: the cache, staleness and manual rules ----------

const fp = sourceFingerprint(SQ_TITLE, SQ_DESC)

test('Albanian is never sent for translation', () => {
  assert.equal(
    shouldTranslate({ lang: SOURCE_LANG, title: SQ_TITLE, meta: {}, fingerprint: fp }),
    false,
  )
})

test('a language with no translation yet is translated on selection', () => {
  assert.equal(shouldTranslate({ lang: 'en', meta: {}, fingerprint: fp }), true)
})

test('a cached translation is reused — selecting it again costs nothing', () => {
  const meta = markGenerated({}, 'en', fp)
  assert.equal(
    shouldTranslate({ lang: 'en', title: 'Modern 2+1 Apartment in Bllok', meta, fingerprint: fp }),
    false,
  )
})

test('editing the Albanian makes an existing translation stale and it regenerates', () => {
  const meta = markGenerated({}, 'en', fp)
  const newFp = sourceFingerprint(SQ_TITLE + ' me ballkon', SQ_DESC)
  assert.equal(
    shouldTranslate({ lang: 'en', title: 'Modern 2+1 Apartment in Bllok', meta, fingerprint: newFp }),
    true,
  )
})

test('a manually edited translation is never silently overwritten', () => {
  const meta = markManual(markGenerated({}, 'en', fp), 'en', fp)
  // Even once the Albanian moves on, the agent's own wording stands.
  const newFp = sourceFingerprint(SQ_TITLE + ' me ballkon', SQ_DESC)
  assert.equal(
    shouldTranslate({ lang: 'en', title: 'Modern 2+1 Apartment for Sale in Bllok', meta, fingerprint: fp }),
    false,
  )
  assert.equal(
    shouldTranslate({ lang: 'en', title: 'Modern 2+1 Apartment for Sale in Bllok', meta, fingerprint: newFp }),
    false,
  )
})

test('an explicit regenerate overrides both the cache and the manual pin', () => {
  const cached = markGenerated({}, 'en', fp)
  const manual = markManual({}, 'en', fp)
  assert.equal(shouldTranslate({ lang: 'en', title: 'x', meta: cached, fingerprint: fp, force: true }), true)
  assert.equal(shouldTranslate({ lang: 'en', title: 'x', meta: manual, fingerprint: fp, force: true }), true)
})

test('with no Albanian text nothing is ever requested, not even on regenerate', () => {
  assert.equal(shouldTranslate({ lang: 'en', meta: {}, fingerprint: '' }), false)
  assert.equal(shouldTranslate({ lang: 'en', meta: {}, fingerprint: '', force: true }), false)
})

// ---------- translationStateFor ----------

test('text with no metadata is treated as human-written, not as regenerable output', () => {
  // Listings that predate this feature, and anything the retired "translate
  // all" button filled in, have translations but no provenance. Guessing
  // "machine" would silently destroy an agent's own wording; guessing "human"
  // costs one explicit Regenerate tap. Only one of those is recoverable.
  const state = translationStateFor({
    lang: 'en',
    title: 'Something an agent typed',
    meta: {},
    fingerprint: fp,
  })
  assert.equal(state, TranslationState.MANUAL)
  assert.equal(
    shouldTranslate({ lang: 'en', title: 'Something an agent typed', meta: {}, fingerprint: fp }),
    false,
  )
})

test('an empty language with no metadata is simply missing', () => {
  assert.equal(
    translationStateFor({ lang: 'en', title: '', description: '', meta: {}, fingerprint: fp }),
    TranslationState.MISSING,
  )
})

test('each state is reported distinctly so the UI can label it', () => {
  assert.equal(
    translationStateFor({ lang: SOURCE_LANG, meta: {}, fingerprint: fp }),
    TranslationState.SOURCE,
  )
  assert.equal(
    translationStateFor({ lang: 'en', meta: {}, fingerprint: '' }),
    TranslationState.NO_SOURCE,
  )
  assert.equal(
    translationStateFor({ lang: 'en', title: 'x', meta: markGenerated({}, 'en', fp), fingerprint: fp }),
    TranslationState.CURRENT,
  )
  assert.equal(
    translationStateFor({ lang: 'en', title: 'x', meta: markGenerated({}, 'en', 'OLD'), fingerprint: fp }),
    TranslationState.STALE,
  )
})

test('editing the source language does not mark it as a manual translation', () => {
  // sq is the source; editing it moves the fingerprint instead, which is what
  // makes the other languages stale. Pinning it would be meaningless.
  assert.deepEqual(markManual({}, SOURCE_LANG, fp), {})
})

// ---------- mergeTranslation: never lose another language ----------

test('generating one language leaves every other one intact', () => {
  const existing = { sq: SQ_TITLE, en: 'English', de: 'German', it: 'Italian' }
  const merged = mergeTranslation(existing, 'es', 'Spanish')
  assert.deepEqual(merged, {
    sq: SQ_TITLE,
    en: 'English',
    de: 'German',
    it: 'Italian',
    es: 'Spanish',
  })
})

test('an empty result cannot blank a field that already had content', () => {
  const existing = { sq: SQ_TITLE, en: 'English' }
  // Happens when the source description was empty: the title comes back
  // translated and the description comes back "". That must not wipe EN.
  assert.deepEqual(mergeTranslation(existing, 'en', ''), existing)
  assert.deepEqual(mergeTranslation(existing, 'en', '   '), existing)
  assert.deepEqual(mergeTranslation(existing, 'en', null), existing)
})

test('merging never mutates the object it was given', () => {
  const existing = { sq: SQ_TITLE }
  const merged = mergeTranslation(existing, 'en', 'English')
  assert.deepEqual(existing, { sq: SQ_TITLE })
  assert.notEqual(merged, existing)
})

test('metadata for other languages survives recording a new one', () => {
  const meta = markGenerated(markGenerated({}, 'en', fp), 'de', fp)
  const next = markGenerated(meta, 'es', fp)
  assert.deepEqual(Object.keys(next).sort(), ['de', 'en', 'es'])
  assert.equal(next.en.sourceHash, fp)
})

// ---------- sanitizeTranslationResponse: the model-output trust boundary ----------

test('a well-formed response passes through', () => {
  const out = sanitizeTranslationResponse(
    { title: '  Modern 2+1 Apartment in Bllok  ', description: 'Modern apartment...' },
    { wantTitle: true, wantDescription: true },
  )
  assert.deepEqual(out, {
    title: 'Modern 2+1 Apartment in Bllok',
    description: 'Modern apartment...',
  })
})

test('a field that was asked for and came back empty fails safe', () => {
  // Returning "" here would write a blank over the input the agent is looking
  // at. Null lets the caller keep what is already on screen.
  assert.equal(
    sanitizeTranslationResponse({ title: '', description: 'x' }, { wantTitle: true, wantDescription: true }),
    null,
  )
  assert.equal(
    sanitizeTranslationResponse({ title: 'x' }, { wantTitle: true, wantDescription: true }),
    null,
  )
})

test('a field that was not asked for is allowed to be empty', () => {
  // Title-only and description-only listings are both legitimate.
  assert.deepEqual(
    sanitizeTranslationResponse({ title: 'Only a title', description: '' }, { wantTitle: true, wantDescription: false }),
    { title: 'Only a title', description: '' },
  )
  assert.deepEqual(
    sanitizeTranslationResponse({ title: '', description: 'Only a description' }, { wantTitle: false, wantDescription: true }),
    { title: '', description: 'Only a description' },
  )
})

test('junk in place of a response is rejected rather than rendered', () => {
  for (const junk of [null, undefined, 'a string', 42, [], { title: 123, description: {} }]) {
    assert.equal(
      sanitizeTranslationResponse(junk, { wantTitle: true, wantDescription: true }),
      null,
      `expected null for ${JSON.stringify(junk)}`,
    )
  }
})

// ---------- Scenario walks ----------
//
// The rules above are correct individually; these exercise them in the order a
// real agent hits them, which is where rule interactions actually break.

test('journey: write Albanian, translate EN, switch away, come back — no second call', () => {
  let titles = { sq: SQ_TITLE }
  let descs = { sq: SQ_DESC }
  let meta = {}
  const calls = []
  const fingerprint = () => sourceFingerprint(titles.sq, descs.sq)

  const select = (lang) => {
    const f = fingerprint()
    if (!shouldTranslate({ lang, title: titles[lang], description: descs[lang], meta, fingerprint: f })) return
    calls.push(lang)
    titles = mergeTranslation(titles, lang, `${lang.toUpperCase()} title`)
    descs = mergeTranslation(descs, lang, `${lang.toUpperCase()} desc`)
    meta = markGenerated(meta, lang, f)
  }

  select('en')
  select('de')
  select('en') // cached
  select('sq') // source
  select('en') // still cached
  assert.deepEqual(calls, ['en', 'de'], 'EN must be translated exactly once')
  assert.equal(titles.en, 'EN title')
  assert.equal(titles.de, 'DE title')
  assert.equal(titles.sq, SQ_TITLE, 'the Albanian source is never overwritten')
})

test('journey: hand-edit EN, leave, return — the edit survives, and other languages are untouched', () => {
  let titles = { sq: SQ_TITLE, en: 'EN title', de: 'DE title' }
  let meta = markGenerated(markGenerated({}, 'en', fp), 'de', fp)

  // Agent corrects the English by hand.
  const edited = 'Modern 2+1 Apartment for Sale in Bllok'
  titles = mergeTranslation(titles, 'en', edited)
  meta = markManual(meta, 'en', fp)

  // Returning to EN must not regenerate over it.
  assert.equal(
    shouldTranslate({ lang: 'en', title: titles.en, meta, fingerprint: fp }),
    false,
  )
  assert.equal(titles.en, edited)
  // German is unaffected by the English edit.
  assert.equal(titles.de, 'DE title')
  assert.equal(meta.de.manual, false)
})

test('journey: edit the Albanian — machine languages go stale, hand-edited ones hold', () => {
  const meta = markManual(markGenerated(markGenerated({}, 'en', fp), 'de', fp), 'en', fp)
  const newFp = sourceFingerprint(SQ_TITLE + ' me ballkon', SQ_DESC)

  // DE was machine output -> regenerate from the new Albanian.
  assert.equal(shouldTranslate({ lang: 'de', title: 'DE title', meta, fingerprint: newFp }), true)
  assert.equal(
    translationStateFor({ lang: 'de', title: 'DE title', meta, fingerprint: newFp }),
    TranslationState.STALE,
  )
  // EN was hand-edited -> the agent's wording stands until they ask.
  assert.equal(shouldTranslate({ lang: 'en', title: 'edited', meta, fingerprint: newFp }), false)
  assert.equal(shouldTranslate({ lang: 'en', title: 'edited', meta, fingerprint: newFp, force: true }), true)
})

test('journey: a failed translation leaves every existing field exactly as it was', () => {
  const titles = { sq: SQ_TITLE, en: 'EN title' }
  const meta = markGenerated({}, 'en', fp)
  // A failure produces no sanitized payload at all, so nothing is merged.
  const bad = sanitizeTranslationResponse({ title: '', description: '' }, { wantTitle: true, wantDescription: true })
  assert.equal(bad, null)
  const after = bad ? mergeTranslation(titles, 'de', bad.title) : titles
  assert.deepEqual(after, { sq: SQ_TITLE, en: 'EN title' })
  assert.equal(meta.en.sourceHash, fp, 'metadata is untouched by a failure')
})

test('journey: title-only and description-only listings each translate the field they have', () => {
  // Title present, description empty.
  assert.notEqual(sourceFingerprint(SQ_TITLE, ''), '')
  assert.equal(shouldTranslate({ lang: 'en', meta: {}, fingerprint: sourceFingerprint(SQ_TITLE, '') }), true)
  // Description present, title empty.
  assert.notEqual(sourceFingerprint('', SQ_DESC), '')
  assert.equal(shouldTranslate({ lang: 'en', meta: {}, fingerprint: sourceFingerprint('', SQ_DESC) }), true)
  // Neither -> never.
  assert.equal(shouldTranslate({ lang: 'en', meta: {}, fingerprint: sourceFingerprint('', '') }), false)
})

// ---------- Error classification ----------
//
// Regression guard for a real incident: ANTHROPIC_API_KEY was rejected by the
// upstream API (401 invalid x-api-key) on every single request, and the UI
// reported it as the generic "unavailable, try again later". That advice could
// never work — the key was invalid the whole time — and diagnosing it required
// reading the edge function's stderr. A rejected key must be distinguishable
// from a transient outage at the point where the UI picks its message.
//
// classify() itself lives in the two platform clients (they each need their own
// Supabase singleton), so this tests the shared contract they both implement:
// the edge function's 503 body carries `upstream_status`, and 401/403 there
// means "server misconfigured", not "retry".

/** Mirrors the classify() branch order in lib/translate.ts + src/lib/translate.js. */
function classifyBody(body) {
  const code = typeof body?.error === 'string' ? body.error : ''
  if (code === 'rate_limited') return 'rate_limited'
  if (code === 'unauthorized') return 'unauthorized'
  if (code === 'empty_content') return 'empty_content'
  if (code.startsWith('unsupported_') || code === 'target_equals_source') return 'invalid_response'
  const upstream = body?.upstream_status
  if (upstream === 401 || upstream === 403) return 'not_configured'
  return 'unavailable'
}

test('a rejected upstream API key is not reported as a transient outage', () => {
  // Exactly what translate-property returned during the incident.
  assert.equal(
    classifyBody({ error: 'ai_unavailable', upstream_status: 401, stop_reason: null }),
    'not_configured',
  )
  assert.equal(classifyBody({ error: 'ai_unavailable', upstream_status: 403 }), 'not_configured')
})

test('a genuine upstream outage still reads as retryable', () => {
  assert.equal(classifyBody({ error: 'ai_unavailable', upstream_status: 500 }), 'unavailable')
  assert.equal(classifyBody({ error: 'ai_unavailable', upstream_status: 529 }), 'unavailable')
  assert.equal(classifyBody({ error: 'ai_unavailable' }), 'unavailable')
})

test('quota, auth and bad-input failures keep their own distinct codes', () => {
  // upstream_status must never override a more specific error code.
  assert.equal(classifyBody({ error: 'rate_limited' }), 'rate_limited')
  assert.equal(classifyBody({ error: 'unauthorized' }), 'unauthorized')
  assert.equal(classifyBody({ error: 'empty_content' }), 'empty_content')
  assert.equal(classifyBody({ error: 'unsupported_target_language' }), 'invalid_response')
  assert.equal(classifyBody({ error: 'target_equals_source' }), 'invalid_response')
})
