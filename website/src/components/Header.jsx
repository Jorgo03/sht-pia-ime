import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Menu, Smartphone, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Logo from './Logo'
import LanguageSelect from './LanguageSelect'

export default function Header({ overHero }) {
  const { t } = useTranslation()
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

  return (
    <header className={`site-header ${overHero ? 'is-overlay' : ''} ${light ? 'is-light' : 'is-solid'}`}>
      <div className="topbar">
        <div className="container topbar-inner">
          <p>{t('site.footer.tagline')}</p>
          <div className="topbar-end">
            <Link to="/#agents">{t('site.listHome')}</Link>
            <LanguageSelect />
          </div>
        </div>
      </div>
      <div className="container nav">
        <Link to="/" className="nav-logo" aria-label={t('common.appName')}>
          <Logo />
        </Link>
        <nav aria-label={t('site.menu')} className="nav-links">
          {links.map((l) => (
            <NavLink key={l.label} to={l.to} className={() => (l.active ? 'is-active' : '')} aria-current={l.active ? 'page' : undefined}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <Link to="/#app" className="btn btn-outline nav-app">
          <Smartphone size={16} aria-hidden="true" />
          {t('web.nav.app')}
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
          {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
        </button>
      </div>
      <div id="mobile-menu" ref={panel} className="mobile-menu" hidden={!open}>
        <nav aria-label={t('site.menu')} onClick={(e) => e.target.closest('a') && setOpen(false)}>
          {links.map((l) => (
            <Link key={l.label} to={l.to} aria-current={l.active ? 'page' : undefined}>
              {l.label}
            </Link>
          ))}
          <Link to="/#app">{t('web.nav.app')}</Link>
        </nav>
        <LanguageSelect className="is-block" />
      </div>
    </header>
  )
}
