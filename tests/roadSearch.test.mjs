// Rules for turning a Nominatim response into road suggestions.
//
// Nominatim is not reachable from CI, so the network half is untested by
// design — but the filtering IS the substance of that module, and it is pure.
// A dropdown that lists bus stops, or the same street six times, is the
// failure mode these guard.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseRoadResults } from '../src/lib/roadSearch.js'

const road = (over = {}) => ({
  category: 'highway',
  type: 'residential',
  name: 'Rruga e Kavajës',
  lat: '41.3232',
  lon: '19.7999',
  address: { road: 'Rruga e Kavajës', city: 'Tiranë' },
  ...over,
})

test('a road becomes a suggestion with usable coordinates', () => {
  const [first] = parseRoadResults([road()])
  assert.equal(first.name, 'Rruga e Kavajës')
  // Numbers, not the strings Nominatim sends — the map cannot use strings.
  assert.equal(first.latitude, 41.3232)
  assert.equal(first.longitude, 19.7999)
})

test('non-road features are dropped', () => {
  // A street-ish query returns rivers, suburbs and bus stops too. None of them
  // is somewhere you can put a building.
  const results = parseRoadResults([
    road(),
    { category: 'waterway', type: 'river', name: 'Lana', lat: '41.32', lon: '19.81' },
    { category: 'place', type: 'suburb', name: 'Blloku', lat: '41.32', lon: '19.82' },
  ])
  assert.equal(results.length, 1)
  assert.equal(results[0].name, 'Rruga e Kavajës')
})

test('highway features you cannot address are dropped', () => {
  // OSM files bus stops and crossings under `highway` as well.
  const results = parseRoadResults([
    road({ type: 'bus_stop', name: 'Stacioni' }),
    road({ type: 'crossing', name: 'Kalimi' }),
    road(),
  ])
  assert.deepEqual(results.map((r) => r.name), ['Rruga e Kavajës'])
})

test('one street split across many OSM ways is listed once', () => {
  // The most visible failure without this: a long road comes back six times
  // and fills the dropdown with itself.
  const results = parseRoadResults([road(), road({ lat: '41.3240' }), road({ lat: '41.3251' })])
  assert.equal(results.length, 1)
})

test('deduplication is case-insensitive', () => {
  const results = parseRoadResults([road(), road({ name: 'RRUGA E KAVAJËS', address: { road: 'RRUGA E KAVAJËS' } })])
  assert.equal(results.length, 1)
})

test('a result with unusable coordinates is skipped, not shown as 0,0', () => {
  // Sending the map to the Gulf of Guinea is worse than showing nothing.
  const results = parseRoadResults([
    road({ lat: 'not-a-number' }),
    road({ lat: undefined, lon: undefined, name: 'Rruga B', address: { road: 'Rruga B' } }),
    road(),
  ])
  assert.deepEqual(results.map((r) => r.name), ['Rruga e Kavajës'])
})

test('the name falls back through address.road, name, then display_name', () => {
  const [a] = parseRoadResults([{ category: 'highway', type: 'residential', lat: '41', lon: '19', name: 'Rruga X' }])
  assert.equal(a.name, 'Rruga X')

  const [b] = parseRoadResults([
    { category: 'highway', type: 'residential', lat: '41', lon: '19', display_name: 'Rruga Y, Tiranë, Albania' },
  ])
  assert.equal(b.name, 'Rruga Y')
})

test('context distinguishes same-named roads without repeating the name', () => {
  const [first] = parseRoadResults([
    road({ address: { road: 'Rruga e Kavajës', suburb: 'Astir', city: 'Tiranë' } }),
  ])
  assert.equal(first.context, 'Astir')
  assert.notEqual(first.context, first.name)
})

test('a malformed response yields an empty list rather than throwing', () => {
  // The field must degrade to plain typing, never break the form.
  assert.deepEqual(parseRoadResults(null), [])
  assert.deepEqual(parseRoadResults({ error: 'rate limited' }), [])
  assert.deepEqual(parseRoadResults([null, undefined, 'nonsense']), [])
})
