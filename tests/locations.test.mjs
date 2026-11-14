// The locations audit (docs/locations/): the reference dataset, the list both
// apps offer, and the helpers that resolve and check places. These keep a
// fake or misplaced location from coming back in.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import LOCATIONS, { CITIES } from '../src/features/properties/data/locations.js'
import { CITY_KEYS } from '../supabase/functions/ai-assistant/places.js'
import {
  ALBANIA_BOX, checkPin, cityCentre, cityLabel, findCity, fold, locationIdFor, resolveCity, resolveZone, searchPlaces,
} from '../src/features/properties/lib/places.js'

const dataset = JSON.parse(fs.readFileSync(new URL('../data/albania-locations.json', import.meta.url), 'utf8'))
const decisions = JSON.parse(fs.readFileSync(new URL('../docs/locations/decisions.json', import.meta.url), 'utf8')).decisions
const byId = new Map(dataset.locations.map((e) => [e.id, e]))
const inAlbania = (lat, lng) => lat >= ALBANIA_BOX.minLat && lat <= ALBANIA_BOX.maxLat && lng >= ALBANIA_BOX.minLng && lng <= ALBANIA_BOX.maxLng

test('the dataset has the divisions of Law 115/2014', () => {
  const count = (t) => dataset.locations.filter((e) => e.type === t).length
  assert.equal(count('qark'), 12)
  assert.equal(count('bashki'), 61)
  assert.equal(count('njesi'), 373)
})

test('every place has a real parent, a unique id and a point inside Albania', () => {
  const ids = new Set()
  for (const e of dataset.locations) {
    assert.ok(!ids.has(e.id), `duplicate id ${e.id}`)
    ids.add(e.id)
    if (e.type === 'qark') assert.equal(e.parent_id, null)
    else assert.ok(byId.has(e.parent_id), `${e.id}: parent ${e.parent_id} missing`)
    assert.ok(e.centroid && inAlbania(e.centroid.lat, e.centroid.lng), `${e.id}: centroid outside Albania`)
    assert.ok(e.source?.osm, `${e.id}: no source`)
  }
  const parentType = { bashki: 'qark', njesi: 'bashki' }
  for (const e of dataset.locations) if (parentType[e.type]) assert.equal(byId.get(e.parent_id).type, parentType[e.type], e.id)
})

test('the apps offer all 61 municipalities, one city each', () => {
  assert.equal(CITIES.length, 61)
  assert.equal(new Set(CITIES.map((c) => c.city)).size, 61)
  for (const c of CITIES) assert.equal(byId.get(c.id)?.type, 'bashki', c.city)
  // The shape the pickers use is still { city, zones: [name] }.
  assert.deepEqual(LOCATIONS[0], { city: CITIES[0].city, zones: CITIES[0].zones.map((z) => z.name) })
})

test('every zone is a real place inside its own municipality', () => {
  for (const c of CITIES) {
    const names = new Set()
    for (const z of c.zones) {
      assert.ok(byId.has(z.id), `${c.city}/${z.name}: not in the dataset`)
      let b = byId.get(z.id)
      while (b && b.type !== 'bashki') b = byId.get(b.parent_id)
      assert.equal(b?.id, c.id, `${c.city}/${z.name}: belongs to ${b?.id}`)
      assert.equal(checkPin(c.city, z.lat, z.lng), 'ok', `${c.city}/${z.name}: point outside the municipality`)
      assert.ok(!names.has(fold(z.name)), `${c.city}/${z.name}: listed twice`)
      names.add(fold(z.name))
    }
  }
})

test('nothing the audit removed is offered again', () => {
  const offered = new Set(CITIES.flatMap((c) => c.zones.map((z) => `${c.city}|${fold(z.name)}`)))
  const removed = decisions.filter((d) => d.action === 'remove' && d.zone !== 'Qendër')
  assert.ok(removed.length > 30)
  for (const d of removed) assert.ok(!offered.has(`${d.city}|${fold(d.zone)}`), `${d.city}/${d.zone} is back`)
  for (const fake of ['Përmet i Durrësit', 'Himara Jugor', 'Liqeni i Korçës', 'Kukës i Ri', 'Kukës i Vjetër', 'Rrethi i Ri', 'Skelë', 'Dunavat']) {
    assert.ok(!CITIES.some((c) => c.zones.some((z) => fold(z.name) === fold(fake))), `${fake} is offered`)
  }
})

