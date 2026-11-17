import { test } from 'node:test'
import assert from 'node:assert/strict'
import { convertAmount, isDisplayCurrency, ratesMap, roundConverted } from '../lib/currency.js'
import { ratesFromResponse } from '../supabase/functions/exchange-rates/logic.js'

// Currency toggle (DECISIONS.md W4): rates are units per 1 EUR.

const RATES = { ALL: 100, USD: 1.1, GBP: 0.85 }

test('converts through EUR', () => {
  assert.equal(convertAmount(100000, 'EUR', 'ALL', RATES), 10000000)
  assert.equal(convertAmount(10000000, 'ALL', 'EUR', RATES), 100000)
  assert.ok(Math.abs(convertAmount(110, 'USD', 'GBP', RATES) - 85) < 1e-9)
})

test('same currency is unchanged; missing rates give null', () => {
  assert.equal(convertAmount(5, 'USD', 'USD', {}), 5)
  assert.equal(convertAmount(5, 'EUR', 'USD', {}), null)
  assert.equal(convertAmount('x', 'EUR', 'ALL', RATES), null)
  assert.equal(convertAmount(5, null, 'ALL', RATES), 500)
})

test('converted prices are rounded to 3 significant figures above 1,000', () => {
  assert.equal(roundConverted(123456), 123000)
  assert.equal(roundConverted(9876543), 9880000)
  assert.equal(roundConverted(987.4), 987)
})

test('only the four display currencies', () => {
  assert.equal(isDisplayCurrency('ALL'), true)
  assert.equal(isDisplayCurrency('CHF'), false)
  assert.equal(isDisplayCurrency(null), false)
})

test('rows become a map, bad rows dropped', () => {
  assert.deepEqual(ratesMap([{ currency: 'ALL', per_eur: '98.5' }, { currency: 'USD', per_eur: 0 }]), { ALL: 98.5 })
})

test('the rates function keeps plausible source values only', () => {
  const now = new Date('2026-11-16T06:15:00Z')
  const ok = ratesFromResponse({ result: 'success', base_code: 'EUR', rates: { ALL: 98.2, USD: 1.08, GBP: 0.84 } }, now)
  assert.deepEqual(ok.rows.map((r) => [r.currency, r.per_eur]), [['ALL', 98.2], ['EUR', 1], ['USD', 1.08], ['GBP', 0.84]])
  assert.equal(ok.rows[0].updated_at, now.toISOString())
  assert.ok(ratesFromResponse({ result: 'success', base_code: 'EUR', rates: { ALL: 0.98, USD: 1.08, GBP: 0.84 } }).error)
  assert.ok(ratesFromResponse({ result: 'error' }).error)
  assert.ok(ratesFromResponse({ result: 'success', base_code: 'USD', rates: {} }).error)
})
