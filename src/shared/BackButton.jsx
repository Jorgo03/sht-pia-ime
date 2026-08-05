import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

// Top-left "back to the settings menu" affordance for profile sub-pages.
// Deliberately an explicit target rather than navigate(-1): deep links and
// new tabs have no in-app history entry (history-back would leave the app),
// and "up" from these pages is always the profile menu.
export default function BackButton({ to = '/profile', label }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  return (
    <button className="fav-back" onClick={() => navigate(to)}>
      <ArrowLeft size={14} /> {label || t('favourites.backToProfile')}
    </button>
  )
}
