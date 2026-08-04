import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './features/auth/AuthContext'
import { FavoritesProvider } from './features/favorites/FavoritesContext'
import { ThemeProvider } from './shared/ThemeContext'
import { AddSheetProvider, useAddSheet } from './features/quick-add/AddSheetContext'
import Header from './shared/Header'
import BottomNav from './shared/BottomNav'
import AddSheet from './features/quick-add/AddSheet'
import ProtectedRoute from './shared/ProtectedRoute'
import LoadingScreen from './shared/LoadingScreen'
import Home from './features/properties/pages/Home'
import Search from './features/properties/pages/Search'
import Favorites from './features/favorites/pages/Favorites'
import Profile from './features/auth/pages/Profile'
import PropertyDetail from './features/properties/pages/PropertyDetail'
import AuthCallback from './features/auth/pages/AuthCallback'
import NotFound from './shared/pages/NotFound'
import CookieConsent from './shared/CookieConsent'
import WelcomeToast from './shared/WelcomeToast'

// Heavy or signed-in-only screens are split out of the first-paint bundle
// (PropertyDashboard alone pulls in recharts).
const Messages = lazy(() => import('./features/messaging/pages/Messages'))
const AgentDashboard = lazy(() => import('./features/listings/pages/AgentDashboard'))
const MyListings = lazy(() => import('./features/listings/pages/MyListings'))
const PropertyDashboard = lazy(() => import('./features/listings/pages/PropertyDashboard'))
const NewListing = lazy(() => import('./features/listings/pages/NewListing'))
const AgentProfile = lazy(() => import('./features/properties/pages/AgentProfile'))
const Viewings = lazy(() => import('./features/viewings/pages/Viewings'))
const SavedSearches = lazy(() => import('./features/saved-searches/pages/SavedSearches'))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function AddSheetToast() {
  const { toast, setToast } = useAddSheet()
  if (!toast) return null
  return (
    <div className="addsheet-toast" role="status" onClick={() => setToast(null)}>
      {toast}
    </div>
  )
}

function RouteFallback() {
  return <div className="page" />
}

// Gates the app shell on AuthContext's initial session check (the same
// `loading` flag ProtectedRoute already waits on) so a cold load shows the
// splash instead of a flash of signed-out header/nav.
function AppShell() {
  const { loading } = useAuth()

  if (loading) return <LoadingScreen state="splash" />

  return (
    <div className="app-shell">
      <ScrollToTop />
      <Header />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/favorites" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
          <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/property/:id" element={<PropertyDetail />} />
          <Route path="/agent/:id" element={<AgentProfile />} />
          <Route path="/agent-dashboard" element={<ProtectedRoute requireRole="agent"><AgentDashboard /></ProtectedRoute>} />
          <Route path="/my-listings" element={<ProtectedRoute><MyListings /></ProtectedRoute>} />
          <Route path="/my-listings/:id/dashboard" element={<ProtectedRoute><PropertyDashboard /></ProtectedRoute>} />
          <Route path="/new-listing" element={<ProtectedRoute><NewListing /></ProtectedRoute>} />
          <Route path="/viewings" element={<ProtectedRoute><Viewings /></ProtectedRoute>} />
          <Route path="/saved-searches" element={<ProtectedRoute><SavedSearches /></ProtectedRoute>} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <BottomNav />
      <AddSheet />
      <AddSheetToast />
      <CookieConsent />
      <WelcomeToast />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <FavoritesProvider>
            <AddSheetProvider>
              <AppShell />
            </AddSheetProvider>
          </FavoritesProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
