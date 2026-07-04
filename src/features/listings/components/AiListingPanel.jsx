import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import { generateListing } from '../../../lib/ai'

// Feature A — AI listing generator. Sits at the top of the wizard's Basics
// step: the agent types raw notes, the model drafts title + description into
// the existing (fully editable) inputs. Nothing is published automatically.
export default function AiListingPanel({ form, onApply }) {
  const { t } = useTranslation()
  const [notes, setNotes] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [applied, setApplied] = useState(false)

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    setApplied(false)
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
        floor: form.floor,
        total_floors: form.total_floors,
        year_built: form.year_built,
        features: form.features,
        notes,
      }, 'sq')
      onApply(result)
      setApplied(true)
    } catch (err) {
      setError(
        err?.code === 'rate_limited' ? t('ai.errorRateLimited')
        : err?.code === 'ai_unavailable' ? t('ai.errorUnavailable')
        : t('ai.errorGeneric'),
      )
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="ai-panel">
      <div className="ai-panel__head">
        <Sparkles size={15} />
        <span>{t('ai.panelTitle')}</span>
      </div>
      <textarea
        className="ai-panel__notes"
        rows={3}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={t('ai.notesPlaceholder')}
      />
      <div className="ai-panel__row">
        <button type="button" className="ai-panel__btn" onClick={handleGenerate} disabled={generating}>
          <Sparkles size={14} />
          {generating ? t('ai.generating') : applied ? t('ai.regenerate') : t('ai.generate')}
        </button>
        {applied && <span className="ai-panel__hint">{t('ai.reviewHint')}</span>}
      </div>
      {error && <div className="nl-error">{error}</div>}
    </div>
  )
}
