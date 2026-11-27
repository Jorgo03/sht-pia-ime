import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fileReport, MAX_REPORT_DETAILS, reportReasonsFor } from '@/src/features/safety/lib/safety.js'
import { supabase } from '../lib/supabase'

/**
 * "Report this listing / user", as in the app's report sheet: pick a reason,
 * optional details, then a sent / already reported / failed answer.
 */
export default function ReportDialog({ open, onClose, propertyId, userId, conversationId }) {
  const { t } = useTranslation()
  const ref = useRef(null)
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const reasons = reportReasonsFor({ propertyId, userId })

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  const send = async (e) => {
    e.preventDefault()
    if (!reason || busy) return
    setBusy(true)
    setResult(await fileReport(supabase, { propertyId, userId, conversationId, reason, details }))
    setBusy(false)
  }

  return (
    <dialog
      ref={ref}
      className="dialog"
      onClose={() => {
        // Opened again (for another listing or person), it starts blank.
        setReason('')
        setDetails('')
        setResult(null)
        onClose?.()
      }}
      aria-labelledby="report-title"
    >
      <form method="dialog" className="dialog-body" onSubmit={send}>
        <h2 id="report-title">{t('safety.reportTitle')}</h2>
        {result === 'sent' || result === 'already' ? (
          <p role="status">{result === 'sent' ? t('safety.sent') : t('safety.already')}</p>
        ) : (
          <>
            <fieldset className="choice-list">
              <legend className="visually-hidden">{t('safety.reportTitle')}</legend>
              {reasons.map((r) => (
                <label key={r} className={reason === r ? 'is-on' : ''}>
                  <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} />
                  {t(`safety.reason.${r}`)}
                </label>
              ))}
            </fieldset>
            <textarea
              className="textarea"
              rows={3}
              maxLength={MAX_REPORT_DETAILS}
              placeholder={t('safety.detailsPlaceholder')}
              aria-label={t('safety.detailsPlaceholder')}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
            {result === 'failed' && <p className="form-error" role="alert">{t('safety.failed')}</p>}
          </>
        )}
        <div className="dialog-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            {t('common.close')}
          </button>
          {result !== 'sent' && result !== 'already' && (
            <button type="submit" className="btn btn-primary" disabled={!reason || busy}>
              {t('safety.send')}
            </button>
          )}
        </div>
      </form>
    </dialog>
  )
}
