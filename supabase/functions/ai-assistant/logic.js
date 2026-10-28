// Pure logic for the Shtëpia.ime assistant (docs/AI_ASSISTANT.md): no Deno, no
// network, no database. index.ts does the I/O; tests/aiAssistant.test.mjs runs
// this file under Node.
//
// The model never writes queries. It calls a handful of tools with structured
// criteria; everything here validates those criteria against the real schema
// (supabase/migrations, properties table) and turns them into the same kind
// of PostgREST filters the apps use (data/properties.ts applyFilters).

export const LISTING_TYPES = ['sale', 'rent', 'daily_rent']
export const PROPERTY_TYPES = ['apartment', 'house', 'villa', 'land', 'commercial', 'office', 'garage']
/** The amenities a listing can carry (app/listing/new.tsx FEATURES_LIST, plus legacy heating). */
export const FEATURES = ['balcony', 'parking', 'elevator', 'garden', 'pool', 'furnished', 'airConditioning', 'heating', 'security', 'storage']
export const SORTS = ['relevance', 'newest', 'price_asc', 'price_desc', 'area_desc', 'price_per_m2_asc']

/**
 * Units of each currency per euro, for search ranges and rough comparison
 * only. Copied from src/features/properties/lib/priceRange.js, because this
 * function is deployed on its own; tests/aiAssistant.test.mjs keeps the two
 * identical.
 */
export const UNITS_PER_EUR = Object.freeze({ EUR: 1, ALL: 98, USD: 1.15 })

export const LIMITS = Object.freeze({
  messageChars: 1000,
  historyTurns: 12,
  results: 6,
  candidates: 40,
  detailIds: 4,
  compareIds: 4,
  stateIds: 24,
  modelCalls: 6,
  descriptionChars: 700,
})

/** Screens the assistant may point to (app/ routes). Anything else is dropped. */
export const SCREENS = Object.freeze({
  explore: '/explore',
  favorites: '/favorites',
  saved_searches: '/saved-searches',
  messages: '/messages',
  viewings: '/viewings',
  create_listing: '/listing/create',
  my_listings: '/my-listings',
  agent_dashboard: '/agent-dashboard',
  leads: '/leads',
  profile: '/profile',
  privacy: '/privacy',
  terms: '/terms',
})

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** PostgREST treats these as syntax inside filter values; text never carries them through. */
const cleanText = (v, max) =>
  typeof v === 'string'
    ? v.replace(/[,()*%_\\:."'`;{}[\]<>|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
    : ''

const num = (v, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n) || n < min || n > max) return null
  return n
}

export const isUuid = (v) => typeof v === 'string' && UUID.test(v)

const uniqueIds = (ids, max) => [...new Set((Array.isArray(ids) ? ids : []).filter(isUuid).map((s) => s.toLowerCase()))].slice(0, max)

/**
 * Model (or client) criteria -> criteria safe to query with. Unknown keys and
 * values outside the schema are dropped, never passed on. Budgets come in the
 * currency the person named and are kept in euros, like the apps' search.
 */
