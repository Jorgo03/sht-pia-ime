import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const cache = {}

function cacheKey(propertyId, lang) {
  return `${propertyId}:${lang}`
}

export function useTranslatedProperty(property, language) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [translating, setTranslating] = useState(false)
  const [isTranslated, setIsTranslated] = useState(false)
  const activeRef = useRef(true)

  useEffect(() => {
    activeRef.current = true
    return () => { activeRef.current = false }
  }, [])

  useEffect(() => {
    if (!property) return

    const origTitle = property.title || ''
    const origDesc = property.description || ''

    if (language === 'sq') {
      setTitle(property.title_i18n?.sq || origTitle)
      setDescription(property.description_i18n?.sq || origDesc)
      setIsTranslated(false)
      setTranslating(false)
      return
    }

    // Prefer translations stored by the listing wizard (title_i18n /
    // description_i18n) — no network call needed when both exist.
    const storedTitle = property.title_i18n?.[language]
    const storedDesc = property.description_i18n?.[language]
    if ((storedTitle || !origTitle) && (storedDesc || !origDesc)) {
      setTitle(storedTitle || origTitle)
      setDescription(storedDesc || origDesc)
      setIsTranslated(Boolean(storedTitle || storedDesc))
      setTranslating(false)
      return
    }

    const key = cacheKey(property.id, language)
    if (cache[key]) {
      setTitle(cache[key].title)
      setDescription(cache[key].description)
      setIsTranslated(true)
      setTranslating(false)
      return
    }

    setTitle(origTitle)
    setDescription(origDesc)
    setTranslating(true)
    setIsTranslated(false)

    const texts = [origTitle, origDesc].filter(Boolean)
    if (texts.length === 0) {
      setTranslating(false)
      return
    }

    supabase.functions.invoke('translate-description', {
      body: { texts, targetLang: language },
    }).then(({ data, error }) => {
      if (!activeRef.current) return
      if (error || !data?.translations) {
        setTranslating(false)
        return
      }

      const t = data.translations
      const translatedTitle = origTitle ? (t[0] || origTitle) : ''
      const translatedDesc = origDesc ? (t[origTitle ? 1 : 0] || origDesc) : ''

      cache[key] = { title: translatedTitle, description: translatedDesc }
      setTitle(translatedTitle)
      setDescription(translatedDesc)
      setIsTranslated(true)
      setTranslating(false)
    })
  }, [property?.id, language])

  return { title, description, translating, isTranslated }
}
