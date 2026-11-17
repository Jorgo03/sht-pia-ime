import assert from 'node:assert/strict'
import test from 'node:test'

import {
  achievements,
  compareToBaseline,
  monthsActive,
  parseEstimate,
  periodRange,
  recentMonths,
} from '../src/lib/performanceReport.js'

// Wednesday 2026-11-11, 15:30 local time.
const NOW = new Date(2026, 10, 11, 15, 30)
const day = (y, m, d) => new Date(y, m - 1, d)

test('period: this week starts on Monday at midnight and runs to now', () => {
  assert.deepEqual(periodRange('week', NOW), { from: day(2026, 11, 9), to: null })
  // A Sunday belongs to the week that started six days earlier.
  assert.deepEqual(periodRange('week', new Date(2026, 10, 15, 9)), { from: day(2026, 11, 9), to: null })
  // A Monday starts its own week.
  assert.deepEqual(periodRange('week', new Date(2026, 10, 9, 0, 5)), { from: day(2026, 11, 9), to: null })
})

test('period: month, 3 and 6 months, year and all time', () => {
  assert.deepEqual(periodRange('month', NOW), { from: day(2026, 11, 1), to: null })
  assert.deepEqual(periodRange('3m', NOW), { from: day(2026, 8, 11), to: null })
  assert.deepEqual(periodRange('6m', NOW), { from: day(2026, 5, 11), to: null })
  assert.deepEqual(periodRange('year', NOW), { from: day(2026, 1, 1), to: null })
  assert.deepEqual(periodRange('all', NOW), { from: null, to: null })
  // Crossing a year boundary.
  assert.deepEqual(periodRange('3m', new Date(2027, 0, 20)), { from: day(2026, 10, 20), to: null })
})

test('period: a custom range covers whole days, both ends included', () => {
  const r = periodRange('custom', NOW, { from: new Date(2026, 9, 1, 18), to: new Date(2026, 9, 31, 8) })
  assert.deepEqual(r, { from: day(2026, 10, 1), to: day(2026, 11, 1) })
  // One day.
  assert.deepEqual(periodRange('custom', NOW, { from: day(2026, 10, 5), to: day(2026, 10, 5) }), {
    from: day(2026, 10, 5),
    to: day(2026, 10, 6),
  })
})

test('period: a custom range that is missing or backwards is refused', () => {
  assert.equal(periodRange('custom', NOW), null)
  assert.equal(periodRange('custom', NOW, { from: day(2026, 10, 5) }), null)
  assert.equal(periodRange('custom', NOW, { from: day(2026, 10, 6), to: day(2026, 10, 5) }), null)
  assert.equal(periodRange('nonsense', NOW), null)
})

test('months active: never below one, fractional after that', () => {
  assert.equal(monthsActive(NOW, NOW), 1)
  assert.equal(monthsActive(new Date(2026, 10, 1), NOW), 1)
  const year = monthsActive(new Date(2025, 10, 11, 15, 30), NOW)
  assert.ok(Math.abs(year - 12) < 0.05, `a year is ~12 months, got ${year}`)
  assert.equal(monthsActive('not a date', NOW), 1)
})

test('comparison: previous 3 a month, now 6 a month is +3 and +100%', () => {
  assert.deepEqual(compareToBaseline(3, 36, 6), { previous: 3, current: 6, difference: 3, percent: 100 })
})

test('comparison: a drop is negative, and averages keep one decimal', () => {
  assert.deepEqual(compareToBaseline(4, 10, 4), { previous: 4, current: 2.5, difference: -1.5, percent: -38 })
})

test('comparison: no estimate entered gives no difference and no percentage', () => {
  for (const missing of [null, undefined, '']) {
    assert.deepEqual(compareToBaseline(missing, 12, 3), { previous: null, current: 4, difference: null, percent: null })
  }
})

test('comparison: an estimate of zero has a difference but no percentage', () => {
  assert.deepEqual(compareToBaseline(0, 6, 3), { previous: 0, current: 2, difference: 2, percent: null })
})

test('comparison: less than a month of use divides by one month, not by a fraction', () => {
  assert.deepEqual(compareToBaseline(2, 3, 0.2), { previous: 2, current: 3, difference: 1, percent: 50 })
})

test('estimates: empty is not entered, comma or point decimals, 0 to 1000 only', () => {
  assert.equal(parseEstimate(''), null)
  assert.equal(parseEstimate('  '), null)
  assert.equal(parseEstimate('3'), 3)
  assert.equal(parseEstimate('2,5'), 2.5)
  assert.equal(parseEstimate('0.25'), 0.25)
  assert.equal(parseEstimate('1000'), 1000)
  for (const bad of ['-1', '1001', 'abc', '1.234', '1e3', '3 4']) assert.equal(parseEstimate(bad), undefined, bad)
})

test('achievements: reached, in progress, and capped at their target', () => {
  const list = achievements({ listings: 12, transactions: 1, viewings: 4 })
  const by = Object.fromEntries(list.map((a) => [a.key, a]))
  assert.equal(by.firstListing.done, true)
  assert.equal(by.firstTransaction.done, true)
  assert.equal(by.tenListings.done, true)
  assert.equal(by.tenListings.progress, 10)
  assert.equal(by.tenViewings.done, false)
  assert.equal(by.tenViewings.progress, 4)
  assert.equal(by.tenTransactions.done, false)
  assert.deepEqual(achievements(null).map((a) => a.done), [false, false, false, false, false])
})

test('recent months: the last twelve, oldest first', () => {
  const months = Array.from({ length: 15 }, (_, i) => ({ month: `m${i}`, listings: i, transactions: 0, viewings: 0, inquiries: 0 }))
  const recent = recentMonths(months)
  assert.equal(recent.length, 12)
  assert.equal(recent[0].month, 'm3')
  assert.equal(recent[11].month, 'm14')
  assert.deepEqual(recentMonths(undefined), [])
})
