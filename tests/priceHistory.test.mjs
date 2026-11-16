import { test } from 'node:test'
import assert from 'node:assert/strict'
import { priceSteps } from '../lib/price-history.js'

test('steps are oldest first with the change from the previous price', () => {
  const steps = priceSteps([
    { price: 90000, currency: 'EUR', changed_at: '2026-11-10T00:00:00Z' },
    { price: 100000, currency: 'EUR', changed_at: '2026-10-01T00:00:00Z' },
  ])
  assert.deepEqual(steps.map((s) => s.price), [100000, 90000])
  assert.equal(steps[0].change, null)
  assert.equal(steps[1].change, -0.1)
})

test('repeats collapse; a currency switch has no percentage', () => {
  const steps = priceSteps([
    { price: 100, currency: 'EUR', changed_at: '1' },
    { price: 100, currency: 'EUR', changed_at: '2' },
    { price: 10000, currency: 'ALL', changed_at: '3' },
  ])
  assert.equal(steps.length, 2)
  assert.equal(steps[1].change, null)
})

test('one price is no history', () => {
  assert.equal(priceSteps([{ price: 5, currency: 'EUR', changed_at: '1' }]).length, 1)
  assert.deepEqual(priceSteps(null), [])
})
