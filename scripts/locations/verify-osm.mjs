// Checks every city and zone in src/features/properties/data/locations.js
// against OpenStreetMap (Nominatim), and records where each one really is:
// its municipality (bashki) and county (qark). docs/locations/ explains how
// the results are read.
//
// Nominatim usage policy (operations.osmfoundation.org/policies/nominatim):
// at most 1 request per second, an identifying User-Agent, results cached.
// The cache (docs/locations/osm-cache.json) makes a rerun free and offline.
//
//   node scripts/locations/verify-osm.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CACHE = path.join(root, 'docs', 'locations', 'osm-cache.json')
const OUT = path.join(root, 'docs', 'locations', 'osm-results.json')
const UA = 'ShtepiaIme-location-audit/1.0 (github.com/Jorgo03/sht-pia-ime)'

const { default: LOCATIONS } = await import(new URL('../../src/features/properties/data/locations.js', import.meta.url))

fs.mkdirSync(path.dirname(CACHE), { recursive: true })
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {}
let last = 0

async function search(q) {
  if (cache[q]) return cache[q]
  const wait = 1100 - (Date.now() - last)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  last = Date.now()
  const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
    q, countrycodes: 'al', format: 'jsonv2', addressdetails: '1', limit: '8', 'accept-language': 'sq',
  })}`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`${res.status} for ${q}`)
  const rows = (await res.json()).map((r) => ({
    name: r.name,
    type: r.addresstype,
    category: r.category,
    lat: Number(r.lat),
    lon: Number(r.lon),
    municipality: r.address?.municipality ?? null,
    county: r.address?.county ?? null,
    display: r.display_name,
  }))
  cache[q] = rows
  fs.writeFileSync(CACHE, JSON.stringify(cache, null, 1))
  return rows
}

const PLACE_TYPES = new Set(['city', 'town', 'village', 'suburb', 'neighbourhood', 'quarter', 'hamlet', 'municipality', 'locality', 'isolated_dwelling', 'city_district', 'borough'])
const isPlace = (r) => PLACE_TYPES.has(r.type)

const results = []
for (const { city, zones } of LOCATIONS) {
  const cityRows = await search(`${city}, Shqipëri`)
  const cityHit = cityRows.find((r) => ['city', 'town'].includes(r.type)) ?? cityRows.find(isPlace) ?? cityRows[0] ?? null
  const cityMunicipality = cityHit?.municipality ?? null
  const entry = { city, osm: cityHit, municipality: cityMunicipality, county: cityHit?.county ?? null, zones: [] }
  for (const zone of zones) {
    const near = await search(`${zone}, ${city}`)
    const inCity = near.filter((r) => r.municipality && r.municipality === cityMunicipality)
    let elsewhere = []
    if (inCity.length === 0) elsewhere = await search(zone)
    entry.zones.push({
      zone,
      inCity: inCity.slice(0, 3),
      elsewhere: elsewhere.slice(0, 5),
    })
    process.stdout.write('.')
  }
  results.push(entry)
  fs.writeFileSync(OUT, JSON.stringify(results, null, 1))
  console.log(`\n${city}: ${zones.length} zones done`)
}
console.log('done')
