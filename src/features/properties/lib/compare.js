// Comparing homes side by side. Pure, for `npm test`; the phone app imports it
// through compare.d.ts.

export const MAX_COMPARE = 3

/** Adds or removes an id. A full list comes back unchanged. */
export function toggleCompareId(ids, id, max = MAX_COMPARE) {
  if (ids.includes(id)) return ids.filter((x) => x !== id)
  return ids.length >= max ? ids : [...ids, id]
}

/** The saved list, or nothing when it is unreadable. */
export function parseCompareIds(raw, max = MAX_COMPARE) {
  try {
    const ids = JSON.parse(raw)
    if (!Array.isArray(ids)) return []
    return [...new Set(ids.filter((id) => typeof id === 'string' && id))].slice(0, max)
  } catch {
    return []
  }
}

/** Price per m², for sales only: on a rental the figure means nothing. */
export function pricePerM2(home) {
  const price = Number(home.price)
  const area = Number(home.sqft)
  return home.listing_type === 'sale' && price > 0 && area > 0 ? Math.round(price / area) : null
}

/** The one home that wins, or null on a tie or with fewer than two to compare. */
function winner(homes, value, better) {
  const scored = homes.map((home) => ({ id: home.id, score: value(home) })).filter((x) => x.score != null && x.score > 0)
  if (scored.length < 2) return null
  const top = scored.reduce((a, b) => (better(b.score, a.score) ? b : a))
  return scored.filter((x) => x.score === top.score).length === 1 ? top.id : null
}

const lower = (a, b) => a < b
const higher = (a, b) => a > b

/**
 * The best home on each measure. Prices are only ranked between homes of the
 * same kind in the same currency: a monthly rent is not "cheaper" than a sale,
 * and 15,000,000 lek is not more than €150,000.
 */
export function bestOf(homes) {
  const sameCurrency = new Set(homes.map((h) => h.currency || 'EUR')).size === 1
  const sameKind = new Set(homes.map((h) => h.listing_type)).size === 1
  return {
    price: sameCurrency && sameKind ? winner(homes, (h) => Number(h.price), lower) : null,
    perM2: sameCurrency ? winner(homes, pricePerM2, lower) : null,
    area: winner(homes, (h) => Number(h.sqft) || null, higher),
    beds: winner(homes, (h) => Number(h.beds) || null, higher),
  }
}

/** Every feature any of the homes has, each once, in a stable order. */
export function allFeatures(homes) {
  return [...new Set(homes.flatMap((h) => h.features ?? []))].sort()
}
