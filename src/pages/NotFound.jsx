import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Home, Search } from 'lucide-react'

export default function NotFound() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <div className="page" style={{ textAlign: 'center', paddingTop: '4rem' }}>
      <div style={{ fontSize: 64, fontWeight: 700, color: 'var(--fho-orange-2)', lineHeight: 1 }}>404</div>
      <div style={{ fontSize: 18, fontWeight: 600, marginTop: 12 }}>{t('notFound.title')}</div>
      <div style={{ fontSize: 14, color: 'var(--fho-text-muted)', marginTop: 8, marginBottom: 24 }}>{t('notFound.subtitle')}</div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button
          className="type-chip active"
          onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px' }}
        ><Home size={16} /> {t('common.home')}</button>
        <button
          className="type-chip"
          onClick={() => navigate('/search')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px' }}
        ><Search size={16} /> {t('common.search')}</button>
      </div>
    </div>
  )
}
