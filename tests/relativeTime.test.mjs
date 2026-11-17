// formatRelativeTime on the phones' engine (lib/format.ts).
// Hermes has no Intl.RelativeTimeFormat; calling it crashed the Messages
// screen on a real device (2026-11-06). Here it is removed, as on a phone, and
// the app's own translations (time.*) must answer instead.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import i18next from 'i18next'

const locale = (l) => JSON.parse(readFileSync(new URL(`../src/i18n/locales/${l}.json`, import.meta.url), 'utf8'))
const LANGS = ['sq', 'en', 'de', 'it', 'es', 'pl', 'ru', 'fr']

let saved
let formatRelativeTime
const ago = (seconds) => new Date(Date.now() - seconds * 1000).toISOString()

before(async () => {
  saved = Intl.RelativeTimeFormat
  delete Intl.RelativeTimeFormat
  await i18next.init({
    lng: 'sq',
    fallbackLng: 'sq',
    resources: Object.fromEntries(LANGS.map((l) => [l, { translation: locale(l) }])),
  })
  ;({ formatRelativeTime } = await import('../lib/format.ts'))
})

after(() => {
  Intl.RelativeTimeFormat = saved
})

test('without Intl.RelativeTimeFormat it still answers, in Albanian', () => {
  assert.equal(typeof Intl.RelativeTimeFormat, 'undefined')
  assert.equal(formatRelativeTime(ago(20), 'sq'), 'tani')
  assert.equal(formatRelativeTime(ago(5 * 60), 'sq'), '5 min më parë')
  assert.equal(formatRelativeTime(ago(3 * 3600), 'sq'), '3 orë më parë')
  assert.equal(formatRelativeTime(ago(2 * 86400), 'sq'), '2 ditë më parë')
})

test('every language has the four phrases, with the number in place', () => {
  for (const l of LANGS) {
    for (const [seconds, n] of [[5 * 60, '5'], [3 * 3600, '3'], [2 * 86400, '2']]) {
      const text = formatRelativeTime(ago(seconds), l)
      assert.ok(text.includes(n) && !text.includes('{{'), `${l}: ${text}`)
      assert.ok(!text.startsWith('time.'), `${l} has the key`)
    }
    assert.ok(!formatRelativeTime(ago(10), l).startsWith('time.'), `${l} justNow`)
  }
})

test('a clock a little ahead, older than a week and empty input do not break', () => {
  assert.equal(formatRelativeTime(ago(-30), 'sq'), 'tani')
  assert.match(formatRelativeTime(ago(30 * 86400), 'sq'), /^\d{2}\/\d{2}\/\d{4}$/)
  assert.equal(formatRelativeTime(null, 'sq'), '')
})
