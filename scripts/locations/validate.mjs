// Step 3 of the locations audit: checks every city and zone the app offers
// (src/features/properties/data/locations.js), the live listings'
// coordinates and the map defaults against data/albania-locations.json and
// the OpenStreetMap lookups cached by verify-osm.mjs / verify-pass2.mjs.
// Writes docs/locations/validation.json and docs/locations/VALIDATION_REPORT.md.
//
//   node scripts/locations/validate.mjs && node scripts/locations/build-dataset.mjs
//
// (The second build adds the verified zones that are not in the dataset yet.)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const B = await import('./build-dataset.mjs')
const { fold, bashki, units, places, contains, km, TOWN, bashkiEntries } = B
const { default: APP } = await import(new URL('../../src/features/properties/data/locations.js', import.meta.url))
const SRC = 'src/features/properties/data/locations.js'
const srcLines = fs.readFileSync(path.join(root, SRC), 'utf8').split(/\r?\n/)
const nomCache = JSON.parse(fs.readFileSync(path.join(root, 'docs/locations/osm-cache.json'), 'utf8'))

const STATUS = { valid: '✅ valid', spelling: '✏️ misspelled', hierarchy: '🔁 wrong hierarchy', coords: '📍 bad coordinates', missing: '❌ does not exist', unverified: '❓ unverified' }

// ---------- lookups ----------
const bashkiOf = (lat, lon) => bashki.find((b) => contains(b.shape, lat, lon)) ?? null
const unitOf = (lat, lon) => units.find((u) => u.inside(lat, lon)) ?? null
const key = (s) => fold(s).replace(/^(rruga|lagjja|lagja)\s+/, '')
/** Indefinite/definite pairs fold to one key: Vlora/Vlorë, Durrësi/Durrës. */
const loose = (s) => { const k = key(s); return k.length >= 4 ? k.replace(/(ja|ia|i|a|u|e)$/, '') : k }

// Every named place OpenStreetMap has as a point, plus the 373 units.
const candidates = []
for (const p of places) {
  if (!p.bashki) continue
  candidates.push({ name: p.tags.name, kind: p.tags.place, lat: p.lat, lon: p.lon, bashki: p.bashki, unit: p.unit, osm: `node/${p.id}`, names: [p.tags.name, p.tags.name.replace(/\s*\([^)]*\)$/, ''), ...['alt_name', 'old_name', 'name:sq'].map((k) => p.tags[k]).filter(Boolean)] })
}
// "Maçaj (Babrru)": OpenStreetMap names hamlets after the area they are in.
for (const p of places) {
  const m = /\(([^)]+)\)$/.exec(p.tags.name)
  if (m && p.bashki) candidates.push({ name: m[1], kind: `area named in OSM place "${p.tags.name}"`, lat: p.lat, lon: p.lon, bashki: p.bashki, unit: p.unit, osm: `node/${p.id}`, names: [m[1]], indirect: true })
}
for (const u of units) {
  const c = u.point ?? u.bashki.seat
  candidates.push({ name: u.name, kind: 'njësi administrative', lat: c.lat, lon: c.lon, bashki: u.bashki, unit: u, osm: u.derived ? `relation/${u.e.id} (part)` : `relation/${u.e.id}`, names: [u.name, u.osmName].filter(Boolean) })
}
for (const e of B.lagjeAreas) {
  const b = bashkiOf(e.center.lat, e.center.lon)
  if (b) candidates.push({ name: e.tags.name, kind: `lagje (OSM boundary, level ${e.tags.admin_level})`, lat: e.center.lat, lon: e.center.lon, bashki: b, unit: unitOf(e.center.lat, e.center.lon), osm: `relation/${e.id}`, names: [e.tags.name] })
}
// Kamëz's lower-level areas (Bathore, Paskuqan, Nr. 1, Nr. 2).
for (const e of B.kamezLevel9) {
  const m = /Njësia Administrative (.+?) Bashkia Kamëz/.exec(e.tags.name)
  if (!m || /^Nr\./.test(m[1])) continue
  const kb = bashki.find((x) => x.name === 'Kamëz')
  const c = kb.seat
  candidates.push({ name: m[1], kind: 'area (OSM admin level 9)', lat: c.lat, lon: c.lon, bashki: kb, unit: null, osm: `relation/${e.id}`, names: [m[1]] })
}
// Nominatim results: areas and objects that are not points (streets, squares,
// beaches, suburbs drawn as areas). Placed by geometry, not by address text.
const NOM_PLACE = new Set(['suburb', 'neighbourhood', 'quarter', 'city_district', 'borough', 'village', 'hamlet', 'town', 'city', 'isolated_dwelling', 'locality'])
const nominatim = new Map()
for (const [q, rows] of Object.entries(nomCache)) {
  for (const r of rows ?? []) {
    const lat = Number(r.lat), lon = Number(r.lon)
    if (!r.name || Number.isNaN(lat)) continue
    const id = r.osm_type ? `${r.osm_type}/${r.osm_id}` : `nominatim:${r.display}`
    if (nominatim.has(id)) continue
    nominatim.set(id, {
      name: r.name, lat, lon, osm: id,
      kind: r.addresstype ?? r.type, category: r.category,
      display: r.display ?? r.display_name, query: q,
      bashki: bashkiOf(lat, lon),
    })
  }
}
const nomList = [...nominatim.values()].filter((n) => n.bashki)

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}
/** "Labovë e Madhe" is the full name of "Labovë". */
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const prefixOf = (full, zone) => new RegExp(`^${esc(key(zone))} (e|i|te) `).test(key(full))
/** Streets, squares, schools… whose name contains the zone as a whole word. */
const traces = (zone) => {
  // The whole word, or its stem with a short ending (Llamani: "Plazhi i Llamanit").
  const k = key(zone)
  const stem = loose(zone).length >= 5 ? loose(zone) : k
  const re = new RegExp(`(^|[^a-z0-9])(${esc(k)}|${esc(stem)}[a-z]{0,3})([^a-z0-9]|$)`)
  return nomList.filter((n) => re.test(key(n.name)))
}
const sameWords = (a, b) => key(a).split(' ').sort().join(' ') === key(b).split(' ').sort().join(' ')

