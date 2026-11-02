import { useState, useEffect } from 'react'
import { translatePropertyContent } from '../../../lib/translate'

const cache = {}

// Keyed by the source text too, so an agent's edit is translated afresh
// instead of showing the old title's translation for the rest of the session.
function cacheKey(propertyId, lang, title, description) {
  return `${propertyId}:${lang}:${title}\u0000${description}`
}

export function useTranslatedProperty(property, language) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [translating, setTranslating] = useState(false)
  const [isTranslated, setIsTranslated] = useState(false)

  // Plain values, not the property object: the row is re-fetched into a new
  // object identity on every list refresh, which would re-trigger a
  // translation request for text that has not changed.
  const id = property?.id
  const origTitle = property?.title || ''
  const origDesc = property?.description || ''
  const storedTitle = property?.title_i18n?.[language]
  const storedDesc = property?.description_i18n?.[language]

  useEffect(() => {
    if (!id) return
    // A reply for an older listing or language must not overwrite this one.
    let current = true

    if (language === 'sq') {
      setTitle(storedTitle || origTitle)
      setDescription(storedDesc || origDesc)
      setIsTranslated(false)
      setTranslating(false)
      return
    }

    // Prefer translations stored by the listing wizard (title_i18n /
    // description_i18n) — no network call needed when both exist.
    if ((storedTitle || !origTitle) && (storedDesc || !origDesc)) {
      setTitle(storedTitle || origTitle)
      setDescription(storedDesc || origDesc)
      setIsTranslated(Boolean(storedTitle || storedDesc))
      setTranslating(false)
      return
    }

    const key = cacheKey(id, language, origTitle, origDesc)
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
        const translatedTitle = origTitle ? result.title || origTitle : ''
        const translatedDesc = origDesc ? result.description || origDesc : ''

        // Still a correct translation of its own text, so keep it even if
        // the screen has moved on.
        cache[key] = { title: translatedTitle, description: translatedDesc }
        if (!current) return
        setTitle(translatedTitle)
        setDescription(translatedDesc)
        setIsTranslated(true)
        setTranslating(false)
      })
      .catch(() => {
        // The original text is already on screen from the setState above, so a
        // failure degrades to untranslated rather than to an empty card.
        if (!current) return
        setTranslating(false)
      })
    return () => { current = false }
  }, [id, language, origTitle, origDesc, storedTitle, storedDesc])

  return { title, description, translating, isTranslated }
}
