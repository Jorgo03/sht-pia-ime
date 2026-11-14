// Builds data/albania-locations.json, the reference list of real Albanian
// places, from the sources fetch-sources.mjs downloaded (OpenStreetMap
// administrative outlines and places, Wikidata names). Nothing in it is typed
// by hand except the 61 municipalities and their counties in verify-pass2.mjs,
// which are only used to cross-check what OpenStreetMap says.
//
// Hierarchy is decided by geometry, not by address text: a municipality
// belongs to the county its interior lies in, an administrative unit to the
// municipality its interior lies in, a place to the unit its point lies in.
//
//   node scripts/locations/build-dataset.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CACHE = path.join(root, 'docs', 'locations', 'cache')
const read = (f) => JSON.parse(fs.readFileSync(path.join(CACHE, f), 'utf8'))
const LANGS = ['sq', 'en', 'it', 'de', 'fr', 'es', 'pl', 'ru']
const SNAPSHOT = read('osm-admin-6-7.json').osm3s.timestamp_osm_base

const admin = [...read('osm-admin-6-7.json').elements, ...read('osm-admin-8.json').elements]
const kamezLevel9 = read('osm-admin-9-kamez.json').elements
// Lagje mapped as boundaries (admin levels 9 and 10), kept when they carry a
// real name rather than a number ("Lagjja 3", "Njësia Bashkiake Nr. 2").
const lagjeAreas = read('osm-admin-9-10.json').elements
  .filter((e) => e.center && !/^(Lagjja \d+|Njësia (Bashkiake|Administrative))/.test(e.tags.name))
const places = read('osm-places.json').elements
const wd = read('wikidata.json')

// The main markets: lagje (suburbs, neighbourhoods, quarters) and villages
// are listed in full for these municipalities. Elsewhere only the places the
// app already offers are carried over, once verified.
export const MAIN_MARKETS = ['Tiranë', 'Durrës', 'Vlorë', 'Sarandë', 'Shkodër', 'Korçë', 'Elbasan', 'Fier', 'Kamëz', 'Himarë']

// ---------- geometry ----------
function shape(rel) {
  const segs = []
  let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180
  for (const m of rel.members ?? []) {
    if (m.type !== 'way' || !m.geometry || !['outer', 'inner', ''].includes(m.role)) continue
    for (let i = 1; i < m.geometry.length; i++) {
      const a = m.geometry[i - 1], b = m.geometry[i]
      segs.push([a.lon, a.lat, b.lon, b.lat])
      minLat = Math.min(minLat, a.lat, b.lat); maxLat = Math.max(maxLat, a.lat, b.lat)
      minLon = Math.min(minLon, a.lon, b.lon); maxLon = Math.max(maxLon, a.lon, b.lon)
    }
  }
  return { segs, minLat, maxLat, minLon, maxLon }
}
/** Even-odd rule over every boundary segment; ring order does not matter. */
function contains(s, lat, lon) {
  if (lat < s.minLat || lat > s.maxLat || lon < s.minLon || lon > s.maxLon) return false
  let inside = false
  for (const [x1, y1, x2, y2] of s.segs) {
    if ((y1 > lat) !== (y2 > lat) && lon < ((x2 - x1) * (lat - y1)) / (y2 - y1) + x1) inside = !inside
  }
  return inside
}
/** A point certainly inside: the middle of the widest span on a few horizontal lines. */
function interiorPoint(s) {
  let best = null
  for (const f of [0.5, 0.4, 0.6, 0.3, 0.7]) {
    const lat = s.minLat + (s.maxLat - s.minLat) * f
    const xs = []
    for (const [x1, y1, x2, y2] of s.segs) {
      if ((y1 > lat) !== (y2 > lat)) xs.push(((x2 - x1) * (lat - y1)) / (y2 - y1) + x1)
    }
    xs.sort((a, b) => a - b)
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const w = xs[i + 1] - xs[i]
      if (!best || w > best.w) best = { w, lat, lon: (xs[i] + xs[i + 1]) / 2 }
    }
  }
  return best && { lat: best.lat, lon: best.lon }
}
const km = (a, b) => {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}

// ---------- names ----------
export const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/^(lagjja|lagja|lagje|fshati|bashkia|njësia administrative|njesia administrative)\s+/, '')
  .replace(/[-‐–]/g, ' ').replace(/\s+/g, ' ').trim()
