import { RefreshCw, SearchX } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function ErrorState({ onRetry }) {
  const { t } = useTranslation()
  return (
    <div className="state" role="alert">
      <p>{t('web.error')}</p>
      <button type="button" className="btn btn-outline" onClick={onRetry}>
        <RefreshCw size={16} aria-hidden="true" />
        {t('common.retry')}
      </button>
    </div>
  )
}

export function EmptyState({ title, hint, children }) {
  return (
    <div className="state">
      <SearchX size={28} aria-hidden="true" />
      <p className="state-title">{title}</p>
      {hint && <p>{hint}</p>}
      {children}
    </div>
  )
}