export function normalizeCriteria(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const out = {}
  if (LISTING_TYPES.includes(r.listing_type)) out.listing_type = r.listing_type
  if (PROPERTY_TYPES.includes(r.property_type)) out.property_type = r.property_type
  const city = cleanText(r.city, 60)
  if (city) out.city = city
  const zone = cleanText(r.zone, 80)
  if (zone) out.zone = zone

  const rate = Object.hasOwn(UNITS_PER_EUR, r.currency) ? UNITS_PER_EUR[r.currency] : 1
  const eur = (v) => {
    const n = num(v, { min: 0, max: 1e10 })
    return n === null ? null : Math.round(n / rate)
  }
  let min = eur(r.min_price)
  let max = eur(r.max_price)
  if (min !== null && max !== null && min > max) [min, max] = [max, min]
  if (min !== null && min > 0) out.min_price_eur = min
  if (max !== null && max > 0) out.max_price_eur = max

  let minA = num(r.min_area, { min: 1, max: 100000 })
  let maxA = num(r.max_area, { min: 1, max: 100000 })
  if (minA !== null && maxA !== null && minA > maxA) [minA, maxA] = [maxA, minA]
  if (minA !== null) out.min_area = Math.round(minA)
  if (maxA !== null) out.max_area = Math.round(maxA)

  const beds = num(r.min_beds, { min: 0, max: 20 })
  if (beds !== null) out.min_beds = Math.round(beds)
  const exactBeds = num(r.beds, { min: 0, max: 20 })
  if (exactBeds !== null) out.beds = Math.round(exactBeds)
  const baths = num(r.min_baths, { min: 0, max: 20 })
  if (baths !== null) out.min_baths = baths
  const fMin = num(r.min_floor, { min: -5, max: 200 })
  if (fMin !== null) out.min_floor = Math.round(fMin)
  const fMax = num(r.max_floor, { min: -5, max: 200 })
  if (fMax !== null) out.max_floor = Math.round(fMax)

  const feats = (list) => [...new Set((Array.isArray(list) ? list : []).filter((f) => FEATURES.includes(f)))]
  const required = feats(r.required_features)
  if (required.length) out.required_features = required
  const preferred = feats(r.preferred_features).filter((f) => !required.includes(f))
  if (preferred.length) out.preferred_features = preferred

  const keywords = cleanText(r.keywords, 60)
  if (keywords.length >= 3) out.keywords = keywords
  if (isUuid(r.near_property_id)) {
    out.near_property_id = r.near_property_id.toLowerCase()
    out.radius_km = num(r.radius_km, { min: 0.2, max: 25 }) ?? 2
  }
  if (isUuid(r.exclude_property_id)) out.exclude_property_id = r.exclude_property_id.toLowerCase()
  if (SORTS.includes(r.sort)) out.sort = r.sort
  return out
}

const CRITERIA_KEYS = ['listing_type', 'property_type', 'city', 'zone', 'min_price_eur', 'max_price_eur', 'min_area', 'max_area', 'min_beds', 'beds', 'min_baths', 'min_floor', 'max_floor', 'required_features', 'preferred_features', 'keywords', 'near_property_id', 'radius_km', 'exclude_property_id', 'sort']

/**
 * A follow-up ("po me ashensor?") keeps the earlier search and changes only
 * what the person changed. `remove` names criteria to drop ("pa kufi çmimi").
 * A new search ("tani dua një vilë") starts from nothing.
 */
export function mergeCriteria(previous, next, { mode = 'refine', remove = [] } = {}) {
  const prev = mode === 'new' ? {} : { ...(previous ?? {}) }
  for (const key of Array.isArray(remove) ? remove : []) {
    if (key === 'price') { delete prev.min_price_eur; delete prev.max_price_eur }
    else if (key === 'area') { delete prev.min_area; delete prev.max_area }
    else if (key === 'location') { delete prev.city; delete prev.zone; delete prev.near_property_id; delete prev.radius_km }
    else if (CRITERIA_KEYS.includes(key)) delete prev[key]
  }
  const merged = { ...prev, ...next }
  if (next.required_features || prev.required_features) {
    merged.required_features = [...new Set([...(prev.required_features ?? []), ...(next.required_features ?? [])])]
  }
  if (next.preferred_features || prev.preferred_features) {
    merged.preferred_features = [...new Set([...(prev.preferred_features ?? []), ...(next.preferred_features ?? [])])]
      .filter((f) => !(merged.required_features ?? []).includes(f))
  }
  for (const k of ['required_features', 'preferred_features']) if (merged[k] && !merged[k].length) delete merged[k]
  return merged
}

