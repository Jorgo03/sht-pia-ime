import { useTranslation } from 'react-i18next'
import { Sun, Moon, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
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
  const { i18n } = useTranslation()
  const { theme, toggle } = useTheme()
  const { user } = useAuth()
  const [langOpen, setLangOpen] = useState(false)
  const dropdownRef = useRef(null)

  const currentLang = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0]

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setLangOpen(false)
      }
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

  return (
    <header className="app-header">
      <div className="header-brand">Shtëpia.ime</div>
      <div className="header-actions">
        <div className="lang-switcher" ref={dropdownRef}>
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
      </div>
    </header>
  )
}
