import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Home, Search } from 'lucide-react'

// Reference Tailwind component — the fho-* utilities come from
// src/styles/tailwind.css and follow the light/dark theme automatically.
export default function NotFound() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <div className="page pt-16 text-center">
      <div className="text-6xl font-bold leading-none text-fho-orange-2">404</div>
      <div className="mt-3 text-lg font-semibold text-fho-text">{t('notFound.title')}</div>
      <div className="mt-2 mb-6 text-sm text-fho-text-muted">{t('notFound.subtitle')}</div>
      <div className="flex justify-center gap-2.5">
        <button
          className="flex cursor-pointer items-center gap-1.5 rounded-fho-pill border-0 bg-fho-orange-1 px-5 py-2.5 text-sm font-semibold text-white"
          onClick={() => navigate('/')}
        ><Home size={16} /> {t('common.home')}</button>
        <button
          className="flex cursor-pointer items-center gap-1.5 rounded-fho-pill border border-fho-border-strong bg-transparent px-5 py-2.5 text-sm font-semibold text-fho-text"
          onClick={() => navigate('/search')}
        ><Search size={16} /> {t('common.search')}</button>
      </div>
    </div>
  )
}
