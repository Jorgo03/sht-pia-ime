import { useEffect, useState } from 'react';

import { Property } from '@/data/types';
import { translatePropertyContent, type LangCode } from '@/lib/translate';

const cache: Record<string, { title: string; description: string }> = {};

// Keyed by the source text too, so an agent's edit is translated afresh
// instead of showing the old title's translation for the rest of the session.
function cacheKey(propertyId: string, lang: string, title: string, description: string): string {
  return `${propertyId}:${lang}:${title}\u0000${description}`;
}

interface TranslatedProperty {
  title: string;
  description: string;
  translating: boolean;
  isTranslated: boolean;
}

/**
 * Mirrors web's useTranslatedProperty() exactly — same fallback chain
 * (source language passthrough -> stored title_i18n/description_i18n from
 * the listing wizard -> in-memory cache -> a live translate-property call),
 * same "Auto-translated" badge signal. Without this, a listing authored in
 * Albanian with no stored translation for the viewer's language just shows
 * the original Albanian text on mobile with no indication or fallback,
 * unlike web.
 */
export function useTranslatedProperty(
  property: Property | null,
  language: string,
): TranslatedProperty {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [translating, setTranslating] = useState(false);
  const [isTranslated, setIsTranslated] = useState(false);

  const id = property?.id;
  const origTitle = property?.title || '';
  const origDesc = property?.description || '';
  const storedTitle = property?.title_i18n?.[language];
  const storedDesc = property?.description_i18n?.[language];

  useEffect(() => {
    if (!id) return;
    // A reply for an older listing or language must not overwrite this one.
    let current = true;

    if (language === 'sq') {
      setTitle(storedTitle || origTitle);
      setDescription(storedDesc || origDesc);
      setIsTranslated(false);
      setTranslating(false);
      return;
    }

    if ((storedTitle || !origTitle) && (storedDesc || !origDesc)) {
      setTitle(storedTitle || origTitle);
      setDescription(storedDesc || origDesc);
      setIsTranslated(Boolean(storedTitle || storedDesc));
      setTranslating(false);
      return;
    }

    const key = cacheKey(id, language, origTitle, origDesc);
    const cached = cache[key];
    if (cached) {
      setTitle(cached.title);
      setDescription(cached.description);
      setIsTranslated(true);
      setTranslating(false);
      return;
    }

    setTitle(origTitle);
    setDescription(origDesc);
    setTranslating(true);
    setIsTranslated(false);

    if (!origTitle && !origDesc) {
      setTranslating(false);
      return;
    }

    // One request for both fields in the viewer's language only. This used to
    // be two calls that each fanned out to all seven languages and threw six
    // away — eight translations billed to render one.
    translatePropertyContent({
      title: origTitle,
      description: origDesc,
      targetLanguage: language as LangCode,
    })
      .then((result) => {
        const translatedTitle = origTitle ? result.title || origTitle : '';
        const translatedDesc = origDesc ? result.description || origDesc : '';

        // Still a correct translation of its own text, so keep it even if
        // the screen has moved on.
        cache[key] = { title: translatedTitle, description: translatedDesc };
        if (!current) return;
        setTitle(translatedTitle);
        setDescription(translatedDesc);
        setIsTranslated(true);
        setTranslating(false);
      })
      .catch(() => {
        // The original text is already on screen from the setState above, so a
        // failure degrades to untranslated rather than to an empty card.
        if (!current) return;
        setTranslating(false);
      });
    return () => {
      current = false;
    };
  }, [id, language, origTitle, origDesc, storedTitle, storedDesc]);

  return { title, description, translating, isTranslated };
}
