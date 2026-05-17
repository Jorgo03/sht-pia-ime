import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useProperties({ filter = 'all', listingType = null, city = null, minPrice = null, maxPrice = null, beds = null } = {}) {
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    let query = supabase
      .from('properties')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (filter && filter !== 'all') {
      query = query.eq('property_type', filter)
    }
    if (listingType) {
      query = query.eq('listing_type', listingType)
    }
    if (city) {
      query = query.ilike('city', `%${city}%`)
    }
    if (minPrice != null) {
      query = query.gte('price', minPrice)
    }
    if (maxPrice != null) {
      query = query.lte('price', maxPrice)
    }
    if (beds != null) {
      query = query.gte('beds', beds)
    }

    query.then(({ data, error: err }) => {
      if (!active) return
      if (err) setError(err.message)
      else setProperties(data || [])
      setLoading(false)
    })

    return () => { active = false }
  }, [filter, listingType, city, minPrice, maxPrice, beds])

  return { properties, loading, error }
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
