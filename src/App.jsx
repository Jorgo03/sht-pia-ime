import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { FavoritesProvider } from './contexts/FavoritesContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { AddSheetProvider, useAddSheet } from './contexts/AddSheetContext'
import { QueryCacheProvider } from './contexts/QueryCache'
import Header from './components/Header'
import BottomNav from './components/BottomNav'
import AddSheet from './components/AddSheet'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import Search from './pages/Search'
import Favorites from './pages/Favorites'
import Messages from './pages/Messages'
import Profile from './pages/Profile'
import PropertyDetail from './pages/PropertyDetail'
import AgentDashboard from './pages/AgentDashboard'
import MyListings from './pages/MyListings'
import PropertyDashboard from './pages/PropertyDashboard'
import NewListing from './pages/NewListing'
import AgentProfile from './pages/AgentProfile'
import AuthCallback from './pages/AuthCallback'
import NotFound from './pages/NotFound'
import CookieConsent from './components/CookieConsent'
import WelcomeToast from './components/WelcomeToast'

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
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
