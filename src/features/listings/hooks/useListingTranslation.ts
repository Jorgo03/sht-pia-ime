import { useCallback, useMemo, useRef, useState } from 'react'

import {
  SOURCE_LANG,
  TranslationState,
  markGenerated,
  markManual,
  mergeTranslation,
  shouldTranslate,
  sourceFingerprint,
  translationStateFor,
  type I18nMap,
  type LangCode,
  type TranslationMeta,
  type TranslationStateValue,
} from '../../../lib/translationCore'

/**
 * The listing form's translation state machine — shared by the web wizard
 * (src/features/listings/pages/NewListing.jsx) and the Expo wizard
 * (app/listing/new.tsx), which drive identical form shapes and must behave
 * identically. Written in TypeScript so both get checked by the repo's single
 * `tsc --noEmit`; Vite resolves the .ts import from .jsx without ceremony.
 *
 * It owns three things that are easy to get wrong separately and impossible to
 * keep consistent if duplicated: when a language tap costs an API call, which
 * response is still allowed to land, and when a human's words are protected.
 */

/** The slice of listing form state this hook reads and writes. */
export interface TranslatableForm {
  title_i18n: I18nMap
  description_i18n: I18nMap
  translation_meta: TranslationMeta
}

export type TranslateFn = (args: {
  title: string
  description: string
  targetLanguage: LangCode
  sourceLanguage?: LangCode
}) => Promise<{ title: string; description: string; provider?: string }>

export interface UseListingTranslationArgs<F extends TranslatableForm> {
  form: F
  setForm: (updater: (prev: F) => F) => void
  /** Platform binding: lib/translate.ts on Expo, src/lib/translate.js on web. */
  translate: TranslateFn
  /**
   * When false, language tabs still switch and stay editable but nothing is
   * ever sent upstream — the web app's `autoTranslate` feature flag, which
   * must degrade to plain manual multi-language entry rather than to a dead
   * selector.
   */
  enabled?: boolean
}

export interface UseListingTranslationResult {
  activeLang: LangCode
  /** The primary action: selecting a language translates if it needs it. */
  selectLanguage: (lang: LangCode) => void
  /** Explicit user-driven re-translation of the active language. */
  regenerate: () => void
  /** Retry after a failure, for the active language. */
  retry: () => void
  editTitle: (value: string) => void
  editDescription: (value: string) => void
  /** Text currently shown in the two inputs, for the active language. */
  title: string
  description: string
  /**
   * The Albanian source, regardless of which language is active.
   *
   * Exposed so a form can show it as the placeholder when the active language
   * has no text yet. Otherwise selecting an untranslated language empties both
   * inputs, and an agent looking at two blank boxes cannot tell a failed
   * translation from one that simply has not run.
   */
  sourceTitle: string
  sourceDescription: string
  /** True while the active language is being translated. */
  translating: boolean
  /** Any language currently in flight — drives per-tab spinners. */
  pendingLangs: ReadonlySet<LangCode>
  /** Error code for the active language, or null. */
  error: string | null
  /**
   * Which engine produced the active language's text, when this session
   * generated it. 'mymemory' is the free fallback and is rougher, which the
   * agent needs to know before publishing in a language they cannot read.
   */
  provider: string | null
  /** Classification of the active language: current, stale, manual, ... */
  state: TranslationStateValue
  /** Fingerprint of the Albanian source; '' when there is nothing to translate. */
  fingerprint: string
  /** True when the active language may be regenerated (has source, not sq). */
  canRegenerate: boolean
}

