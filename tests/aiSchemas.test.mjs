// Unit tests for the AI response sanitizers — the trust boundary between
// model output and the app. Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeSearchFilters } from '../src/lib/aiSchemas.js'

// ---------- sanitizeSearchFilters ----------

test('parses a full valid filter set', () => {
  const out = sanitizeSearchFilters({
    city: 'Tiranë', listing_type: 'sale', property_type: 'apartment',
    min_price: 50000, max_price: 100000, beds: 2,
  })
  assert.deepEqual(out, {
    city: 'Tiranë', listing: 'sale', type: 'apartment',
    minPrice: '50000', maxPrice: '100000', beds: '2',
  })
})

test('rejects unknown enum values instead of passing them to the DB', () => {
  const out = sanitizeSearchFilters({ listing_type: 'lease', property_type: 'castle', city: 'Durrës' })
  assert.deepEqual(out, { city: 'Durrës' })
})

test('drops negative, zero, non-numeric, and absurd prices', () => {
  assert.equal(sanitizeSearchFilters({ min_price: -5 }), null)
  assert.equal(sanitizeSearchFilters({ max_price: 0 }), null)
  assert.equal(sanitizeSearchFilters({ max_price: 'cheap' }), null)
  assert.equal(sanitizeSearchFilters({ max_price: 1e12 }), null)
  assert.equal(sanitizeSearchFilters({ beds: 99 }), null)
})

test('swaps min/max when the model inverts the bounds', () => {
  const out = sanitizeSearchFilters({ min_price: 200000, max_price: 100000 })
  assert.deepEqual(out, { minPrice: '100000', maxPrice: '200000' })
})

test('returns null for garbage input', () => {
  assert.equal(sanitizeSearchFilters(null), null)
  assert.equal(sanitizeSearchFilters('apartament'), null)
  assert.equal(sanitizeSearchFilters({}), null)
  assert.equal(sanitizeSearchFilters({ city: '   ' }), null)
})

test('truncates absurdly long city strings', () => {
  const out = sanitizeSearchFilters({ city: 'x'.repeat(500) })
  assert.equal(out.city.length, 60)
})