/** PostgREST `or` for a euro price range across listing currencies (same as priceRange.js). */
export function priceRangeExpression(minEur, maxEur) {
  const min = minEur ?? null
  const max = maxEur ?? null
  if (min === null && max === null) return null
  const range = (rate) =>
    [min === null ? null : `price.gte.${Math.round(min * rate)}`, max === null ? null : `price.lte.${Math.round(max * rate)}`]
      .filter(Boolean)
      .join(',')
  const codes = Object.keys(UNITS_PER_EUR)
  return [
    ...codes.map((code) => `and(currency.eq.${code},${range(UNITS_PER_EUR[code])})`),
    `and(currency.is.null,${range(1)})`,
    `and(currency.not.in.(${codes.join(',')}),${range(1)})`,
  ].join(',')
}

/** Degrees of latitude/longitude spanning `km` around a point (a box, not a circle). */
export function boundsAround(lat, lng, km) {
  const dLat = km / 111
  const dLng = km / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)))
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng }
}

/**
 * Criteria -> predicates on a supabase-js query of `properties`. Only active,
 * non-held listings; RLS still applies on top because index.ts queries as the
 * caller. `anchor` is the near_property_id listing's coordinates, when known.
 */
export function applyCriteria(query, c, anchor) {
  let q = query.eq('status', 'active').eq('moderation_hold', false)
  if (c.listing_type) q = q.eq('listing_type', c.listing_type)
  if (c.property_type) q = q.eq('property_type', c.property_type)
  if (c.city) q = q.ilike('city', `%${c.city}%`)
  if (c.zone) q = q.ilike('zone', `%${c.zone}%`)
  const price = priceRangeExpression(c.min_price_eur, c.max_price_eur)
  if (price) q = q.or(price)
  if (c.min_area != null) q = q.gte('sqft', c.min_area)
  if (c.max_area != null) q = q.lte('sqft', c.max_area)
  if (c.beds != null) q = q.eq('beds', c.beds)
  else if (c.min_beds != null) q = q.gte('beds', c.min_beds)
  if (c.min_baths != null) q = q.gte('baths', c.min_baths)
  if (c.min_floor != null) q = q.gte('floor', c.min_floor)
  if (c.max_floor != null) q = q.lte('floor', c.max_floor)
  if (c.required_features?.length) q = q.contains('features', c.required_features)
  if (c.keywords) q = q.or(`title.ilike.%${c.keywords}%,description.ilike.%${c.keywords}%,zone.ilike.%${c.keywords}%`)
  if (c.exclude_property_id) q = q.neq('id', c.exclude_property_id)
  if (anchor && Number.isFinite(anchor.latitude) && Number.isFinite(anchor.longitude)) {
    const b = boundsAround(anchor.latitude, anchor.longitude, c.radius_km ?? 2)
    q = q.gte('latitude', b.minLat).lte('latitude', b.maxLat).gte('longitude', b.minLng).lte('longitude', b.maxLng)
  }
  return q
}

export const priceInEur = (row) => {
  const p = Number(row?.price)
  if (!Number.isFinite(p)) return null
  return p / (UNITS_PER_EUR[row?.currency] ?? 1)
}

/** Price per m² in the listing's own currency, or null without a usable area. */
export const pricePerM2 = (row) => {
  const p = Number(row?.price)
  const a = Number(row?.sqft)
  if (!Number.isFinite(p) || !Number.isFinite(a) || a <= 0) return null
  return Math.round(p / a)
}

/**
 * Hard criteria are already enforced by the query; this orders what came
 * back by how well it fits the preferences, and says why. Keyword-stuffed
 * descriptions earn nothing: only structured fields count.
 */
