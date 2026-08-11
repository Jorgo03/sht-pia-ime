// Shared between the collapsed FilterBar and the expanded Filtrat sheet so the
// two tiers can never offer different options for the same filter.

// Matches the `property_type` check constraint on public.properties. The
// constraint also permits 'commercial' and 'garage'; they are intentionally not
// offered in search yet — add them here when the listing form starts using them.
export const PROPERTY_TYPES = ['apartment', 'villa', 'house', 'land', 'office']

// null = "any". Top value is rendered as "N+" since the query is a `gte`.
export const BED_OPTIONS = [null, 1, 2, 3, 4]
export const BATH_OPTIONS = [null, 1, 2, 3, 4]

// Price is an open-ended range: it starts at €10,000 and has no upper bound —
// an empty max means "no ceiling", so the query simply omits the `lte`.
// Deliberately no slider and no PRICE_MAX: a slider needs a finite top end,
// which would silently cap what the user can search for.
export const PRICE_MIN = 10000
export const PRICE_STEP = 1000

// Surface is stored in properties.sqft but holds m².  Deliberately no slider:
// the listing form allows up to 100,000 m², so any slider bound wide enough to
// be correct would be useless at residential scale.
export const AREA_MAX = 100000

// TODO: id/referenca filter — not implemented yet. It belongs here as a plain
// text param, and in the bar between Cmimi max and Sip min.
// TODO: zona — needs a `zone` column on properties plus capture in NewListing
// before it can filter anything. Options list already exists in ./locations.js.
