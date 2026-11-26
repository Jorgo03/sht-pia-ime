import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { filterAgents, initialsOf } from '@/src/features/properties/lib/discovery.js'
import { getAgentDirectory } from '../lib/api'
import { EmptyState, ErrorState } from '../components/States'

// Agencies and agents with live listings, as in the app (app/agents/index.tsx).
export default function Agents() {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const q = useQuery({ queryKey: ['agents'], queryFn: getAgentDirectory })
  const list = filterAgents(q.data ?? [], query)

  useEffect(() => {
    document.title = `${t('agents.headlinePre')} ${t('agents.headlineEm')} | ${t('common.appName')}`
  }, [t])

  return (
    <div className="page container section">
      <div className="section-head">
        <h1 className="page-title">{t('agents.headlinePre')} {t('agents.headlineEm')}</h1>
      </div>
      <label className="search-input">
        <Search size={18} aria-hidden="true" />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('agents.searchPlaceholder')} aria-label={t('agents.searchPlaceholder')} />
      </label>
      {q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : q.isPending ? (
        <ul className="agent-list" aria-hidden="true">{[0, 1, 2].map((i) => <li key={i} className="agent is-skeleton" />)}</ul>
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState title={t('agents.empty')} hint={t('agents.emptyHint')} />
      ) : list.length === 0 ? (
        <EmptyState title={t('agents.noResults')} />
      ) : (
        <ul className="agent-list">
          {list.map((a) => (
            <li key={a.id}>
              <Link to={`/agent/${a.id}`} className="agent">
                {a.avatar ? <img src={a.avatar} alt="" loading="lazy" decoding="async" /> : <span className="agent-initials" aria-hidden="true">{initialsOf(a.title)}</span>}
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
  )
}
