// Second pass. Address fields in OpenStreetMap often leave out the
// municipality (Durrës, Lezhë, Kukës, Krujë, Bulqizë), so a zone's real
// municipality is decided by geometry instead: each of the 61 municipalities'
// boundaries is fetched once, and every candidate point is placed inside one.
// Zones not found as places are retried with spelling variants.
// Same Nominatim rules and cache as verify-osm.mjs.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BASHKI } from './bashki-list.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CACHE = path.join(root, 'docs', 'locations', 'osm-cache.json')
const BOUNDS = path.join(root, 'docs', 'locations', 'cache', 'bashki-boundaries.json')
const UA = 'ShtepiaIme-location-audit/1.0 (github.com/Jorgo03/sht-pia-ime)'


const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {}
let last = 0
function save(file, data) {
  for (let i = 0; ; i++) {
    try {
      fs.writeFileSync(file, JSON.stringify(data, null, 1))
      return
    } catch (err) {
      if (i >= 5) throw err
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500)
    }
  }
}
async function get(params) {
  const key = JSON.stringify(params)
  if (cache[key]) return cache[key]
  const wait = 1100 - (Date.now() - last)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  last = Date.now()
  const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({ countrycodes: 'al', format: 'jsonv2', 'accept-language': 'sq', ...params })}`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`${res.status} for ${key}`)
  const json = await res.json()
  cache[key] = json
  save(CACHE, cache)
  return json
}

// 1. Municipality boundaries.
const bounds = fs.existsSync(BOUNDS) ? JSON.parse(fs.readFileSync(BOUNDS, 'utf8')) : {}
for (const name of Object.keys(BASHKI)) {
  if (bounds[name]) continue
  const rows = await get({ q: `Bashkia ${name}`, polygon_geojson: '1', polygon_threshold: '0.002', limit: '5' })
  const hit = rows.find((r) => r.category === 'boundary' && r.type === 'administrative' && /^Bashkia /.test(r.name ?? ''))
    ?? rows.find((r) => r.category === 'boundary' && r.type === 'administrative')
  bounds[name] = hit
    ? { osm_id: hit.osm_id, osm_type: hit.osm_type, name: hit.name, lat: Number(hit.lat), lon: Number(hit.lon), geojson: hit.geojson }
    : null
  save(BOUNDS, bounds)
  process.stdout.write(hit ? '+' : 'x')
}
console.log('\nboundaries:', Object.values(bounds).filter(Boolean).length, 'of', Object.keys(BASHKI).length)

// 2. Spelling variants for zones that were not found as a place.
const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
const definite = (s) => (/ë$/.test(s) ? s.replace(/ë$/, 'a') : /e$/.test(s) ? s : `${s}i`)
const classified = JSON.parse(fs.readFileSync(path.join(root, 'docs/locations/classified.json'), 'utf8'))
const retry = classified.filter((z) => ['not-found', 'not-a-place', 'not-a-place-elsewhere', 'wrong-municipality'].includes(z.status))
for (const z of retry) {
  // Genitive forms too: beaches and streets are named "Plazhi i Llamanit".
  const genitive = /[ëe]$/.test(z.zone) ? `${z.zone.replace(/[ëe]$/, '')}ës` : /i$/.test(z.zone) ? `${z.zone}t` : `${z.zone}it`
  const variants = [...new Set([strip(z.zone), definite(z.zone), `Lagjja ${z.zone}`, `${z.zone} ${z.city}`, genitive])].filter((v) => v !== z.zone)
  for (const v of variants) await get({ q: v, addressdetails: '1', limit: '8' })
  process.stdout.write('.')
}
console.log('\nvariants done')
