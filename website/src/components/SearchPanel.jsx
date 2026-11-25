import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BedDouble, Building2, Euro, MapPin, Ruler, Search as SearchIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CITIES } from '@/src/features/properties/data/locations.js'
import { cityName, formatPrice, PROPERTY_TYPES } from '../lib/format'

const PRICES = {
  sale: [50000, 100000, 150000, 200000, 300000, 500000, 1000000],
  rent: [300, 500, 800, 1200, 2000, 3000],
}
const AREAS = [50, 75, 100, 150, 200]
const BEDS = [1, 2, 3, 4]

/** Current URL params → the panel's fields. */
export function fieldsFrom(params) {
  return {
    deal: params?.get('deal') ?? '',
    city: params?.get('city') ?? '',
    type: params?.get('type') ?? '',
    beds: params?.get('beds') ?? '',
    area: params?.get('area') ?? '',
    max: params?.get('max') ?? '',
  }
}

function Field({ icon: Icon, label, value, onChange, children }) {
  return (
    <label className="sp-field">
      <span className="sp-label">
        <Icon size={15} aria-hidden="true" />
        {label}
      </span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </label>
  )
}

/**
 * The search form: a deal switch over five fields. Submitting always lands on
 * /search with only the fields that were set, so results are linkable.
 */
export default function SearchPanel({ initial, variant = 'hero' }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const navigate = useNavigate()
  const [f, setF] = useState(() => initial ?? fieldsFrom(null))
  const set = (key) => (value) => setF((prev) => ({ ...prev, [key]: value, ...(key === 'deal' ? { max: '' } : {}) }))

  const submit = (e) => {
    e.preventDefault()
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(f)) if (v) params.set(k, v)
    navigate(`/search${params.size ? `?${params}` : ''}`)
  }

  const prices = PRICES[f.deal === 'rent' ? 'rent' : 'sale']
  const cities = [...CITIES].sort((a, b) => cityName(a.city, lang).localeCompare(cityName(b.city, lang), lang))

  return (
    <form className={`search-panel is-${variant}`} onSubmit={submit} role="search">
      <div className="sp-deal" role="radiogroup" aria-label={t('search.listingType')}>
        {[
          ['', t('web.search.all')],
          ['sale', t('detail.forSale')],
          ['rent', t('detail.forRent')],
        ].map(([value, label]) => (
          <label key={value || 'all'} className={f.deal === value ? 'is-on' : ''}>
            <input type="radio" name="deal" value={value} checked={f.deal === value} onChange={() => set('deal')(value)} />
            {label}
          </label>
        ))}
      </div>
      <div className="sp-fields">
        <Field icon={MapPin} label={t('web.search.location')} value={f.city} onChange={set('city')}>
          <option value="">{t('web.search.anyCity')}</option>
          {cities.map((c) => (
            <option key={c.id} value={c.city}>
              {cityName(c.city, lang)}
            </option>
          ))}
        </Field>
        <Field icon={Building2} label={t('search.propertyType')} value={f.type} onChange={set('type')}>
          <option value="">{t('search.anyType')}</option>
          {PROPERTY_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`search.${type}`)}
            </option>
          ))}
        </Field>
        <Field icon={BedDouble} label={t('web.search.rooms')} value={f.beds} onChange={set('beds')}>
          <option value="">{t('web.search.any')}</option>
          {BEDS.map((n) => (
            <option key={n} value={n}>
              {t('web.search.roomsMin', { n })}
            </option>
          ))}
        </Field>
        <Field icon={Ruler} label={t('web.search.area')} value={f.area} onChange={set('area')}>
          <option value="">{t('web.search.any')}</option>
          {AREAS.map((n) => (
            <option key={n} value={n}>
              {t('web.search.areaMin', { n })}
            </option>
          ))}
        </Field>
        <Field icon={Euro} label={t('search.maxPrice')} value={f.max} onChange={set('max')}>
          <option value="">{t('web.search.any')}</option>
          {prices.map((n) => (
            <option key={n} value={n}>
              {t('web.search.priceUpTo', { price: formatPrice(n, lang, 'EUR') })}
            </option>
          ))}
        </Field>
        <button type="submit" className="btn btn-primary sp-submit">
          <SearchIcon size={18} aria-hidden="true" />
          {t('web.search.submit')}
        </button>
      </div>
    </form>
  )
}
