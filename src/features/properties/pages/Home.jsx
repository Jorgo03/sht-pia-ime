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

const NEIGHBORHOOD_COLORS = ['#ff7d1a', '#e85d00', '#cc5200', '#ff9f4a', '#d4722a', '#b85c1a']

export default function Home() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { properties, loading, error } = useProperties({ limit: 24 })
  const { recentIds } = useRecentlyViewed()
  const { properties: recentProperties } = usePropertiesByIds(recentIds.slice(0, 6))

  const hour = new Date().getHours()
  const greeting = hour < 12 ? t('home.greetingMorning') : t('home.greetingEvening')
  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || ''
  const matchCount = properties.length

  const featured = properties[0]
  const matched = properties.slice(1, 7)

  const neighborhoods = properties.reduce((acc, p) => {
    if (p.city && !acc.find(n => n.name === p.city)) {
      acc.push({ name: p.city, count: properties.filter(x => x.city === p.city).length })
    }
    return acc
  }, []).slice(0, 4)

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
          {t('common.error')}: {error}
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

      {!loading && neighborhoods.length > 0 && (
        <section>
          <h2 className="section-title__bare">{t('home.neighborhoods')}</h2>
          <div className="neighborhood-grid">
            {neighborhoods.map((n, i) => (
              <div
                key={n.name}
                className="neighborhood-card"
                style={{ background: `linear-gradient(135deg, ${NEIGHBORHOOD_COLORS[i % NEIGHBORHOOD_COLORS.length]}22, ${NEIGHBORHOOD_COLORS[i % NEIGHBORHOOD_COLORS.length]}06)` }}
                onClick={() => navigate(`/search?city=${encodeURIComponent(n.name)}`)}
              >
                <span className="neighborhood-name">{n.name}</span>
                <span className="neighborhood-sub">{t('home.country')}</span>
                <span className="neighborhood-count" style={{ color: NEIGHBORHOOD_COLORS[i % NEIGHBORHOOD_COLORS.length] }}>
                  {t('home.homesCount', { count: n.count })}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
