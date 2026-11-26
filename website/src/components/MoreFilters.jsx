import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AMENITIES } from '@/src/features/properties/lib/amenities.js'
import { normalizeRef, zonesFor } from '@/src/features/properties/lib/searchFilters.js'
import Select from './Select'

// The app's filter sheet (components/property/filter-sheet.tsx) for the web:
// neighbourhood, price range, bedrooms, bathrooms, surface range, amenities
// and reference number, written back into the search address.
const FIELDS = ['zone', 'min', 'max', 'beds', 'baths', 'area', 'maxArea', 'features', 'ref']

export default function MoreFilters({ open, onClose, params, onApply }) {
  const { t } = useTranslation()
  const ref = useRef(null)
  const [f, setF] = useState({})
  const [error, setError] = useState(null)

  useEffect(() => {
    const d = ref.current
    if (open && !d.open) {
      setF(Object.fromEntries(FIELDS.map((k) => [k, params.get(k) ?? ''])))
      setError(null)
      d.showModal()
    }
    if (!open && d.open) d.close()
  }, [open, params])

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))
  const features = (f.features || '').split(',').filter(Boolean)
  const toggleFeature = (a) => setF((s) => ({ ...s, features: (features.includes(a) ? features.filter((x) => x !== a) : [...features, a]).join(',') }))
  const zones = zonesFor(params.get('city'))

  const apply = (e) => {
    e.preventDefault()
    const n = (k) => (f[k] ? Number(f[k]) : null)
    if ((n('min') && n('max') && n('min') > n('max')) || (n('area') && n('maxArea') && n('area') > n('maxArea'))) return setError(t('search.rangeInvalid'))
    if (f.ref && !normalizeRef(f.ref)) return setError(t('search.referenceInvalid'))
    const next = new URLSearchParams(params)
    for (const k of FIELDS) {
      const v = k === 'ref' ? (f.ref ? normalizeRef(f.ref) : '') : String(f[k] ?? '').trim()
      if (v) next.set(k, v)
      else next.delete(k)
    }
    onApply(next)
  }
  const reset = () => setF(Object.fromEntries(FIELDS.map((k) => [k, ''])))
  return (
    <dialog ref={ref} className="dialog dialog-wide" onClose={onClose} aria-labelledby="filters-title">
      <form className="dialog-body" onSubmit={apply} noValidate>
        <h2 id="filters-title">{t('search.filtersTitle')}</h2>
        {zones.length > 0 && (
          <label className="field">
            <span>{t('search.zone')}</span>
            <Select className="input" value={f.zone ?? ''} onChange={set('zone')}>
              <option value="">{t('search.anyZone')}</option>
              {zones.map((z) => <option key={z.name ?? z} value={z.name ?? z}>{z.name ?? z}</option>)}
            </Select>
          </label>
        )}
        <fieldset className="range">
          <legend>{t('search.priceRange')} (€)</legend>
          <input className="input" inputMode="numeric" aria-label={t('search.minPrice')} placeholder={t('search.minPrice')} value={f.min ?? ''} onChange={set('min')} />
          <input className="input" inputMode="numeric" aria-label={t('search.maxPrice')} placeholder={t('search.maxPrice')} value={f.max ?? ''} onChange={set('max')} />
        </fieldset>
        <div className="form-grid">
          <label className="field">
            <span>{t('search.bedrooms')}</span>
            <Select className="input" value={f.beds ?? ''} onChange={set('beds')}>
              <option value="">{t('search.anyBeds')}</option>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}+</option>)}
            </Select>
          </label>
          <label className="field">
            <span>{t('search.bathrooms')}</span>
            <Select className="input" value={f.baths ?? ''} onChange={set('baths')}>
              <option value="">{t('search.anyBaths')}</option>
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}+</option>)}
            </Select>
          </label>
        </div>
        <fieldset className="range">
          <legend>{t('search.surface')} (m²)</legend>
          <input className="input" inputMode="numeric" aria-label={t('search.minArea')} placeholder={t('search.minArea')} value={f.area ?? ''} onChange={set('area')} />
          <input className="input" inputMode="numeric" aria-label={t('search.maxArea')} placeholder={t('search.maxArea')} value={f.maxArea ?? ''} onChange={set('maxArea')} />
        </fieldset>
        <fieldset className="chip-set">
          <legend>{t('listing.features')}</legend>
          {AMENITIES.map((a) => (
            <button key={a} type="button" className={`chip ${features.includes(a) ? 'is-on' : ''}`} aria-pressed={features.includes(a)} onClick={() => toggleFeature(a)}>
              {t(`listing.feature.${a}`)}
            </button>
          ))}
        </fieldset>
        <label className="field">
          <span>{t('search.reference')}</span>
          <input className="input" value={f.ref ?? ''} onChange={set('ref')} placeholder="SH-1A2B3C4D" autoCapitalize="characters" spellCheck={false} />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="btn btn-outline" onClick={reset}>{t('search.reset')}</button>
          <button type="button" className="btn btn-outline" onClick={onClose}>{t('common.close')}</button>
          <button type="submit" className="btn btn-primary">{t('search.showHomesAny')}</button>
        </div>
      </form>
    </dialog>
  )
}
