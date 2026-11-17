import { useTranslation } from 'react-i18next'
import { AlertCircle } from 'lucide-react'

/**
 * A list that could not be loaded, with a way to try again. Without it a
 * failed read fell through to the empty state ("no listings yet") when the
 * truth was "the network dropped". Twin of components/ui/load-error.tsx.
 */
export default function LoadError({ onRetry, message }) {
  const { t } = useTranslation()
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <AlertCircle size={36} className="text-fho-orange-1" aria-hidden="true" />
      <p className="text-[15px] text-fho-text-muted">{message ?? t('errors.loadFailed')}</p>
      <button type="button" className="pill-btn" onClick={onRetry}>{t('common.retry')}</button>
    </div>
  )
}