export function rankResults(rows, c) {
  const pref = c.preferred_features ?? []
  const scored = (rows ?? []).map((row) => {
    const features = Array.isArray(row.features) ? row.features : []
    const matched = []
    const missing = []
    let score = 0
    for (const f of pref) {
      if (features.includes(f)) { score += 2; matched.push(f) } else missing.push(f)
    }
    const eur = priceInEur(row)
    if (c.max_price_eur && eur != null) score += Math.max(0, 1 - eur / c.max_price_eur) // room left in the budget
    if (c.min_beds != null && row.beds != null) score += row.beds === c.min_beds ? 0.5 : 0
    if (row.image_urls?.length) score += 0.3
    if (row.sqft == null) score -= 0.2
    return { row, score, matched, missing }
  })
  const sort = c.sort ?? 'relevance'
  const by = {
    relevance: (a, b) => b.score - a.score || Date.parse(b.row.created_at) - Date.parse(a.row.created_at),
    newest: (a, b) => Date.parse(b.row.created_at) - Date.parse(a.row.created_at),
    price_asc: (a, b) => (priceInEur(a.row) ?? Infinity) - (priceInEur(b.row) ?? Infinity),
    price_desc: (a, b) => (priceInEur(b.row) ?? -Infinity) - (priceInEur(a.row) ?? -Infinity),
    area_desc: (a, b) => (b.row.sqft ?? -1) - (a.row.sqft ?? -1),
    price_per_m2_asc: (a, b) => (perM2Eur(a.row) ?? Infinity) - (perM2Eur(b.row) ?? Infinity),
  }[sort]
  return scored.sort(by)
}

const perM2Eur = (row) => {
  const e = priceInEur(row)
  const a = Number(row?.sqft)
  return e != null && a > 0 ? e / a : null
}

/** What a card may show: public listing fields only, no owner or contact data. */
export function cardFor(row) {
  return {
    id: row.id,
    title: row.title,
    title_i18n: row.title_i18n ?? null,
    price: row.price,
    currency: row.currency ?? 'EUR',
    listing_type: row.listing_type,
    property_type: row.property_type,
    city: row.city ?? null,
    zone: row.zone ?? null,
    address: row.address ?? null,
    sqft: row.sqft ?? null,
    beds: row.beds ?? null,
    baths: row.baths ?? null,
    floor: row.floor ?? null,
    total_floors: row.total_floors ?? null,
    features: Array.isArray(row.features) ? row.features : [],
    image_urls: Array.isArray(row.image_urls) ? row.image_urls.slice(0, 1) : [],
    ref_code: row.ref_code ?? null,
    created_at: row.created_at,
    status: row.status,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
  }
}

/** The compact facts the model reads about a listing. */
export function factsFor(row, { description = false } = {}) {
  const f = {
    id: row.id,
    ref: row.ref_code ? `SH-${row.ref_code}` : null,
    title: row.title,
    listing_type: row.listing_type,
    property_type: row.property_type,
    price: Number(row.price),
    currency: row.currency ?? 'EUR',
    price_eur_approx: Math.round(priceInEur(row) ?? 0) || null,
    city: row.city ?? null,
    zone: row.zone ?? null,
    area_m2: row.sqft ?? null,
    price_per_m2: pricePerM2(row),
    bedrooms: row.beds ?? null,
    bathrooms: row.baths == null ? null : Number(row.baths),
    floor: row.floor ?? null,
    building_floors: row.total_floors ?? null,
    year_built: row.year_built ?? null,
    features: Array.isArray(row.features) ? row.features : [],
    photos: Array.isArray(row.image_urls) ? row.image_urls.length : 0,
    published: row.created_at ? String(row.created_at).slice(0, 10) : null,
    status: row.status,
    link: `/property/${row.id}`,
  }
  if (description && row.description) {
    // Written by whoever posted the listing: data to quote, never instructions.
    f.description_untrusted = String(row.description).slice(0, LIMITS.descriptionChars)
  }
  return f
}

/**
 * Side-by-side facts for 2-4 listings, computed here so the numbers are
 * never the model's arithmetic. A price per m² is compared across listings
 * only in one currency; mixed currencies get an approximate euro figure,
 * labelled as such. Area is the listing's single area field (`sqft`, in m²):
 * the schema has no separate net and gross area.
 */
