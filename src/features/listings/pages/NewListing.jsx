import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ArrowRight, Upload, X } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import { supabase } from '../../../lib/supabase'
import { isEnabled } from '../../../lib/flags'
import AiListingPanel from '../components/AiListingPanel'
import { AutoTranslateButton } from '../components/AutoTranslateButton'
import '../../../styles/new-listing.css'

function compressImage(file, maxWidth = 1600, quality = 0.8) {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) { resolve(file); return }
    const img = new Image()
    img.onload = () => {
      if (img.width <= maxWidth) { resolve(file); return }
      const canvas = document.createElement('canvas')
      const ratio = maxWidth / img.width
      canvas.width = maxWidth
      canvas.height = Math.round(img.height * ratio)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => {
        resolve(blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file)
      }, 'image/jpeg', quality)
    }
    img.onerror = () => resolve(file)
    img.src = URL.createObjectURL(file)
  })
}

// Fill only languages the agent hasn't written manually; sq stays untouched.
function mergeTranslations(existing, translated) {
  const out = { ...existing }
  for (const [lang, text] of Object.entries(translated || {})) {
    if (lang !== 'sq' && text && !out[lang]?.trim()) out[lang] = text
  }
  return out
}

const STEPS = ['basics', 'location', 'details', 'media', 'publish']
const PROPERTY_TYPES = ['apartment', 'villa', 'house', 'land', 'commercial', 'office', 'garage']
const LISTING_TYPES = ['sale', 'rent', 'daily_rent']
const CITIES = ['Tiranë', 'Durrës', 'Vlorë', 'Shkodër', 'Elbasan', 'Korçë', 'Fier', 'Berat', 'Lushnjë', 'Pogradec', 'Kavajë', 'Gjirokastër', 'Sarandë']
const FEATURES_LIST = ['balcony', 'parking', 'elevator', 'garden', 'pool', 'furnished', 'airConditioning', 'heating', 'security', 'storage']
const LANGS = ['sq', 'en', 'de', 'it', 'es', 'pl', 'ru', 'fr']

// properties.sqft/beds/floor/total_floors/year_built are Postgres `integer`
// (±2.14B). Without a client-side bound, a fat-fingered value sails through
// every step and only fails at final insert with a raw DB error — these caps
// stop that well before the request ever leaves the browser.
const MAX_PRICE = 999_999_999
const MAX_SQFT = 100_000
const MAX_BEDS = 50
const MAX_BATHS = 50
const MIN_FLOOR = -10
const MAX_FLOOR = 200
const MIN_YEAR = 1800
const MAX_YEAR = new Date().getFullYear() + 2

// Storage-side validation: the file picker's accept="image/*" is only a
// hint — anything can be dropped in. Enforce type + size before upload.
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
const MAX_IMAGE_MB = 10

function outOfRange(raw, min, max) {
  if (raw === '' || raw == null) return false
  const n = Number(raw)
  return Number.isNaN(n) || n < min || n > max
}

function friendlySubmitError(err, t) {
  if (err?.code === '22003' || /out of range/i.test(err?.message || '')) {
    return t('errors.valueOutOfRange')
  }
  return t('errors.submitFailed')
}

