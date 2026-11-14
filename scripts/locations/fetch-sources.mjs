// Downloads the raw sources for data/albania-locations.json into
// docs/locations/cache/ (not committed: the geometry alone is tens of MB).
// Each file is fetched once; delete it to fetch it again.
//
//   1. OpenStreetMap administrative areas of Albania, with outlines
//      (Overpass API): qarqe = admin_level 6, bashki = 7, njësi
//      administrative = 8.
//   2. OpenStreetMap named places (cities, towns, villages, suburbs,
//      neighbourhoods, quarters, hamlets), with coordinates and names.
//   3. Wikidata labels and aliases in the app's 8 languages, and the Albanian
//      Wikipedia article title, for every area and town with a wikidata id.
//
//   node scripts/locations/fetch-sources.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const DIR = path.join(root, 'docs', 'locations', 'cache')
const UA = 'ShtepiaIme-location-audit/1.0 (github.com/Jorgo03/sht-pia-ime)'
export const LANGS = ['sq', 'en', 'it', 'de', 'fr', 'es', 'pl', 'ru']
fs.mkdirSync(DIR, { recursive: true })

async function overpass(file, query) {
  const out = path.join(DIR, file)
  if (fs.existsSync(out)) return JSON.parse(fs.readFileSync(out, 'utf8'))
  let res
  // A busy server answers 429 or 504; wait and try again a few times.
  for (let attempt = 1; ; attempt++) {
    res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ data: query }),
    })
    if (res.ok || attempt === 4 || ![429, 502, 503, 504].includes(res.status)) break
    console.log(`${file}: ${res.status}, retrying`)
    await new Promise((r) => setTimeout(r, 30000 * attempt))
  }
  if (!res.ok) throw new Error(`Overpass ${res.status} for ${file}`)
  const text = await res.text()
  const json = JSON.parse(text)
  if (json.remark) throw new Error(`Overpass remark for ${file}: ${json.remark}`)
  fs.writeFileSync(out, text)
  console.log(`${file}: ${json.elements.length} elements`)
  return json
}

const AREA = 'area["ISO3166-1"="AL"][admin_level=2]->.a;'
const upper = await overpass('osm-admin-6-7.json', `[out:json][timeout:600];${AREA}rel(area.a)[boundary=administrative][admin_level~"^(6|7)$"];out geom;`)
const units = await overpass('osm-admin-8.json', `[out:json][timeout:600];${AREA}rel(area.a)[boundary=administrative][admin_level=8];out geom;`)
// OpenStreetMap maps Kamëz's two units (Kamëz, Paskuqan) one level lower.
const kamez = await overpass('osm-admin-9-kamez.json', `[out:json][timeout:300];${AREA}rel(area.a)[boundary=administrative][admin_level=9][name~"Kamëz"];out geom;`)
// Official lagje some towns map as boundaries (Shkodër's Partizani, Perash…).
const lagje = await overpass('osm-admin-9-10.json', `[out:json][timeout:300];${AREA}rel(area.a)[boundary=administrative][admin_level~"^(9|10)$"];out tags center;`)
const admin = { elements: [...upper.elements, ...units.elements, ...kamez.elements, ...lagje.elements] }
const places = await overpass('osm-places.json', `[out:json][timeout:300];${AREA}node(area.a)[place~"^(city|town|village|suburb|neighbourhood|quarter|hamlet)$"][name];out body;`)

const wdFile = path.join(DIR, 'wikidata.json')
const wd = fs.existsSync(wdFile) ? JSON.parse(fs.readFileSync(wdFile, 'utf8')) : {}
const ids = new Set()
for (const e of admin.elements) if (e.tags?.wikidata) ids.add(e.tags.wikidata)
for (const e of places.elements) if (['city', 'town'].includes(e.tags?.place) && e.tags.wikidata) ids.add(e.tags.wikidata)
const todo = [...ids].filter((id) => !wd[id])
for (let i = 0; i < todo.length; i += 50) {
  const batch = todo.slice(i, i + 50)
  const url = `https://www.wikidata.org/w/api.php?${new URLSearchParams({
    action: 'wbgetentities', ids: batch.join('|'), props: 'labels|aliases|sitelinks', sitefilter: 'sqwiki', languages: LANGS.join('|'), format: 'json',
  })}`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`Wikidata ${res.status}`)
  const json = await res.json()
  for (const [id, ent] of Object.entries(json.entities ?? {})) {
    wd[id] = {
      labels: Object.fromEntries(Object.entries(ent.labels ?? {}).map(([l, v]) => [l, v.value])),
      aliases: Object.fromEntries(Object.entries(ent.aliases ?? {}).map(([l, v]) => [l, v.map((a) => a.value)])),
      // Albanian Wikipedia titles a town by its definite form (Durrësi, Kamza).
      sqwiki: ent.sitelinks?.sqwiki?.title ?? null,
    }
  }
  fs.writeFileSync(wdFile, JSON.stringify(wd, null, 1))
  await new Promise((r) => setTimeout(r, 1000))
}
console.log(`wikidata: ${Object.keys(wd).length} items`)