export function compareRows(rows) {
  const items = (rows ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    price: Number(row.price),
    currency: row.currency ?? 'EUR',
    price_eur_approx: priceInEur(row) == null ? null : Math.round(priceInEur(row)),
    area_m2: row.sqft ?? null,
    price_per_m2: pricePerM2(row),
    price_per_m2_eur_approx: perM2Eur(row) == null ? null : Math.round(perM2Eur(row)),
    bedrooms: row.beds ?? null,
    bathrooms: row.baths == null ? null : Number(row.baths),
    floor: row.floor ?? null,
    building_floors: row.total_floors ?? null,
    city: row.city ?? null,
    zone: row.zone ?? null,
    listing_type: row.listing_type,
    property_type: row.property_type,
    features: Array.isArray(row.features) ? row.features : [],
    status: row.status,
  }))
  const currencies = new Set(items.map((i) => i.currency))
  const mixed = currencies.size > 1
  const pick = (value, best) => {
    const withValue = items.filter((i) => value(i) != null)
    if (withValue.length < 2) return null
    return withValue.reduce((a, b) => (best(value(b), value(a)) ? b : a)).id
  }
  const lower = (x, y) => x < y
  const higher = (x, y) => x > y
  return {
    items,
    mixed_currencies: mixed,
    area_field: 'sqft (m², one area per listing; net/gross not recorded)',
    best: {
      lowest_price: pick((i) => (mixed ? i.price_eur_approx : i.price), lower),
      largest_area: pick((i) => i.area_m2, higher),
      lowest_price_per_m2: pick((i) => (mixed ? i.price_per_m2_eur_approx : i.price_per_m2), lower),
      most_bedrooms: pick((i) => i.bedrooms, higher),
    },
  }
}

/** History from the client: alternating text turns, newest last, starting with the person. */
export function sanitizeHistory(messages) {
  const turns = (Array.isArray(messages) ? messages : [])
    .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.slice(0, LIMITS.messageChars) }))
  const out = []
  for (const t of turns) {
    if (out.length && out[out.length - 1].role === t.role) out[out.length - 1] = t
    else out.push(t)
  }
  const recent = out.slice(-LIMITS.historyTurns)
  while (recent.length && recent[0].role !== 'user') recent.shift()
  return recent
}

/** The conversation state the client echoes back: criteria and the listings in play. */
export function sanitizeState(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}
  return {
    criteria: normalizeStoredCriteria(r.criteria),
    result_ids: uniqueIds(r.result_ids, LIMITS.results * 2),
    seen_ids: uniqueIds(r.seen_ids, LIMITS.stateIds),
  }
}

/** Stored criteria are already in euros; re-validate without converting again. */
function normalizeStoredCriteria(raw) {
  if (!raw || typeof raw !== 'object') return {}
  const c = normalizeCriteria({ ...raw, min_price: raw.min_price_eur, max_price: raw.max_price_eur, currency: 'EUR' })
  return c
}

// ---------------------------------------------------------------- the tools

const criteriaSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    listing_type: { type: 'string', enum: LISTING_TYPES, description: 'sale, rent (monthly) or daily_rent' },
    property_type: { type: 'string', enum: PROPERTY_TYPES, description: 'commercial = business premises/shop' },
    city: { type: 'string', description: 'City in Albanian spelling, e.g. Tiranë, Durrës, Vlorë' },
    zone: { type: 'string', description: 'Neighbourhood, e.g. Blloku, Plazh, Ali Demi' },
    min_price: { type: 'number' },
    max_price: { type: 'number' },
    currency: { type: 'string', enum: ['EUR', 'ALL', 'USD'], description: 'Currency of min_price/max_price as the person said it' },
    min_area: { type: 'number', description: 'm²' },
    max_area: { type: 'number', description: 'm²' },
    min_beds: { type: 'number', description: 'At least this many bedrooms. "2+1" = 2 bedrooms.' },
    beds: { type: 'number', description: 'Exactly this many bedrooms, only when the person insists on exactly' },
    min_baths: { type: 'number' },
    min_floor: { type: 'number' },
    max_floor: { type: 'number' },
    required_features: { type: 'array', items: { type: 'string', enum: FEATURES }, description: 'Must-haves' },
    preferred_features: { type: 'array', items: { type: 'string', enum: FEATURES }, description: 'Nice-to-haves (ranked, not filtered)' },
    keywords: { type: 'string', description: 'One short phrase to look for in title/description/zone, e.g. "qendër", "pamje nga deti"' },
    near_property_id: { type: 'string', description: 'Listing id to search around (needs its map location)' },
    radius_km: { type: 'number' },
    exclude_property_id: { type: 'string' },
    sort: { type: 'string', enum: SORTS },
  },
}

