import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Heart, Menu, MessageCircle, UserRound, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Logo from './Logo'
import LanguageSelect from './LanguageSelect'
import { useAuth } from '../auth/AuthContext'

export default function Header({ overHero, dark = false }) {
  const { t } = useTranslation()
  const { session, profile } = useAuth()
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
    { to: '/#agents', label: t('site.nav.agencies'), active: false },
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
            <Link to={session ? '/account' : '/signup'}>{t('site.listHome')}</Link>
            <Link to="/#app">{t('web.nav.app')}</Link>
            <LanguageSelect />
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
          {session && <Link to="/viewings">{t('viewings.title')}</Link>}
          <Link to="/#app">{t('web.nav.app')}</Link>
          {!session && <Link to="/signup">{t('auth.createAccount')}</Link>}
        </nav>
        <LanguageSelect className="is-block" />
      </div>
    </header>
  )
}
