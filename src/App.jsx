import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthContext'
import { FavoritesProvider } from './features/favorites/FavoritesContext'
import { ThemeProvider } from './shared/ThemeContext'
import { AddSheetProvider, useAddSheet } from './features/quick-add/AddSheetContext'
import { QueryCacheProvider } from './shared/QueryCache'
import Header from './shared/Header'
import BottomNav from './shared/BottomNav'
import AddSheet from './features/quick-add/AddSheet'
import ProtectedRoute from './shared/ProtectedRoute'
import Home from './features/properties/pages/Home'
import Search from './features/properties/pages/Search'
import Favorites from './features/favorites/pages/Favorites'
import Messages from './features/messaging/pages/Messages'
import Profile from './features/auth/pages/Profile'
import PropertyDetail from './features/properties/pages/PropertyDetail'
import AgentDashboard from './features/listings/pages/AgentDashboard'
import MyListings from './features/listings/pages/MyListings'
import PropertyDashboard from './features/listings/pages/PropertyDashboard'
import NewListing from './features/listings/pages/NewListing'
import AgentProfile from './features/properties/pages/AgentProfile'
import AuthCallback from './features/auth/pages/AuthCallback'
import NotFound from './shared/pages/NotFound'
import CookieConsent from './shared/CookieConsent'
import WelcomeToast from './shared/WelcomeToast'

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

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <FavoritesProvider>
            <QueryCacheProvider>
              <AddSheetProvider>
                <div className="app-shell">
                  <ScrollToTop />
                  <Header />
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
                    <Route path="/auth/callback" element={<AuthCallback />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                  <BottomNav />
                  <AddSheet />
                  <AddSheetToast />
                  <CookieConsent />
                  <WelcomeToast />
                </div>
              </AddSheetProvider>
            </QueryCacheProvider>
          </FavoritesProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
