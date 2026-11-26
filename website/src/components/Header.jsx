import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Bell, Heart, Menu, MessageCircle, UserRound, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Logo from './Logo'
import LanguageSelect from './LanguageSelect'
import { CurrencySelect } from '../features/currency'
import { useAuth } from '../auth/AuthContext'

export default function Header({ overHero, dark = false }) {
  const { t } = useTranslation()
  const { session, profile } = useAuth()
  const isAgent = profile?.role === 'agent'
  const { pathname, search } = useLocation()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const menuButton = useRef(null)
  const panel = useRef(null)

  useEffect(() => {
    if (!overHero) return
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [overHero])

  // The menu closes when one of its links is followed, and on Escape (which
  // hands focus back to the button).
  useEffect(() => {
    if (!open) return
    panel.current?.querySelector('a, select')?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        menuButton.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const deal = new URLSearchParams(search).get('deal')
  const links = [
    { to: '/search?deal=sale', label: t('web.nav.buy'), active: pathname === '/search' && deal === 'sale' },
    { to: '/search?deal=rent', label: t('web.nav.rent'), active: pathname === '/search' && deal === 'rent' },
    { to: '/agents', label: t('site.nav.agencies'), active: pathname === '/agents' },
    { to: '/wanted', label: t('wanted.boardPre') + ' ' + t('wanted.boardEm'), active: pathname === '/wanted' },
  ]
  const light = overHero && !scrolled && !open
  const account = session
    ? { to: '/account', label: profile?.full_name?.split(' ')[0] || t('web.account.title') }
    : { to: '/login', label: t('common.signIn') }

  return (
    <header className={`site-header ${overHero ? 'is-overlay' : ''} ${light ? 'is-light' : 'is-solid'} ${dark ? 'is-dark' : ''}`}>
      <div className="topbar">
        <div className="container topbar-inner">
          <p>{t('site.footer.tagline')}</p>
          <div className="topbar-end">
            <Link to={session ? '/listing/new' : '/signup'}>{t('site.listHome')}</Link>
            <Link to={{ hash: '#app' }}>{t('web.nav.app')}</Link>
            <LanguageSelect />
            <CurrencySelect />
          </div>
        </div>
      </div>
      <div className="container nav">
        <Link to="/" className="nav-logo" aria-label={t('common.appName')}>
          {/* The app's top bar shows its text wordmark (components/ui/app-header.tsx). */}
          {dark ? (
            <span className="wordmark">
              Shtëpia<span>.ime</span>
            </span>
          ) : (
            <Logo />
          )}
        </Link>
        <nav aria-label={t('site.menu')} className="nav-links">
          {links.map((l) => (
            <NavLink key={l.label} to={l.to} className={() => (l.active ? 'is-active' : '')} aria-current={l.active ? 'page' : undefined}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        {session && (
          <Link to="/notifications" className="nav-icon nav-bell" aria-label={t('notifications.headlinePre') + ' ' + t('notifications.headlineEm')} aria-current={pathname === '/notifications' ? 'page' : undefined}>
            <Bell size={20} aria-hidden="true" />
          </Link>
        )}
        {session && (
          <Link to="/messages" className="nav-icon" aria-label={t('common.messages')} aria-current={pathname.startsWith('/messages') ? 'page' : undefined}>
            <MessageCircle size={20} aria-hidden="true" />
          </Link>
        )}
        <Link to="/favorites" className="nav-icon" aria-label={t('favourites.title')} aria-current={pathname === '/favorites' ? 'page' : undefined}>
          <Heart size={20} aria-hidden="true" />
        </Link>
        <Link to={account.to} className="btn btn-outline nav-account" aria-current={pathname === account.to ? 'page' : undefined}>
          <UserRound size={16} aria-hidden="true" />
          <span className="nav-account-label">{account.label}</span>
        </Link>
        <button
          ref={menuButton}
          type="button"
          className="nav-toggle"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? t('common.close') : t('site.menu')}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X size={dark ? 26 : 22} aria-hidden="true" /> : <Menu size={dark ? 26 : 22} aria-hidden="true" />}
        </button>
      </div>
      <div id="mobile-menu" ref={panel} className="mobile-menu" hidden={!open}>
        <nav aria-label={t('site.menu')} onClick={(e) => e.target.closest('a') && setOpen(false)}>
          {links.map((l) => (
            <Link key={l.label} to={l.to} aria-current={l.active ? 'page' : undefined}>
              {l.label}
            </Link>
          ))}
          <Link to="/favorites">{t('favourites.title')}</Link>
          {session && <Link to="/messages">{t('common.messages')}</Link>}
          {isAgent && <Link to="/agent-dashboard">{t('agentDashboard.title')}</Link>}
          {session && <Link to="/my-listings">{t('listing.myListings')}</Link>}
          {isAgent && <Link to="/leads">{t('leads.headlinePre')} {t('leads.headlineEm')}</Link>}
          {session && <Link to="/viewings">{t('viewings.title')}</Link>}
          {session && <Link to="/saved-searches">{t('saved.headlinePre')} {t('saved.headlineEm')}</Link>}
          {session && <Link to="/notifications">{t('notifications.headlinePre')} {t('notifications.headlineEm')}</Link>}
          <Link to="/compare">{t('compare.headlinePre')} {t('compare.headlineEm')}</Link>
          <Link to="/guide">{t('legal.buyingGuide')}</Link>
          <Link to={{ hash: '#app' }}>{t('web.nav.app')}</Link>
          {!session && <Link to="/signup">{t('auth.createAccount')}</Link>}
        </nav>
        <div className="menu-selects">
          <LanguageSelect className="is-block" />
          <CurrencySelect className="is-block" />
        </div>
      </div>
    </header>
  )
}
