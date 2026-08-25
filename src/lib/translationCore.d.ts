// Types for src/lib/translationCore.js.
//
// The implementation is .js so `npm test` (node --test over plain ESM) can
// import it directly, the same arrangement src/lib/aiSchemas.js already uses.
// This declaration file is what gives the Expo side, which is strict TS, real
// types across that boundary instead of `any`.

export type LangCode = 'sq' | 'en' | 'de' | 'it' | 'es' | 'pl' | 'ru' | 'fr'

/** Language code -> text, as stored in properties.title_i18n / description_i18n. */
export type I18nMap = Partial<Record<LangCode, string>> & Record<string, string>

export interface TranslationMetaEntry {
  /** Fingerprint of the Albanian source this translation was made from. */
  sourceHash: string
  /** True once a human edited it — blocks automatic regeneration. */
  manual: boolean
  updatedAt: string | null
}

/** Language code -> metadata, as stored in properties.translation_meta. */
export type TranslationMeta = Partial<Record<LangCode, TranslationMetaEntry>> &
  Record<string, TranslationMetaEntry>

export type TranslationStateValue =
  | 'source'
  | 'no_source'
  | 'missing'
  | 'current'
  | 'stale'
  | 'manual'

export const SUPPORTED_LANGS: readonly LangCode[]
export const SOURCE_LANG: 'sq'

export const TranslationState: {
  readonly SOURCE: 'source'
  readonly NO_SOURCE: 'no_source'
  readonly MISSING: 'missing'
  readonly CURRENT: 'current'
  readonly STALE: 'stale'
  readonly MANUAL: 'manual'
}

export function normalizeForHash(value: unknown): string

export function sourceFingerprint(
  title: string | null | undefined,
  description: string | null | undefined,
): string

export function metaFor(
  meta: TranslationMeta | null | undefined,
  lang: string,
): TranslationMetaEntry | null

export function translationStateFor(args: {
  lang: string
  title?: string | null
  description?: string | null
  meta?: TranslationMeta | null
  fingerprint: string
}): TranslationStateValue

export function shouldTranslate(args: {
  lang: string
  title?: string | null
  description?: string | null
  meta?: TranslationMeta | null
  fingerprint: string
  force?: boolean
}): boolean

export function mergeTranslation(
  existing: I18nMap | null | undefined,
  lang: string,
  value: string | null | undefined,
): I18nMap

export function markGenerated(
  meta: TranslationMeta | null | undefined,
  lang: string,
  fingerprint: string,
  now?: Date,
): TranslationMeta

export function markManual(
  meta: TranslationMeta | null | undefined,
  lang: string,
  fingerprint: string,
  now?: Date,
): TranslationMeta

export function sanitizeTranslationResponse(
  raw: unknown,
  opts: { wantTitle: boolean; wantDescription: boolean },
): { title: string; description: string } | null
