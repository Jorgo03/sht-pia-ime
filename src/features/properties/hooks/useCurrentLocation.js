import { useEffect, useState } from 'react'
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
// hardcoded city. Client-side geolocation + OpenStreetMap Nominatim reverse
// geocoding (same no-API-key stack as the Leaflet maps already in this app,
// so no Edge Function proxy needed). Silent on denial/timeout/failure — the
// caller just gets null and omits the location segment.
export function useCurrentLocation() {
  const { i18n } = useTranslation()
  const [city, setCity] = useState(() => readCache(i18n.language))

  useEffect(() => {
    const cached = readCache(i18n.language)
    if (cached) { setCity(cached); return }
    if (!navigator.geolocation) return

    let cancelled = false
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords
          const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=10&accept-language=${i18n.language}`
          const r = await fetch(url, { headers: { Accept: 'application/json' } })
          if (!r.ok || cancelled) return
          const data = await r.json()
          const resolved = data.address?.city || data.address?.town || data.address?.village || data.address?.municipality
          if (resolved) {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ city: resolved, lang: i18n.language, at: Date.now() }))
            setCity(resolved)
          }
        } catch {
          // network/parse failure — leave city as null
        }
      },
      () => { /* permission denied or unavailable — leave city as null */ },
      { timeout: 8000, maximumAge: CACHE_MS },
    )
    return () => { cancelled = true }
  }, [i18n.language])

  return city
}
