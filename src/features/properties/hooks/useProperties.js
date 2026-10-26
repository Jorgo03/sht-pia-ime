import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { applyPriceRange } from '../lib/priceRange'
import { applyZoneAndRef } from '../lib/searchFilters'

const PAGE_SIZE = 24

const SORTS = {
  newest: { column: 'created_at', ascending: false },
  price_asc: { column: 'price', ascending: true },
  price_desc: { column: 'price', ascending: false },
}

// Filter predicates live in one place so the row query and the exact-count
// query can never drift apart.
// Zone and reference (F19): zone only counts with the city it belongs to;
// a reference is exact (properties.ref_code, see lib/searchFilters.js).
function applyFilters(query, { filter, listingType, city, zone, refCode, minPrice, maxPrice, beds, baths, minArea, maxArea }) {
  if (filter && filter !== 'all') query = query.eq('property_type', filter)
  if (listingType) query = query.eq('listing_type', listingType)
  if (city) query = query.ilike('city', `%${city}%`)
  // Euros, compared per listing currency (lib/priceRange.js).
  query = applyPriceRange(query, { minPrice, maxPrice })
  if (beds != null) query = query.gte('beds', beds)
  if (baths != null) query = query.gte('baths', baths)
  // `sqft` is the surface column; it stores m², which is what the UI labels it.
  if (minArea != null) query = query.gte('sqft', minArea)
  if (maxArea != null) query = query.lte('sqft', maxArea)
  return applyZoneAndRef(query, { city, zone, ref: refCode })
}

function buildQuery(filters) {
  const order = SORTS[filters.sort] || SORTS.newest
  return applyFilters(
    supabase
      .from('properties')
      .select('*')
      .eq('status', 'active')
      .order(order.column, { ascending: order.ascending })
      // Rows with the same price or date have no order of their own, so the
      // pages of one search could repeat or skip them; the id settles it.
      .order('id', { ascending: true }),
    filters,
  )
}

// head:true fetches no rows — only the exact match count, so the
// "Shfaq {N} prona" CTA can report the full result set rather than the
// 20 rows currently held in state.
function buildCountQuery(filters) {
  return applyFilters(
    supabase
      .from('properties')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
    filters,
  )
}

export function useProperties({ filter = 'all', listingType = null, city = null, zone = null, refCode = null, minPrice = null, maxPrice = null, beds = null, baths = null, minArea = null, maxArea = null, paginate = false, limit = null, sort = 'newest' } = {}) {
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadMoreFailed, setLoadMoreFailed] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  // Bumped whenever the filters change, so a "load more" page that was still
  // on its way for the previous filters is dropped instead of being appended
  // to the new results.
  const generation = useRef(0)

  useEffect(() => {
    let active = true
    generation.current += 1
    setLoading(true)
    setLoadingMore(false)
    setLoadMoreFailed(false)
    setError(null)

    const filters = { filter, listingType, city, zone, refCode, minPrice, maxPrice, beds, baths, minArea, maxArea, sort }
    const query = buildQuery(filters)
    const limited = paginate ? query.range(0, PAGE_SIZE - 1) : limit ? query.limit(limit) : query

    limited.then(({ data, error: err }) => {
      if (!active) return
      if (err) {
        // Same rule as useProperty(): the driver's text describes our schema
        // and is English-only, so it stays in the console for debugging and
        // the UI shows a localized message instead.
        console.error('useProperties failed:', err.message)
        setError(true)
      } else {
        setProperties(data || [])
        setHasMore(paginate && (data || []).length === PAGE_SIZE)
      }
      setLoading(false)
    })

    // Count runs alongside the rows; a count failure must not blank the list,
    // so it falls back to the number of rows actually loaded.
    buildCountQuery(filters).then(({ count, error: countErr }) => {
      if (!active) return
      setTotalCount(countErr ? 0 : (count ?? 0))
    })

    return () => { active = false }
  }, [filter, listingType, city, zone, refCode, minPrice, maxPrice, beds, baths, minArea, maxArea, paginate, limit, sort])

  const loadMore = useCallback(() => {
    if (!paginate || loadingMore || !hasMore) return
    const requested = generation.current
    setLoadingMore(true)
    setLoadMoreFailed(false)

    const query = buildQuery({ filter, listingType, city, zone, refCode, minPrice, maxPrice, beds, baths, minArea, maxArea, sort })
    query.range(properties.length, properties.length + PAGE_SIZE - 1)
      .then(({ data, error: err }) => {
        if (requested !== generation.current) return
        if (err) {
          // Keep hasMore, so the same button offers to try again.
          console.error('useProperties loadMore failed:', err.message)
          setLoadMoreFailed(true)
        } else {
          const newItems = data || []
          setProperties(prev => [...prev, ...newItems.filter(p => !prev.some(q => q.id === p.id))])
          setHasMore(newItems.length === PAGE_SIZE)
        }
        setLoadingMore(false)
      })
  }, [filter, listingType, city, zone, refCode, minPrice, maxPrice, beds, baths, minArea, maxArea, paginate, sort, loadingMore, hasMore, properties.length])

  return { properties, loading, loadingMore, loadMoreFailed, error, hasMore, loadMore, totalCount }
}

export function usePropertiesByIds(ids = []) {
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)

  // Callers pass a fresh array literal every render, so depending on `ids`
  // directly would refetch on every render. Keying on the serialized contents
  // is the intent; naming it also lets the linter check the dependency
  // statically instead of flagging an inline expression.
  const idsKey = JSON.stringify(ids)

  useEffect(() => {
    if (!ids.length) { setProperties([]); setLoading(false); return }
    let active = true
    setLoading(true)

    supabase
      .from('properties')
      .select('*')
      .in('id', ids)
      .then(({ data }) => {
        if (!active) return
        const map = new Map((data || []).map(p => [p.id, p]))
        setProperties(ids.map(id => map.get(id)).filter(Boolean))
        setLoading(false)
      })

    return () => { active = false }
    // `ids` itself is intentionally absent: idsKey above is its value-identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  return { properties, loading }
}

export function useProperty(id) {
  const [property, setProperty] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!id) return
    let active = true
    setLoading(true)

    supabase
      .from('properties')
      .select('*, agent:profiles(id, full_name, phone, agency_name, avatar_url)')
      .eq('id', id)
      // maybeSingle, not single: a listing that was deleted, or an id that
      // never existed, is a normal "not found" — not a failure. single()
      // rejects with PostgREST's PGRST116 there, which the page then rendered
      // verbatim as "Error: Cannot coerce the result to a single JSON object".
      // Anyone opening a stale or shared link to a removed listing saw raw
      // driver text, in English regardless of their language.
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (!active) return
        if (err) {
          // The real message stays available for debugging, but never reaches
          // the UI: it is untranslated and describes our database, not
          // anything the visitor can act on.
          console.error('useProperty failed:', err.message)
          setError(true)
        } else {
          setProperty(data)
        }
        setLoading(false)
      })

    return () => { active = false }
  }, [id])

  return { property, loading, error }
}
