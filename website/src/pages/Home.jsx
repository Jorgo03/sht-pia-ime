import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { initialsOf } from '@/src/features/properties/lib/discovery.js'
import SearchPanel from '../components/SearchPanel'
import HeroTypewriter from '../components/HeroTypewriter'
import PropertyCard, { CardSkeleton } from '../components/PropertyCard'
import { ErrorState } from '../components/States'
import { getAgentDirectory, getCityTiles, getProperties, getPropertiesByIds } from '../lib/api'
import { recentlyViewedIds } from '../features/listing'
import { cityName } from '../lib/format'
import { AI_CHAT_ENABLED } from '../lib/features'

function Hero() {
  const { t } = useTranslation()
  return (
    <section className="hero" aria-labelledby="hero-title">
      <img
        className="hero-photo"
        src="/images/hero-1280.webp"
        srcSet="/images/hero-720.webp 720w, /images/hero-1280.webp 1280w, /images/hero-2400.webp 2400w"
        sizes="100vw"
        alt=""
        fetchPriority="high"
      />
      <div className="hero-shade" />
      <div className="container hero-inner">
        <HeroTypewriter />
        <p className="hero-lead">{t('site.hero.lead')}</p>
        <SearchPanel />
        {AI_CHAT_ENABLED && (
          <Link to="/assistant" className="ai-entry">
            <Sparkles size={18} aria-hidden="true" />
            <span>
              <strong>{t('aiAssistant.entry')}</strong>
              <span>{t('aiAssistant.entryHint')}</span>
            </span>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        )}
      </div>
    </section>
  )
}

function SectionHead({ id, title, lead, action }) {
  return (
    <div className="section-head">
      <div>
        <h2 id={id}>{title}</h2>
        {lead && <p>{lead}</p>}
      </div>
      {action}
    </div>
  )
}

function Latest() {
  const { t } = useTranslation()
  const q = useQuery({ queryKey: ['latest'], queryFn: () => getProperties({}, 0, 6) })
  return (
    <section className="section" aria-labelledby="latest-title">
      <div className="container">
        <SectionHead
          id="latest-title"
          title={t('site.listings.title')}
          action={
            <Link to="/search" className="text-link">
              {t('web.seeAll')}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          }
        />
        {q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : (
          <div className="grid">
            {q.isPending
              ? Array.from({ length: 3 }, (_, i) => <CardSkeleton key={i} />)
              : q.data.map((p) => <PropertyCard key={p.id} property={p} />)}
          </div>
        )}
      </div>
    </section>
  )
}

function Cities() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const q = useQuery({ queryKey: ['cities'], queryFn: getCityTiles })
  return (
    <section className="section is-stone" aria-labelledby="cities-title">
      <div className="container">
        <SectionHead id="cities-title" title={t('web.cities.title')} />
        {q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : (
          <ul className="cities">
            {(q.data ?? Array.from({ length: 8 }, (_, i) => ({ city: String(i), pending: true }))).map((c) => (
              <li key={c.city}>
                {c.pending ? (
                  <span className="city is-skeleton" aria-hidden="true" />
                ) : (
                  <Link to={`/search?city=${encodeURIComponent(c.city)}`} className={`city ${c.photo ? 'has-photo' : ''}`}>
                    {c.photo && <img src={c.photo} alt="" loading="lazy" decoding="async" />}
                    <span className="city-name">{cityName(c.city, lang)}</span>
                    <span className="city-count">{t('search.results', { count: c.count })}</span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function Agents() {
  const { t } = useTranslation()
  const q = useQuery({ queryKey: ['agents'], queryFn: getAgentDirectory })
  return (
    <section id="agents" className="section" aria-labelledby="agents-title">
      <div className="container agents">
        <div>
          <SectionHead id="agents-title" title={t('web.agents.title')} lead={t('web.agents.body')} />
          {q.isError ? (
            <ErrorState onRetry={() => q.refetch()} />
          ) : q.isPending ? (
            <ul className="agent-list" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <li key={i} className="agent is-skeleton" />
              ))}
            </ul>
          ) : q.data.length === 0 ? (
            <p className="agents-empty">{t('web.agents.empty')}</p>
          ) : (
            <ul className="agent-list">
              {q.data.slice(0, 6).map((a) => (
                <li key={a.id}>
                  <Link to={`/agent/${a.id}`} className="agent">
                  {a.avatar ? (
                    <img src={a.avatar} alt="" loading="lazy" decoding="async" />
                  ) : (
                    <span className="agent-initials" aria-hidden="true">
                      {initialsOf(a.title)}
                    </span>
                  )}
                  <div>
                    <p className="agent-name">{a.title}</p>
                    {a.subtitle && <p className="agent-sub">{a.subtitle}</p>}
                    <p className="agent-sub">{t('search.results', { count: a.listings })}</p>
                  </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <aside className="join" aria-labelledby="join-title">
          <h3 id="join-title">{t('web.agents.joinTitle')}</h3>
          <p>{t('web.agents.joinBody')}</p>
          <Link to={{ hash: '#app' }} className="btn btn-primary">
            {t('web.nav.app')}
          </Link>
        </aside>
      </div>
    </section>
  )
}

// The homes this visitor opened last, as on the app's Home (this browser only).
function RecentlyViewed() {
  const { t } = useTranslation()
  const [ids] = useState(recentlyViewedIds)
  const q = useQuery({ queryKey: ['recent', ids], enabled: ids.length > 0, queryFn: () => getPropertiesByIds(ids.slice(0, 6)) })
  if (ids.length === 0 || q.isError || (q.data && q.data.length === 0)) return null
  return (
    <section className="section" aria-labelledby="recent-title">
      <div className="container">
        <SectionHead id="recent-title" title={t('common.recentlyViewed')} />
        <div className="grid">
          {q.isPending
            ? Array.from({ length: Math.min(ids.length, 3) }, (_, i) => <CardSkeleton key={i} />)
            : q.data.map((p) => <PropertyCard key={p.id} property={p} />)}
        </div>
      </div>
    </section>
  )
}

export default function Home() {
  const { t } = useTranslation()
  useEffect(() => {
    document.title = `${t('common.appName')} | ${t('site.hero.title')} ${t('site.hero.titleEm')}`
  }, [t])
  return (
    <>
      <Hero />
      <RecentlyViewed />
      <Latest />
      <Cities />
      <Agents />
    </>
  )
}
