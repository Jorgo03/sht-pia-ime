// Pure sanitizers for AI edge-function responses. No imports — keep this
// module dependency-free so it can be unit-tested with `node --test`.

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

  const min = positiveNumber(raw.min_price, 100_000_000)
  const max = positiveNumber(raw.max_price, 100_000_000)
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

// Raw model output -> { title, description } ready to drop into the wizard
// inputs. Highlights are folded into the description as plain lines.
export function sanitizeGeneratedListing(raw) {
  if (!raw || typeof raw !== 'object') return null
  const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, 120) : ''
  let description = typeof raw.description === 'string' ? raw.description.trim().slice(0, 4000) : ''
  if (!title || !description) return null

  const highlights = (Array.isArray(raw.highlights) ? raw.highlights : [])
    .filter((h) => typeof h === 'string' && h.trim())
    .slice(0, 5)
    .map((h) => `• ${h.trim().slice(0, 120)}`)
  if (highlights.length > 0) description = `${description}\n\n${highlights.join('\n')}`

  return { title, description }
}
