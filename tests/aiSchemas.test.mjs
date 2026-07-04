// Unit tests for the AI response sanitizers — the trust boundary between
// model output and the app. Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeSearchFilters, sanitizeGeneratedListing } from '../src/lib/aiSchemas.js'

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

// ---------- sanitizeGeneratedListing ----------

test('folds highlights into the description', () => {
  const out = sanitizeGeneratedListing({
    title: 'Apartament modern në Bllok',
    description: 'Përshkrim i gjatë i pronës.',
    highlights: ['85 m²', '2 dhoma gjumi'],
  })
  assert.equal(out.title, 'Apartament modern në Bllok')
  assert.ok(out.description.includes('• 85 m²'))
  assert.ok(out.description.includes('• 2 dhoma gjumi'))
})

test('rejects output missing title or description', () => {
  assert.equal(sanitizeGeneratedListing({ title: 'X' }), null)
  assert.equal(sanitizeGeneratedListing({ description: 'Y' }), null)
  assert.equal(sanitizeGeneratedListing({ title: '  ', description: 'Y' }), null)
  assert.equal(sanitizeGeneratedListing(null), null)
})

test('caps title length and highlight count', () => {
  const out = sanitizeGeneratedListing({
    title: 't'.repeat(300),
    description: 'desc',
    highlights: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  })
  assert.equal(out.title.length, 120)
  assert.equal((out.description.match(/•/g) || []).length, 5)
})

test('ignores non-string highlights', () => {
  const out = sanitizeGeneratedListing({
    title: 'T', description: 'D', highlights: [42, null, { x: 1 }, 'valid'],
  })
  assert.equal((out.description.match(/•/g) || []).length, 1)
})
