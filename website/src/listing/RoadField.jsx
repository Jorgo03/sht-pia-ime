import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin, Loader2 } from 'lucide-react'
import { searchRoads } from '@/src/lib/roadSearch.js'

const DEBOUNCE_MS = 450
const MIN_QUERY = 2

/**
 * Road/street input with suggestions for the selected city — web sibling of
 * components/listing/road-field.tsx.
 *
 * Two files rather than shared code, for the same reason lib/format.ts and
 * src/lib/format.js are two files: one renders <input> and <ul>, the other
 * renders <Field> and <Pressable>. What they genuinely share is the search and
 * filtering, and that IS shared — both import src/lib/roadSearch.js, so the
 * rules about what counts as a road live in exactly one place.
 *
 * The field stays plain text. Albanian addresses are frequently informal
 * ("prapa shkollës"), OSM coverage outside Tirana is patchy, and the product
 * has never required a road. Suggestions are an accelerator laid on top: pick
 * one and it fills itself in, ignore them and type whatever you like. Nothing
 * here can block a publish.
 */
export function RoadField({ value, onChange, city, onSelectRoad, placeholder }) {
  const { t } = useTranslation()
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  /** Set while a suggestion is being applied, so writing the name back into
   *  the field does not immediately search for it and reopen the list. */
  const justPickedRef = useRef(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (justPickedRef.current) {
      justPickedRef.current = false
      return
    }
    if (!open || !city || value.trim().length < MIN_QUERY) {
      setSuggestions([])
      setLoading(false)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    const timer = setTimeout(async () => {
      const roads = await searchRoads({ city, query: value, signal: controller.signal })
      if (controller.signal.aborted) return
      setSuggestions(roads)
      setLoading(false)
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
      // Leaving `loading` true here would strand a spinner when the effect is
      // torn down by the next keystroke; the new run sets it again immediately.
      setLoading(false)
    }
  }, [value, city, open])

  // A city change invalidates every suggestion on screen — they belong to the
  // previous city, and picking one would move the map to the wrong place.
  useEffect(() => {
    setSuggestions([])
    setOpen(false)
  }, [city])

  // Clicking anywhere else closes the list. Without this it stays open over the
  // map, which is exactly what the agent needs to see next.
  useEffect(() => {
    if (!open) return
    const onDocPointerDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDocPointerDown)
    return () => document.removeEventListener('pointerdown', onDocPointerDown)
  }, [open])

  const pick = (road) => {
    justPickedRef.current = true
    onChange(road.name)
    onSelectRoad(road)
    setSuggestions([])
    setOpen(false)
  }

  const showList = open && (loading || suggestions.length > 0)

  return (
    <div className="relative" ref={wrapRef}>
      <div className="relative">
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          className="w-full pr-10"
        />
        {loading && (
          <Loader2
            size={16}
            aria-hidden="true"
            className="rf-spin"
          />
        )}
      </div>

      {!city && <span className="nl-note">{t('listing.roadNeedsCity')}</span>}

      {showList && (
        // Overlaid rather than inline: pushing the map down the moment the list
        // appears moves the marker off screen just as it becomes relevant.
        <ul className="rf-list">
          {suggestions.map((road) => (
            <li key={`${road.name}-${road.latitude}-${road.longitude}`}>
              <button
                type="button"
                onClick={() => pick(road)}
                className="rf-item">
                <MapPin size={15} aria-hidden="true" className="rf-pin" />
                <span className="min-w-0">
                  <span className="rf-name">{road.name}</span>
                  {!!road.context && (
                    <span className="rf-context">{road.context}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
          {!loading && suggestions.length === 0 && (
            <li className="rf-empty">{t('listing.roadNoResults')}</li>
          )}
        </ul>
      )}
    </div>
  )
}
