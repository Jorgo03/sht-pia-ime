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
import { AMENITIES, toggleAmenity } from '../src/features/properties/lib/amenities.js'
import { alertNotificationData, notTheirOwn } from '../supabase/functions/saved-search-alerts/logic.js'
import { buildPush, safeRoute } from '../supabase/functions/push-dispatch/logic.js'
import { notificationCopy, notificationRoute } from '../src/features/notifications/lib/feed.js'
import { batches, buildImport, COLUMN_NAMES, parseCsv, parseNumber, REQUIRED_COLUMNS } from '../src/features/listings/lib/bulkImport.js'
import { regionAround } from '../src/features/properties/lib/nearMe.js'
import { hasFacets, savedFromFilters, savedKey, savedLabel } from '../src/features/saved-searches/lib/fromFilters.js'
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

test('amenities stay in one order, so one search has one cache key', () => {
  assert.deepEqual(toggleAmenity(['pool'], 'balcony'), ['balcony', 'pool'])
  assert.deepEqual(toggleAmenity(['balcony', 'pool'], 'pool'), ['balcony'])
  assert.deepEqual(toggleAmenity(null, 'pool'), ['pool'])
  assert.ok(!AMENITIES.includes('heating'), 'no longer offered')
})

const SEARCH = '11111111-1111-4111-8111-111111111111'
const HOME = '22222222-2222-4222-8222-222222222222'

test('alerts skip your own listings and record ids and a count only', () => {
  const rows = [{ id: 'a', owner_id: 'me', agent_id: 'x' }, { id: 'b', owner_id: 'x', agent_id: 'me' }, { id: 'c', owner_id: 'x', agent_id: 'y' }]
  assert.deepEqual(notTheirOwn(rows, 'me').map((r) => r.id), ['c'])
  assert.deepEqual(alertNotificationData(SEARCH, [{ id: HOME, title: 'secret' }]), { search_id: SEARCH, count: 1, property_id: HOME })
  assert.deepEqual(alertNotificationData(SEARCH, [{ id: 'a' }, { id: 'b' }]), { search_id: SEARCH, count: 2 })
})

test('an alert opens the home when there is one, the searches when there are many', () => {
  assert.equal(buildPush({ kind: 'saved_search', data: { count: 1, property_id: HOME }, lang: 'sq' }).url, `/property/${HOME}`)
  const many = buildPush({ kind: 'saved_search', data: { count: 3 }, lang: 'en' })
  assert.equal(many.url, '/saved-searches')
  assert.equal(safeRoute(many.url), '/saved-searches')
  assert.match(many.body, /^3 new homes/)
  assert.equal(notificationRoute({ kind: 'saved_search', data: { count: 3 } }), '/saved-searches')
  assert.equal(notificationRoute({ kind: 'saved_search', data: { count: 1, property_id: HOME } }), `/property/${HOME}`)
})

test('every language has alert wording that shows no search name, address or price', () => {
  for (const lang of ['sq', 'en', 'de', 'it', 'es', 'pl', 'ru', 'fr']) {
    const push = buildPush({ kind: 'saved_search', data: { count: 2, name: 'SECRET', address: 'SECRET', price: 99 }, lang })
    assert.doesNotMatch(push.body, /SECRET|99/, lang)
  }
  const t = (key, opts) => (opts?.total ? `${key}:${opts.total}` : key)
  assert.equal(notificationCopy({ kind: 'saved_search', data: { count: 4 } }, t).body, 'notifications.kinds.saved_search.bodyMany:4')
})

test('saving a search keeps what was chosen, in one comparable form', () => {
  const saved = savedFromFilters({ city: ' Tiranë ', listingType: 'rent', beds: 2, features: ['pool'], minPrice: null, sort: 'newest' })
  assert.deepEqual(saved, { city: 'Tiranë', listing_type: 'rent', beds: 2, features: ['pool'] })
  assert.equal(hasFacets(savedFromFilters({ sort: 'newest', city: '  ', features: [] })), false)
  assert.equal(savedKey({ city: 'A', listing_type: 'rent', zone: null }), savedKey({ listing_type: 'rent', city: 'A' }))
  assert.match(savedLabel(saved, (k) => k), /^Tiranë · search\.rent · 2\+/)
})

