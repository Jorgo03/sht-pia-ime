import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import Search from './pages/Search'
import Property from './pages/Property'
import NotFound from './pages/NotFound'
import AuthScreen from './auth/AuthScreen'
import Account from './pages/Account'

const AUTH_PATHS = ['/login', '/signup', '/forgot-password']

export default function App() {
  const { pathname, hash } = useLocation()
  const { t } = useTranslation()

  // A new page starts at the top; an in-page link (#app) scrolls to its section.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
    else window.scrollTo(0, 0)
  }, [pathname, hash])

  return (
    <>
      <a className="skip-link" href="#main">{t('web.skip')}</a>
      <Header overHero={pathname === '/'} dark={AUTH_PATHS.includes(pathname)} />
      <main id="main" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/property/:id" element={<Property />} />
          <Route path="/login" element={<AuthScreen key="signin" start="signin" />} />
          <Route path="/signup" element={<AuthScreen key="signup" start="signup" />} />
          <Route path="/forgot-password" element={<AuthScreen key="recover" start="recover" />} />
          <Route path="/account" element={<Account />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      {/* Like the app, the sign-in screen has no footer: its card carries the legal links. */}
      {!AUTH_PATHS.includes(pathname) && <Footer />}
    </>
  )
}
