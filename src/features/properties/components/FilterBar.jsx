import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { Home, MapPin, BedDouble, Bath, Euro } from 'lucide-react'
import LOCATIONS from '../data/locations'
import { PROPERTY_TYPES, BED_OPTIONS, BATH_OPTIONS, PRICE_MIN, PRICE_STEP } from '../data/filterOptions'

/**
 * Collapsed inline filter bar — the always-visible tier, shown from 768px up.
 * Below that it is hidden by CSS and the existing "Filtrat" button opens the
 * expanded sheet instead. Reads and writes the same URL params as the sheet,
 * so the two tiers stay in sync with no extra state.
 */
function FilterBar({ values, onChange }) {
  const { t } = useTranslation()
  const { type, city, beds, baths, minPrice, maxPrice } = values

  const countLabel = n => (n === BED_OPTIONS[BED_OPTIONS.length - 1] ? `${n}+` : String(n))

  return (
    <div className="filter-bar">
      <div className="filter-bar__group">
        <label className="filter-bar__field">
          <Home size={15} aria-hidden="true" />
          <select
            className={type ? 'has-value' : ''}
            value={type}
            onChange={e => onChange('type', e.target.value)}
            aria-label={t('search.typology')}
          >
            <option value="">{t('search.typology')}</option>
            {PROPERTY_TYPES.map(pt => (
              <option key={pt} value={pt}>{t(`search.${pt}`)}</option>
            ))}
          </select>
        </label>

        <label className="filter-bar__field">
          <MapPin size={15} aria-hidden="true" />
          <select
            className={city ? 'has-value' : ''}
            value={city}
            onChange={e => onChange('city', e.target.value)}
            aria-label={t('search.city')}
          >
            <option value="">{t('search.city')}</option>
            {LOCATIONS.map(l => (
              <option key={l.city} value={l.city}>{l.city}</option>
            ))}
          </select>
        </label>

        {/* TODO: Zona goes here, between Qyteti and Dhoma Gjumi. Needs a `zone`
            column on properties + capture in NewListing; zone lists per city are
            already available in ../data/locations.js. */}
      </div>

      <div className="filter-bar__group">
        <label className="filter-bar__field">
          <BedDouble size={15} aria-hidden="true" />
          <select
            className={beds ? 'has-value' : ''}
            value={beds}
            onChange={e => onChange('beds', e.target.value)}
            aria-label={t('search.bedrooms')}
          >
            <option value="">{t('search.bedrooms')}</option>
            {BED_OPTIONS.filter(Boolean).map(b => (
              <option key={b} value={b}>{countLabel(b)}</option>
            ))}
          </select>
        </label>

        <label className="filter-bar__field">
          <Bath size={15} aria-hidden="true" />
          <select
            className={baths ? 'has-value' : ''}
            value={baths}
            onChange={e => onChange('baths', e.target.value)}
            aria-label={t('search.bathrooms')}
          >
            <option value="">{t('search.bathrooms')}</option>
            {BATH_OPTIONS.filter(Boolean).map(b => (
              <option key={b} value={b}>{countLabel(b)}</option>
            ))}
          </select>
        </label>

        <label className="filter-bar__field">
          <Euro size={15} aria-hidden="true" />
          <input
            type="number"
            inputMode="numeric"
            min={PRICE_MIN}
            step={PRICE_STEP}
            placeholder={t('search.minPrice')}
            value={minPrice}
            onChange={e => onChange('minPrice', e.target.value)}
            aria-label={t('search.minPrice')}
          />
        </label>

        <label className="filter-bar__field">
          <Euro size={15} aria-hidden="true" />
          <input
            type="number"
            inputMode="numeric"
            min={PRICE_MIN}
            step={PRICE_STEP}
            placeholder={t('search.maxPrice')}
            value={maxPrice}
            onChange={e => onChange('maxPrice', e.target.value)}
            aria-label={t('search.maxPrice')}
          />
        </label>

        {/* TODO: Id/Referenca goes here, after Cmimi max — plain text input,
            matching the FutureHome field order. Excluded for now by request. */}
      </div>
    </div>
  )
}

export default memo(FilterBar)