const slugify = (s) => fold(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
/** Albanian definite form by the standard rule; only used when no source
 *  gives it, and marked as such. A phrase takes it on its first word
 *  ("Malësi e Madhe" -> "Malësia e Madhe"). */
function definiteByRule(n) {
  const [first, ...rest] = n.split(' ')
  if (rest.length) return [definiteByRule(first), ...rest].join(' ')
  if (/u$|[ae]$/.test(n)) return n
  if (/ër$/.test(n)) return n.replace(/ër$/, 'ra')
  if (/ë$/.test(n)) return n.replace(/ë$/, 'a')
  if (/i$/.test(n)) return `${n}a`
  if (/[kg]$|[^szxtdc]h$/.test(n)) return `${n}u`
  return `${n}i`
}
function namesFor(tags) {
  const item = tags.wikidata ? wd[tags.wikidata] : null
  const names = {}
  const aliases = new Set()
  for (const l of LANGS) {
    const v = item?.labels?.[l] ?? tags[`name:${l}`]
    if (v) names[l] = clean(v)
    for (const a of item?.aliases?.[l] ?? []) aliases.add(clean(a))
  }
  for (const k of ['alt_name', 'old_name', 'official_name', 'short_name']) if (tags[k]) for (const a of tags[k].split(';')) aliases.add(clean(a))
  return { names, aliases }
}
const clean = (v) => v.replace(/^(Bashkia|Njësia administrative|Qarku i|Qarku|Gmina|Comune di|Commune de|Municipality of|Municipio de|Gemeinde|Komuna e|Komuna)\s+/i, '').replace(/\s+(Municipality|County|District)$/i, '').trim()

// ---------- counties, municipalities, units ----------
const QARK_NAME = {
  'Qarku i Beratit': 'Berat', 'Qarku i Dibrës': 'Dibër', 'Qarku i Durrësit': 'Durrës', 'Qarku i Elbasanit': 'Elbasan',
  'Qarku i Fierit': 'Fier', 'Qarku i Gjirokastrës': 'Gjirokastër', 'Qarku i Korçës': 'Korçë', 'Qarku i Kukësit': 'Kukës',
  'Qarku i Lezhës': 'Lezhë', 'Qarku i Shkodrës': 'Shkodër', 'Qarku i Tiranës': 'Tiranë', 'Qarku i Vlorës': 'Vlorë',
}
const qarqe = admin.filter((e) => e.tags.admin_level === '6').map((e) => ({ e, name: QARK_NAME[e.tags.name], shape: shape(e) }))
// OpenStreetMap writes one municipality differently from the law.
const OFFICIAL = { 'Vau-Dejës': 'Vau i Dejës' }
const bashki = admin.filter((e) => e.tags.admin_level === '7').map((e) => {
  const osmName = e.tags.name.replace(/^Bashkia /, '')
  return { e, name: OFFICIAL[osmName] ?? osmName, osmName, shape: shape(e) }
})
// Units take the law's spelling (law-units.mjs); OpenStreetMap's, where it
// differs, is kept as an alias.
const OSM_UNIT_NAME = {
  'Ura Vajgurore': 'Dimal', 'Katundi i Ri': 'Katund i Ri', Rashbull: 'Rrashbull', Funar: 'Funarë', 'Thumanë': 'Kodër-Thumanë',
  Ujmisht: 'Ujëmisht', Zagorie: 'Zagori', 'Librazhd Qendër': 'Qendër Librazhd', 'Përrenjas': 'Prrenjas', 'Vau-Dejës': 'Vau i Dejës',
}
const units = admin.filter((e) => e.tags.admin_level === '8').map((e) => {
  const s = shape(e)
  return { e, name: OSM_UNIT_NAME[e.tags.name] ?? e.tags.name, osmName: e.tags.name, shape: s, inside: (lat, lon) => contains(s, lat, lon) }
})
const problems = []
if (qarqe.length !== 12 || qarqe.some((q) => !q.name)) problems.push(`expected 12 named qarqe, got ${qarqe.length}`)
if (bashki.length !== 61) problems.push(`expected 61 bashki, got ${bashki.length}`)

const { BASHKI } = await import('./bashki-list.mjs')
for (const b of bashki) {
  const p = interiorPoint(b.shape)
  b.qark = qarqe.find((q) => contains(q.shape, p.lat, p.lon)) ?? null
  if (!b.qark) problems.push(`bashki ${b.name}: in no qark`)
  else if (BASHKI[b.name] !== b.qark.name) problems.push(`bashki ${b.name}: OSM puts it in ${b.qark.name}, the law list in ${BASHKI[b.name] ?? 'nothing'}`)
}
for (const name of Object.keys(BASHKI)) if (!bashki.some((b) => b.name === name)) problems.push(`law list bashki ${name} missing in OSM`)
for (const u of units) {
  const p = interiorPoint(u.shape)
  u.point = p
  u.bashki = bashki.find((b) => contains(b.shape, p.lat, p.lon)) ?? null
  if (!u.bashki) problems.push(`unit ${u.name}: in no bashki`)
}
// Kamëz: OpenStreetMap has no level-8 units there. Paskuqan is its own
// level-9 area; the unit Kamëz is the rest of the municipality.
{
  const kb = bashki.find((b) => b.name === 'Kamëz')
  const rel = kamezLevel9.find((e) => /Paskuqan/.test(e.tags.name))
  const ps = shape(rel)
  const pask = { e: rel, name: 'Paskuqan', osmName: rel.tags.name, shape: ps, bashki: kb, point: interiorPoint(ps), inside: (lat, lon) => contains(ps, lat, lon) }
  const rest = { e: { id: kb.e.id, tags: {}, members: [] }, name: 'Kamëz', osmName: null, shape: kb.shape, bashki: kb, point: null, derived: true,
    inside: (lat, lon) => contains(kb.shape, lat, lon) && !contains(ps, lat, lon) }
  units.push(pask, rest)
}
const { LAW_UNITS } = await import('./law-units.mjs')
const lawCount = Object.values(LAW_UNITS).reduce((n, l) => n + l.length, 0)
if (lawCount !== 373) problems.push(`law list has ${lawCount} units, not 373`)
for (const b of bashki) {
  const law = LAW_UNITS[b.name] ?? []
  const mine = units.filter((u) => u.bashki === b)
  // Spellings that differ only in ë/e or a hyphen take the law's form.
  for (const u of mine) {
    const match = law.find((n) => fold(n) === fold(u.name))
    if (match && match !== u.name) u.name = match
  }
  for (const n of law) if (!mine.some((u) => u.name === n)) problems.push(`${b.name}: law unit ${n} not found in OSM`)
  for (const u of mine) if (!law.includes(u.name)) problems.push(`${b.name}: OSM unit ${u.name} not in the law list`)
}

// ---------- places ----------
const TOWN = new Set(['city', 'town'])
const LAGJE = new Set(['suburb', 'neighbourhood', 'quarter', 'city_district', 'borough'])
for (const p of places) {
  p.unit = units.find((u) => u.inside(p.lat, p.lon)) ?? null
  p.bashki = p.unit?.bashki ?? bashki.find((b) => contains(b.shape, p.lat, p.lon)) ?? null
}
// The seat of each bashki: its admin_centre node, else the town of the same name inside it.
for (const b of bashki) {
  const centre = b.e.members.find((m) => m.type === 'node' && m.role === 'admin_centre')
  b.seat = (centre && places.find((p) => p.id === centre.ref)) ??
    places.find((p) => TOWN.has(p.tags.place) && p.bashki === b && [fold(b.name), fold(b.osmName)].includes(fold(p.tags.name))) ?? null
  if (!b.seat) problems.push(`bashki ${b.name}: no seat town found`)
}

// ---------- output ----------
const out = []
const ids = new Set()
function add(entry) {
  if (ids.has(entry.id)) entry.id = `${entry.id}-${entry.source.osm.split('/')[1]}`
  ids.add(entry.id)
  out.push(entry)
  return entry
}
function entry({ type, name, parent, tags, osm, centroid, centroidSource, extra = {} }) {
  const { names, aliases } = namesFor(tags)
  const sqLabel = names.sq
  // Albanian Wikipedia titles a town by its definite form (Durrësi, Kamza,
  // Shkodra); so, often, does the Wikidata Albanian label. Either is used
  // when it is plainly the definite form of this name: same stem, ending in
  // -a/-i/-u, at most two letters longer. Otherwise the grammar rule.
  const item = tags.wikidata ? wd[tags.wikidata] : null
  const stem = fold(name).slice(0, Math.max(3, fold(name).length - 2))
  const isDefinite = (v) => v && v !== name && !/^Bashkia /.test(v) && fold(v).startsWith(stem) && /[aiu]$/.test(v) && v.length - name.length <= 2
  const wikiTitle = item?.sqwiki?.replace(/\s*\(.*\)$/, '').replace(/,.*$/, '')
  const definite = [wikiTitle, sqLabel].find(isDefinite) ?? definiteByRule(name)
  const definiteSource = definite === wikiTitle ? 'sq.wikipedia' : definite === sqLabel && definite !== name ? 'wikidata' : 'rule'
  names.sq = name
  const folded = fold(name)
  for (const v of [definite, folded, fold(definite), ...Object.values(names)]) aliases.add(v)
  aliases.delete(name)
  return {
    id: `${type}/${parent ? `${parent.id.split('/').slice(1).join('/')}/` : ''}${slugify(name)}`,
    slug: slugify(name),
    type,
    parent_id: parent?.id ?? null,
    name: { indefinite: name, definite, definite_source: definiteSource },
    names,
    aliases: [...aliases].filter(Boolean).sort(),
    centroid: centroid ? { lat: +centroid.lat.toFixed(6), lng: +centroid.lon.toFixed(6), source: centroidSource } : null,
    postal_code: tags.postal_code ?? tags['addr:postcode'] ?? null,
    ...extra,
    source: { osm, wikidata: tags.wikidata ?? null },
  }
}

const qarkEntries = new Map()
for (const q of qarqe.sort((a, b) => a.name.localeCompare(b.name, 'sq'))) {
  const seat = bashki.find((b) => b.name === q.name)?.seat
  qarkEntries.set(q, add(entry({
    type: 'qark', name: q.name, tags: q.e.tags, osm: `relation/${q.e.id}`,
    centroid: seat ?? interiorPoint(q.shape), centroidSource: seat ? 'seat town (OSM node)' : 'inside outline (OSM)',
    extra: { iso_3166_2: q.e.tags['ISO3166-2'] ?? null, official_name: q.e.tags.name },
  })))
}
const bashkiEntries = new Map()
for (const b of bashki.sort((a, b) => a.name.localeCompare(b.name, 'sq'))) {
  const seatTags = b.seat?.tags ?? {}
  const tags = { ...b.e.tags, ...(seatTags.wikidata ? { wikidata: seatTags.wikidata } : {}), postal_code: seatTags.postal_code ?? b.e.tags.postal_code }
  bashkiEntries.set(b, add(entry({
    type: 'bashki', name: b.name, parent: qarkEntries.get(b.qark), tags, osm: `relation/${b.e.id}`,
    centroid: b.seat ?? interiorPoint(b.shape), centroidSource: b.seat ? 'seat town (OSM node)' : 'inside outline (OSM)',
    extra: { official_name: `Bashkia ${b.name}`, seat: b.seat?.tags.name ?? null, municipality_wikidata: b.e.tags.wikidata ?? null },
  })))
  if (b.osmName !== b.name) bashkiEntries.get(b).aliases.push(b.osmName)
}
// A county takes the definite form of its seat (Qarku i Beratit: Berati).
for (const [q, e] of qarkEntries) {
  const seat = [...bashkiEntries.values()].find((b) => b.name.indefinite === q.name)
  if (seat) e.name = { ...e.name, definite: seat.name.definite, definite_source: seat.name.definite_source }
}
const unitEntries = new Map()
for (const u of units.filter((x) => x.bashki).sort((a, b) => a.name.localeCompare(b.name, 'sq'))) {
  const centre = u.e.members.find((m) => m.type === 'node' && m.role === 'admin_centre')
  const node = (centre && places.find((p) => p.id === centre.ref)) ??
    places.find((p) => p.unit === u && fold(p.tags.name) === fold(u.name))
  unitEntries.set(u, add(entry({
    type: 'njesi', name: u.name, parent: bashkiEntries.get(u.bashki), tags: u.e.tags, osm: `relation/${u.e.id}`,
    centroid: node ?? u.point, centroidSource: node ? 'unit centre (OSM node)' : 'inside outline (OSM)',
    extra: u.derived ? { note: 'OpenStreetMap has no outline for this unit: it is the municipality minus Paskuqan' } : {},
  })))
  const ue = unitEntries.get(u)
  // The unit named after its municipality's seat shares its definite form.
  const be = bashkiEntries.get(u.bashki)
  if (fold(u.name) === fold(be.name.indefinite)) ue.name = { ...ue.name, definite: be.name.definite, definite_source: be.name.definite_source }
  if (u.osmName && u.osmName !== u.name && !ue.aliases.includes(u.osmName)) ue.aliases.push(u.osmName)
}

// Lagje and villages: in full for the main markets, plus anything the app
// already offers that was verified (added by validate.mjs through `keep`).
const keep = new Set(fs.existsSync(path.join(CACHE, 'keep-places.json')) ? read('keep-places.json') : [])
for (const p of places.sort((a, b) => a.tags.name.localeCompare(b.tags.name, 'sq'))) {
  if (!p.unit || TOWN.has(p.tags.place)) continue
  const main = MAIN_MARKETS.includes(p.bashki?.name) && (LAGJE.has(p.tags.place) || p.tags.place === 'village')
  if (!main && !keep.has(p.id)) continue
  // A village that is its own unit's centre is already the unit.
  if (fold(p.tags.name) === fold(p.unit.name) && !LAGJE.has(p.tags.place)) continue
  add(entry({
    type: LAGJE.has(p.tags.place) ? 'lagje' : 'fshat', name: p.tags.name, parent: unitEntries.get(p.unit), tags: p.tags,
    osm: `node/${p.id}`, centroid: p, centroidSource: 'OSM node', extra: { osm_place: p.tags.place },
  }))
}

for (const e of lagjeAreas) {
  const unit = units.find((u) => u.inside(e.center.lat, e.center.lon))
  if (!unit) continue
  add(entry({
    type: 'lagje', name: e.tags.name, parent: unitEntries.get(unit), tags: e.tags,
    osm: `relation/${e.id}`, centroid: e.center, centroidSource: 'OSM boundary centre', extra: { osm_place: `admin_level ${e.tags.admin_level}` },
  }))
}

// Places the app offers that OpenStreetMap maps as an area rather than a
// point (found through Nominatim by validate.mjs).
const extra = fs.existsSync(path.join(CACHE, 'keep-extra.json')) ? read('keep-extra.json') : []
for (const x of extra) {
  const unit = units.find((u) => u.inside(x.lat, x.lon))
  if (!unit) continue
  add(entry({
    type: LAGJE.has(x.osm_place) ? 'lagje' : 'fshat', name: x.name, parent: unitEntries.get(unit), tags: {},
    osm: x.osm, centroid: { lat: x.lat, lon: x.lon }, centroidSource: 'OSM area centre (Nominatim)', extra: { osm_place: x.osm_place },
  }))
}

// ---------- checks ----------
for (const e of out) {
  const c = e.centroid
  if (c && (c.lat < 39.6 || c.lat > 42.7 || c.lng < 19.2 || c.lng > 21.1)) problems.push(`${e.id}: centroid outside Albania's box`)
}
const counts = out.reduce((m, e) => ((m[e.type] = (m[e.type] ?? 0) + 1), m), {})
const dataset = {
  about: 'Real Albanian places: 12 qarqe, 61 bashki (Law 115/2014), their njësi administrative, and lagje/villages for the main markets. Built by scripts/locations/build-dataset.mjs from OpenStreetMap and Wikidata; see docs/locations/SOURCES.md.',
  snapshot: SNAPSHOT,
  languages: LANGS,
  names_note: 'names holds only sourced names; a language that is missing uses the Albanian name. name.definite_source "rule" means the definite form follows the Albanian grammar rule, no source gave it.',
  counts,
  locations: out,
}
fs.writeFileSync(path.join(root, 'data', 'albania-locations.json'), `${JSON.stringify(dataset, null, 1)}\n`)
fs.writeFileSync(path.join(CACHE, 'hierarchy-problems.json'), JSON.stringify(problems, null, 1))
console.log('counts', counts)
console.log(`problems (${problems.length}):`)
for (const p of problems) console.log(' ', p)
export { kamezLevel9, lagjeAreas, out as LOCATIONS_OUT, units, bashki, places, km, contains, bashkiEntries, unitEntries, TOWN, LAGJE }
