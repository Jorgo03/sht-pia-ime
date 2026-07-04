import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Languages } from 'lucide-react'
import { translateAll } from '../../../lib/translate'

// Feature E — one-click translation of the Albanian title + description into
// all 8 supported languages via the existing translate-property edge function
// (Google + DeepL pipeline). Fills title_i18n / description_i18n.
export function AutoTranslateButton({ title, description, onResult }) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null) // 'done' | 'error'

  const ready = Boolean(title?.trim() && description?.trim())

  const handleClick = async () => {
    if (!ready || loading) return
    setLoading(true)
    setStatus(null)
    try {
      const [titleMap, descriptionMap] = await Promise.all([
        translateAll(title, 'sq'),
        translateAll(description, 'sq'),
      ])
      onResult({ titleMap, descriptionMap })
      setStatus('done')
    } catch {
      setStatus('error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ai-panel__row">
      <button
        type="button"
        className="ai-panel__btn ai-panel__btn--ghost"
        onClick={handleClick}
        disabled={loading || !ready}
        title={ready ? undefined : t('ai.translateFirst')}
      >
        <Languages size={14} />
        {loading ? t('ai.translating') : t('ai.translateAll')}
      </button>
      {status === 'done' && <span className="ai-panel__hint">{t('ai.translated')}</span>}
      {status === 'error' && <span className="nl-error">{t('ai.errorGeneric')}</span>}
    </div>
  )
}