// ---------- cities ----------
const cityRows = []
const cityBashki = new Map()
for (const { city } of APP) {
  const town = places.find((p) => TOWN.has(p.tags.place) && fold(p.tags.name) === fold(city) && p.bashki)
  const b = town?.bashki ?? null
  cityBashki.set(city, b)
  const seatOf = bashki.find((x) => x.seat === town)
  cityRows.push({
    value: city, kind: 'city', where: `${SRC}:${srcLines.findIndex((l) => l.includes(`city: '${city}'`)) + 1}`,
    status: town ? 'valid' : 'missing',
    proposal: town ? (seatOf ? (seatOf.name === city ? `Keep. Seat of Bashkia ${seatOf.name}` : `Keep the town. It is the seat of Bashkia ${seatOf.name}, so the municipality's other places belong under it`) : `Keep. Town in Bashkia ${b.name}`) : 'No town of this name found',
    evidence: town ? `OSM node/${town.id} (${town.tags.place}) at ${town.lat.toFixed(4)}, ${town.lon.toFixed(4)}, inside the Bashkia ${b.name} outline (relation/${b.e.id})` : '',
    userData: ['Tiranë', 'Durrës'].includes(city) ? 'Y' : 'N',
    dataset: b ? bashkiEntries.get(b).id : null,
  })
}

