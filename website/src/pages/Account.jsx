import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { Building2, Home, LogOut, Smartphone, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { profilePatch, PROFILE_LIMITS, saveProfile } from '@/src/features/auth/lib/profileForm.js'
import { supabase } from '../lib/supabase'
import { accountTypeOf, useAuth } from '../auth/AuthContext'
import { FormError, TextField } from '../auth/Fields'

const ICONS = { client: Home, agent: UserRound, office: Building2 }

export default function Account() {
  const { t } = useTranslation()
  const { state } = useLocation()
  const { session, user, profile, ready, signOut, refreshProfile } = useAuth()
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(state?.notice ? t(state.notice) : null)

  useEffect(() => {
    document.title = `${t('web.account.title')} | ${t('common.appName')}`
  }, [t])

  if (!ready) return <div className="page container section" aria-busy="true" />
  if (!session) return <Navigate to="/login?next=/account" replace />

  const type = accountTypeOf(user, profile)
  const isAgent = profile?.role === 'agent'
  const Icon = ICONS[type]
  const values = form ?? { full_name: profile?.full_name ?? '', agency_name: profile?.agency_name ?? '', phone: profile?.phone ?? '' }
  const set = (key) => (e) => setForm({ ...values, [key]: e.target.value })

  const save = async (e) => {
    e.preventDefault()
    if (busy) return
    setNotice(null)
    if (type === 'office' && !values.agency_name.trim()) return setError(t('web.auth.officeRequired'))
    const { patch, error: problem } = profilePatch(profile, values, { isAgent })
    if (problem) return setError(t(`profile.edit.${problem}`))
    setBusy(true)
    setError(null)
    const result = await saveProfile(supabase, user.id, patch)
    setBusy(false)
    if (result === 'failed') return setError(t('profile.edit.failed'))
    await refreshProfile().catch(() => {})
    setForm(null)
    setNotice(t('web.account.saved'))
  }

  return (
    <div className="page container section account">
      <header className="account-head">
        <div>
          <h1 className="page-title">{t('web.account.title')}</h1>
          <p className="account-email">{user.email}</p>
        </div>
        <span className="account-type">
          <Icon size={16} aria-hidden="true" />
          {t(`web.auth.type.${type}`)}
        </span>
      </header>

      <div className="account-grid">
        <form className="auth-form account-card" onSubmit={save} noValidate>
          <h2>{t('profile.edit.title')}</h2>
          <TextField label={t('auth.fullName')} autoComplete="name" value={values.full_name} onChange={set('full_name')} maxLength={PROFILE_LIMITS.full_name} />
          {isAgent && (
            <TextField
              label={type === 'office' ? t('auth.officeName') : t('web.auth.agencyOptional')}
              autoComplete="organization"
              value={values.agency_name}
              onChange={set('agency_name')}
              maxLength={PROFILE_LIMITS.agency_name}
            />
          )}
          <TextField
            label={t('profile.edit.phone')}
            type="tel"
            autoComplete="tel"
            value={values.phone}
            onChange={set('phone')}
            maxLength={PROFILE_LIMITS.phone}
            hint={isAgent ? t('profile.edit.phoneHintAgent') : t('profile.edit.phoneHintClient')}
          />
          <FormError>{error}</FormError>
          {notice && !error && (
            <p className="form-note" role="status">
              {notice}
            </p>
          )}
          <button type="submit" className="btn btn-primary" disabled={busy || !form}>
            {t('common.save')}
          </button>
        </form>

        <aside className="account-card">
          <h2>{isAgent ? t('web.account.agentTitle') : t('web.account.clientTitle')}</h2>
          <p>{isAgent ? t('web.account.agentBody') : t('web.account.clientBody')}</p>
          <div className="account-actions">
            <Link to={isAgent ? '/#app' : '/search'} className="btn btn-outline">
              {isAgent ? <Smartphone size={16} aria-hidden="true" /> : null}
              {isAgent ? t('web.nav.app') : t('site.cta.search')}
            </Link>
            <button type="button" className="btn btn-outline" onClick={signOut}>
              <LogOut size={16} aria-hidden="true" />
              {t('common.signOut')}
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
