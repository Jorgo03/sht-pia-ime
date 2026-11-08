import { test } from 'node:test'
import assert from 'node:assert/strict'

import LOCATIONS from '../src/features/properties/data/locations.js'
import {
  filterAgents,
  HIGHLIGHT_CITIES,
  initialsOf,
  joinAgents,
  rankCityTiles,
  tallyAgents,
} from '../src/features/properties/lib/discovery.js'
import {
  allFeatures,
  bestOf,
  MAX_COMPARE,
  parseCompareIds,
  pricePerM2,
  toggleCompareId,
} from '../src/features/properties/lib/compare.js'

test('every highlighted city is one the search knows', () => {
  const known = LOCATIONS.map((l) => l.city)
  for (const city of HIGHLIGHT_CITIES) assert.ok(known.includes(city), city)
})

test('city tiles: empty cities are hidden, the fullest come first', () => {
  const tile = (city, count) => ({ city, count, photo: null })
  assert.deepEqual(
    rankCityTiles([tile('A', 0), tile('B', 2), tile('C', 9), tile('D', 2)]).map((t) => t.city),
    ['C', 'B', 'D'],
  )
})

test('the directory counts live listings and leads with the agency', () => {
  const tally = tallyAgents([{ agent_id: 'a' }, { agent_id: 'b' }, { agent_id: 'b' }, { agent_id: null }])
  assert.deepEqual(tally, [{ id: 'b', listings: 2 }, { id: 'a', listings: 1 }])
  const rows = joinAgents(tally, [
    { id: 'a', full_name: ' Ana ', agency_name: null, avatar_url: null },
    { id: 'b', full_name: 'Besa', agency_name: 'Zyra', avatar_url: 'x' },
  ])
  assert.deepEqual(rows, [
    { id: 'b', title: 'Zyra', subtitle: 'Besa', avatar: 'x', listings: 2 },
    { id: 'a', title: 'Ana', subtitle: null, avatar: null, listings: 1 },
  ])
})

test('the directory leaves out anyone without a readable profile or a name', () => {
  const tally = [{ id: 'gone', listings: 1 }, { id: 'blank', listings: 1 }]
  assert.deepEqual(joinAgents(tally, [{ id: 'blank', full_name: '  ', agency_name: null, avatar_url: null }]), [])
})

test('search ignores case and accents; initials keep whole characters', () => {
  const agents = [{ id: '1', title: 'Zyra Korçë', subtitle: null, avatar: null, listings: 1 }]
  assert.equal(filterAgents(agents, 'korce').length, 1)
  assert.equal(filterAgents(agents, 'vlore').length, 0)
  assert.equal(filterAgents(agents, '  ').length, 1)
  assert.equal(initialsOf('çelo mara kola'), 'ÇM')
  assert.equal(initialsOf(''), '')
})

test('the comparison holds three, and a full list stays as it is', () => {
  let ids = []
  for (const id of ['a', 'b', 'c', 'd']) ids = toggleCompareId(ids, id)
  assert.equal(MAX_COMPARE, 3)
  assert.deepEqual(ids, ['a', 'b', 'c'])
  assert.deepEqual(toggleCompareId(ids, 'b'), ['a', 'c'])
})

test('a damaged saved list is an empty one', () => {
  assert.deepEqual(parseCompareIds('nonsense'), [])
  assert.deepEqual(parseCompareIds('{"a":1}'), [])
  assert.deepEqual(parseCompareIds('["a","a",1,"b","c","d"]'), ['a', 'b', 'c'])
})

const home = (id, fields) => ({ id, price: 100000, currency: 'EUR', sqft: 100, beds: 2, listing_type: 'sale', features: [], ...fields })

test('price per m² exists for sales only', () => {
  assert.equal(pricePerM2(home('a', {})), 1000)
  assert.equal(pricePerM2(home('a', { listing_type: 'rent', price: 500 })), null)
  assert.equal(pricePerM2(home('a', { sqft: null })), null)
})

test('the best on each measure', () => {
  const best = bestOf([home('a', { price: 90000, sqft: 120, beds: 3 }), home('b', { price: 120000, sqft: 90, beds: 2 })])
  assert.deepEqual(best, { price: 'a', perM2: 'a', area: 'a', beds: 'a' })
})

test('a tie, or a single home, has no winner', () => {
  assert.equal(bestOf([home('a', {}), home('b', {})]).price, null)
  assert.equal(bestOf([home('a', {})]).price, null)
})

test('a rent is never "cheaper" than a sale, nor lek than euro', () => {
  assert.equal(bestOf([home('a', { listing_type: 'rent', price: 500 }), home('b', {})]).price, null)
  const mixed = bestOf([home('a', { currency: 'ALL', price: 15000000 }), home('b', { price: 150000 })])
  assert.equal(mixed.price, null)
  assert.equal(mixed.perM2, null)
})

test('features are listed once each', () => {
  assert.deepEqual(allFeatures([home('a', { features: ['pool', 'balcony'] }), home('b', { features: ['balcony'] }), home('c', { features: null })]), ['balcony', 'pool'])
})
