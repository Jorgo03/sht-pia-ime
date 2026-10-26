import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatCompactPrice } from '../src/lib/format.js'

// Map price bubbles. The phone app's formatBubblePrice (lib/cluster.ts) uses
// the same rule; both used to print € for every listing.

test('euros and dollars carry their sign', () => {
  assert.equal(formatCompactPrice(200000), '€200K')
  assert.equal(formatCompactPrice(1250000, 'EUR'), '€1.3M')
  assert.equal(formatCompactPrice(2000000, 'EUR'), '€2M', 'no ".0" on round millions')
  assert.equal(formatCompactPrice(450, 'EUR'), '€450')
  assert.equal(formatCompactPrice(250000, 'USD'), '$250K')
})

test('lek is named, not shown as euros (15,000,000 ALL is not €15M)', () => {
  assert.equal(formatCompactPrice(15000000, 'ALL'), 'ALL 15M')
  assert.equal(formatCompactPrice(45000, 'ALL'), 'ALL 45K')
})

test('rounding picks the unit after rounding: 999,600 is 1M, not 1000K', () => {
  assert.equal(formatCompactPrice(999600), '€1M')
  assert.equal(formatCompactPrice(999400), '€999K')
})

test('no currency means euros; junk prices are 0', () => {
  assert.equal(formatCompactPrice(200000, null), '€200K')
  assert.equal(formatCompactPrice('abc'), '€0')
})
