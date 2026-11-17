// Turns what is on the Search screen into a saved search. Pure, for `npm test`;
// the phone app imports it through fromFilters.d.ts.

const present = (v) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)

/** A saved search's filters from the Search screen's. Unset values are left out. */
export function savedFromFilters(f) {
  const city = String(f?.city ?? '').trim()
  const candidates = {
    city,
    zone: f?.zone,
    listing_type: f?.listingType,
    type: f?.propertyType,
    minPrice: f?.minPrice,
    maxPrice: f?.maxPrice,
    beds: f?.beds,
    baths: f?.baths,
    minArea: f?.minArea,
    maxArea: f?.maxArea,
    features: f?.features,
  }
  return Object.fromEntries(Object.entries(candidates).filter(([, v]) => present(v)))
}

/** The same search always gives the same key, however it was written. */
export function savedKey(saved) {
  const entries = Object.entries(saved ?? {}).filter(([, v]) => present(v))
  return JSON.stringify(entries.sort(([a], [b]) => a.localeCompare(b)))
}

export const hasFacets = (saved) => Object.keys(saved ?? {}).length > 0

/** A readable default name. `t` is passed in, so this stays free of i18next. */
export function savedLabel(saved, t) {
  const parts = [
    saved.city,
    saved.zone,
    saved.listing_type ? t(`search.${saved.listing_type}`) : null,
    saved.type ? t(`search.${saved.type}`) : null,
    saved.beds ? `${saved.beds}+` : null,
    ...(saved.features ?? []).slice(0, 2).map((f) => t(`listing.feature.${f}`)),
  ].filter(Boolean)
  return (parts.join(' · ') || t('search.filtersTitle')).slice(0, 120)
}