test('places that sat under the wrong city are under the right one', () => {
  const zonesOf = (city) => findCity(city).zones.map((z) => z.name)
  assert.ok(zonesOf('Kavajë').includes('Golem'))
  assert.ok(!zonesOf('Durrës').includes('Golem'))
  assert.ok(zonesOf('Himarë').includes('Dhërmi'))
  assert.ok(!zonesOf('Vlorë').includes('Dhërmi'))
  assert.ok(zonesOf('Kamëz').includes('Paskuqan'))
  assert.ok(!zonesOf('Tiranë').includes('Paskuqan'))
  assert.equal(resolveCity('Koplik'), 'Koplik', 'Koplik is the seat of Malësi e Madhe, not a zone of Shkodër')
})

test('names typed any way resolve to the canonical city and zone', () => {
  assert.equal(resolveCity('Tirana'), 'Tiranë')
  assert.equal(resolveCity('tirane'), 'Tiranë')
  assert.equal(resolveCity('Durazzo'), 'Durrës')
  assert.equal(resolveCity('Valona'), 'Vlorë')
  assert.equal(resolveCity('Shkodra'), 'Shkodër')
  assert.equal(resolveCity('Dibër'), 'Peshkopi')
  assert.equal(resolveCity('Atlantis'), null)
  assert.equal(cityLabel('Peshkopi'), 'Peshkopi (Dibër)')
  assert.equal(cityLabel('Tiranë'), 'Tiranë')
  assert.equal(resolveZone('Tiranë', 'blloku'), 'Blloku')
  assert.equal(resolveZone('Tiranë', 'Laprakë'), 'Lapraka', 'the old spelling still finds the zone')
  assert.equal(resolveZone('Durrës', 'Blloku'), null)
  assert.match(locationIdFor('Tiranë', 'Blloku'), /blloku/)
  assert.equal(locationIdFor('Tiranë', null), findCity('Tiranë').id)
})

test('autocomplete finds cities and zones by any word, without diacritics', () => {
  assert.deepEqual(searchPlaces('dur')[0], { city: 'Durrës', zone: null, label: 'Durrës' })
  assert.ok(searchPlaces('bllok').some((r) => r.city === 'Tiranë' && r.zone === 'Blloku'))
  assert.ok(searchPlaces('komuna parisit').some((r) => r.zone === 'Komuna e Parisit'))
  assert.ok(searchPlaces('ksamil').some((r) => r.city === 'Sarandë' && r.zone === 'Ksamil'))
  assert.deepEqual(searchPlaces(''), [])
  assert.ok(searchPlaces('a', { limit: 3 }).length <= 3)
})

test('a pin is checked against Albania and the chosen city', () => {
  assert.equal(checkPin('Tiranë', 41.3275, 19.8187), 'ok')
  assert.equal(checkPin('Tiranë', 45, 12), 'outside-albania')
  assert.equal(checkPin('Tiranë', 39.8752, 20.0065), 'outside-city', 'a Sarandë pin on a Tiranë listing')
  assert.equal(checkPin('Tiranë', null, null), 'missing')
  // The three live listings (2026-11-14) all pass.
  assert.equal(checkPin('Durrës', 41.312785, 19.480836), 'ok')
  assert.equal(checkPin('Tiranë', 41.329208, 19.833069), 'ok')
  assert.equal(checkPin('Tiranë', 41.333391, 19.869473), 'ok')
  assert.deepEqual(cityCentre('Atlantis'), null)
})

test('the map default and the local seed listings are real places in Tiranë', () => {
  for (const f of ['components/listing/location-picker.native.tsx', 'components/map/leaflet/leaflet-maps.tsx', 'src/features/listings/pages/NewListing.jsx', 'src/features/properties/components/PropertyMap.jsx']) {
    const src = fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
    assert.match(src, /41\.3275/, f)
  }
  assert.equal(checkPin('Tiranë', 41.3275, 19.8187), 'ok')
  const seed = fs.readFileSync(new URL('../supabase/seed_local.sql', import.meta.url), 'utf8')
  const pins = [...seed.matchAll(/\n\s*(4[0-2]\.\d+),\s*(19\.\d+|20\.\d+),/g)].map((m) => [Number(m[1]), Number(m[2])])
  assert.ok(pins.length >= 10)
  for (const [lat, lng] of pins) assert.equal(checkPin('Tiranë', lat, lng), 'ok', `${lat}, ${lng}`)
})

test('the AI assistant knows the same cities', () => {
  assert.equal(CITY_KEYS.tirana, 'Tiranë')
  assert.equal(CITY_KEYS.durazzo, 'Durrës')
  assert.deepEqual(new Set(Object.values(CITY_KEYS)), new Set(CITIES.map((c) => c.city)))
})

test('the generated files are not edited by hand', () => {
  for (const f of ['src/features/properties/data/locations.js', 'supabase/functions/ai-assistant/places.js', 'supabase/pending/locations_seed.sql']) {
    assert.match(fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'), /GENERATED by scripts\/locations\/generate-app-list\.mjs/, f)
  }
})