export const TOOLS = [
  {
    name: 'search_properties',
    description:
      'Search the live Shtëpia.ime listings. mode "refine" keeps the current criteria (shown in the context) and changes only what you pass; ' +
      'mode "new" starts over. Use remove to drop criteria (e.g. ["price"], ["required_features"], ["location"]). Returns up to 6 ranked listings and the total number of matches.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        mode: { type: 'string', enum: ['refine', 'new'] },
        criteria: criteriaSchema,
        remove: { type: 'array', items: { type: 'string' } },
      },
      required: ['mode', 'criteria'],
    },
  },
  {
    name: 'get_properties',
    description: 'Current facts (and the owner-written description) for up to 4 listings by id, e.g. the listing the person is viewing or "the first one".',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: { ids: { type: 'array', items: { type: 'string' } } },
      required: ['ids'],
    },
  },
  {
    name: 'compare_properties',
    description: 'Side-by-side comparison of 2-4 listings by id with prices, area, price per m², rooms, floor and amenities computed from the database. The app shows it as a table.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: { ids: { type: 'array', items: { type: 'string' } } },
      required: ['ids'],
    },
  },
  {
    name: 'show_properties',
    description: 'Show listings to the person as cards, in this order. Only ids returned by a tool in this conversation. Call this whenever you recommend or list listings.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: { ids: { type: 'array', items: { type: 'string' } } },
      required: ['ids'],
    },
  },
  {
    name: 'open_screen',
    description: 'Offer a button that opens a screen of the app.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: { screen: { type: 'string', enum: Object.keys(SCREENS) } },
      required: ['screen'],
    },
  },
]

/**
 * One turn of the conversation. `callModel(messages)` returns an Anthropic
 * message; `db` has search(criteria, anchor, limit) -> {rows, count},
 * byIds(ids) -> rows, anchorFor(id) -> {latitude, longitude} | null. Both are
 * injected so this runs the same in tests and in the Edge Function.
 */