test('near me shows the same distance north and east', () => {
  const r = regionAround({ latitude: 41.33, longitude: 19.82 }, 5)
  assert.ok(Math.abs(r.latitudeDelta * 110.574 - 10) < 0.001)
  assert.ok(r.longitudeDelta > r.latitudeDelta, 'a degree of longitude is shorter at this latitude')
})

test('the spreadsheet reader copes with what Excel really writes', () => {
  assert.deepEqual(parseCsv('\uFEFFa;b\r\n1;"x;y"\r\n;\r\n"li""ne\ntwo";2').map((r) => r.cells), [['a', 'b'], ['1', 'x;y'], ['li"ne\ntwo', '2']])
  assert.equal(parseNumber('125.000 €'), 125000)
  assert.equal(parseNumber('125,000'), 125000)
  assert.equal(parseNumber('1.250.000,50'), 1250000.5)
  assert.equal(parseNumber('85,5'), 85.5)
  assert.equal(parseNumber('abc'), null)
})

const HEAD = 'titulli,cmimi,qyteti,lloji,tipi,siperfaqja,foto,karakteristikat,dhoma'
const good = (t = 'Apartament 1') => `${t},"120.000 €",Tiranë,shitje,apartament,80,https://x.al/a.jpg|https://x.al/b.jpg,Ballkon|Ashensor,2`

test('a good row becomes exactly what the database accepts', () => {
  const { problem, rows } = buildImport(`${HEAD}\n${good()}`)
  assert.equal(problem, null)
  assert.deepEqual(rows[0].errors, [])
  const c = rows[0].columns
  assert.equal(c.price, 120000)
  assert.equal(c.listing_type, 'sale')
  assert.equal(c.property_type, 'apartment')
  assert.deepEqual(c.features, ['balcony', 'elevator'])
  assert.equal(c.image_urls.length, 2)
  assert.equal(c.currency, 'EUR')
})

test('bad rows say exactly what is wrong, and good rows still go through', () => {
  const { rows } = buildImport(`${HEAD}\n,0,Tiranë,shitje,kala,80,http://x.al/a.jpg,Fantazi,2\n${good()}`)
  assert.deepEqual(rows[0].errors.map((e) => `${e.kind}:${e.field}`).sort(), ['invalid:features', 'invalid:photos', 'invalid:price', 'invalid:property_type', 'required:title'])
  assert.equal(rows[0].columns, null)
  assert.ok(rows[1].columns)
})

test('nothing is published twice, from the same file or an earlier import', () => {
  const twice = buildImport(`${HEAD}\n${good()}\n${good()}`).rows
  assert.deepEqual(twice[1].errors, [{ kind: 'duplicate' }])
  const again = buildImport(`${HEAD}\n${good()}`, [{ title: 'APARTAMENT 1', address: '', price: 120000 }]).rows
  assert.deepEqual(again[0].errors, [{ kind: 'duplicate' }])
})

test('files that cannot be imported say why', () => {
  assert.equal(buildImport('PK\u0003\u0004binary').problem, 'excel')
  assert.equal(buildImport('').problem, 'empty')
  const columns = buildImport('titulli,cmimi\nA,1')
  assert.equal(columns.problem, 'columns')
  assert.ok(columns.missing.includes('photos'))
  assert.equal(buildImport(`${HEAD}\n${Array(201).fill(good()).join('\n')}`).problem, 'tooMany')
  assert.deepEqual(buildImport(`${HEAD}\nApartament \uFFFD,1,T,shitje,vile,8,https://a.al/a,,1`).rows[0].errors, [{ kind: 'encoding' }])
})

test('every required column has a name, and rows go in small groups', () => {
  for (const c of REQUIRED_COLUMNS) assert.ok(COLUMN_NAMES[c], c)
  assert.deepEqual(batches([1, 2, 3], 2), [[1, 2], [3]])
})
