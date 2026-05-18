import { useTranslation } from 'react-i18next'
import { Sun, Moon, ChevronDown, User, LayoutDashboard, Heart, Settings, LogOut, Plus } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import '../styles/header.css'

const LANGUAGES = [
  { code: 'sq', flag: '\u{1F1E6}\u{1F1F1}', name: 'Shqip' },
  { code: 'en', flag: '\u{1F1EC}\u{1F1E7}', name: 'English' },
  { code: 'de', flag: '\u{1F1E9}\u{1F1EA}', name: 'Deutsch' },
  { code: 'it', flag: '\u{1F1EE}\u{1F1F9}', name: 'Italiano' },
  { code: 'es', flag: '\u{1F1EA}\u{1F1F8}', name: 'Español' },
  { code: 'pl', flag: '\u{1F1F5}\u{1F1F1}', name: 'Polski' },
  { code: 'ru', flag: '\u{1F1F7}\u{1F1FA}', name: 'Русский' },
  { code: 'fr', flag: '\u{1F1EB}\u{1F1F7}', name: 'Français' },
]

export default function Header() {
  const { t, i18n } = useTranslation()
  const { theme, toggle } = useTheme()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [langOpen, setLangOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [profile, setProfile] = useState(null)
  const langRef = useRef(null)
  const accountRef = useRef(null)

  const currentLang = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0]

  useEffect(() => {
    if (user) {
      supabase.from('profiles').select('full_name, avatar_url, role, agency_name').eq('id', user.id).single()
        .then(({ data }) => { if (data) setProfile(data) })
    } else {
      setProfile(null)
    }
  }, [user])

  useEffect(() => {
    const handleClick = (e) => {
      if (langRef.current && !langRef.current.contains(e.target)) setLangOpen(false)
      if (accountRef.current && !accountRef.current.contains(e.target)) setAccountOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const changeLanguage = async (code) => {
    i18n.changeLanguage(code)
    localStorage.setItem('fho_lang', code)
    setLangOpen(false)

    if (user) {
      await supabase
        .from('profiles')
        .update({ preferred_language: code })
        .eq('id', user.id)
    }
  }

  const displayName = profile?.full_name || user?.email?.split('@')[0] || ''
  const initials = displayName.slice(0, 2).toUpperCase()

  const handleNav = (path) => {
    setAccountOpen(false)
    navigate(path)
  }

  return (
    <header className="app-header">
      <div className="header-brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>Shtëpia.ime</div>
      <div className="header-actions">
        {user && (
          <button className="new-listing-btn" onClick={() => navigate('/new-listing')}>
            <Plus size={16} />
            <span className="new-listing-label">{t('listing.newListing')}</span>
          </button>
        )}
        <div className="lang-switcher" ref={langRef}>
          <button className="lang-btn" onClick={() => setLangOpen(!langOpen)}>
            <span className="lang-flag">{currentLang.flag}</span>
            <span className="lang-name">{currentLang.name}</span>
            <ChevronDown size={14} className={`lang-chevron ${langOpen ? 'open' : ''}`} />
          </button>
          {langOpen && (
            <div className="lang-dropdown">
              {LANGUAGES.map(lang => (
                <button
                  key={lang.code}
                  className={`lang-option ${lang.code === i18n.language ? 'active' : ''}`}
                  onClick={() => changeLanguage(lang.code)}
                >
                  <span className="lang-flag">{lang.flag}</span>
                  <span>{lang.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="theme-btn" onClick={toggle} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <div className="account-switcher" ref={accountRef}>
          {user ? (
            <>
              <button className="account-avatar-btn" onClick={() => setAccountOpen(!accountOpen)}>
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="account-avatar-img" />
                ) : (
                  <span className="account-avatar-initials">{initials}</span>
                )}
              </button>
              {accountOpen && (
                <div className="account-dropdown">
                  <div className="account-greeting">
                    <div className="account-name">{t('account.welcomeBack', { name: displayName })}</div>
                    <div className="account-email">{user.email}</div>
                  </div>
                  <div className="account-divider" />
                  <button className="account-option" onClick={() => handleNav('/my-listings')}>
                    <LayoutDashboard size={16} /> {t('account.myListings')}
                  </button>
                  <button className="account-option" onClick={() => handleNav('/favorites')}>
                    <Heart size={16} /> {t('common.favorites')}
                  </button>
                  <button className="account-option" onClick={() => handleNav('/profile')}>
                    <Settings size={16} /> {t('account.settings')}
                  </button>
                  <div className="account-divider" />
                  <button className="account-option account-signout" onClick={() => { setAccountOpen(false); signOut() }}>
                    <LogOut size={16} /> {t('common.signOut')}
                  </button>
                </div>
              )}
            </>
          ) : (
            <button className="account-signin-btn" onClick={() => navigate('/profile')}>
              <User size={18} />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
