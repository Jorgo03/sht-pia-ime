import { NavLink } from 'react-router-dom'
import { Home, Search, Heart, MessageCircle, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function BottomNav() {
  const { t } = useTranslation()

  const items = [
    { to: '/',          icon: Home,           label: t('common.home') },
    { to: '/search',    icon: Search,         label: t('common.search') },
    { to: '/favorites', icon: Heart,          label: t('common.favorites') },
    { to: '/messages',  icon: MessageCircle,  label: t('common.messages') },
    { to: '/profile',   icon: User,           label: t('common.profile') },
  ]

  return (
    <nav className="liquid-nav" aria-label="Primary">
      {items.map(({ to, icon: Icon, label }) => (
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
    </nav>
  )
}
