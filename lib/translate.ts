import { supabase } from '@/lib/supabase';
import {
  SOURCE_LANG,
  SUPPORTED_LANGS,
  sanitizeTranslationResponse,
  type I18nMap,
  type LangCode,
} from '@/src/lib/translationCore';

// Re-exported so screens keep importing language constants and types from
// '@/lib/translate' as they always have, while the definitions themselves live
// in the one module the web app shares (see src/lib/translationCore.js for why
// that has to be a single copy).
export { SOURCE_LANG, SUPPORTED_LANGS };
export type { I18nMap, LangCode };

/** Error codes translate-property can return, plus the transport failures. */
export type TranslationErrorCode =
  | 'unavailable'
  /** The server's ANTHROPIC_API_KEY is missing or rejected — owner must fix. */
  | 'not_configured'
  | 'rate_limited'
  | 'unauthorized'
  | 'empty_content'
  | 'invalid_response'
  | 'network';

export class TranslationError extends Error {
  code: TranslationErrorCode;
  constructor(code: TranslationErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'TranslationError';
    this.code = code;
  }
}

/**
 * supabase-js reports any non-2xx as a FunctionsHttpError whose message is a
 * generic "non-2xx status code" — the body carrying the real reason is only
 * reachable through error.context. Without this the UI could not tell "you are
 * out of quota" from "the server's key is rejected", and would show one vague
 * failure for both.
 *
 * The `upstream_status` split is not cosmetic. A rejected API key produced the
 * exact same "unavailable, try again later" message as a transient outage,
 * which is advice that can never work — the key had been invalid the whole
 * time, and finding that out took reading the edge function's stderr. An
 * upstream 401/403 is a server misconfiguration only the owner can fix, and
 * the UI has to say so instead of telling people to retry forever.
 */
async function classify(error: unknown): Promise<TranslationErrorCode> {
  const context = (error as { context?: Response })?.context;
  if (!context || typeof context.json !== 'function') return 'network';
  try {
    const body = await context.json();
    const code = typeof body?.error === 'string' ? body.error : '';
    if (code === 'rate_limited') return 'rate_limited';
    if (code === 'unauthorized') return 'unauthorized';
    if (code === 'empty_content') return 'empty_content';
    if (code.startsWith('unsupported_') || code === 'target_equals_source') return 'invalid_response';
    const upstream = body?.upstream_status;
    if (upstream === 401 || upstream === 403) return 'not_configured';
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}

/**
 * Which engine produced a translation.
 *
 * `mymemory` is the free fallback and is visibly rougher than the prompted
 * model, so the UI surfaces it rather than passing both off as equivalent —
 * an agent publishing in a language they do not read deserves to know which
 * one they are looking at.
 */
export type TranslationProvider = 'anthropic' | 'mymemory' | 'unknown';

export interface TranslatePropertyArgs {
  title: string;
  description: string;
  targetLanguage: LangCode;
  sourceLanguage?: LangCode;
}

/**
 * Translates a listing's title and description into one target language.
 *
 * One call for both fields, by design: it is a single upstream request instead
 * of two, and the model reads them together, which is what lets it tell a
 * neighbourhood name in the title from an ordinary noun.
 *
 * Whichever field is blank stays blank — the caller passes both, and only the
 * non-empty ones are required to come back filled.
 */
export async function translatePropertyContent({
  title,
  description,
  targetLanguage,
  sourceLanguage = SOURCE_LANG,
}: TranslatePropertyArgs): Promise<{
  title: string;
  description: string;
  provider: TranslationProvider;
}> {
  const wantTitle = !!title?.trim();
  const wantDescription = !!description?.trim();

  // Nothing to translate never becomes a request — the caller is expected to
  // check too, but this is the boundary that actually guarantees it.
  if (!wantTitle && !wantDescription) {
    return { title: '', description: '', provider: 'unknown' };
  }

  const { data, error } = await supabase.functions.invoke('translate-property', {
    body: {
      title: title ?? '',
      description: description ?? '',
      sourceLanguage,
      targetLanguage,
    },
  });

  if (error) throw new TranslationError(await classify(error));

  const clean = sanitizeTranslationResponse(data, { wantTitle, wantDescription });
  if (!clean) throw new TranslationError('invalid_response');

  const raw = (data as { provider?: unknown })?.provider;
  const provider: TranslationProvider =
    raw === 'anthropic' || raw === 'mymemory' ? raw : 'unknown';

  return { ...clean, provider };
}
