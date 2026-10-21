import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { PROFILE_LIMITS, profilePatch, saveProfile } from '../lib/profileForm'

/**
 * Edit your name, phone and (agents) agency — docs/LAUNCH_TASKS.md L12.
 * Same bottom sheet as ReportSheet. Only fields that changed are sent.
 */
export default function EditProfileSheet({ userId, profile, isAgent, onSaved, onClose }) {
  const { t } = useTranslation()
  const [form, setForm] = useState({
    full_name: profile?.full_name ?? '',
    phone: profile?.phone ?? '',
    agency_name: profile?.agency_name ?? '',
  })
  const [saving, setSaving] = useState(false)
  // 'nameRequired' | 'tooLong' | 'phoneInvalid' | 'failed' | ''
  const [error, setError] = useState('')
  const firstField = useRef(null)

  useEffect(() => {
    firstField.current?.focus()
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const set = (key) => (e) => { setForm((f) => ({ ...f, [key]: e.target.value })); setError('') }

  const submit = async (e) => {
    e.preventDefault()
    if (saving) return
    const { patch, error: invalid } = profilePatch(profile, form, { isAgent })
    if (invalid) { setError(invalid); return }
    setSaving(true)
    const result = await saveProfile(supabase, userId, patch)
    setSaving(false)
    if (result === 'failed') { setError('failed'); return }
    if (result === 'saved') await onSaved()
    onClose()
  }

  const errorText = {
    nameRequired: t('profile.edit.nameRequired'),
    tooLong: t('profile.edit.tooLong'),
    phoneInvalid: t('profile.edit.phoneInvalid'),
    failed: t('profile.edit.failed'),
  }[error]
  const labelClass = 'flex flex-col gap-1.5 text-[13px] font-semibold text-fho-text'

  return (
    <>
      <div className="addsheet-backdrop" onClick={onClose} />
      <div className="addsheet-panel" role="dialog" aria-modal="true" aria-label={t('profile.edit.title')}>
        <div className="addsheet-grip" />
        <div className="addsheet-header">
          <h2 className="addsheet-title">{t('profile.edit.title')}</h2>
          <button className="addsheet-close" onClick={onClose} aria-label={t('common.close')}>
            <X size={18} />
          </button>
        </div>

        <form className="addsheet-miniform" onSubmit={submit} noValidate>
          <label className={labelClass}>
            {t('auth.fullName')}
            <input
              ref={firstField}
              className="addsheet-input"
              autoComplete="name"
              maxLength={PROFILE_LIMITS.full_name}
              value={form.full_name}
              onChange={set('full_name')}
              aria-invalid={error === 'nameRequired' || undefined}
            />
          </label>
          {isAgent && (
            <label className={labelClass}>
              {t('auth.agencyName')}
              <input
                className="addsheet-input"
                autoComplete="organization"
                maxLength={PROFILE_LIMITS.agency_name}
                value={form.agency_name}
                onChange={set('agency_name')}
              />
            </label>
          )}
          <label className={labelClass}>
            {t('profile.edit.phone')}
            <input
              className="addsheet-input"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+355 69 123 4567"
              maxLength={PROFILE_LIMITS.phone}
              value={form.phone}
              onChange={set('phone')}
              aria-invalid={error === 'phoneInvalid' || undefined}
              aria-describedby="edit-profile-phone-hint"
            />
            <span id="edit-profile-phone-hint" className="text-[12px] font-normal text-fho-text-muted">
              {isAgent ? t('profile.edit.phoneHintAgent') : t('profile.edit.phoneHintClient')}
            </span>
          </label>
          {errorText && <div className="nl-error" role="alert">{errorText}</div>}
          <button className="cta-pill" type="submit" disabled={saving}>
            {saving ? t('common.loading') : t('common.save')}
          </button>
        </form>
      </div>
    </>
  )
}
