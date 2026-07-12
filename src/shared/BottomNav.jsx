import { NavLink } from 'react-router-dom'
import { Home, Search, MessageCircle, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useUnreadCount } from '../features/messaging/hooks/useUnreadCount'

export default function BottomNav() {
  const { t } = useTranslation()
  const unread = useUnreadCount()

  const items = [
    { to: '/', icon: Home, label: t('common.home') },
    { to: '/search', icon: Search, label: t('common.search') },
    { to: '/messages', icon: MessageCircle, label: t('common.messages'), badge: unread || null },
    { to: '/profile', icon: User, label: t('common.profile') },
  ]

  return (
    <nav className="liquid-nav" aria-label="Primary">
      {items.map(({ to, icon: Icon, label, badge }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
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
