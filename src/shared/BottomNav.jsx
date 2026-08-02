import { NavLink, useNavigate } from 'react-router-dom'
import { Home, Search, Plus, MessageCircle, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useUnreadCount } from '../features/messaging/hooks/useUnreadCount'

export default function BottomNav() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const unread = useUnreadCount()

  const left = [
    { to: '/', icon: Home, label: t('common.home') },
    { to: '/search', icon: Search, label: t('common.search') },
  ]

  const right = [
    { to: '/messages', icon: MessageCircle, label: t('common.messages'), badge: unread || null },
    { to: '/profile', icon: User, label: t('common.profile') },
  ]

  return (
    <nav className="liquid-nav" aria-label="Primary">
      {left.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          aria-label={label}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Icon size={22} strokeWidth={1.8} />
        </NavLink>
      ))}

      {/* Goes straight to the listing wizard (ProtectedRoute sends
          signed-out users to sign-in first). */}
      <button
        className="nav-add"
        onClick={() => navigate('/new-listing')}
        aria-label={t('listing.newListing')}
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>

      {right.map(({ to, icon: Icon, label, badge }) => (
        <NavLink
          key={to}
          to={to}
          aria-label={label}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Icon size={22} strokeWidth={1.8} />
          {badge ? <span className="nav-badge">{badge > 9 ? '9+' : badge}</span> : null}
        </NavLink>
      ))}
    </nav>
  )
}
