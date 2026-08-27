import { useState } from 'react'
import { Search as SearchIcon } from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import FeaturedCard from '../components/FeaturedCard'
import PropertyCard from '../components/PropertyCard'
import SkeletonCard from '../../../shared/SkeletonCard'
import { useProperties, usePropertiesByIds } from '../hooks/useProperties'
import { useRecentlyViewed } from '../hooks/useRecentlyViewed'
import { useAuth } from '../../auth/AuthContext'
import '../../../styles/home.css'

// Device-local hour, not UTC — 6-12 morning, 12-19 afternoon, else evening.
// The previous version only split morning/evening (hour < 12), which
// silently mislabeled both the afternoon and the 00:00-05:59 window.
function getGreeting(hour, t) {
  if (hour >= 6 && hour < 12) return t('home.greetingMorning')
  if (hour >= 12 && hour < 19) return t('home.greetingAfternoon')
  return t('home.greetingEvening')
}

export default function Home() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { properties, loading, error } = useProperties({ limit: 24 })
  const { recentIds } = useRecentlyViewed()
  const { properties: recentProperties } = usePropertiesByIds(recentIds.slice(0, 6))

  const greeting = getGreeting(new Date().getHours(), t)
  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || ''
  const matchCount = properties.length

  const featured = properties[0]
  const matched = properties.slice(1, 7)

  return (
    <div className="home-screen">
      <section className="screen-head">
        <div className="screen-kicker">
          <span className="screen-kicker__dash" />
          {greeting}
        </div>
        <h1 className="screen-headline">
          {greeting}{displayName ? `, ${displayName}` : ''}. <em>{t('home.matchesToday', { count: matchCount })}</em>
        </h1>
      </section>

      <button className="home-search-bar" onClick={() => navigate('/search')}>
        <SearchIcon size={18} />
        <span>{t('home.searchPlaceholder')}</span>
        <span className="filters-chip">{t('search.filters')}</span>
      </button>

      {loading && (
        <div style={{ padding: '0 1.25rem' }}>
          <div className="property-grid" style={{ padding: 0 }}>
            {Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      )}

      {error && (
        <div className="placeholder-card" style={{ margin: '0 1.25rem' }}>
          {t('errors.generic')}
        </div>
      )}

      {!loading && featured && (
        <section>
          <header className="section-title">
            <h2>{t('home.featured')}</h2>
            <span className="mono-eyebrow">{t('home.editorsPick')}</span>
          </header>
          <FeaturedCard property={featured} />
        </section>
      )}

      {!loading && matched.length > 0 && (
        <section>
          <header className="section-title">
            <h2>{t('home.matched')}</h2>
            <Link to="/search">{t('home.seeAll')}</Link>
          </header>
          <div className="h-scroll snap-x">
            {matched.map(p => <PropertyCard key={p.id} property={p} variant="compact" />)}
          </div>
        </section>
      )}

      {recentProperties.length > 0 && (
        <section>
          <header className="section-title">
            <h2>{t('common.recentlyViewed')}</h2>
          </header>
          <div className="h-scroll snap-x">
            {recentProperties.map(p => <PropertyCard key={p.id} property={p} variant="compact" />)}
          </div>
        </section>
      )}

      {/* "Trending neighborhoods" removed per owner request 2026-07-14; the
          removal was confirmed permanent 2026-08-18, so its CSS (home.css,
          polish.css) and `home.neighborhoods` i18n keys are gone too. */}
    </div>
  )
}
