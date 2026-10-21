import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyZoneAndRef, formatRef, normalizeRef, validZone, zonesFor } from '../src/features/properties/lib/searchFilters.js'

// Zone and reference search (docs/LAUNCH_TASKS.md F19).

test('zones come from the chosen city, and only count for that city', () => {
  assert.ok(zonesFor('Tiranë').includes('Blloku'))
  assert.deepEqual(zonesFor('Atlantis'), [])
  assert.deepEqual(zonesFor(''), [])
  assert.equal(validZone('Tiranë', 'Blloku'), 'Blloku')
  assert.equal(validZone('Durrës', 'Blloku'), null, 'a Tirana zone with Durrës is ignored, not an empty result')
  assert.equal(validZone('Tiranë', ''), null)
})

test('references: shown as SH-XXXXXXXX, typed almost any way', () => {
  assert.equal(formatRef('1A2B3C4D'), 'SH-1A2B3C4D')
  assert.equal(formatRef(null), '')
  for (const typed of ['SH-1A2B3C4D', 'sh-1a2b3c4d', '1a2b 3c4d', ' SH1A2B3C4D ']) {
    assert.equal(normalizeRef(typed), '1A2B3C4D', typed)
  }
  assert.equal(normalizeRef('https://x.app/property/1a2b3c4d-0000-4000-8000-000000000000'), '1A2B3C4D')
})

test('anything that is not a full reference is no filter at all', () => {
  for (const typed of ['', '   ', 'SH-123', '1A2B3C4D5', 'Blloku', null]) {
    assert.equal(normalizeRef(typed), null, String(typed))
  }
})

test('predicates: zone needs its city; reference is exact', () => {
  const calls = []
  const q = { eq: (c, v) => { calls.push([c, v]); return q } }
  applyZoneAndRef(q, { city: 'Tiranë', zone: 'Blloku', ref: 'sh-1a2b3c4d' })
  applyZoneAndRef(q, { city: 'Durrës', zone: 'Blloku', ref: 'nope' })
  applyZoneAndRef(q, {})
  assert.deepEqual(calls, [['zone', 'Blloku'], ['ref_code', '1A2B3C4D']])
})
