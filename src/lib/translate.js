// src/lib/translate.js
import { supabase } from './supabase';

/**
 * Translate Albanian (or English) text into all 8 supported languages.
 * Returns an object: { sq, en, de, it, es, pl, ru, fr }
 */
export async function translateAll(text, source = 'sq') {
  if (!text?.trim()) return {};

  const { data, error } = await supabase.functions.invoke('translate-property', {
    body: { text, source },
  });

  if (error) {
    console.error('Translation failed:', error);
    throw new Error('Translation service unavailable. Please try again.');
  }

  return data || {};
}
