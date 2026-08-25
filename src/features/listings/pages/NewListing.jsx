import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import { ArrowLeft, ArrowRight, Upload, X, Film, Sparkles, Loader2, Check } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import { supabase } from '../../../lib/supabase'
import { isEnabled } from '../../../lib/flags'
import { generateListing } from '../../../lib/ai'
import { getMarkerIcon } from '../../properties/components/MapMarker'
import AiListingPanel from '../components/AiListingPanel'
import { TranslationBar } from '../components/TranslationBar'
import { useListingTranslation } from '../hooks/useListingTranslation'
import { translatePropertyContent } from '../../../lib/translate'
import '../../../styles/map.css'
import '../../../styles/new-listing.css'

const TIRANA_CENTER = [41.3275, 19.8187]

// Bridges Leaflet's imperative click events into the pin state.
function MapClickPicker({ onPick }) {
  useMapEvents({
    click(e) { onPick(e.latlng) },
  })
  return null
}

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

const STEPS =['basics', 'location', 'details', 'media', 'publish']
const PROPERTY_TYPES = ['apartment', 'villa', 'house', 'land', 'commercial', 'office', 'garage']
// daily_rent removed from creation (owner decision 2026-07-14); display
// helpers in lib/format keep supporting it in case legacy rows ever exist.
const LISTING_TYPES = ['sale', 'rent']
const CITIES = ['Tiranë', 'Durrës', 'Vlorë', 'Shkodër', 'Elbasan', 'Korçë', 'Fier', 'Berat', 'Lushnjë', 'Pogradec', 'Kavajë', 'Gjirokastër', 'Sarandë']
const FEATURES_LIST = ['balcony', 'parking', 'elevator', 'garden', 'pool', 'furnished', 'airConditioning', 'heating', 'security', 'storage']

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

// Video: MP4/MOV only, capped at Supabase's default per-object limit.
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime']
const MAX_VIDEO_MB = 50

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

const INITIAL_FORM = {
  listing_type: 'sale',
  property_type: 'apartment',
  title_i18n: { sq: '' },
  description_i18n: { sq: '' },
  // Per-language provenance — see properties.translation_meta.
  translation_meta: {},
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
}

// Draft persistence: the wizard survives navigation/refresh via
// localStorage. Selected photos are File objects and can't be serialized —
// they're the one thing a returning user re-adds.
const DRAFT_KEY = 'fho_listing_draft'
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const draft = JSON.parse(raw)
    if (!draft?.form || Date.now() - (draft.savedAt || 0) > DRAFT_TTL_MS) return null
    return draft
  } catch {
    return null
  }
}

