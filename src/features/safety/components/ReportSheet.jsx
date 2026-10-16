import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Flag } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { MAX_REPORT_DETAILS, REPORT_REASONS, fileReport } from '../lib/safety'

/**
 * Report a listing (propertyId) or a person (userId). Same bottom sheet as
 * ViewingRequestSheet. The parent only mounts it for a signed-in user.
 */
export default function ReportSheet({ propertyId, userId, onClose }) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [sending, setSending] = useState(false)
  // 'sent' | 'already' | 'failed' | ''
  const [result, setResult] = useState('')
  const firstRadio = useRef(null)

  useEffect(() => {
    firstRadio.current?.focus()
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const submit = async () => {
    if (!reason || sending) return
    setSending(true)
    setResult(await fileReport(supabase, { propertyId, userId, reason, details }))
    setSending(false)
  }

  const title = propertyId ? t('safety.reportListing') : t('safety.reportUser')
  const done = result === 'sent' || result === 'already'

  return (
    <>
      <div className="addsheet-backdrop" onClick={onClose} />
      <div className="addsheet-panel" role="dialog" aria-modal="true" aria-label={title}>
        <div className="addsheet-grip" />
        <div className="addsheet-header">
          <h2 className="addsheet-title">{title}</h2>
          <button className="addsheet-close" onClick={onClose} aria-label={t('common.close')}>
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div className="addsheet-miniform">
            <p role="status" className="m-0 text-[15px] text-fho-text">
              {result === 'sent' ? t('safety.sent') : t('safety.already')}
            </p>
            <button className="cta-pill" onClick={onClose}>{t('common.close')}</button>
          </div>
        ) : (
          <div className="addsheet-miniform">
            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
              <legend className="addsheet-miniform__title mb-2 flex items-center gap-2">
                <Flag size={16} aria-hidden="true" /> {t('safety.reportTitle')}
              </legend>
              {REPORT_REASONS.map((r, i) => (
                <label
                  key={r}
                  className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-[15px] ${reason === r ? 'border-fho-orange-1 bg-fho-surface-2' : 'border-fho-border'}`}
                >
                  <input
                    ref={i === 0 ? firstRadio : undefined}
                    type="radio"
                    name="report-reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => { setReason(r); setResult('') }}
                    className="accent-[var(--fho-orange-1)]"
                  />
                  {t(`safety.reason.${r}`)}
                </label>
              ))}
            </fieldset>
            <textarea
              className="addsheet-input addsheet-textarea"
              placeholder={t('safety.detailsPlaceholder')}
              aria-label={t('safety.detailsPlaceholder')}
              maxLength={MAX_REPORT_DETAILS}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
            {result === 'failed' && <div className="nl-error" role="alert">{t('safety.failed')}</div>}
            <button className="cta-pill" onClick={submit} disabled={!reason || sending}>
              {sending ? t('common.loading') : t('safety.send')}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
