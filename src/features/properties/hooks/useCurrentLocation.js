import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

const CACHE_KEY = 'fho_geo_city'
const CACHE_MS = 6 * 60 * 60 * 1000 // 6h — location doesn't need to be fresher than this

function readCache(lang) {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
    if (cached && cached.lang === lang && Date.now() - cached.at < CACHE_MS) return cached.city
  } catch {
    // corrupt cache — ignore, refetch
  }
  return null
}

// Real "where the user actually is" for diaspora/foreign users, not a
// hardcoded city — but only on request. Geolocation is a permission prompt,
// so this never fires on its own; the caller must call requestLocation()
// from a tap (e.g. a "detect my location" button), matching the same
// no-API-key stack (Geolocation + OpenStreetMap Nominatim) the Leaflet map
// already uses, so no Edge Function proxy is needed.
export function useCurrentLocation() {
  const { i18n } = useTranslation()
  const [city, setCity] = useState(() => readCache(i18n.language))
  // 'idle' | 'requesting' | 'resolved' | 'denied' | 'unavailable' | 'error'
  const [status, setStatus] = useState(() => (city ? 'resolved' : 'idle'))

  useEffect(() => {
    const cached = readCache(i18n.language)
    setCity(cached)
    setStatus(cached ? 'resolved' : 'idle')
  }, [i18n.language])

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) { setStatus('unavailable'); return }
    setStatus('requesting')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords
          const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=10&accept-language=${i18n.language}`
          const r = await fetch(url, { headers: { Accept: 'application/json' } })
          if (!r.ok) { setStatus('error'); return }
          const data = await r.json()
          const resolved = data.address?.city || data.address?.town || data.address?.village || data.address?.municipality
          if (resolved) {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ city: resolved, lang: i18n.language, at: Date.now() }))
            setCity(resolved)
            setStatus('resolved')
          } else {
            setStatus('unavailable')
          }
        } catch {
          setStatus('error')
        }
      },
      () => setStatus('denied'),
      { timeout: 8000, maximumAge: CACHE_MS },
    )
  }, [i18n.language])

  return { city, status, requestLocation }
}
