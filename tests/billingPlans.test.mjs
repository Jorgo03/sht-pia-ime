import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupPlans, perMonth, planName } from '../src/features/billing/lib/plans.js'

// Pricing page grouping (docs/LAUNCH_TASKS.md F15).

const rows = [
  { id: 'pro_12', kind: 'agency_subscription', tier: 'pro', period_months: 12, price_cents: 24900, currency: 'ALL', name_i18n: { sq: 'Pro', en: 'Pro' }, listing_cap: 50 },
  { id: 'pro_1', kind: 'agency_subscription', tier: 'pro', period_months: 1, price_cents: 2490, currency: 'ALL', name_i18n: { sq: 'Pro' } },
  { id: 'promo_1', kind: 'promotion', tier: 'promote', period_months: 1, price_cents: 500, currency: 'EUR' },
  { id: 'old', kind: 'promotion', tier: 'promote', period_months: 3, price_cents: 1, active: false },
]

test('one card per plan, periods in order, inactive rows hidden', () => {
  const cards = groupPlans(rows)
  assert.deepEqual(cards.map((c) => c.key), ['agency_subscription:pro', 'promotion:promote'])
  assert.deepEqual(cards[0].options.map((o) => o.months), [1, 12])
  assert.deepEqual(cards[1].options.map((o) => o.id), ['promo_1'])
})

test('no prices yet means no cards, not an error', () => {
  assert.deepEqual(groupPlans([]), [])
  assert.deepEqual(groupPlans(null), [])
})

test('names fall back to Albanian, then the tier; per-month price is rounded', () => {
  const [pro, promo] = groupPlans(rows)
  assert.equal(planName(pro, 'de'), 'Pro')
  assert.equal(planName(promo, 'en'), 'promote')
  assert.equal(perMonth({ months: 12, priceCents: 24900 }), 2075)
  assert.equal(perMonth({ months: null, priceCents: 100 }), null)
})
