// Freezes the approved outcome of the validation (Checkpoint 1, approved by
// the owner on 2026-11-14: "Approve all") into docs/locations/decisions.json.
// It runs once, against the validation of the ORIGINAL list; later
// validations check the new list, so this refuses to overwrite its output
// unless given --force.
//
// How each status was applied:
//   ✅ valid          keep, spelled as the source spells it
//   ✏️ misspelled     rename to the proposed name ("probably" ones included,
//                     and "Labovë" becomes both full names)
//   🔁 wrong hierarchy move to the municipality it is in
//   ❌ does not exist remove
//   ❓ unverified     "Qendër" is replaced by the official units, which every
//                     municipality now lists; a real street, square, lake,
//                     beach or landmark in the city stays as an area name;
//                     a name with only traces (things named after it) is
//                     removed, as its proposal said, unless a second
//                     OpenStreetMap search (RESCUED below) found the object.
//
//   node scripts/locations/decide.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = path.join(root, 'docs/locations/decisions.json')
if (fs.existsSync(OUT) && !process.argv.includes('--force')) {
  console.log('docs/locations/decisions.json already exists; pass --force to rebuild it from the current validation')
  process.exit(0)
}
const rows = JSON.parse(fs.readFileSync(path.join(root, 'docs/locations/validation.json'), 'utf8')).filter((r) => r.kind === 'zone')

// Overpass search on 2026-11-14 for the trace-only names as any OSM object:
// only this one turned up inside its city's municipality.
const RESCUED = {
  'Sarandë|Mango': { name: 'Plazhi Mango', bashki: 'Sarandë', osm: 'way/285639634', lat: 39.8527, lon: 20.0205, kind: 'beach', category: 'natural' },
}

const decisions = []
for (const r of rows) {
  const d = { city: r.city, zone: r.value, status: r.status, where: r.where, evidence: r.evidence }
  const rescued = RESCUED[`${r.city}|${r.value}`]
  if (r.status === 'missing') Object.assign(d, { action: 'remove' })
  else if (r.generic) Object.assign(d, { action: 'remove', note: 'replaced by the official units of the municipality' })
  else if (r.traceOnly && rescued) Object.assign(d, { action: 'keep', to: [{ ...rescued, as: r.value }], landmark: true, evidence: `${r.evidence}; Overpass: ${rescued.category}=${rescued.kind} "${rescued.name}" (OSM ${rescued.osm})` })
  else if (r.traceOnly) Object.assign(d, { action: 'remove', note: 'no source for it as a place' })
  else if (r.status === 'hierarchy') Object.assign(d, { action: 'move', to: r.match.map((x) => (/^area named/.test(x.kind) ? { ...x, as: r.value } : x)) })
  else if (r.status === 'spelling') Object.assign(d, { action: 'rename', to: r.match })
  else if (r.landmark) Object.assign(d, { action: 'keep', to: r.match.map((x) => ({ ...x, as: r.value })), landmark: true })
  else Object.assign(d, { action: 'keep', to: r.match })
  decisions.push(d)
}
const counts = decisions.reduce((c, d) => ((c[d.action] = (c[d.action] ?? 0) + 1), c), {})
fs.writeFileSync(OUT, `${JSON.stringify({ approved: '2026-11-14', by: 'owner, Checkpoint 1: "Approve all"', counts, decisions }, null, 1)}\n`)
console.log('wrote docs/locations/decisions.json', counts)
