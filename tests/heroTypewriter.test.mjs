import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  advance,
  isRtlLanguage,
  preparePhrases,
  segmentByRules,
  segmentGraphemes,
  stepDelay,
  visibleParts,
} from '../src/features/home/lib/typewriter.js'

const read = (f) => JSON.parse(fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'))

// The cases that break a naive split. Hermes, the phone engine, has no
// Intl.Segmenter, so the fallback has to give exactly the same answer.
const SAMPLES = [
  'Prona e duhur, fillon këtu.',
  'çështje Ç ë Ë',
  'Найдите объект, созданный для вас.',
  'ë decomposed', // e + combining diaeresis
  'مُمْكِن', // Arabic with harakat
  'العقار المناسب يبدأ هنا.',
  'بِسْمِ',
  '🏠 house 👍🏽 ok',
  '👩‍👩‍👧 family',
  '🇦🇱🇷🇺 flags',
  '1️⃣ keycap',
]

test('splitting never breaks a character, with or without Intl.Segmenter', () => {
  for (const s of SAMPLES) {
    assert.deepEqual(segmentByRules(s), segmentGraphemes(s), s)
    assert.equal(segmentByRules(s).join(''), s, s)
  }
  assert.equal(segmentByRules('ë').length, 1)
  assert.equal(segmentByRules('👩‍👩‍👧').length, 1)
  assert.equal(segmentByRules('🇦🇱🇷🇺').length, 2)
  assert.equal(segmentByRules('مُ').length, 1, 'a letter keeps its haraka')
})

const P = preparePhrases([{ lead: 'Një,', accent: 'dy.' }, { lead: 'Tre', accent: 'katër' }])

test('a phrase is typed, rests, is deleted, then the next one starts from empty', () => {
  let s = { index: 0, count: 0, phase: 'typing' }
  const seen = []
  for (let i = 0; i < 40 && !(s.index === 1 && s.phase === 'typing'); i++) {
    s = advance(s, P)
    seen.push(s.phase)
  }
  assert.equal(s.index, 1)
  assert.equal(s.count, 0)
  assert.ok(seen.includes('pause') && seen.includes('deleting') && seen.includes('gap'))
})

test('after the last phrase it returns to the first, with nothing on screen', () => {
  const last = { index: 1, count: 1, phase: 'deleting' }
  const gap = advance(last, P)
  assert.deepEqual(gap, { index: 1, count: 0, phase: 'gap' })
  assert.deepEqual(advance(gap, P), { index: 0, count: 0, phase: 'typing' })
})

test('lead and accent split at the right place while typing', () => {
  const p = P[0]
  assert.deepEqual(visibleParts(p, 2), { lead: 'Nj', accent: '' })
  assert.deepEqual(visibleParts(p, p.graphemes.length), { lead: 'Një, ', accent: 'dy.' })
  assert.deepEqual(visibleParts(p, 999), { lead: 'Një, ', accent: 'dy.' })
})

test('timing is organic but bounded, and rests about 2 to 3 seconds', () => {
  const typing = { index: 0, count: 1, phase: 'typing' }
  assert.notEqual(stepDelay(typing, P, 0), stepDelay(typing, P, 1))
  for (const r of [0, 0.5, 1]) {
    const pause = stepDelay({ index: 0, count: 5, phase: 'pause' }, P, r)
    assert.ok(pause >= 2000 && pause <= 3000, String(pause))
  }
  const afterComma = stepDelay({ index: 0, count: 4, phase: 'typing' }, P, 0)
  assert.ok(afterComma > stepDelay(typing, P, 0), 'a longer breath after punctuation')
})

test('bad translation data can only shorten the loop', () => {
  assert.deepEqual(preparePhrases(undefined), [])
  assert.deepEqual(preparePhrases('home.heroPhrases'), [])
  assert.equal(preparePhrases([{ lead: '', accent: '' }, { lead: 'Vetëm' }]).length, 1)
})

test('right-to-left languages are recognised', () => {
  assert.equal(isRtlLanguage('ar'), true)
  assert.equal(isRtlLanguage('ar-AL'), true)
  assert.equal(isRtlLanguage('sq'), false)
  assert.equal(isRtlLanguage('ru'), false)
})

test('every language has six phrases, the Albanian as written, the Russian in Cyrillic', () => {
  const full = (j) => j.home.heroPhrases.map((p) => `${p.lead} ${p.accent}`)
  assert.deepEqual(full(read('src/i18n/locales/sq.json')), [
    'Prona e duhur, fillon këtu.',
    'Gjej pronën që të përshtatet.',
    'Investimi i duhur, në vendin e duhur.',
    'Biznesi yt meriton vendin e duhur.',
    'Ktheje mundësinë në investim.',
    'Zbulo mundësinë e radhës.',
  ])
  for (const lang of ['en', 'de', 'it', 'es', 'pl', 'ru', 'fr']) {
    assert.equal(read(`src/i18n/locales/${lang}.json`).home.heroPhrases.length, 6, lang)
  }
  for (const line of full(read('src/i18n/locales/ru.json'))) assert.match(line, /^[Ѐ-ӿ\s,.—-]+$/, line)
})

test('the component holds no words and no left or right', () => {
  const src = fs.readFileSync(new URL('../components/home/hero-typewriter.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(src, /fillon|Prona|\.split\(''\)/)
  assert.doesNotMatch(src, /textAlign/)
})
