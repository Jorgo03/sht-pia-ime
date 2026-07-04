import { Briefcase } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function AgentDashboard() {
  const { t } = useTranslation()

  return (
    <div className="page">
      <h1 className="page-title">{t('agentDashboard.title')}</h1>
      <p className="page-subtitle">{t('agentDashboard.subtitle')}</p>
      <div className="placeholder-card">
        <div className="icon"><Briefcase size={32} /></div>
        <div>{t('agentDashboard.comingSoon')}</div>
      </div>
    </div>
  )
}
