// Price-range search across currencies, shared by the website and the phone
// app (and mirrored in supabase/functions/saved-search-alerts/logic.js).
//
// A listing is priced in EUR, ALL or USD (both listing forms offer all three),
// but a search's min and max are euros: the fields show €. Comparing the raw
// numbers hid a 15,000,000 ALL flat (about €150,000) from a "max 200,000"
// search and let 150,000 ALL (about €1,500) through a "min 100,000" one. The
// bounds are converted into each listing currency instead.

/**
 * Units of each currency per euro. Reference rates for search only: they are
 * never shown and never price anything. A search range is a rough cut, so a
 * few percent of drift does not matter; update them if the lek or the dollar
 * moves much further.
 */
export const UNITS_PER_EUR = Object.freeze({ EUR: 1, ALL: 98, USD: 1.15 })

const bound = (value) => {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * The PostgREST `or` expression for a price range given in euros, or null
 * when neither bound is set. A listing with no currency, or one not listed
 * above, is compared as euros, which is how formatPrice shows it.
 */
export function priceRangeExpression(minEur, maxEur) {
  const min = bound(minEur)
  const max = bound(maxEur)
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

/** Adds a price range in euros to a Supabase query on `properties`. */
export function applyPriceRange(query, { minPrice, maxPrice } = {}) {
  const expression = priceRangeExpression(minPrice, maxPrice)
  return expression ? query.or(expression) : query
}
