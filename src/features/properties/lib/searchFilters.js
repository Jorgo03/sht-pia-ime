// Zone and reference-number search (docs/LAUNCH_TASKS.md F19), shared by the
// website and the phone app so both read, show and query them the same way.
import LOCATIONS from '../data/locations.js'

/** Zones of a city, or [] for an unknown / empty city. */
export function zonesFor(city) {
  return LOCATIONS.find((l) => l.city === city)?.zones ?? []
}

/** A zone only counts when it belongs to the chosen city. */
export function validZone(city, zone) {
  return Boolean(zone) && zonesFor(city).includes(zone) ? zone : null
}

/** "SH-1A2B3C4D" as shown on a listing, from the ref_code column. */
export function formatRef(refCode) {
  return refCode ? `SH-${refCode}` : ''
}

/**
 * What a person typed into the reference box, as a ref_code, or null.
 * Accepts "SH-1a2b3c4d", "1A2B 3C4D", "sh1a2b3c4d" or a pasted listing link.
 */
export function normalizeRef(input) {
  const raw = String(input ?? '').trim()
  if (!raw) return null
  // A pasted link: the listing id carries the reference.
  const id = raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
  if (id) return id[0].slice(0, 8).toUpperCase()
  const hex = raw.toUpperCase().replace(/^SH/, '').replace(/[^0-9A-F]/g, '')
  return hex.length === 8 ? hex : null
}

/**
 * Add zone and reference predicates to a Supabase query on `properties`.
 * A reference is exact and wins over everything else in the UI, but here it
 * simply narrows like any other filter.
 */
export function applyZoneAndRef(query, { city, zone, ref } = {}) {
  const z = validZone(city, zone)
  if (z) query = query.eq('zone', z)
  const r = normalizeRef(ref)
  if (r) query = query.eq('ref_code', r)
  return query
}
