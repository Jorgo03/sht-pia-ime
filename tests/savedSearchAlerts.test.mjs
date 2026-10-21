import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  applySavedFilters as serverFilters, buildAlertEmail, dedupeKey, dispatchEnabled, windowStart, MAX_LISTINGS_PER_EMAIL,
} from '../supabase/functions/saved-search-alerts/logic.js'
import { applySavedFilters as appFilters } from '../src/features/saved-searches/lib/matches.js'

// Saved-search email alerts (docs/LAUNCH_TASKS.md F13). The server must match
// exactly what the apps show, must never send without the owner switching it
// on, and must not leak anything into the email it should not.

const recorder = () => {
  const calls = []
  const q = new Proxy({}, { get: (_, op) => (...a) => { calls.push([op, ...a]); return q } })
  return { calls, q }
}

test('the server matches with the same rules as the apps', () => {
  const cases = [
    { city: 'Tiranë', zone: 'Blloku', listing_type: 'sale', type: 'apartment', minPrice: '50000', maxPrice: 200000, beds: 2 },
    { city: '', type: 'all', minPrice: 'abc' },
    { listing_type: 'rent' },
    null,
  ]
  for (const f of cases) {
    const a = recorder(); const b = recorder()
    serverFilters(a.q, f); appFilters(b.q, f)
    assert.deepEqual(a.calls, b.calls, JSON.stringify(f))
  }
})

test('new matches start after the last alert, or after the search was saved', () => {
  assert.equal(windowStart({ created_at: 'A', last_alerted_at: null }), 'A')
  assert.equal(windowStart({ created_at: 'A', last_alerted_at: 'B' }), 'B')
})

test('nothing is sent unless the provider, the sender and the switch are all set', () => {
  assert.equal(dispatchEnabled({}), false)
  assert.equal(dispatchEnabled({ RESEND_API_KEY: 'k', ALERT_EMAIL_FROM: 'a@b' }), false)
  assert.equal(dispatchEnabled({ ALERTS_DISPATCH_ENABLED: 'true', RESEND_API_KEY: 'k' }), false)
  assert.equal(dispatchEnabled({ ALERTS_DISPATCH_ENABLED: 'yes', RESEND_API_KEY: 'k', ALERT_EMAIL_FROM: 'a@b' }), false)
  assert.equal(dispatchEnabled({ ALERTS_DISPATCH_ENABLED: 'true', RESEND_API_KEY: 'k', ALERT_EMAIL_FROM: 'a@b' }), true)
})

const listing = (n, extra = {}) => ({ id: `id-${n}`, title: `Shtëpi ${n}`, title_i18n: { en: `Home ${n}` }, city: 'Tiranë', price: 100000 + n, currency: 'EUR', ...extra })

test('the email lists up to 10 listings in the person\'s language, with an unsubscribe link', () => {
  const listings = Array.from({ length: 12 }, (_, i) => listing(i))
  const mail = buildAlertEmail({ lang: 'en', searchName: 'Tirana flats', listings, siteUrl: 'https://site', unsubscribeUrl: 'https://u/x' })
  assert.equal(mail.subject, '12 new homes for "Tirana flats"')
  assert.equal((mail.text.match(/https:\/\/site\/property\//g) ?? []).length, MAX_LISTINGS_PER_EMAIL)
  assert.match(mail.text, /and 2 more/)
  assert.match(mail.text, /Home 0 — Tiranë · 100,000 EUR/)
  assert.match(mail.html, /href="https:\/\/u\/x"/)
  assert.match(buildAlertEmail({ lang: 'sq', searchName: 'x', listings: [listing(1)], siteUrl: 's', unsubscribeUrl: 'u' }).text, /Shtëpi 1/)
  assert.match(buildAlertEmail({ lang: 'xx', searchName: 'x', listings: [listing(1)], siteUrl: 's', unsubscribeUrl: 'u' }).subject, /new homes/)
})

test('listing text cannot inject markup into the email', () => {
  const mail = buildAlertEmail({ lang: 'en', searchName: 's', listings: [listing(1, { title_i18n: { en: '<img src=x onerror=alert(1)>' } })], siteUrl: 'https://s', unsubscribeUrl: 'https://u' })
  assert.doesNotMatch(mail.html, /<img/)
  assert.match(mail.html, /&lt;img/)
  assert.doesNotMatch(mail.html, /<img|<script|track|pixel/i)
})

test('the dedupe key is short, stable and order-independent', () => {
  const ids = Array.from({ length: 500 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`)
  const key = dedupeKey('search-1', ids)
  assert.equal(key, dedupeKey('search-1', [...ids].reverse()))
  assert.notEqual(key, dedupeKey('search-1', ids.slice(1)))
  assert.notEqual(key, dedupeKey('search-2', ids))
  assert.ok(key.length < 80)
})
