import { useState, useEffect, useRef } from 'react'
import { translatePropertyContent } from '../../../lib/translate'

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

    if (!origTitle && !origDesc) {
      setTranslating(false)
      return
    }

    // One request for both fields, into the viewer's language only. This was
    // two calls that each fanned out to all eight languages and discarded
    // seven — eight translations billed to render one card.
    translatePropertyContent({
      title: origTitle,
      description: origDesc,
      targetLanguage: language,
    })
      .then((result) => {
        if (!activeRef.current) return

        const translatedTitle = origTitle ? result.title || origTitle : ''
        const translatedDesc = origDesc ? result.description || origDesc : ''

        cache[key] = { title: translatedTitle, description: translatedDesc }
        setTitle(translatedTitle)
        setDescription(translatedDesc)
        setIsTranslated(true)
        setTranslating(false)
      })
      .catch(() => {
        // The original text is already on screen from the setState above, so a
        // failure degrades to untranslated rather than to an empty card.
        if (!activeRef.current) return
        setTranslating(false)
      })
  }, [property?.id, language])

  return { title, description, translating, isTranslated }
}
