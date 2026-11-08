import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { HEADLINE_FONT_FILES, headlineFont, needsHeadlineFallback } from '../src/lib/headlineFonts.js'

// Newsreader has no Cyrillic, so Russian headlines use the brand's Manrope
// (which has it) instead of each phone's system font.

test('Russian headlines use Manrope; every other language keeps Newsreader', () => {
  for (const lang of ['ru', 'ru-RU', 'RU', 'ru_RU']) {
    assert.equal(needsHeadlineFallback(lang), true, lang)
    assert.equal(headlineFont('serif', lang), 'Manrope_600SemiBold')
    assert.equal(headlineFont('serifSemiBold', lang), 'Manrope_700Bold')
    assert.equal(headlineFont('serifItalic', lang), 'Manrope_600SemiBold')
  }
  for (const lang of ['sq', 'en', 'de', 'it', 'es', 'pl', 'fr', 'en-GB', '', null, undefined]) {
    assert.equal(needsHeadlineFallback(lang), false, String(lang))
    assert.equal(headlineFont('serif', lang), 'Newsreader_500Medium')
    assert.equal(headlineFont('serifSemiBold', lang), 'Newsreader_600SemiBold')
    assert.equal(headlineFont('serifItalic', lang), 'Newsreader_500Medium_Italic')
  }
})

test('every headline font file is loaded by the app', () => {
  const layout = fs.readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8')
  for (const family of HEADLINE_FONT_FILES) assert.match(layout, new RegExp(`\\b${family}\\b`), family)
})

test('the app supports exactly one language that needs the fallback', () => {
  // If a Cyrillic or other non-Latin locale is added, decide its headline font.
  const locales = fs.readdirSync(new URL('../src/i18n/locales/', import.meta.url)).map((f) => f.replace(/\.json$/, ''))
  assert.deepEqual(locales.filter((l) => needsHeadlineFallback(l)), ['ru'])
})
