// Zone and reference-number search (docs/LAUNCH_TASKS.md F19), shared by the
// website and the phone app so both read, show and query them the same way.
import LOCATIONS, { CITIES } from '../data/locations.js'
import { findCity, fold, resolveZone } from './places.js'

/**
 * Case- and diacritic-insensitive form: "TIRANA" / "Tiranë" / "tirane" all
 * become "tirane". People type the road/city name partially and without the
 * right ë/ç — exact matching made the zone list vanish until the full
 * official name was typed.
 */
function norm(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

/**
 * Zones for a city. Exact (normalized) match first; otherwise a partial
 * prefix/substring city ("Tir", "tirane") returns the matched cities' zones
 * so the zone dropdown appears while typing instead of after the full name.
 * An unrelated name ("Atlantis") still returns [].
 */
export function zonesFor(city) {
  const wanted = norm(city)
  if (!wanted) return []
  // Any name or alias of a city: "Tirana", "Durazzo", "Dibër" (Peshkopi).
  const known = findCity(city)
  if (known) return LOCATIONS.find((l) => l.city === known.city)?.zones ?? []
  if (wanted.length < 2) return []
  const seen = new Set()
  const out = []
  for (const l of LOCATIONS) {
    const name = norm(l.city)
    if (name.startsWith(wanted) || name.includes(wanted)) {
      for (const z of l.zones) {
        if (!seen.has(z)) {
          seen.add(z)
          out.push(z)
        }
      }
    }
  }
  return out
}

/**
 * A zone only counts when it belongs to the chosen city. Accepts partial
 * road/zone names ("Kavaj", "rruga e kavajes" without diacritics) and
 * resolves them to the canonical zone, so typing part of a road name filters
 * instead of being silently dropped. A partial that matches more than one
 * different zone (e.g. "Qendër" exists in many cities) stays null unless the
 * city narrows it to one.
 */
export function validZone(city, zone) {
  if (!zone) return null
  const wanted = norm(zone)
  if (!wanted) return null
  // A zone's own name or alias ("Laprakë" for Lapraka) first.
  const known = city ? resolveZone(city, zone) : null
  if (known) return known
  const candidates = city ? zonesFor(city) : []
  const pool = candidates.length ? candidates : LOCATIONS.flatMap((l) => l.zones)
  const exact = pool.find((z) => norm(z) === wanted)
  if (exact) return exact
  if (wanted.length >= 2) {
    const hits = [...new Set(pool.filter((z) => {
      const n = norm(z)
      return n.startsWith(wanted) || n.includes(wanted)
    }))]
    if (hits.length === 1) return hits[0]
    // "Bllok" matches Blloku and Blloku Gintash: the one the others extend.
    const base = hits.find((h) => hits.every((o) => norm(o).startsWith(norm(h))))
    if (base) return base
  }
  return null
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

/**
 * Free-text search must find a road/zone partial ("Kavaj") as well as a full
 * city name. The old query did `ilike('city', '%term%')` only, so typing part
 * of a road name matched nothing because road names live in `zone` /
 * `address`, not `city`. Searching all three with OR makes "Kavaj" return
 * listings in "Rruga e Kavajës". PostgREST's `or()` syntax splits on commas
 * and parentheses and treats %/_ as wildcards, so those are stripped — a term
 * that survives empty (only wildcards) applies no filter at all.
 */
export function cleanFreeText(term) {
  return String(term ?? '')
    .replace(/[%_,()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function freeTextFilter(term) {
  const cleaned = cleanFreeText(term)
  if (!cleaned) return null
  const p = `%${cleaned}%`
  const parts = [`city.ilike.${p}`, `zone.ilike.${p}`, `address.ilike.${p}`]
  // A city or zone typed any way ("tirana", "Durazzo", "lapraka") also finds
  // the listings stored under its canonical name, which ilike alone misses
  // when the diacritics differ ("tirane" is not a substring of "Tiranë").
  // Only when the ilike would miss it: the canonical name already contains
  // what was typed, letter for letter, needs nothing extra.
  const missed = (name) => !name.toLowerCase().includes(cleaned.toLowerCase())
  const city = findCity(cleaned)
  if (city && missed(city.city)) parts.push(`city.eq."${city.city}"`)
  const k = fold(cleaned)
  const zones = new Set()
  for (const c of CITIES) for (const z of c.zones) if ((fold(z.name) === k || z.keys.includes(k)) && missed(z.name)) zones.add(z.name)
  for (const z of zones) parts.push(`zone.eq."${z}"`)
  return parts.join(',')
}

export function applyFreeText(query, term) {
  const filter = freeTextFilter(term)
  if (!filter) return query
  return query.or(filter)
}
