import { supabase } from '@/lib/supabase';

export const SUPPORTED_LANGS = ['sq', 'en', 'de', 'it', 'es', 'pl', 'ru', 'fr'] as const;
export type LangCode = (typeof SUPPORTED_LANGS)[number];
export type I18nMap = Record<string, string>;

export async function translateAll(
  text: string,
  source: LangCode = 'sq',
): Promise<I18nMap> {
  if (!text?.trim()) return {};

  const { data, error } = await supabase.functions.invoke('translate-property', {
    body: { text, source },
  });

  if (error) {
    console.error('Translation failed:', error);
    throw new Error('Translation service unavailable. Please try again.');
  }

  return (data as I18nMap) ?? {};
}
