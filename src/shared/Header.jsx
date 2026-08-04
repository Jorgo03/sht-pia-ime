import { useTranslation } from 'react-i18next'
import { Sun, Moon, ChevronDown, User, LayoutDashboard, Heart, Settings, LogOut, Bell, CalendarDays } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from './ThemeContext'
import { useAuth } from '../features/auth/AuthContext'
import { useUpcomingViewings } from '../features/viewings/hooks/useUpcomingViewings'
import { getLocalizedText, formatDate } from '../lib/format'
import { supabase } from '../lib/supabase'
import Avatar from './Avatar'
import '../styles/header.css'

const LANGUAGES = [
  { code: 'sq', name: 'Shqip' },
  { code: 'en', name: 'English' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'es', name: 'Español' },
  { code: 'pl', name: 'Polski' },
  { code: 'ru', name: 'Русский' },
  { code: 'fr', name: 'Français' },
]

export default function Header() {
  const { t, i18n } = useTranslation()
  const { theme, toggle } = useTheme()
  const { user, profile, signOut, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [langOpen, setLangOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)
  const langRef = useRef(null)
  const accountRef = useRef(null)
  const bellRef = useRef(null)
  const upcoming = useUpcomingViewings()

  const currentLang = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0]

  useEffect(() => {
    const handleClick = (e) => {
      if (langRef.current && !langRef.current.contains(e.target)) setLangOpen(false)
      if (accountRef.current && !accountRef.current.contains(e.target)) setAccountOpen(false)
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const changeLanguage = async (code) => {
    await i18n.changeLanguage(code)
    document.documentElement.lang = code
    localStorage.setItem('fho_lang', code)
    setLangOpen(false)
    if (user) {
      await supabase.from('profiles').update({ preferred_language: code }).eq('id', user.id)
      refreshProfile()
    }
  }

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || ''

  const handleNav = (path) => { setAccountOpen(false); navigate(path) }

  return (
    <header className="app-header">
      <div className="header-brand" onClick={() => navigate('/')}>
        Shtëpia<span className="brand-ime">.ime</span>
      </div>
      <div className="header-actions">
        <div className="lang-switcher" ref={langRef}>
          <button className="lang-btn" onClick={() => setLangOpen(!langOpen)}>
            <span className="lang-code">{currentLang.code}</span>
            <span className="lang-label">{currentLang.name}</span>
            <ChevronDown size={14} className={`lang-chevron ${langOpen ? 'open' : ''}`} />
          </button>
          {langOpen && (
            <div className="lang-dropdown">
              {LANGUAGES.map(lang => (
                <button key={lang.code} className={`lang-option ${lang.code === i18n.language ? 'active' : ''}`} onClick={() => changeLanguage(lang.code)}>
                  <span className="lang-code">{lang.code}</span>
                  <span>{lang.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {user && (
          <div className="account-switcher" ref={bellRef}>
            <button className="theme-btn" style={{ position: 'relative' }} onClick={() => setBellOpen(!bellOpen)} aria-label={t('bell.label')}>
              <Bell size={18} />
              {upcoming.length > 0 && (
                <span style={{ position: 'absolute', top: 2, right: 2, minWidth: 15, height: 15, borderRadius: 8, background: 'var(--fho-orange-1)', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
                  {upcoming.length}
                </span>
              )}
            </button>
            {bellOpen && (
              <div className="account-dropdown" role="menu">
                <div className="account-greeting">
                  <div className="account-name">{t('bell.title')}</div>
                </div>
                <div className="account-divider" />
                {upcoming.length === 0 ? (
                  <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--fho-text-muted)' }}>{t('bell.empty')}</div>
                ) : (
                  upcoming.slice(0, 5).map(v => {
                    const title = v.property ? (getLocalizedText(v.property.title_i18n, i18n.language) || v.property.title) : ''
                    const time = new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit' }).format(new Date(v.scheduled_at))
                    return (
                      <button key={v.id} className="account-option" onClick={() => { setBellOpen(false); navigate('/viewings') }}>
                        <CalendarDays size={16} />
                        <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                          <span style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
                          <span style={{ fontSize: 11, color: 'var(--fho-text-muted)' }}>
                            {formatDate(v.scheduled_at, i18n.language)} · {time} · {t(`viewings.status.${v.status}`, v.status)}
                          </span>
                        </span>
                      </button>
                    )
                  })
                )}
                <div className="account-divider" />
                <button className="account-option" onClick={() => { setBellOpen(false); navigate('/viewings') }}>
                  {t('bell.viewAll')}
                </button>
              </div>
            )}
          </div>
        )}
        <button className="theme-btn" onClick={toggle} aria-label={t('common.toggleTheme')}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <div className="account-switcher" ref={accountRef}>
          {user ? (
            <>
              <button className="account-avatar-btn" onClick={() => setAccountOpen(!accountOpen)} aria-label={t('account.settings')}>
                <Avatar
                  src={profile?.avatar_url}
                  name={profile?.full_name || user?.user_metadata?.full_name}
                  email={user.email}
                  size={36}
                />
              </button>
              {accountOpen && (
                <div className="account-dropdown">
                  <div className="account-greeting">
                    <div className="account-name">{t('account.welcomeBack', { name: displayName })}</div>
                    <div className="account-email">{user.email}</div>
                  </div>
                  <div className="account-divider" />
                  <button className="account-option" onClick={() => handleNav('/my-listings')}><LayoutDashboard size={16} /> {t('account.myListings')}</button>
                  <button className="account-option" onClick={() => handleNav('/favorites')}><Heart size={16} /> {t('common.favorites')}</button>
                  <button className="account-option" onClick={() => handleNav('/profile')}><Settings size={16} /> {t('account.settings')}</button>
                  <div className="account-divider" />
                  <button className="account-option account-signout" onClick={() => { setAccountOpen(false); signOut() }}><LogOut size={16} /> {t('common.signOut')}</button>
                </div>
              )}
            </>
          ) : (
            <button className="account-signin-btn" onClick={() => navigate('/profile')}><User size={18} /></button>
          )}
        </div>
      </div>
    </header>
  )
}
