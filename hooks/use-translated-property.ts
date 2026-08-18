import { useEffect, useRef, useState } from 'react';

import { Property } from '@/data/types';
import { translateAll } from '@/lib/translate';

const cache: Record<string, { title: string; description: string }> = {};

function cacheKey(propertyId: string, lang: string): string {
  return `${propertyId}:${lang}`;
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
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!property) return;

    const origTitle = property.title || '';
    const origDesc = property.description || '';

    if (language === 'sq') {
      setTitle(property.title_i18n?.sq || origTitle);
      setDescription(property.description_i18n?.sq || origDesc);
      setIsTranslated(false);
      setTranslating(false);
      return;
    }

    const storedTitle = property.title_i18n?.[language];
    const storedDesc = property.description_i18n?.[language];
    if ((storedTitle || !origTitle) && (storedDesc || !origDesc)) {
      setTitle(storedTitle || origTitle);
      setDescription(storedDesc || origDesc);
      setIsTranslated(Boolean(storedTitle || storedDesc));
      setTranslating(false);
      return;
    }

    const key = cacheKey(property.id, language);
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

    Promise.all([
      origTitle ? translateAll(origTitle, 'sq') : Promise.resolve<Record<string, string>>({}),
      origDesc ? translateAll(origDesc, 'sq') : Promise.resolve<Record<string, string>>({}),
    ])
      .then(([titleMap, descMap]) => {
        if (!activeRef.current) return;

        const translatedTitle = origTitle ? titleMap[language] || origTitle : '';
        const translatedDesc = origDesc ? descMap[language] || origDesc : '';

        cache[key] = { title: translatedTitle, description: translatedDesc };
        setTitle(translatedTitle);
        setDescription(translatedDesc);
        setIsTranslated(true);
        setTranslating(false);
      })
      .catch(() => {
        if (!activeRef.current) return;
        setTranslating(false);
      });
  }, [property?.id, language]);

  return { title, description, translating, isTranslated };
}
