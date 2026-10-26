// Pure sanitizers for AI edge-function responses. Only pure imports, so this
// module can be unit-tested with `node --test`.

import { UNITS_PER_EUR } from '../features/properties/lib/priceRange.js'

const LISTING_TYPES = ['sale', 'rent', 'daily_rent']
const PROPERTY_TYPES = ['apartment', 'villa', 'house', 'land', 'commercial', 'office', 'garage']

function positiveNumber(v, max) {
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0 || n > max) return null
  return Math.round(n)
}

// Raw model output -> filters safe to write into the Search page URL params.
// Returns null when nothing usable was extracted.
export function sanitizeSearchFilters(raw) {
  if (!raw || typeof raw !== 'object') return null
  const out = {}

  if (typeof raw.city === 'string' && raw.city.trim()) {
    out.city = raw.city.trim().slice(0, 60)
  }
  if (LISTING_TYPES.includes(raw.listing_type)) out.listing = raw.listing_type
  if (PROPERTY_TYPES.includes(raw.property_type)) out.type = raw.property_type

  // The search fields are euros. A query in lekë or dollars ("deri 15 milionë
  // lekë") comes back in that currency and is converted here, with the same
  // reference rates the price filter uses. An unknown currency counts as euros.
  const rate = Object.hasOwn(UNITS_PER_EUR, raw.currency) ? UNITS_PER_EUR[raw.currency] : 1
  const inEur = (v) => (v == null ? null : Math.max(1, Math.round(v / rate)))
  const min = inEur(positiveNumber(raw.min_price, 100_000_000 * rate))
  const max = inEur(positiveNumber(raw.max_price, 100_000_000 * rate))
  if (min != null) out.minPrice = String(min)
  if (max != null) out.maxPrice = String(max)
  if (min != null && max != null && min > max) {
    // Model swapped the bounds — trust the values, fix the order.
    out.minPrice = String(max)
    out.maxPrice = String(min)
  }

  const beds = positiveNumber(raw.beds, 20)
  if (beds != null) out.beds = String(beds)

  return Object.keys(out).length > 0 ? out : null
}
