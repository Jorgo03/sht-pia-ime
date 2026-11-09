// The amenities an agent can tag and a buyer can search by. Pure, for
// `npm test`; the phone app imports it through amenities.d.ts.

// 'heating' is no longer offered (owner's call, 2026-10-15). Listings that
// already have it still show it: listing.feature.heating stays in the locales.
export const AMENITIES = ['balcony', 'parking', 'elevator', 'garden', 'pool', 'furnished', 'airConditioning', 'security', 'storage']

/** Adds or removes one, always in the list's own order so a search has one cache key. */
export function toggleAmenity(selected, amenity) {
  const current = selected ?? []
  const next = current.includes(amenity) ? current.filter((a) => a !== amenity) : [...current, amenity]
  return AMENITIES.filter((a) => next.includes(a))
}