// ---------- zones ----------
const appCityByBashki = new Map()
for (const [city, b] of cityBashki) if (b && !appCityByBashki.has(b)) appCityByBashki.set(b, city)
const keepNodes = new Set()
const keepExtra = []
const zoneRows = []
for (const { city, zones } of APP) {
  const b = cityBashki.get(city)
  const start = srcLines.findIndex((l) => l.includes(`city: '${city}'`))
  for (const zone of zones) {
    const where = `${SRC}:${srcLines.findIndex((l, i) => i >= start && l.includes(`'${zone}'`)) + 1}`
    const row = { value: zone, city, kind: 'zone', where, userData: 'N' }
    const exact = (c) => c.names.some((n) => key(n) === key(zone))
    const looseEq = (c) => c.names.some((n) => loose(n) === loose(zone) || sameWords(n, zone))
    const here = candidates.filter((c) => c.bashki === b)
    const nomHere = nomList.filter((n) => n.bashki === b && (key(n.name) === key(zone) || loose(n.name) === loose(zone)))
    const nomHerePlace = nomHere.filter((n) => NOM_PLACE.has(n.kind) && n.category !== 'highway')
    let hit
    if (zone === 'Qendër') {
      const qUnit = units.find((u) => u.bashki === b && u.name === 'Qendër')
      if (qUnit) {
        Object.assign(row, { status: 'valid', proposal: 'Keep. Qendër is an official unit of this municipality', evidence: `Law 115/2014 unit list; OSM relation/${qUnit.e.id}` })
      } else {
        const seatUnit = units.find((u) => u.bashki === b && fold(u.name) === fold(b.name)) ?? units.find((u) => u.bashki === b && u.inside(b.seat.lat, b.seat.lon))
        Object.assign(row, { status: 'unverified', proposal: `Not a place name: it means "the centre". Replace with the town's own unit, ${seatUnit?.name ?? b.seat.tags.name}, or keep it as a "town centre" label`, evidence: `No place named Qendër in Bashkia ${b.name} (OSM); the law has no unit Qendër here` })
      }
    } else if ((hit = here.find(exact))) {
      Object.assign(row, { status: 'valid', proposal: 'Keep', evidence: `${hit.kind} "${hit.name}" in ${hit.unit?.name ? `${hit.unit.name}, ` : ''}Bashkia ${b.name} (OSM ${hit.osm}, ${hit.lat.toFixed(4)}, ${hit.lon.toFixed(4)})` })
      if (hit.osm.startsWith('node/')) keepNodes.add(Number(hit.osm.slice(5)))
    } else if (nomHerePlace.length) {
      hit = nomHerePlace[0]
      const renamed = key(hit.name) !== key(zone)
      Object.assign(row, {
        status: renamed ? 'spelling' : 'valid',
        proposal: renamed ? `Rename to "${hit.name}"` : 'Keep',
        evidence: `${hit.kind} "${hit.name}" in Bashkia ${b.name} (OSM ${hit.osm}, via Nominatim: ${hit.display})`,
      })
      keepExtra.push({ name: hit.name, lat: hit.lat, lon: hit.lon, osm: hit.osm, osm_place: hit.kind })
    } else if ((hit = here.find(looseEq))) {
      Object.assign(row, { status: 'spelling', proposal: `Rename to "${hit.name}"`, evidence: `${hit.kind} "${hit.name}" in Bashkia ${b.name} (OSM ${hit.osm})` })
      if (hit.osm.startsWith('node/')) keepNodes.add(Number(hit.osm.slice(5)))
    } else if ((hit = here.filter((c) => !c.indirect && prefixOf(c.name, zone))).length) {
      Object.assign(row, { status: 'spelling', proposal: `Use the full name: ${[...new Set(hit.map((c) => `"${c.name}"`))].join(' or ')}`, evidence: hit.slice(0, 3).map((c) => `${c.kind} "${c.name}" in Bashkia ${b.name} (OSM ${c.osm})`).join('; ') })
      for (const c of hit) if (c.osm.startsWith('node/')) keepNodes.add(Number(c.osm.slice(5)))
    } else {
      const elsewhere = candidates.filter((c) => exact(c) || looseEq(c) || (!c.indirect && prefixOf(c.name, zone)))
      const elsewhereNom = nomList.filter((n) => key(n.name) === key(zone) && NOM_PLACE.has(n.kind) && n.category !== 'highway')
      // Nearest first: "Golem" next to Durrës is the Golem in Kavajë, not the one in Shkodër.
      const seat = b.seat
      const all = [...elsewhere, ...elsewhereNom].map((c) => ({ ...c, km: km(seat, c) })).sort((x, y) => x.km - y.km)
        // A zone is part of the town it is listed under: a namesake 40 km away is not it.
        .filter((c) => c.km <= 40)
      const realHere = nomHere[0]
      if (realHere && (!all.length || all[0].km > 15)) {
        // A street or landmark of that name here beats a place of the same name far away.
        Object.assign(row, {
          status: 'unverified',
          proposal: `Real ${realHere.category}/${realHere.kind} in Bashkia ${b.name}, not a lagje or village. Keep only if buyers use it as an area name; else remove`,
          evidence: `OSM ${realHere.osm}: ${realHere.display}${all.length ? `. (A place of this name exists ${all[0].km.toFixed(0)} km away, in Bashkia ${all[0].bashki.name}.)` : ''}`,
        })
      } else if (all.length) {
        const nearest = all[0]
        const target = appCityByBashki.get(nearest.bashki)
        const others = [...new Set(all.slice(1).map((c) => c.bashki.name))].filter((x) => x !== nearest.bashki.name)
        Object.assign(row, {
          status: 'hierarchy',
          proposal: target
            ? `Move to ${target} (it is in Bashkia ${nearest.bashki.name}, ${nearest.km.toFixed(0)} km from ${city})`
            : `Not in Bashkia ${b.name}: it is in Bashkia ${nearest.bashki.name} (${nearest.km.toFixed(0)} km away), which the app does not list as a city. Move it under that municipality, else remove`,
          evidence: `${nearest.kind} "${nearest.name}" in Bashkia ${nearest.bashki.name} (OSM ${nearest.osm})${others.length ? `; same name also in Bashkia ${others.join(', ')}` : ''}`,
        })
        for (const c of elsewhere) if (c.osm.startsWith('node/') && c.bashki === nearest.bashki) keepNodes.add(Number(c.osm.slice(5)))
      } else {
        const near = here.map((c) => ({ c, d: lev(key(c.name), key(zone)) })).filter((x) => x.d <= 2 && key(zone).length > 4).sort((a, b2) => a.d - b2.d)[0]
        if (near) {
          Object.assign(row, { status: 'spelling', proposal: `Probably "${near.c.name}" (${near.c.kind}); confirm before renaming`, evidence: `Closest name in Bashkia ${b.name}: OSM ${near.c.osm}, ${near.d} letter(s) different. No place spelled "${zone}" in OpenStreetMap` })
        } else if ((hit = traces(zone)).length) {
          const inB = hit.filter((n) => n.bashki === b)
          const show = (inB.length ? inB : hit).slice(0, 3)
          Object.assign(row, {
            status: 'unverified',
            proposal: `No place of this name in OpenStreetMap, but ${inB.length ? `Bashkia ${b.name}` : `Bashkia ${[...new Set(hit.map((n) => n.bashki.name))].join(' / ')}`} has things named after it. Needs a local source (cadastre or the municipality) before keeping; else remove`,
            evidence: show.map((n) => `${n.category}/${n.kind} "${n.name}" (OSM ${n.osm})`).join('; '),
          })
        } else {
          Object.assign(row, { status: 'missing', proposal: 'Remove. No replacement proposed: nothing real carries this name', evidence: 'No trace in any source checked: the 373 units of Law 115/2014, 4,560 named places in OpenStreetMap, and Nominatim searches with and without diacritics, in definite and genitive form, as "Lagjja …" and with the city name' })
        }
      }
    }
    zoneRows.push(row)
  }
}

