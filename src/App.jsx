import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { FavoritesProvider } from './contexts/FavoritesContext'
import { ThemeProvider } from './contexts/ThemeContext'
import Header from './components/Header'
import BottomNav from './components/BottomNav'
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

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <FavoritesProvider>
            <div className="app-shell">
              <Header />
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/search" element={<Search />} />
                <Route path="/favorites" element={<Favorites />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/property/:id" element={<PropertyDetail />} />
                <Route path="/agent-dashboard" element={<AgentDashboard />} />
                <Route path="/my-listings" element={<MyListings />} />
                <Route path="/my-listings/:id/dashboard" element={<PropertyDashboard />} />
                <Route path="/new-listing" element={<NewListing />} />
              </Routes>
              <BottomNav />
            </div>
          </FavoritesProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
