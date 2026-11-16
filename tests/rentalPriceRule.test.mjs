import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { pricePerM2 } from '../src/features/properties/lib/compare.js'

// The parity brief's rule: a rental never shows a price per m². A €400/month,
// 40 m² rental shows "€400/month", never "€10/m²". One shared rule, used by
// every screen that shows the figure.

test('a €400/month 40 m² rental has no price per m²', () => {
  assert.equal(pricePerM2({ listing_type: 'rent', price: 400, sqft: 40 }), null)
  assert.equal(pricePerM2({ listing_type: 'daily_rent', price: 40, sqft: 40 }), null)
})

test('a sale has one, rounded', () => {
  assert.equal(pricePerM2({ listing_type: 'sale', price: 100000, sqft: 75 }), 1333)
})

test('every screen that shows a price per m² uses the shared rule', () => {
  for (const f of ['app/property/[id].tsx', 'components/property/property-row.tsx', 'app/compare.tsx']) {
    const src = fs.readFileSync(f, 'utf8')
    assert.match(src, /pricePerM2\(/, f)
    assert.doesNotMatch(src, /price\)? \/ (Number\()?(property\.)?(sqft|area)/, `${f} divides by the area itself`)
  }
})
