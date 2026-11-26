import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import Search from './pages/Search'
import Property from './pages/Property'
import NotFound from './pages/NotFound'
import AuthScreen from './auth/AuthScreen'
const Account = lazy(() => import('./pages/Account'))
const Favorites = lazy(() => import('./pages/Favorites'))
const Messages = lazy(() => import('./pages/Messages'))
const Thread = lazy(() => import('./pages/Thread'))
const Viewings = lazy(() => import('./pages/Viewings'))
const Compare = lazy(() => import('./pages/Compare'))
const SavedSearches = lazy(() => import('./pages/SavedSearches'))
const Wanted = lazy(() => import('./pages/Wanted'))
const Agents = lazy(() => import('./pages/Agents'))
const PublicProfile = lazy(() => import('./pages/PublicProfile'))
const Notifications = lazy(() => import('./pages/Notifications'))
const Guide = lazy(() => import('./pages/Guide'))
const MyListings = lazy(() => import('./pages/MyListings'))
const ListingStats = lazy(() => import('./pages/ListingStats'))
const AgentDashboard = lazy(() => import('./pages/AgentDashboard'))
const Leads = lazy(() => import('./pages/Leads'))
const Performance = lazy(() => import('./pages/Performance'))
const ImportListings = lazy(() => import('./pages/ImportListings'))
const NewListing = lazy(() => import('./listing/NewListing'))
import RequireAuth from './auth/RequireAuth'

function OldEdit() {
  const { id } = useParams()
  return <Navigate to={`/listing/${id}/edit`} replace />
}

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
        {/* Pages other than home, search and listings load when first opened. */}
        <Suspense fallback={<div className="page container section" aria-busy="true" />}>
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
          <Route path="/my-listings" element={<MyListings />} />
          <Route path="/listing/new" element={<RequireAuth><NewListing /></RequireAuth>} />
          <Route path="/listing/:id/edit" element={<RequireAuth><NewListing /></RequireAuth>} />
          <Route path="/listing/:id/analytics" element={<ListingStats />} />
          <Route path="/listing/import" element={<ImportListings />} />
          <Route path="/agent-dashboard" element={<AgentDashboard />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/performance" element={<Performance />} />
          {/* The old website's addresses for the same pages. */}
          <Route path="/new-listing" element={<Navigate to="/listing/new" replace />} />
          <Route path="/my-listings/:id/edit" element={<OldEdit />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </main>
      {/* Like the app, the sign-in screen has no footer: its card carries the legal links. */}
      {!AUTH_PATHS.includes(pathname) && <Footer />}
    </>
  )
}
