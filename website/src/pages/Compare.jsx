import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Columns3, Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { allFeatures, bestOf, pricePerM2 } from '@/src/features/properties/lib/compare.js'
import { supabase } from '../lib/supabase'
import { removeCompare, useCompare, MAX_COMPARE } from '../features/compare'
import { EmptyState, ErrorState } from '../components/States'
import { cityName, formatPrice, priceOf, titleOf } from '../lib/format'

const COLUMNS = 'id, title, title_i18n, price, currency, sqft, beds, baths, floor, total_floors, year_built, property_type, listing_type, city, zone, features, image_urls'

// Homes side by side, as in the app (app/compare.tsx), with the best value on
// each measure marked.
export default function Compare() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const ids = useCompare()
  const q = useQuery({
    queryKey: ['compare', ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('properties').select(COLUMNS).in('id', ids).eq('status', 'active')
      if (error) throw error
      const byId = new Map((data ?? []).map((h) => [h.id, h]))
      return ids.map((id) => byId.get(id)).filter(Boolean)
    },
  })

  useEffect(() => {
    document.title = `${t('compare.headlinePre')} ${t('compare.headlineEm')} | ${t('common.appName')}`
  }, [t])

  const homes = q.data ?? []
  const best = bestOf(homes)
  const none = t('aiAssistant.notSpecified')
  const mark = (home, winner, label) => (winner === home.id ? <span className="pill best">{label}</span> : null)
  const rows = [
    ['price', t('aiAssistant.compare.price'), (h) => <>{priceOf(h, lang)} {mark(h, best.price, t('aiAssistant.compare.best.price'))}</>],
    ['perM2', t('aiAssistant.compare.pricePerM2'), (h) => {
      const v = pricePerM2(h)
      return v ? <>{formatPrice(v, lang, h.currency)} {mark(h, best.perM2, t('aiAssistant.compare.best.perM2'))}</> : none
    }],
    ['area', t('aiAssistant.compare.area'), (h) => (h.sqft ? <>{h.sqft} m² {mark(h, best.area, t('aiAssistant.compare.best.area'))}</> : none)],
    ['beds', t('aiAssistant.compare.bedrooms'), (h) => (h.beds != null ? <>{h.beds} {mark(h, best.beds, t('aiAssistant.compare.best.beds'))}</> : none)],
    ['baths', t('aiAssistant.compare.bathrooms'), (h) => (h.baths != null ? h.baths : none)],
    ['floor', t('aiAssistant.compare.floor'), (h) => (h.floor != null ? (h.total_floors ? t('aiAssistant.compare.floorOf', { floor: h.floor, total: h.total_floors }) : h.floor) : none)],
    ['year', t('compare.yearBuilt'), (h) => h.year_built || none],
    ['type', t('compare.type'), (h) => (h.property_type ? t(`search.${h.property_type}`, { defaultValue: h.property_type }) : none)],
    ['place', t('aiAssistant.compare.location'), (h) => [h.zone, h.city && cityName(h.city, lang)].filter(Boolean).join(', ') || none],
  ]
  const features = allFeatures(homes)

  return (
    <div className="page container section">
      <div className="section-head">
        <h1 className="page-title">
          {t('compare.headlinePre')} {t('compare.headlineEm')}
        </h1>
      </div>
      {ids.length === 0 ? (
        <EmptyState title={t('compare.empty')} hint={t('compare.emptyHint')}>
          <Link to="/search" className="btn btn-primary">{t('compare.browse')}</Link>
        </EmptyState>
      ) : q.isError ? (
        <>
          <p className="state">{t('compare.loadFailed')}</p>
          <ErrorState onRetry={() => q.refetch()} />
        </>
      ) : q.isPending ? (
        <div className="compare is-skeleton" aria-busy="true" />
      ) : (
        <div className="compare-scroll">
          <table className="compare">
            <thead>
              <tr>
                <th scope="col"><span className="visually-hidden">{t('compare.headlineEm')}</span></th>
                {homes.map((h) => (
                  <th key={h.id} scope="col">
                    <div className="compare-home">
                      {h.image_urls?.[0] && <img src={h.image_urls[0]} alt="" loading="lazy" decoding="async" />}
                      <Link to={`/property/${h.id}`}>{titleOf(h, lang)}</Link>
                      <button type="button" className="nav-icon" onClick={() => removeCompare(h.id)} aria-label={t('compare.remove')}>
                        <X size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </th>
                ))}
                {homes.length < MAX_COMPARE && (
                  <th scope="col">
                    <Link to="/search" className="compare-add">
                      <Plus size={20} aria-hidden="true" />
                      {t('compare.addAnother')}
                    </Link>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map(([key, label, cell]) => (
                <tr key={key}>
                  <th scope="row">{label}</th>
                  {homes.map((h) => <td key={h.id}>{cell(h)}</td>)}
                  {homes.length < MAX_COMPARE && <td />}
                </tr>
              ))}
              {features.length > 0 && (
                <tr>
                  <th scope="row">{t('aiAssistant.compare.amenities')}</th>
                  {homes.map((h) => (
                    <td key={h.id}>
                      <ul className="compare-features">
                        {features.map((f) => (
                          <li key={f} className={h.features?.includes(f) ? 'yes' : 'no'}>
                            {t(`listing.feature.${f}`, { defaultValue: f })}: {h.features?.includes(f) ? t('compare.yes') : t('compare.no')}
                          </li>
                        ))}
                      </ul>
                    </td>
                  ))}
                  {homes.length < MAX_COMPARE && <td />}
                </tr>
              )}
            </tbody>
          </table>
          <button type="button" className="btn btn-outline" onClick={() => ids.forEach(removeCompare)}>
            <Columns3 size={16} aria-hidden="true" />
            {t('compare.clear')}
          </button>
        </div>
      )}
    </div>
  )
}