export default function NewListing() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const videoInputRef = useRef(null)

  const [draft] = useState(loadDraft)
  const [step, setStep] = useState(draft?.step ?? 0)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState({})
  const [draftRestored, setDraftRestored] = useState(Boolean(draft))

  const [form, setForm] = useState(draft?.form ? { ...INITIAL_FORM, ...draft.form } : INITIAL_FORM)

  // Owns the language selection for BOTH text fields, plus the per-language
  // cache, staleness against the Albanian source, protection for hand-edited
  // translations, and discarding superseded responses. Shared verbatim with
  // the Expo wizard (app/listing/new.tsx).
  const translation = useListingTranslation({
    form,
    setForm,
    translate: translatePropertyContent,
    // Flag off => the tabs still switch and stay editable, they just never
    // call out. Manual multi-language entry, exactly as before Feature E.
    enabled: isEnabled('autoTranslate'),
  })

  const [images, setImages] = useState([])
  // Native video upload (replaces the old YouTube-URL text field). Like the
  // photos, a File can't be draft-persisted — re-added after a restore.
  const [video, setVideo] = useState(null)
  const [aiTitleBusy, setAiTitleBusy] = useState(false)

  // Persist progress on every change; cleared on successful submit/discard.
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, step, savedAt: Date.now() }))
    } catch { /* storage full/blocked — wizard still works, just unsaved */ }
  }, [form, step])

  const discardDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
    setForm(INITIAL_FORM)
    setStep(0)
    setImages([])
    setErrors({})
    setDraftRestored(false)
  }

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

  // One video max; accepts from either the picker or a drag-drop. The
  // accept= attribute is only a picker hint, so type/size are enforced here.
  const handleVideo = (file) => {
    if (!file) return
    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      setErrors(prev => ({ ...prev, video: t('errors.videoInvalidType') }))
      return
    }
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      setErrors(prev => ({ ...prev, video: t('errors.videoTooLarge', { max: MAX_VIDEO_MB }) }))
      return
    }
    setErrors(prev => ({ ...prev, video: undefined }))
    setVideo(prev => {
      if (prev) URL.revokeObjectURL(prev.preview)
      return { file, preview: URL.createObjectURL(file) }
    })
  }

  const removeVideo = () => {
    setVideo(prev => {
      if (prev) URL.revokeObjectURL(prev.preview)
      return null
    })
  }

  // Item 1: title-only AI generation — reuses the existing
  // ai-generate-listing Edge Function (same grounding/rate limits as the
  // full panel) and applies just the title, leaving the description alone.
  const handleAiTitle = async () => {
    if (aiTitleBusy) return
    setAiTitleBusy(true)
    setErrors(prev => ({ ...prev, title: undefined }))
    try {
      const result = await generateListing({
        listing_type: form.listing_type,
        property_type: form.property_type,
        city: form.city,
        address: form.address,
        price: form.price,
        currency: form.currency,
        sqft: form.sqft,
        beds: form.beds,
        baths: form.baths,
        features: form.features,
        notes: form.description_i18n.sq || '',
      }, 'sq')
      updateI18n('title_i18n', 'sq', result.title)
      // AI writes the Albanian source, so show it — otherwise the agent stays
      // on a translated tab and cannot see what was just generated.
      translation.selectLanguage('sq')
    } catch (err) {
      setErrors(prev => ({
        ...prev,
        title: err?.code === 'rate_limited' ? t('ai.errorRateLimited') : t('ai.errorUnavailable'),
      }))
    } finally {
      setAiTitleBusy(false)
    }
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

      // Video rides the same all-or-nothing rule as the photos: a failed
      // upload aborts the submit and removes everything already uploaded.
      let videoUrl = null
      if (video) {
        const ext = video.file.name.split('.').pop()
        const path = `${user.id}/video-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: vErr } = await supabase.storage.from('property-images').upload(path, video.file)
        if (vErr) {
          if (uploadedPaths.length) await supabase.storage.from('property-images').remove(uploadedPaths).catch(() => {})
          throw Object.assign(new Error('upload_failed'), { uploadFailed: true })
        }
        uploadedPaths.push(path)
        videoUrl = supabase.storage.from('property-images').getPublicUrl(path).data.publicUrl
      }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

      const { error } = await supabase.from('properties').insert({
        owner_id: user.id,
        agent_id: profile?.role === 'agent' ? user.id : null,
        owner_type: profile?.role === 'agent' ? 'agent' : 'client',
        title: form.title_i18n.sq || '',
        title_i18n: form.title_i18n,
        description: form.description_i18n.sq || '',
        description_i18n: form.description_i18n,
        // Which languages are machine output and which an agent corrected by
        // hand, so a later edit does not regenerate over their work.
        translation_meta: form.translation_meta,
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
        video_url: videoUrl,
        image_urls: imageUrls,
        contact_phone: form.contact_phone,
        whatsapp_enabled: form.whatsapp_enabled,
        contact_email: form.contact_email,
        status: asDraft ? 'draft' : 'active',
      })

      if (error) throw error
      try { localStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
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
        <button onClick={() => (step > 0 ? prev() : navigate(-1))} className="nl-back" aria-label={t('common.back')}><ArrowLeft size={18} /></button>
        <h1 className="page-title" style={{ margin: 0 }}>{t('listing.newListing')}</h1>
      </div>

      {draftRestored && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, margin: '0 0 12px', padding: '10px 14px', background: 'var(--fho-orange-tint)', border: '1px solid var(--fho-orange-soft)', borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--fho-text)' }}>
          <span>{t('listing.draftRestored')}</span>
          <button className="link-btn" style={{ color: 'var(--fho-orange-2)', whiteSpace: 'nowrap' }} onClick={discardDraft}>{t('listing.discardDraft')}</button>
        </div>
      )}

      <div className="nl-progress" role="list" aria-label={t('listing.newListing')}>
        {STEPS.map((s, i) => {
          // Jumping back to a completed step is safe (its data is already
          // validated); jumping forward would skip validation on the steps
          // in between, so only i < step is reachable this way.
          const clickable = i < step
          const completed = i < step
          const current = i === step
          return (
            <div key={s} className="nl-step-item" role="listitem">
              <button
                type="button"
                className={`nl-step ${completed ? 'completed' : ''} ${current ? 'current' : ''} ${clickable ? 'nl-step--clickable' : ''}`}
                onClick={clickable ? () => setStep(i) : undefined}
                tabIndex={clickable ? 0 : -1}
                aria-disabled={!clickable}
                aria-current={current ? 'step' : undefined}
              >
                <span className="nl-step-dot">{completed ? <Check size={13} strokeWidth={3} /> : i + 1}</span>
                <span className="nl-step-label">{t(`listing.step.${s}`)}</span>
              </button>
              {i < STEPS.length - 1 && <span className={`nl-step-line ${i < step ? 'filled' : ''}`} />}
            </div>
          )
        })}
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
                  // The panel writes the Albanian source; show it rather than
                  // leaving the agent on a now-stale translated tab.
                  translation.selectLanguage('sq')
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
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                {t('listing.title')}
                {isEnabled('aiListingGenerator') && (
                  <button
                    type="button"
                    className="ai-panel__btn"
                    style={{ padding: '5px 10px', fontSize: 12 }}
                    onClick={handleAiTitle}
                    disabled={aiTitleBusy}
                  >
                    {aiTitleBusy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    {aiTitleBusy ? t('ai.generating') : t('ai.generateTitle')}
                  </button>
                )}
              </label>
              {/* One selector for both fields: picking a language translates
                  the title and description together, in a single request. */}
              <TranslationBar
                activeLang={translation.activeLang}
                onSelect={translation.selectLanguage}
                filled={lang =>
                  Boolean(form.title_i18n[lang]?.trim() || form.description_i18n[lang]?.trim())
                }
                pendingLangs={translation.pendingLangs}
                state={translation.state}
                translating={translation.translating}
                error={translation.error}
                onRegenerate={translation.regenerate}
                onRetry={translation.retry}
                canRegenerate={translation.canRegenerate}
              />
              <input
                type="text"
                value={translation.title}
                onChange={e => {
                  translation.editTitle(e.target.value)
                  if (errors.title) setErrors(prev => ({ ...prev, title: undefined }))
                }}
                placeholder={t('listing.titlePlaceholder')}
              />
              {errors.title && <span className="nl-error">{errors.title}</span>}
            </div>
            <div className="nl-field">
              <label>{t('listing.description')}</label>
              <textarea
                rows={4}
                value={translation.description}
                onChange={e => {
                  translation.editDescription(e.target.value)
                  if (errors.description) setErrors(prev => ({ ...prev, description: undefined }))
                }}
                placeholder={t('listing.descriptionPlaceholder')}
              />
              {errors.description && <span className="nl-error">{errors.description}</span>}
            </div>
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
            <div className="nl-field">
              <label>{t('listing.pinLocation')}</label>
              <div className="map-wrapper" style={{ height: 260 }}>
                <MapContainer
                  center={form.latitude != null && form.longitude != null ? [form.latitude, form.longitude] : TIRANA_CENTER}
                  zoom={form.latitude != null ? 15 : 12}
                  scrollWheelZoom={false}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapClickPicker onPick={({ lat, lng }) => {
                    update('latitude', Number(lat.toFixed(6)))
                    update('longitude', Number(lng.toFixed(6)))
                  }} />
                  {form.latitude != null && form.longitude != null && (
                    <Marker
                      position={[form.latitude, form.longitude]}
                      icon={getMarkerIcon(form.listing_type)}
                      draggable
                      eventHandlers={{
                        dragend: (e) => {
                          const { lat, lng } = e.target.getLatLng()
                          update('latitude', Number(lat.toFixed(6)))
                          update('longitude', Number(lng.toFixed(6)))
                        },
                      }}
                    />
                  )}
                </MapContainer>
              </div>
              <span style={{ fontSize: 12, color: 'var(--fho-text-muted)' }}>
                {form.latitude != null && form.longitude != null
                  ? `${form.latitude}, ${form.longitude}`
                  : t('listing.mapHint')}
              </span>
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
              <label>{t('listing.videoUpload')}</label>
              {video ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', border: '1px solid var(--fho-border)', borderRadius: 'var(--r-md)', background: 'var(--fho-surface-2)' }}>
                  <Film size={18} style={{ color: 'var(--fho-orange-1)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fho-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{video.file.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--fho-text-muted)' }}>{(video.file.size / (1024 * 1024)).toFixed(1)} MB</div>
                  </div>
                  <button className="nl-image-remove" style={{ position: 'static' }} onClick={removeVideo} aria-label={t('common.close')}><X size={12} /></button>
                </div>
              ) : (
                <div
                  className="nl-upload-zone"
                  style={{ padding: 20 }}
                  onClick={() => videoInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); handleVideo(e.dataTransfer.files?.[0]) }}
                >
                  <Film size={22} />
                  <div style={{ fontSize: 12 }}>{t('listing.dropVideo')}</div>
                </div>
              )}
              <input ref={videoInputRef} type="file" accept="video/mp4, video/quicktime" hidden onChange={e => { handleVideo(e.target.files?.[0]); e.target.value = '' }} />
              {errors.video && <span className="nl-error">{errors.video}</span>}
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
              <input type="email" value={form.contact_email} onChange={e => update('contact_email', e.target.value)} placeholder="john.doe@gmail.com" />
            </div>
            {errors.submit && <div className="nl-error" style={{ marginBottom: 12 }}>{errors.submit}</div>}
          </>
        )}
      </div>

      {step < STEPS.length - 1 ? (
        // Mid-wizard steps: lightweight floating pair instead of a docked
        // bar. bottom-24 clears .liquid-nav (18px gap + 62px height = 80px,
        // +16px breathing room). The app-shell is a centered max-w-480
        // column, not the full viewport (same as .liquid-nav/.nl-actions
        // below) — so this positions the same way: a full-width fixed strip
        // centered via left-1/2/-translate-x-1/2, pointer-events-none so
        // its empty space never blocks clicks, with the actual buttons
        // (pointer-events-auto) pushed to its right edge via justify-end.
        // A plain `right-5` here would anchor to the raw viewport instead
        // and drift away from the nav on anything wider than ~480px.
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 px-5">
          <div className="flex items-center justify-end gap-3">
            {step > 0 && (
              <button
                onClick={prev}
                aria-label={t('listing.back')}
                title={t('listing.back')}
                className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border border-fho-border-strong bg-fho-surface text-fho-text shadow-fho-card transition-transform hover:scale-105 active:scale-95"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <button
              onClick={next}
              aria-label={t('listing.next')}
              title={t('listing.next')}
              className="pointer-events-auto flex h-[58px] w-[58px] items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--fho-orange-1),var(--fho-orange-2))] text-white shadow-fho-cta transition-transform hover:scale-105 active:scale-95"
            >
              <ArrowRight size={24} />
            </button>
          </div>
        </div>
      ) : (
        // Final (Publish) step keeps the fuller docked bar — a submission
        // deserves a clearer, paired Save Draft / Publish affordance rather
        // than a small anonymous corner button.
        <div className="nl-actions">
          <button className="nl-btn nl-btn-secondary" onClick={prev}><ArrowLeft size={16} /> {t('listing.back')}</button>
          <div style={{ flex: 1 }} />
          <button className="nl-btn nl-btn-secondary" onClick={() => submit(true)} disabled={submitting}>{t('listing.saveDraft')}</button>
          <button className="nl-btn nl-btn-primary" onClick={() => submit(false)} disabled={submitting}>
            {submitting ? t('common.loading') : t('listing.publish')}
          </button>
        </div>
      )}
    </div>
  )
}
