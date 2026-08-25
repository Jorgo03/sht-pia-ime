// src/lib/translate.js
//
// Web half of the listing-translation client. Mirrors lib/translate.ts on the
// Expo side — the repo's established two-files-one-API convention, since each
// app has to reach for its own Supabase singleton. The logic they must agree
// on (fingerprinting, staleness, validation) is not duplicated here; it lives
// in ./translationCore.js, which both import.
import { supabase } from './supabase'
import { SOURCE_LANG, sanitizeTranslationResponse } from './translationCore'

export { SOURCE_LANG, SUPPORTED_LANGS } from './translationCore'

/**
 * supabase-js collapses every non-2xx into a FunctionsHttpError whose message
 * is a generic "non-2xx status code"; the body with the real reason is only
 * reachable via error.context. Without this the UI shows one vague failure for
 * "out of quota" and "server has no API key" alike.
 *
 * @returns {Promise<'unavailable'|'rate_limited'|'unauthorized'|'empty_content'|'invalid_response'|'network'>}
 */
async function classify(error) {
  const context = error?.context
  if (!context || typeof context.json !== 'function') return 'network'
  try {
    const body = await context.json()
    const code = typeof body?.error === 'string' ? body.error : ''
    if (code === 'rate_limited') return 'rate_limited'
    if (code === 'unauthorized') return 'unauthorized'
    if (code === 'empty_content') return 'empty_content'
    if (code.startsWith('unsupported_') || code === 'target_equals_source') return 'invalid_response'
    return 'unavailable'
  } catch {
    return 'unavailable'
  }
}

export class TranslationError extends Error {
  constructor(code, message) {
    super(message ?? code)
    this.name = 'TranslationError'
    this.code = code
  }
}

/**
 * Translates a listing's title and description into one target language.
 *
 * Both fields go in one call: one upstream request instead of two, and the
 * model reads them together, which is what lets it tell a neighbourhood name
 * in the title from an ordinary noun.
 *
 * @param {{ title: string, description: string, targetLanguage: string, sourceLanguage?: string }} args
 * @returns {Promise<{ title: string, description: string }>}
 */
export async function translatePropertyContent({
  title,
  description,
  targetLanguage,
  sourceLanguage = SOURCE_LANG,
}) {
  const wantTitle = !!title?.trim()
  const wantDescription = !!description?.trim()

  // Nothing to translate never becomes a request.
  if (!wantTitle && !wantDescription) return { title: '', description: '' }

  const { data, error } = await supabase.functions.invoke('translate-property', {
    body: {
      title: title ?? '',
      description: description ?? '',
      sourceLanguage,
      targetLanguage,
    },
  })

  if (error) throw new TranslationError(await classify(error))

  const clean = sanitizeTranslationResponse(data, { wantTitle, wantDescription })
  if (!clean) throw new TranslationError('invalid_response')
  return clean
}
