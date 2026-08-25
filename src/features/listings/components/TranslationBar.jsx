import { useTranslation } from 'react-i18next'
import { AlertCircle, Loader2, PencilLine, RefreshCw, Sparkles } from 'lucide-react'

import { SOURCE_LANG, SUPPORTED_LANGS, TranslationState } from '../../../lib/translationCore'

/**
 * The listing form's language selector — and its translation control.
 *
 * One bar for title AND description together, replacing the two independent
 * `.nl-lang-tabs` rows and the separate "Translate all languages" button this
 * wizard used to carry. Selecting a language IS the translate action, so there
 * is one obvious way to get German rather than a tab that shows an empty field
 * next to a button somewhere below that fills it.
 *
 * Mirrors components/listing/translation-bar.tsx on mobile — same states, same
 * copy keys, same behaviour.
 */
export function TranslationBar({
  activeLang,
  onSelect,
  filled,
  pendingLangs,
  state,
  translating,
  error,
  onRegenerate,
  onRetry,
  canRegenerate,
}) {
  const { t } = useTranslation()

  const statusLabel =
    state === TranslationState.MANUAL
      ? t('ai.translationManual')
      : state === TranslationState.STALE
        ? t('ai.translationStale')
        : state === TranslationState.CURRENT
          ? t('ai.translationAuto')
          : null

  const StatusIcon =
    state === TranslationState.MANUAL
      ? PencilLine
      : state === TranslationState.STALE
        ? RefreshCw
        : Sparkles

  const errorLabel =
    error === 'rate_limited'
      ? t('ai.errorRateLimited')
      : error === 'not_configured'
        ? t('ai.translationNotConfigured')
        : error === 'unavailable'
          ? t('ai.errorUnavailable')
          : t('ai.translationFailed')

  return (
    <div className="nl-translation-bar">
      <div className="nl-lang-tabs">
        {SUPPORTED_LANGS.map((lang) => {
          const active = activeLang === lang
          const busy = pendingLangs.has(lang)
          return (
            <button
              key={lang}
              type="button"
              // Only the language actually in flight is blocked; every other
              // tab stays live, so the form is never globally frozen.
              disabled={busy}
              aria-pressed={active}
              aria-busy={busy}
              className={`nl-lang-tab ${active ? 'active' : ''} ${
                filled(lang) && !active ? 'filled' : ''
              }`}
              onClick={() => onSelect(lang)}
            >
              {busy ? <Loader2 size={11} className="animate-spin" /> : lang.toUpperCase()}
            </button>
          )
        })}
      </div>

      {/* aria-live so a screen reader hears the translation finish — the
          visible change is text swapping inside an input it is not focused on. */}
      <div className="nl-translation-status" aria-live="polite">
        {translating ? (
          <>
            <Loader2 size={13} className="animate-spin" />
            <span>{t('ai.translating')}</span>
          </>
        ) : error ? (
          <>
            <AlertCircle size={13} className="nl-translation-status--error" />
            <span className="nl-translation-status--error">{errorLabel}</span>
            {/* No retry for a rejected server key: the request cannot start
                succeeding until someone changes a secret, so offering "try
                again" would just loop. */}
            {error !== 'not_configured' && (
              <button type="button" className="nl-translation-action" onClick={onRetry}>
                {t('common.retry')}
              </button>
            )}
          </>
        ) : statusLabel ? (
          <>
            <StatusIcon size={13} />
            <span>{statusLabel}</span>
            {canRegenerate && (
              <button type="button" className="nl-translation-action" onClick={onRegenerate}>
                {t('ai.regenerateTranslation')}
              </button>
            )}
          </>
        ) : activeLang !== SOURCE_LANG && state === TranslationState.NO_SOURCE ? (
          <span>{t('ai.translateFirst')}</span>
        ) : null}
      </div>
    </div>
  )
}