export function useListingTranslation<F extends TranslatableForm>({
  form,
  setForm,
  translate,
  enabled = true,
}: UseListingTranslationArgs<F>): UseListingTranslationResult {
  const [activeLang, setActiveLang] = useState<LangCode>(SOURCE_LANG)
  const [pendingLangs, setPendingLangs] = useState<ReadonlySet<LangCode>>(() => new Set())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [providers, setProviders] = useState<Record<string, string>>({})

  const sourceTitle = form.title_i18n?.[SOURCE_LANG] ?? ''
  const sourceDescription = form.description_i18n?.[SOURCE_LANG] ?? ''

  const fingerprint = useMemo(
    () => sourceFingerprint(sourceTitle, sourceDescription),
    [sourceTitle, sourceDescription],
  )

  /**
   * Monotonic run ids, one entry per language, holding the id of the newest
   * run that language is allowed to accept a result from.
   *
   * This is what makes rapid EN -> DE -> EN -> IT switching safe. Note the
   * displayed text needs no protection of its own: the inputs render
   * `map[activeLang]`, so a late EN result landing while DE is on screen
   * changes nothing visible — it just fills in EN, which is real data worth
   * keeping. What genuinely has to be guarded is a superseded run for the SAME
   * language writing over a newer one, and that is exactly what comparing
   * against this map does.
   */
  const latestRunRef = useRef<Map<LangCode, number>>(new Map())
  const runIdRef = useRef(0)
  /** Fingerprint each in-flight run was started for, to dedupe identical work. */
  const inFlightRef = useRef<Map<LangCode, string>>(new Map())

  const setPending = useCallback((lang: LangCode, on: boolean) => {
    setPendingLangs((prev) => {
      const next = new Set(prev)
      if (on) next.add(lang)
      else next.delete(lang)
      return next
    })
  }, [])

  /**
   * Invalidates any in-flight run for `lang`.
   *
   * Used when the agent types into a translated field: their keystrokes must
   * win over a request that is still on its way back, otherwise the response
   * lands a second later and silently overwrites what they just wrote.
   */
  const supersede = useCallback((lang: LangCode) => {
    runIdRef.current += 1
    latestRunRef.current.set(lang, runIdRef.current)
    inFlightRef.current.delete(lang)
    setPending(lang, false)
  }, [setPending])

  const run = useCallback(
    async (lang: LangCode, force: boolean) => {
      const title = sourceTitle
      const description = sourceDescription
      const startedFingerprint = sourceFingerprint(title, description)

      if (!enabled) return
      if (!startedFingerprint) return
      if (lang === SOURCE_LANG) return

      // Already doing exactly this work — a second tap must not double-bill.
      if (inFlightRef.current.get(lang) === startedFingerprint) return

      if (
        !shouldTranslate({
          lang,
          title: form.title_i18n?.[lang],
          description: form.description_i18n?.[lang],
          meta: form.translation_meta,
          fingerprint: startedFingerprint,
          force,
        })
      ) {
        return
      }

      runIdRef.current += 1
      const runId = runIdRef.current
      latestRunRef.current.set(lang, runId)
      inFlightRef.current.set(lang, startedFingerprint)
      setPending(lang, true)
      setErrors((prev) => {
        if (!prev[lang]) return prev
        const next = { ...prev }
        delete next[lang]
        return next
      })

      try {
        const result = await translate({
          title,
          description,
          targetLanguage: lang,
          sourceLanguage: SOURCE_LANG,
        })

        // Superseded while in flight — by a newer run for this language, or by
        // the agent typing into this language's field. Drop it silently.
        if (latestRunRef.current.get(lang) !== runId) return

        if (result.provider) {
          setProviders((prev) => ({ ...prev, [lang]: result.provider as string }))
        }

        setForm((prev) => ({
          ...prev,
          title_i18n: mergeTranslation(prev.title_i18n, lang, result.title),
          description_i18n: mergeTranslation(prev.description_i18n, lang, result.description),
          // Tagged with the fingerprint it was actually generated from, not
          // the current one. If the agent edited the Albanian mid-flight the
          // result is still real work and worth keeping — it simply reads as
          // stale, and regenerates the next time this language is selected.
          translation_meta: markGenerated(prev.translation_meta, lang, startedFingerprint),
        }))
      } catch (err) {
        if (latestRunRef.current.get(lang) !== runId) return
        // Nothing is written on failure: the existing text, and above all the
        // Albanian source, is left exactly as it was.
        const code = (err as { code?: string })?.code ?? 'unavailable'
        setErrors((prev) => ({ ...prev, [lang]: code }))
      } finally {
        if (inFlightRef.current.get(lang) === startedFingerprint) {
          inFlightRef.current.delete(lang)
        }
        setPending(lang, false)
      }
    },
    [
      enabled,
      form.title_i18n,
      form.description_i18n,
      form.translation_meta,
      sourceTitle,
      sourceDescription,
      setForm,
      setPending,
      translate,
    ],
  )

  const selectLanguage = useCallback(
    (lang: LangCode) => {
      setActiveLang(lang)
      // Fire-and-forget: selecting a language must never block the tap, and
      // every failure path already lands in per-language error state.
      void run(lang, false)
    },
    [run],
  )

  const regenerate = useCallback(() => {
    if (activeLang === SOURCE_LANG) return
    // An explicit request overrides both the cache and the manual-edit pin —
    // the only thing that is allowed to.
    supersede(activeLang)
    void run(activeLang, true)
  }, [activeLang, run, supersede])

  const retry = useCallback(() => {
    if (activeLang === SOURCE_LANG) return
    void run(activeLang, true)
  }, [activeLang, run])

  const editField = useCallback(
    (field: 'title_i18n' | 'description_i18n', value: string) => {
      const lang = activeLang
      // Typing beats a request that has not come back yet.
      if (inFlightRef.current.has(lang)) supersede(lang)

      setForm((prev) => {
        const nextMap = { ...(prev[field] ?? {}), [lang]: value }
        const base = { ...prev, [field]: nextMap } as F

        // Editing the source does not create a "manual translation" — it moves
        // the fingerprint, which is what makes every other language stale.
        if (lang === SOURCE_LANG) return base

        const nextFingerprint = sourceFingerprint(
          prev.title_i18n?.[SOURCE_LANG] ?? '',
          prev.description_i18n?.[SOURCE_LANG] ?? '',
        )
        return {
          ...base,
          translation_meta: markManual(prev.translation_meta, lang, nextFingerprint),
        }
      })
    },
    [activeLang, setForm, supersede],
  )

  const editTitle = useCallback((value: string) => editField('title_i18n', value), [editField])
  const editDescription = useCallback(
    (value: string) => editField('description_i18n', value),
    [editField],
  )

  const state = translationStateFor({
    lang: activeLang,
    title: form.title_i18n?.[activeLang],
    description: form.description_i18n?.[activeLang],
    meta: form.translation_meta,
    fingerprint,
  })

  return {
    activeLang,
    selectLanguage,
    regenerate,
    retry,
    editTitle,
    editDescription,
    title: form.title_i18n?.[activeLang] ?? '',
    description: form.description_i18n?.[activeLang] ?? '',
    sourceTitle,
    sourceDescription,
    translating: pendingLangs.has(activeLang),
    pendingLangs,
    error: errors[activeLang] ?? null,
    provider: providers[activeLang] ?? null,
    state,
    fingerprint,
    canRegenerate:
      enabled &&
      activeLang !== SOURCE_LANG &&
      !!fingerprint &&
      state !== TranslationState.NO_SOURCE,
  }
}
