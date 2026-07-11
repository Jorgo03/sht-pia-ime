import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'

const PAGE_SIZE = 20

const SORTS = {
  newest: { column: 'created_at', ascending: false },
  price_asc: { column: 'price', ascending: true },
  price_desc: { column: 'price', ascending: false },
}

function buildQuery({ filter, listingType, city, minPrice, maxPrice, beds, sort }) {
  const order = SORTS[sort] || SORTS.newest
  let query = supabase
    .from('properties')
    .select('*')
    .eq('status', 'active')
    .order(order.column, { ascending: order.ascending })

  if (filter && filter !== 'all') query = query.eq('property_type', filter)
  if (listingType) query = query.eq('listing_type', listingType)
  if (city) query = query.ilike('city', `%${city}%`)
  if (minPrice != null) query = query.gte('price', minPrice)
  if (maxPrice != null) query = query.lte('price', maxPrice)
  if (beds != null) query = query.gte('beds', beds)
  return query
}

export function useProperties({ filter = 'all', listingType = null, city = null, minPrice = null, maxPrice = null, beds = null, paginate = false, limit = null, sort = 'newest' } = {}) {
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    const query = buildQuery({ filter, listingType, city, minPrice, maxPrice, beds, sort })
    const limited = paginate ? query.range(0, PAGE_SIZE - 1) : limit ? query.limit(limit) : query

    limited.then(({ data, error: err }) => {
      if (!active) return
      if (err) setError(err.message)
      else {
        setProperties(data || [])
        setHasMore(paginate && (data || []).length === PAGE_SIZE)
      }
      setLoading(false)
    })

    return () => { active = false }
  }, [filter, listingType, city, minPrice, maxPrice, beds, paginate, limit, sort])

  const loadMore = useCallback(() => {
    if (!paginate || loadingMore || !hasMore) return
    setLoadingMore(true)

    const query = buildQuery({ filter, listingType, city, minPrice, maxPrice, beds, sort })
    query.range(properties.length, properties.length + PAGE_SIZE - 1)
      .then(({ data }) => {
        const newItems = data || []
        setProperties(prev => [...prev, ...newItems])
        setHasMore(newItems.length === PAGE_SIZE)
        setLoadingMore(false)
      })
  }, [filter, listingType, city, minPrice, maxPrice, beds, paginate, sort, loadingMore, hasMore, properties.length])

  return { properties, loading, loadingMore, error, hasMore, loadMore }
}

export function usePropertiesByIds(ids = []) {
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)

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
  }, [JSON.stringify(ids)])

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
      .single()
      .then(({ data, error: err }) => {
        if (!active) return
        if (err) setError(err.message)
        else setProperty(data)
        setLoading(false)
      })

    return () => { active = false }
  }, [id])

  return { property, loading, error }
}
