// Sorts the OpenStreetMap results (docs/locations/osm-results.json, from
// verify-osm.mjs) into: valid, wrong municipality, not a place (street,
// beach, site…), and not found. Prints a summary and writes
// docs/locations/classified.json for the validation report.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const results = JSON.parse(fs.readFileSync(path.join(root, 'docs/locations/osm-results.json'), 'utf8'))

const PLACE = new Set(['city', 'town', 'village', 'suburb', 'neighbourhood', 'quarter', 'hamlet', 'locality', 'isolated_dwelling', 'city_district', 'borough', 'municipality'])
const out = []
const counts = {}
const bump = (k) => (counts[k] = (counts[k] ?? 0) + 1)

for (const c of results) {
  for (const z of c.zones) {
    let status, where = null, note = ''
    const placeIn = z.inCity.filter((r) => PLACE.has(r.type))
    const placeElse = z.elsewhere.filter((r) => PLACE.has(r.type))
    if (z.zone === 'Qendër') {
      status = 'generic'
      note = 'label for the town centre'
    } else if (placeIn.length) {
      status = 'valid'
      where = placeIn[0]
    } else if (z.inCity.length) {
      status = 'not-a-place'
      where = z.inCity[0]
      note = `${z.inCity[0].category}/${z.inCity[0].type}`
    } else if (placeElse.length) {
      status = 'wrong-municipality'
      where = placeElse[0]
      note = [...new Set(placeElse.map((r) => r.municipality).filter(Boolean))].join('; ')
    } else if (z.elsewhere.length) {
      status = 'not-a-place-elsewhere'
      where = z.elsewhere[0]
      note = `${z.elsewhere[0].category}/${z.elsewhere[0].type} in ${z.elsewhere[0].municipality ?? '?'}`
    } else {
      status = 'not-found'
    }
    bump(status)
    out.push({
      city: c.city,
      cityMunicipality: c.municipality,
      cityCounty: c.county,
      zone: z.zone,
      status,
      note,
      lat: where?.lat ?? null,
      lon: where?.lon ?? null,
      osm: where?.display ?? null,
    })
  }
}
fs.writeFileSync(path.join(root, 'docs/locations/classified.json'), JSON.stringify(out, null, 1))
console.log('cities:')
for (const c of results) console.log(`  ${c.city} -> ${c.municipality ?? '?'} / ${c.county ?? '?'} (${c.osm?.type ?? 'none'})`)
console.log('counts:', JSON.stringify(counts))
for (const s of ['not-found', 'wrong-municipality', 'not-a-place', 'not-a-place-elsewhere']) {
  console.log(`\n== ${s}`)
  for (const r of out.filter((x) => x.status === s)) console.log(`  ${r.city} | ${r.zone} | ${r.note}`)
}