// ---------- coordinates ----------
const coordRows = []
const LIVE = [
  { value: 'listing 0c30e394 (Durrës, "Rruga Pavarësia")', city: 'Durrës', lat: 41.312785, lon: 19.480836, userData: 'Y' },
  { value: 'listing 83afd071 (Tiranë, "Ali Demi")', city: 'Tiranë', lat: 41.329208, lon: 19.833069, userData: 'Y' },
  { value: 'listing 0babdc62 (Tiranë, no address)', city: 'Tiranë', lat: 41.333391, lon: 19.869473, userData: 'Y' },
  { value: 'map default Tirana 41.3275, 19.8187 (4 files)', city: 'Tiranë', lat: 41.3275, lon: 19.8187, userData: 'N' },
]
for (const x of LIVE) {
  const inBox = x.lat >= 39.6 && x.lat <= 42.7 && x.lon >= 19.2 && x.lon <= 21.1
  const b = bashkiOf(x.lat, x.lon)
  const seat = cityBashki.get(x.city)?.seat
  const d = seat ? km({ lat: x.lat, lon: x.lon }, seat) : null
  const ok = inBox && b && b === cityBashki.get(x.city)
  coordRows.push({
    value: x.value, city: x.city, kind: 'coordinates', where: x.userData === 'Y' ? 'public.properties' : 'map components',
    status: ok ? 'valid' : 'coords', userData: x.userData,
    proposal: ok ? 'Keep' : `Check: point is in ${b ? `Bashkia ${b.name}` : 'no municipality'}`,
    evidence: `${x.lat}, ${x.lon} is inside Albania's box and inside the Bashkia ${b?.name ?? '?'} outline, ${d?.toFixed(1)} km from the ${x.city} town point${unitOf(x.lat, x.lon) ? ` (unit ${unitOf(x.lat, x.lon).name})` : ''}`,
  })
}

// ---------- output ----------
const rows = [...cityRows, ...zoneRows, ...coordRows]
const cache = path.join(root, 'docs/locations/cache')
fs.writeFileSync(path.join(cache, 'keep-places.json'), JSON.stringify([...keepNodes]))
fs.writeFileSync(path.join(cache, 'keep-extra.json'), JSON.stringify(keepExtra, null, 1))
fs.writeFileSync(path.join(root, 'docs/locations/validation.json'), JSON.stringify(rows, null, 1))
const counts = {}
for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1
console.log('counts', counts)
for (const s of ['missing', 'spelling', 'unverified']) {
  console.log(`\n== ${s}`)
  for (const r of rows.filter((x) => x.status === s)) console.log(`  ${r.city} | ${r.value} | ${r.proposal}`)
}
export { rows, STATUS }
