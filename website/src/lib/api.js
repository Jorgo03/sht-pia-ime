// Public listing reads for the website. Same columns, filters and ordering as
// the phone app (data/properties.ts), through the same shared helpers, so a
// search here and in the app return the same homes.
import { supabase } from './supabase'
import { HIGHLIGHT_CITIES, joinAgents, tallyAgents } from '@/src/features/properties/lib/discovery.js'
import { applyPriceRange } from '@/src/features/properties/lib/priceRange.js'
import { applyFreeText, applyZoneAndRef } from '@/src/features/properties/lib/searchFilters.js'
import { AMENITIES } from '@/src/features/properties/lib/amenities.js'
import { propertyOrNotFound } from '@/src/features/properties/lib/propertyResult.js'

export const PAGE_SIZE = 24

const LIST_COLUMNS =
  'id, agent_id, title, title_i18n, price, currency, address, city, zone, sqft, beds, baths, property_type, listing_type, image_urls, latitude, longitude, created_at'

const SORTS = {
  newest: { column: 'created_at', ascending: false },
  price_asc: { column: 'price', ascending: true },
  price_desc: { column: 'price', ascending: false },
}

/** URL search params → the app's filter shape. Unknown or junk values are dropped. */
export function filtersFromParams(params) {
  const num = (k) => {
    const n = Number(params.get(k))
    return Number.isFinite(n) && n > 0 ? n : undefined
  }
  const deal = params.get('deal')
  const sort = params.get('sort')
  return {
    city: params.get('city') || undefined,
    propertyType: params.get('type') || undefined,
    listingType: deal === 'sale' || deal === 'rent' ? deal : undefined,
    zone: params.get('zone') || undefined,
    refCode: params.get('ref') || undefined,
    beds: num('beds'),
    baths: num('baths'),
    minArea: num('area'),
    maxArea: num('maxArea'),
    minPrice: num('min'),
    maxPrice: num('max'),
    features: (params.get('features') || '').split(',').filter((f) => AMENITIES.includes(f)),
    sort: SORTS[sort] ? sort : 'newest',
  }
}

function applyFilters(q, f) {
  if (f.propertyType) q = q.eq('property_type', f.propertyType)
  if (f.listingType) q = q.eq('listing_type', f.listingType)
  q = applyFreeText(q, f.city)
  q = applyPriceRange(q, f)
  if (f.beds != null) q = q.gte('beds', f.beds)
  if (f.baths != null) q = q.gte('baths', f.baths)
  if (f.minArea != null) q = q.gte('sqft', f.minArea)
  if (f.maxArea != null) q = q.lte('sqft', f.maxArea)
  if (f.features?.length) q = q.contains('features', f.features)
  // Zone only with its own city; a reference is exact (shared with the app).
  q = applyZoneAndRef(q, { city: f.city, zone: f.zone, ref: f.refCode })
  if (f.bounds) {
    q = q.not('latitude', 'is', null).gte('latitude', f.bounds.minLat).lte('latitude', f.bounds.maxLat).gte('longitude', f.bounds.minLng).lte('longitude', f.bounds.maxLng)
  }
  return q
}

export async function getProperties(f = {}, offset = 0, limit = PAGE_SIZE) {
  const order = SORTS[f.sort ?? 'newest']
  const { data, error } = await applyFilters(
    supabase
      .from('properties')
      .select(LIST_COLUMNS)
      .eq('status', 'active')
      .order(order.column, { ascending: order.ascending })
      .order('id', { ascending: true }),
    f,
  ).range(offset, offset + limit - 1)
  if (error) throw error
  return data ?? []
}

export async function getPropertiesCount(f = {}) {
  const { count, error } = await applyFilters(
    supabase.from('properties').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    f,
  )
  if (error) throw error
  return count ?? 0
}

/** Every highlighted city with its live count and newest photo, in the list's order. */
export async function getCityTiles() {
  return Promise.all(
    HIGHLIGHT_CITIES.map(async (city) => {
      const { data, count, error } = await applyFreeText(
        supabase
          .from('properties')
          .select('image_urls', { count: 'exact' })
          .eq('status', 'active')
          .order('created_at', { ascending: false }),
        city,
      ).limit(1)
      if (error) throw error
      return { city, count: count ?? 0, photo: data?.[0]?.image_urls?.[0] ?? null }
    }),
  )
}

/** Agents and agencies with live listings (profiles.role is not public). */
// Supabase answers at most 1000 rows per request, and a long id list in the
// address can pass the URL limit, so both reads go in pages.
const ROW_PAGE = 1000
const ID_CHUNK = 100
const MAX_DIRECTORY_ROWS = 50000

export async function getAgentDirectory() {
  const rows = []
  for (let from = 0; from < MAX_DIRECTORY_ROWS; from += ROW_PAGE) {
    const { data, error } = await supabase
      .from('properties')
      .select('agent_id')
      .eq('status', 'active')
      .not('agent_id', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + ROW_PAGE - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if ((data ?? []).length < ROW_PAGE) break
  }
  const tally = tallyAgents(rows)
  if (tally.length === 0) return []
  const ids = tally.map((a) => a.id)
  const chunks = []
  for (let i = 0; i < ids.length; i += ID_CHUNK) chunks.push(ids.slice(i, i + ID_CHUNK))
  const results = await Promise.all(
    chunks.map((chunk) => supabase.from('profiles').select('id, full_name, agency_name, avatar_url').in('id', chunk)),
  )
  const failed = results.find((r) => r.error)
  if (failed) throw failed.error
  return joinAgents(tally, results.flatMap((r) => r.data ?? []))
}

/**
 * One listing with its agent; null when it is gone, thrown when offline.
 * No status filter: the database already shows a paused, sold or held listing
 * only to its owner, its agent and moderators, so they can still open it.
 */
export async function getProperty(id) {
  // Not a listing id at all (an old or mistyped link): not found, without a
  // request the database would refuse.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id))) return null
  // maybeSingle: a listing that is gone is an empty answer, not a 406 error.
  const res = await supabase
    .from('properties')
    .select('*, agent:profiles(id, full_name, phone, agency_name, avatar_url)')
    .eq('id', id)
    .maybeSingle()
  // Not a listing id at all (an old or mistyped link): not found, not an error.
  if (res.error?.code === '22P02') return null
  return propertyOrNotFound(res)
}

/** Listings with a map position inside the view, at most 200, like the app's map. */
export async function getMapProperties(f = {}) {
  const { data, error } = await applyFilters(
    supabase.from('properties').select(LIST_COLUMNS).eq('status', 'active').order('created_at', { ascending: false }),
    f,
  ).limit(200)
  if (error) throw error
  return (data ?? []).filter((p) => p.latitude != null && p.longitude != null)
}

/** Active listings by id, in the order given (Recently viewed). */
export async function getPropertiesByIds(ids) {
  if (!ids.length) return []
  const { data, error } = await supabase.from('properties').select(LIST_COLUMNS).in('id', ids).eq('status', 'active')
  if (error) throw error
  const byId = new Map((data ?? []).map((p) => [p.id, p]))
  return ids.map((id) => byId.get(id)).filter(Boolean)
}
