import { MessageCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function Messages() {
  const { t } = useTranslation()

  return (
    <div className="page">
      <h1 className="page-title">{t('common.messages')}</h1>
      <p className="page-subtitle">{t('messages.subtitle')}</p>
      <div className="placeholder-card">
        <div className="icon"><MessageCircle size={32} /></div>
        <div>{t('messages.comingSoon')}</div>
      </div>
    </div>
  )
}
