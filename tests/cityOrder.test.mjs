import { test } from 'node:test'
import assert from 'node:assert/strict'
import LOCATIONS from '../src/features/properties/data/locations.js'
import { orderCities, searchPlaces } from '../src/features/properties/lib/places.js'

// The parity brief: Tirana first, then Durrës, then the rest in the existing
// order; places resolve through the existing records.

const names = LOCATIONS.map((l) => l.city)

test('Tirana, then Durrës, then every other city in the dataset order', () => {
  const ordered = orderCities(names)
  assert.deepEqual(ordered.slice(0, 2), ['Tiranë', 'Durrës'])
  assert.equal(ordered.length, names.length)
  assert.deepEqual(ordered.slice(2), names.filter((c) => c !== 'Tiranë' && c !== 'Durrës'))
})

test('both city pickers use the shared order', async () => {
  const fs = await import('node:fs')
  for (const f of ['components/property/filter-sheet.tsx', 'app/listing/new.tsx']) {
    assert.match(fs.readFileSync(f, 'utf8'), /orderCities\(/, f)
  }
})

test('the brief\'s examples resolve to the existing records', () => {
  for (const [q, city] of [['Astir', 'Tiranë'], ['Blloku', 'Tiranë'], ['Komuna e Parisit', 'Tiranë'], ['Iliria', 'Durrës']]) {
    assert.equal(searchPlaces(q, { limit: 1 })[0]?.city, city, q)
  }
})
