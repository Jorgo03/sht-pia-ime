// The one place both apps resolve, search and check locations: names typed
// any way (Tirana, tirane, Durazzo, Peshkopia, "blloku") resolve to the
// canonical city and zone from data/locations.js, and a pin is checked
// against Albania and its own municipality before a listing is saved. The
// database repeats the same checks (supabase/pending/locations.sql), so a
// client that skips them still cannot save a fake place.
import { CITIES } from '../data/locations.js'

/** Lowercase, no diacritics, hyphens as spaces: "Kodër-Kamëz" -> "koder kamez". */
export function fold(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-‐–]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Albania's bounding box (docs/locations: lat 39.6–42.7, lng 19.2–21.1). */
export const ALBANIA_BOX = Object.freeze({ minLat: 39.6, maxLat: 42.7, minLng: 19.2, maxLng: 21.1 })
/** A pin may sit this far (in degrees, about 1 km) outside its municipality's box. */
const BOX_MARGIN = 0.01

const byKey = new Map()
for (const c of CITIES) {
  for (const k of [fold(c.city), fold(c.label), ...c.keys]) if (k && !byKey.has(k)) byKey.set(k, c)
}

/** The city entry for a name or alias, or null. */
export function findCity(name) {
  const k = fold(name)
  return k ? byKey.get(k) ?? null : null
}

/** "Tirana" -> "Tiranë", "Durazzo" -> "Durrës", "Dibër" -> "Peshkopi"; unknown -> null. */
export function resolveCity(name) {
  return findCity(name)?.city ?? null
}

/** How a city is shown in a picker: "Peshkopi (Dibër)" when the municipality has another name. */
export function cityLabel(city) {
  return findCity(city)?.label ?? String(city ?? '')
}

/** A zone of the city, by name or alias ("lapraka", "Laprakë"), or null. */
export function findZone(city, zone) {
  const c = findCity(city)
  const k = fold(zone)
  if (!c || !k) return null
  return c.zones.find((z) => fold(z.name) === k) ?? c.zones.find((z) => z.keys.includes(k)) ?? null
}

/** The canonical zone name, or null when it is not a zone of that city. */
export function resolveZone(city, zone) {
  return findZone(city, zone)?.name ?? null
}

/** The public.locations id a listing in this city (and zone) points at. */
export function locationIdFor(city, zone) {
  const c = findCity(city)
  if (!c) return null
  return (zone && findZone(c.city, zone)?.id) || c.id
}

/**
 * Autocomplete over cities and zones: every word typed must start a word of
 * the name or one of its aliases. Cities first, then zones; at most `limit`.
 * Each result: { city, zone, label } (zone null for a city).
 */
export function searchPlaces(term, { limit = 8, city: within = null } = {}) {
  const words = fold(term).split(' ').filter(Boolean)
  if (!words.length) return []
  const hit = (keys) => keys.some((k) => {
    const parts = k.split(' ')
    return words.every((w) => parts.some((p) => p.startsWith(w)))
  })
  const out = []
  const scope = within ? [findCity(within)].filter(Boolean) : CITIES
  if (!within) {
    for (const c of scope) if (hit([fold(c.city), ...c.keys])) out.push({ city: c.city, zone: null, label: c.label })
  }
  for (const c of scope) {
    for (const z of c.zones) {
      if (out.length >= limit * 3) break
      if (hit([fold(z.name), ...z.keys])) out.push({ city: c.city, zone: z.name, label: `${z.name}, ${c.city}` })
    }
  }
  return out.slice(0, limit)
}

/**
 * Is this pin plausible for the chosen city?
 * 'ok' | 'missing' (no pin) | 'outside-albania' | 'outside-city' (outside the
 * box of the city's municipality, with a small margin).
 */
export function checkPin(city, lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) return 'missing'
  const A = ALBANIA_BOX
  if (lat < A.minLat || lat > A.maxLat || lng < A.minLng || lng > A.maxLng) return 'outside-albania'
  const c = findCity(city)
  if (c?.bbox) {
    const [minLat, minLng, maxLat, maxLng] = c.bbox
    if (lat < minLat - BOX_MARGIN || lat > maxLat + BOX_MARGIN || lng < minLng - BOX_MARGIN || lng > maxLng + BOX_MARGIN) return 'outside-city'
  }
  return 'ok'
}

/** The city's centre, for a map that has no pin yet. */
export function cityCentre(city) {
  const c = findCity(city)
  return c ? { latitude: c.lat, longitude: c.lng } : null
}