export async function runTurn({ history, state, contextPropertyId, language, callModel, db }) {
  const st = sanitizeState(state)
  const known = new Set([...st.seen_ids, ...st.result_ids])
  if (isUuid(contextPropertyId)) known.add(contextPropertyId.toLowerCase())
  let criteria = st.criteria
  let resultIds = st.result_ids
  let shown = []
  let searchedThisTurn = false
  let comparison = null
  const screens = []

  const LANGS = { sq: 'Albanian', en: 'English', it: 'Italian', de: 'German', es: 'Spanish', fr: 'French', pl: 'Polish', ru: 'Russian' }
  const contextLines = [
    `App language: ${LANGS[language] ?? 'Albanian'} (reply in the language the person writes in).`,
    `Current search criteria (euros): ${JSON.stringify(criteria)}`,
    `Listings from the last search, in order (1 = "e para"): ${resultIds.join(', ') || 'none'}`,
    isUuid(contextPropertyId) ? `The person is viewing listing ${contextPropertyId} right now ("kjo pronë").` : null,
  ].filter(Boolean)
  const turns = sanitizeHistory(history)
  if (!turns.length || turns[turns.length - 1].role !== 'user') return { error: 'empty_query' }
  const last = turns.pop()
  const messages = [
    ...turns,
    { role: 'user', content: [{ type: 'text', text: `<app_context>\n${contextLines.join('\n')}\n</app_context>` }, { type: 'text', text: last.content }] },
  ]

  const runTool = async (name, input) => {
    if (name === 'search_properties') {
      const next = normalizeCriteria(input?.criteria)
      criteria = mergeCriteria(criteria, next, { mode: input?.mode === 'new' ? 'new' : 'refine', remove: input?.remove })
      const anchor = criteria.near_property_id ? await db.anchorFor(criteria.near_property_id) : null
      if (criteria.near_property_id && !anchor) return { error: 'near_property_has_no_location', criteria }
      const { rows, count } = await db.search(criteria, anchor, LIMITS.candidates)
      const ranked = rankResults(rows, criteria).slice(0, LIMITS.results)
      resultIds = ranked.map((r) => r.row.id)
      searchedThisTurn = true
      ranked.forEach((r) => known.add(r.row.id))
      return {
        criteria_used: criteria,
        total_matches: count ?? rows.length,
        results: ranked.map((r, i) => ({ position: i + 1, ...factsFor(r.row), matches_preferences: r.matched, lacks_preferences: r.missing })),
      }
    }
    if (name === 'get_properties' || name === 'compare_properties') {
      const max = name === 'get_properties' ? LIMITS.detailIds : LIMITS.compareIds
      const ids = uniqueIds(input?.ids, max)
      if (!ids.length) return { error: 'no_valid_ids' }
      const rows = await db.byIds(ids)
      rows.forEach((r) => known.add(r.id))
      const found = new Set(rows.map((r) => r.id))
      const unavailable = ids.filter((id) => !found.has(id))
      if (name === 'get_properties') {
        return { properties: rows.map((r) => factsFor(r, { description: true })), not_found_or_unavailable: unavailable }
      }
      if (rows.length < 2) return { error: 'need_two_available_listings', not_found_or_unavailable: unavailable }
      comparison = compareRows(rows)
      return { ...comparison, not_found_or_unavailable: unavailable }
    }
    if (name === 'show_properties') {
      const ids = uniqueIds(input?.ids, LIMITS.results).filter((id) => known.has(id))
      shown = ids
      return { shown: ids.length, ignored_unknown_ids: uniqueIds(input?.ids, LIMITS.results).length - ids.length }
    }
    if (name === 'open_screen') {
      if (!Object.hasOwn(SCREENS, input?.screen)) return { error: 'unknown_screen' }
      if (!screens.includes(input.screen)) screens.push(input.screen)
      return { ok: true }
    }
    return { error: 'unknown_tool' }
  }

  let reply = ''
  for (let call = 0; call < LIMITS.modelCalls; call++) {
    const response = await callModel(messages)
    if (response.stop_reason === 'refusal') return { error: 'refused' }
    const blocks = Array.isArray(response.content) ? response.content : []
    const toolUses = blocks.filter((b) => b.type === 'tool_use')
    const text = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('').trim()
    if (text) reply = text
    if (response.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: blocks })
      continue
    }
    if (response.stop_reason !== 'tool_use' || !toolUses.length) break
    // Thinking blocks go back unchanged, in order, with the tool calls.
    messages.push({ role: 'assistant', content: blocks })
    const results = []
    for (const use of toolUses) {
      let out
      try {
        out = await runTool(use.name, use.input)
      } catch {
        out = { error: 'tool_failed' }
      }
      results.push({ type: 'tool_result', tool_use_id: use.id, content: JSON.stringify(out), ...(out?.error ? { is_error: true } : {}) })
    }
    messages.push({ role: 'user', content: results })
    reply = ''
  }
  if (!reply) return { error: 'no_reply' }

  // Cards are rebuilt from the database here, never from the model's words.
  // A search the model ran but did not present still shows its results.
  const cardIds = shown.length ? shown : searchedThisTurn ? resultIds : []
  const cardRows = cardIds.length ? await db.byIds(cardIds) : []
  const byId = new Map(cardRows.map((r) => [r.id, r]))
  const cards = cardIds.map((id) => byId.get(id)).filter(Boolean).map(cardFor)

  return {
    reply,
    cards,
    comparison,
    screens: screens.map((key) => ({ key, route: SCREENS[key] })),
    state: {
      criteria,
      result_ids: resultIds,
      seen_ids: [...known].slice(-LIMITS.stateIds),
    },
  }
}
