import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyPriceRange, priceRangeExpression, UNITS_PER_EUR } from '../src/features/properties/lib/priceRange.js'
import * as alerts from '../supabase/functions/saved-search-alerts/logic.js'

// A search's price range is in euros; listings are priced in EUR, ALL or USD.

// Evaluates the PostgREST `or` expression against a row, for the operators the
// expression uses, with SQL's NULL rules (NOT IN is never true for NULL).
function split(s) {
  const parts = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      parts.push(cur)
      cur = ''
    } else cur += ch
  }
  if (cur) parts.push(cur)
  return parts
}
function holds(row, cond) {
  if (cond.startsWith('and(')) return split(cond.slice(4, -1)).every((c) => holds(row, c))
  const [column, ...rest] = cond.split('.')
  let op = rest.shift()
  const negated = op === 'not'
  if (negated) op = rest.shift()
  const value = rest.join('.')
  const v = row[column]
  if (op === 'is') return value === 'null' && v == null
  if (v == null) return false
  let r
  if (op === 'eq') r = String(v) === value
  else if (op === 'gte') r = Number(v) >= Number(value)
  else if (op === 'lte') r = Number(v) <= Number(value)
  else if (op === 'in') r = value.slice(1, -1).split(',').includes(String(v))
  else throw new Error(`operator not handled here: ${op}`)
  return negated ? !r : r
}
const matches = (row, min, max) => split(priceRangeExpression(min, max)).some((c) => holds(row, c))

test('no bound, no filter, and the query is left alone', () => {
  for (const [min, max] of [[null, null], [undefined, undefined], ['', ''], ['abc', null]]) {
    assert.equal(priceRangeExpression(min, max), null, `${min}/${max}`)
  }
  const query = { or: () => assert.fail('or() must not be called without a bound') }
  assert.equal(applyPriceRange(query, {}), query)
  assert.equal(applyPriceRange(query), query)
})

test('a euro range is converted into each currency', () => {
  const e = priceRangeExpression(100000, 200000)
  assert.ok(e.includes('and(currency.eq.EUR,price.gte.100000,price.lte.200000)'), e)
  assert.ok(e.includes(`and(currency.eq.ALL,price.gte.${100000 * UNITS_PER_EUR.ALL},price.lte.${200000 * UNITS_PER_EUR.ALL})`), e)
  assert.ok(e.includes(`and(currency.eq.USD,price.gte.${Math.round(100000 * UNITS_PER_EUR.USD)},price.lte.${Math.round(200000 * UNITS_PER_EUR.USD)})`), e)
})

test('the flat that used to vanish: 15,000,000 ALL is within a max of €200,000', () => {
  assert.equal(matches({ price: 15_000_000, currency: 'ALL' }, null, 200000), true)
})

test('a 150,000 ALL rental (about €1,500) no longer passes a €100,000 minimum', () => {
  assert.equal(matches({ price: 150_000, currency: 'ALL' }, 100000, null), false)
})

test('euro listings are filtered exactly as before', () => {
  assert.equal(matches({ price: 150000, currency: 'EUR' }, 100000, 200000), true)
  assert.equal(matches({ price: 100000, currency: 'EUR' }, 100000, 200000), true, 'the bounds are inclusive')
  assert.equal(matches({ price: 250000, currency: 'EUR' }, 100000, 200000), false)
  assert.equal(matches({ price: 90000, currency: 'EUR' }, 100000, null), false)
})

test('dollars: $200,000 is within €180,000 and outside €150,000', () => {
  assert.equal(matches({ price: 200000, currency: 'USD' }, null, 180000), true)
  assert.equal(matches({ price: 200000, currency: 'USD' }, null, 150000), false)
})

test('a listing with no currency, or one the forms do not offer, compares as euros', () => {
  assert.equal(matches({ price: 150000, currency: null }, 100000, 200000), true)
  assert.equal(matches({ price: 250000, currency: null }, 100000, 200000), false)
  assert.equal(matches({ price: 150000, currency: 'GBP' }, 100000, 200000), true)
  assert.equal(matches({ price: 250000, currency: 'GBP' }, 100000, 200000), false)
})

test('a listing with no price never matches a range', () => {
  assert.equal(matches({ price: null, currency: 'EUR' }, 0, 200000), false)
})

test('only the bound that was set is sent; strings from the URL work', () => {
  const onlyMax = priceRangeExpression(null, '200000')
  assert.ok(!onlyMax.includes('gte'), onlyMax)
  assert.ok(onlyMax.includes('and(currency.eq.EUR,price.lte.200000)'), onlyMax)
  const onlyMin = priceRangeExpression('100000', undefined)
  assert.ok(!onlyMin.includes('lte'), onlyMin)
})

test('the email-alert function keeps an identical copy (it deploys on its own)', () => {
  assert.deepEqual(alerts.UNITS_PER_EUR, UNITS_PER_EUR)
  for (const [min, max] of [[100000, 200000], [null, '200000'], ['50000', undefined], [null, null], ['abc', 1], [0, 0]]) {
    assert.equal(alerts.priceRangeExpression(min, max), priceRangeExpression(min, max), `${min}/${max}`)
  }
})

test('applyPriceRange adds one or() and returns what it returns', () => {
  const calls = []
  const query = { or: (expr) => (calls.push(expr), 'next') }
  assert.equal(applyPriceRange(query, { minPrice: 1, maxPrice: 2 }), 'next')
  assert.deepEqual(calls, [priceRangeExpression(1, 2)])
})
