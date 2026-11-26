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
import Favorites from './pages/Favorites'
import Messages from './pages/Messages'
import Thread from './pages/Thread'
import Viewings from './pages/Viewings'
import Compare from './pages/Compare'
import SavedSearches from './pages/SavedSearches'
import Wanted from './pages/Wanted'
import Agents from './pages/Agents'
import PublicProfile from './pages/PublicProfile'
import Notifications from './pages/Notifications'
import Guide from './pages/Guide'

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
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/messages/:id" element={<Thread />} />
          <Route path="/viewings" element={<Viewings />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/saved-searches" element={<SavedSearches />} />
          <Route path="/wanted" element={<Wanted />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/agent/:id" element={<PublicProfile />} />
          <Route path="/user/:id" element={<PublicProfile />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/guide" element={<Guide />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      {/* Like the app, the sign-in screen has no footer: its card carries the legal links. */}
      {!AUTH_PATHS.includes(pathname) && <Footer />}
    </>
  )
}