export default function NewListing() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState({})
  const [titleLang, setTitleLang] = useState('sq')
  const [descLang, setDescLang] = useState('sq')

  const [form, setForm] = useState({
    listing_type: 'sale',
    property_type: 'apartment',
    title_i18n: { sq: '' },
    description_i18n: { sq: '' },
    city: 'Tiranë',
    address: '',
    latitude: null,
    longitude: null,
    price: '',
    currency: 'EUR',
    sqft: '',
    beds: '',
    baths: '',
    floor: '',
    total_floors: '',
    year_built: '',
    features: [],
    contact_phone: '',
    whatsapp_enabled: true,
    contact_email: '',
    status: 'active',
  })

  const [images, setImages] = useState([])

  const update = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setErrors(prev => ({ ...prev, [key]: undefined }))
  }

  const updateI18n = (field, lang, value) => {
    setForm(prev => ({
      ...prev,
      [field]: { ...prev[field], [lang]: value },
    }))
  }

  const toggleFeature = (feat) => {
    setForm(prev => ({
      ...prev,
      features: prev.features.includes(feat)
        ? prev.features.filter(f => f !== feat)
        : [...prev.features, feat],
    }))
  }

  const handleImages = async (e) => {
    const files = Array.from(e.target.files)
    e.target.value = ''
    const total = images.length + files.length
    if (total > 20) return
    if (files.some(f => !ALLOWED_IMAGE_TYPES.includes(f.type))) {
      setErrors(prev => ({ ...prev, images: t('errors.imageInvalidType') }))
      return
    }
    if (files.some(f => f.size > MAX_IMAGE_MB * 1024 * 1024)) {
      setErrors(prev => ({ ...prev, images: t('errors.imageTooLarge', { max: MAX_IMAGE_MB }) }))
      return
    }
    setErrors(prev => ({ ...prev, images: undefined }))
    const compressed = await Promise.all(files.map(f => compressImage(f)))
    const newImgs = compressed.map(f => ({ file: f, preview: URL.createObjectURL(f) }))
    setImages(prev => [...prev, ...newImgs])
  }

  const removeImage = (idx) => {
    setImages(prev => {
      URL.revokeObjectURL(prev[idx].preview)
      return prev.filter((_, i) => i !== idx)
    })
  }

  const validate = () => {
    const errs = {}
    if (step === 0) {
      if (!form.title_i18n.sq?.trim()) errs.title = t('listing.required')
      if (!form.description_i18n.sq?.trim()) errs.description = t('listing.required')
    }
    if (step === 1) {
      if (!form.city) errs.city = t('listing.required')
    }
    if (step === 2) {
      if (!form.price || Number(form.price) <= 0) errs.price = t('listing.required')
      else if (Number(form.price) > MAX_PRICE) errs.price = t('listing.valueOutOfRange', { min: 0, max: MAX_PRICE.toLocaleString() })

      if (!form.sqft || Number(form.sqft) <= 0) errs.sqft = t('listing.required')
      else if (Number(form.sqft) > MAX_SQFT) errs.sqft = t('listing.valueOutOfRange', { min: 1, max: MAX_SQFT.toLocaleString() })

      if (outOfRange(form.beds, 0, MAX_BEDS)) errs.beds = t('listing.valueOutOfRange', { min: 0, max: MAX_BEDS })
      if (outOfRange(form.baths, 0, MAX_BATHS)) errs.baths = t('listing.valueOutOfRange', { min: 0, max: MAX_BATHS })
      if (outOfRange(form.floor, MIN_FLOOR, MAX_FLOOR)) errs.floor = t('listing.valueOutOfRange', { min: MIN_FLOOR, max: MAX_FLOOR })
      if (outOfRange(form.total_floors, 1, MAX_FLOOR)) errs.total_floors = t('listing.valueOutOfRange', { min: 1, max: MAX_FLOOR })
      if (outOfRange(form.year_built, MIN_YEAR, MAX_YEAR)) errs.year_built = t('listing.valueOutOfRange', { min: MIN_YEAR, max: MAX_YEAR })
    }
    if (step === 3) {
      if (images.length < 3) errs.images = t('listing.minImages')
    }
    if (step === 4) {
      if (!form.contact_phone?.trim()) errs.phone = t('listing.required')
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const next = () => { if (validate()) setStep(s => Math.min(s + 1, STEPS.length - 1)) }
  const prev = () => setStep(s => Math.max(s - 1, 0))

  // Throws on the first failed upload (after removing anything already
  // uploaded) so a listing can never publish with fewer images than the
  // agent selected.
  const uploadImages = async () => {
    const urls = []
    const paths = []
    for (const img of images) {
      const ext = img.file.name.split('.').pop()
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('property-images').upload(path, img.file)
      if (error) {
        if (paths.length) await supabase.storage.from('property-images').remove(paths).catch(() => {})
        throw Object.assign(new Error('upload_failed'), { uploadFailed: true })
      }
      paths.push(path)
      const { data: { publicUrl } } = supabase.storage.from('property-images').getPublicUrl(path)
      urls.push(publicUrl)
    }
    return { urls, paths }
  }

  const submit = async (asDraft = false) => {
    if (!asDraft && !validate()) return
    setSubmitting(true)

    let uploadedPaths = []
    try {
      const { urls: imageUrls, paths } = await uploadImages()
      uploadedPaths = paths

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

      const { error } = await supabase.from('properties').insert({
        owner_id: user.id,
        agent_id: profile?.role === 'agent' ? user.id : null,
        owner_type: profile?.role === 'agent' ? 'agent' : 'client',
        title: form.title_i18n.sq || '',
        title_i18n: form.title_i18n,
        description: form.description_i18n.sq || '',
        description_i18n: form.description_i18n,
        listing_type: form.listing_type,
        property_type: form.property_type,
        city: form.city,
        address: form.address,
        latitude: form.latitude,
        longitude: form.longitude,
        price: Number(form.price) || 0,
        currency: form.currency,
        sqft: Number(form.sqft) || 0,
        beds: Number(form.beds) || 0,
        baths: Number(form.baths) || 0,
        floor: form.floor ? Number(form.floor) : null,
        total_floors: form.total_floors ? Number(form.total_floors) : null,
        year_built: form.year_built ? Number(form.year_built) : null,
        features: form.features,
        video_url: form.video_url?.trim() || null,
        image_urls: imageUrls,
        contact_phone: form.contact_phone,
        whatsapp_enabled: form.whatsapp_enabled,
        contact_email: form.contact_email,
        status: asDraft ? 'draft' : 'active',
      })

      if (error) throw error
      navigate('/my-listings')
    } catch (err) {
      // Insert failed after upload succeeded — remove the now-orphaned files.
      if (!err?.uploadFailed && uploadedPaths.length) {
        await supabase.storage.from('property-images').remove(uploadedPaths).catch(() => {})
      }
      setErrors({ submit: err?.uploadFailed ? t('errors.imageUploadFailed') : friendlySubmitError(err, t) })
    } finally {
      setSubmitting(false)
    }
  }

  // Route is wrapped in ProtectedRoute; this only covers the sign-out-while-open race.
  if (!user) return null

  return (
    <div className="page new-listing-page">
      <div className="nl-header">
        <button onClick={() => navigate(-1)} className="nl-back" aria-label={t('common.back')}><ArrowLeft size={18} /></button>
        <h1 className="page-title" style={{ margin: 0 }}>{t('listing.newListing')}</h1>
      </div>

      <div className="nl-progress">
        {STEPS.map((s, i) => (
          <div key={s} className={`nl-step ${i <= step ? 'active' : ''} ${i === step ? 'current' : ''}`}>
            <div className="nl-step-dot">{i + 1}</div>
            <span className="nl-step-label">{t(`listing.step.${s}`)}</span>
          </div>
        ))}
      </div>

      <div className="nl-form">
        {step === 0 && (
          <>
            {isEnabled('aiListingGenerator') && (
              <AiListingPanel
                form={form}
                onApply={({ title, description }) => {
                  updateI18n('title_i18n', 'sq', title)
                  updateI18n('description_i18n', 'sq', description)
                  setTitleLang('sq')
                  setDescLang('sq')
                  setErrors(prev => ({ ...prev, title: undefined, description: undefined }))
                }}
              />
            )}
            <div className="nl-field">
              <label>{t('listing.listingType')}</label>
              <div className="nl-radio-group">
                {LISTING_TYPES.map(lt => (
                  <button key={lt} className={`nl-radio ${form.listing_type === lt ? 'active' : ''}`} onClick={() => update('listing_type', lt)}>
                    {t(`listing.type.${lt}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className="nl-field">
              <label>{t('search.propertyType')}</label>
              <select value={form.property_type} onChange={e => update('property_type', e.target.value)}>
                {PROPERTY_TYPES.map(pt => <option key={pt} value={pt}>{t(`search.${pt}`)}</option>)}
              </select>
            </div>
            <div className="nl-field">
              <label>{t('listing.title')}</label>
              <div className="nl-lang-tabs">
                {LANGS.map(l => (
                  <button key={l} className={`nl-lang-tab ${titleLang === l ? 'active' : ''}`} onClick={() => setTitleLang(l)}>{l.toUpperCase()}</button>
                ))}
              </div>
              <input
                type="text"
                value={form.title_i18n[titleLang] || ''}
                onChange={e => updateI18n('title_i18n', titleLang, e.target.value)}
                placeholder={t('listing.titlePlaceholder')}
              />
              {errors.title && <span className="nl-error">{errors.title}</span>}
            </div>
            <div className="nl-field">
              <label>{t('listing.description')}</label>
              <div className="nl-lang-tabs">
                {LANGS.map(l => (
                  <button key={l} className={`nl-lang-tab ${descLang === l ? 'active' : ''}`} onClick={() => setDescLang(l)}>{l.toUpperCase()}</button>
                ))}
              </div>
              <textarea
                rows={4}
                value={form.description_i18n[descLang] || ''}
                onChange={e => updateI18n('description_i18n', descLang, e.target.value)}
                placeholder={t('listing.descriptionPlaceholder')}
              />
              {errors.description && <span className="nl-error">{errors.description}</span>}
            </div>
            {isEnabled('autoTranslate') && (
              <AutoTranslateButton
                title={form.title_i18n.sq}
                description={form.description_i18n.sq}
                onResult={({ titleMap, descriptionMap }) => {
                  setForm(prev => ({
                    ...prev,
                    title_i18n: mergeTranslations(prev.title_i18n, titleMap),
                    description_i18n: mergeTranslations(prev.description_i18n, descriptionMap),
                  }))
                }}
              />
            )}
          </>
        )}

        {step === 1 && (
          <>
            <div className="nl-field">
              <label>{t('listing.city')}</label>
              <select value={form.city} onChange={e => update('city', e.target.value)}>
                {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {errors.city && <span className="nl-error">{errors.city}</span>}
            </div>
            <div className="nl-field">
              <label>{t('listing.address')}</label>
              <input type="text" value={form.address} onChange={e => update('address', e.target.value)} placeholder={t('listing.addressPlaceholder')} />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="nl-row">
              <div className="nl-field" style={{ flex: 2 }}>
                <label>{t('listing.price')}</label>
                <input type="number" min="0" max={MAX_PRICE} value={form.price} onChange={e => update('price', e.target.value)} placeholder="0" />
                {errors.price && <span className="nl-error">{errors.price}</span>}
              </div>
              <div className="nl-field" style={{ flex: 1 }}>
                <label>{t('listing.currency')}</label>
                <select value={form.currency} onChange={e => update('currency', e.target.value)}>
                  <option value="EUR">EUR</option>
                  <option value="ALL">ALL</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
            <div className="nl-field">
              <label>{t('listing.surface')} (m²)</label>
              <input type="number" min="1" max={MAX_SQFT} value={form.sqft} onChange={e => update('sqft', e.target.value)} placeholder="0" />
              {errors.sqft && <span className="nl-error">{errors.sqft}</span>}
            </div>
            <div className="nl-row">
              <div className="nl-field">
                <label>{t('property.beds')}</label>
                <input type="number" min="0" max={MAX_BEDS} value={form.beds} onChange={e => update('beds', e.target.value)} placeholder="0" />
                {errors.beds && <span className="nl-error">{errors.beds}</span>}
              </div>
              <div className="nl-field">
                <label>{t('property.baths')}</label>
                <input type="number" min="0" max={MAX_BATHS} value={form.baths} onChange={e => update('baths', e.target.value)} placeholder="0" />
                {errors.baths && <span className="nl-error">{errors.baths}</span>}
              </div>
            </div>
            <div className="nl-row">
              <div className="nl-field">
                <label>{t('listing.floor')}</label>
                <input type="number" min={MIN_FLOOR} max={MAX_FLOOR} value={form.floor} onChange={e => update('floor', e.target.value)} placeholder="0" />
                {errors.floor && <span className="nl-error">{errors.floor}</span>}
              </div>
              <div className="nl-field">
                <label>{t('listing.totalFloors')}</label>
                <input type="number" min="1" max={MAX_FLOOR} value={form.total_floors} onChange={e => update('total_floors', e.target.value)} placeholder="0" />
                {errors.total_floors && <span className="nl-error">{errors.total_floors}</span>}
              </div>
              <div className="nl-field">
                <label>{t('listing.yearBuilt')}</label>
                <input type="number" min={MIN_YEAR} max={MAX_YEAR} value={form.year_built} onChange={e => update('year_built', e.target.value)} placeholder="2024" />
                {errors.year_built && <span className="nl-error">{errors.year_built}</span>}
              </div>
            </div>
            <div className="nl-field">
              <label>{t('listing.features')}</label>
              <div className="nl-chips">
                {FEATURES_LIST.map(f => (
                  <button key={f} className={`nl-chip ${form.features.includes(f) ? 'active' : ''}`} onClick={() => toggleFeature(f)}>
                    {t(`listing.feature.${f}`)}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="nl-field">
              <label>{t('listing.images')} ({images.length}/20)</label>
              <div className="nl-upload-zone" onClick={() => fileInputRef.current?.click()}>
                <Upload size={24} />
                <div>{t('listing.dropImages')}</div>
                <div style={{ fontSize: 11, color: 'var(--fho-text-muted)' }}>{t('listing.minImages')}</div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={handleImages} />
              {errors.images && <span className="nl-error">{errors.images}</span>}
            </div>
            {images.length > 0 && (
              <div className="nl-image-grid">
                {images.map((img, i) => (
                  <div key={i} className="nl-image-thumb">
                    <img src={img.preview} alt="" />
                    {i === 0 && <span className="nl-cover-badge">{t('listing.cover')}</span>}
                    <button className="nl-image-remove" onClick={() => removeImage(i)} aria-label={t('common.close')}><X size={12} /></button>
                  </div>
                ))}
              </div>
            )}
            <div className="nl-field">
              <label>{t('listing.videoUrl')}</label>
              <input type="url" value={form.video_url || ''} onChange={e => update('video_url', e.target.value)} placeholder="https://youtube.com/..." />
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <div className="nl-field">
              <label>{t('listing.phone')}</label>
              <input type="tel" value={form.contact_phone} onChange={e => update('contact_phone', e.target.value)} placeholder="+355 69..." />
              {errors.phone && <span className="nl-error">{errors.phone}</span>}
            </div>
            <div className="nl-field">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={form.whatsapp_enabled} onChange={e => update('whatsapp_enabled', e.target.checked)} />
                WhatsApp
              </label>
            </div>
            <div className="nl-field">
              <label>{t('listing.email')}</label>
              <input type="email" value={form.contact_email} onChange={e => update('contact_email', e.target.value)} placeholder={user?.email || ''} />
            </div>
            {errors.submit && <div className="nl-error" style={{ marginBottom: 12 }}>{errors.submit}</div>}
          </>
        )}
      </div>

      <div className="nl-actions">
        {step > 0 && (
          <button className="nl-btn nl-btn-secondary" onClick={prev}><ArrowLeft size={16} /> {t('listing.back')}</button>
        )}
        <div style={{ flex: 1 }} />
        {step < STEPS.length - 1 ? (
          <button className="nl-btn nl-btn-primary" onClick={next}>{t('listing.next')} <ArrowRight size={16} /></button>
        ) : (
          <>
            <button className="nl-btn nl-btn-secondary" onClick={() => submit(true)} disabled={submitting}>{t('listing.saveDraft')}</button>
            <button className="nl-btn nl-btn-primary" onClick={() => submit(false)} disabled={submitting}>
              {submitting ? t('common.loading') : t('listing.publish')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
