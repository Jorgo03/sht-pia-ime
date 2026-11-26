import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, Ban, Bell, BriefcaseBusiness, CalendarClock, Heart, Home, LayoutDashboard, MessageCircle, Plus, Search, Upload, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { profilePatch, PROFILE_LIMITS, saveProfile } from '@/src/features/auth/lib/profileForm.js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { FormError, TextField } from '../auth/Fields'
import { AccountActions, AvatarEditor, NotificationSettings, SecuritySection } from '../features/accountSections'

// The signed-in Profile tab of the app (app/(tabs)/profile.tsx) as the
// website's My account: counts, profile and photo, password & security,
// notification settings, every section, data download and account deletion.

function useStats(user, isAgent) {
  return useQuery({
    queryKey: ['profile-stats', user?.id, isAgent],
    enabled: !!user,
    queryFn: async () => {
      const head = { count: 'exact', head: true }
      const [f, s, third] = await Promise.all([
        supabase.from('favorites').select('id', head).eq('user_id', user.id),
        supabase.from('saved_searches').select('id', head).eq('user_id', user.id),
        isAgent
          ? supabase.from('properties').select('id', head).eq('owner_id', user.id).eq('status', 'active')
          : supabase.from('viewings').select('id', head).eq('client_id', user.id).in('status', ['requested', 'confirmed']),
      ])
      return { saved: f.count ?? 0, searches: s.count ?? 0, third: third.count ?? 0 }
    },
  })
}

export default function Account() {
  const { t } = useTranslation()
  const { state } = useLocation()
  const { session, user, profile, ready, refreshProfile } = useAuth()
  const isAgent = profile?.role === 'agent'
  const stats = useStats(user, isAgent)
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(state?.notice ? t(state.notice) : null)

  useEffect(() => {
    document.title = `${t('web.account.title')} | ${t('common.appName')}`
  }, [t])

  if (!ready) return <div className="page container section" aria-busy="true" />
  if (!session) return <Navigate to="/login?next=/account" replace />

  const values = form ?? { full_name: profile?.full_name ?? '', agency_name: profile?.agency_name ?? '', phone: profile?.phone ?? '' }
  const set = (key) => (e) => setForm({ ...values, [key]: e.target.value })

  const save = async (e) => {
    e.preventDefault()
    if (busy) return
    setNotice(null)
    if (isAgent && values.agency_name.trim().length < 2) return setError(t('errors.officeRequired'))
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

  const links = [
    [Heart, t('common.favorites'), '/favorites'],
    [MessageCircle, t('common.messages'), '/messages'],
    [Search, `${t('saved.headlinePre')} ${t('saved.headlineEm')}`, '/saved-searches'],
    [CalendarClock, t('viewings.title'), '/viewings'],
    [Bell, `${t('notifications.headlinePre')} ${t('notifications.headlineEm')}`, '/notifications'],
    [Home, t('listing.myListings'), '/my-listings'],
    [Plus, t('listing.newListing'), '/listing/new'],
    [Ban, t('safety.blockedUsers'), '/blocked-users'],
  ]
  const agentLinks = [
    [LayoutDashboard, t('agentDashboard.title'), '/agent-dashboard'],
    [Users, `${t('leads.headlinePre')} ${t('leads.headlineEm')}`, '/leads'],
    [BarChart3, t('performance.entry'), '/performance'],
    [Upload, t('import.entry'), '/listing/import'],
    [Search, `${t('wanted.boardPre')} ${t('wanted.boardEm')}`, '/wanted'],
  ]
  const s = stats.data

  return (
    <div className="page container section account">
      <header className="account-head">
        <AvatarEditor />
        <div>
          <h1 className="page-title">{profile?.full_name || t('web.account.title')}</h1>
          <p className="account-email">{user.email}</p>
          {isAgent && profile?.agency_name && <p className="muted">{profile.agency_name}</p>}
        </div>
        <span className="account-type">
          {isAgent ? <BriefcaseBusiness size={16} aria-hidden="true" /> : <Home size={16} aria-hidden="true" />}
          {isAgent ? t('auth.roleAgent') : t('auth.roleClient')}
        </span>
      </header>

      <div className="stat-grid">
        <Link to="/favorites" className="stat"><strong>{s ? s.saved : '–'}</strong><span>{t('profile.statSaved')}</span></Link>
        <Link to="/saved-searches" className="stat"><strong>{s ? s.searches : '–'}</strong><span>{t('profile.statSearches')}</span></Link>
        <Link to={isAgent ? '/my-listings' : '/viewings'} className="stat"><strong>{s ? s.third : '–'}</strong><span>{isAgent ? t('profile.statListings') : t('profile.statViewings')}</span></Link>
      </div>

      <nav className="hub" aria-label={t('web.account.title')}>
        {(isAgent ? [...agentLinks, ...links] : links).map(([Icon, label, to]) => (
          <Link key={to} to={to} className="hub-link">
            <Icon size={18} aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="account-grid">
        <form className="account-card" onSubmit={save} noValidate>
          <h2>{t('profile.edit.title')}</h2>
          <TextField label={t('auth.fullName')} autoComplete="name" value={values.full_name} onChange={set('full_name')} maxLength={PROFILE_LIMITS.full_name} />
          {isAgent && <TextField label={t('auth.officeName')} autoComplete="organization" value={values.agency_name} onChange={set('agency_name')} maxLength={PROFILE_LIMITS.agency_name} />}
          <TextField label={t('profile.edit.phone')} type="tel" autoComplete="tel" value={values.phone} onChange={set('phone')} maxLength={PROFILE_LIMITS.phone} hint={isAgent ? t('profile.edit.phoneHintAgent') : t('profile.edit.phoneHintClient')} />
          <FormError>{error}</FormError>
          {notice && !error && <p className="form-note" role="status">{notice}</p>}
          <button type="submit" className="btn btn-primary" disabled={busy || !form}>{t('common.save')}</button>
        </form>

        <div className="account-side">
          <section className="account-card" aria-labelledby="sec-title">
            <h2 id="sec-title">{t('security.row')}</h2>
            <SecuritySection />
          </section>
          <section className="account-card" aria-labelledby="ns-title">
            <h2 id="ns-title">{t('notifications.settings')}</h2>
            <NotificationSettings />
          </section>
        </div>
      </div>

      <section className="account-card account-footer" aria-label={t('account.settings')}>
        <AccountActions />
        <p className="legal-links">
          <a href="/privacy">{t('legal.privacyPolicy')}</a>
          <a href="/terms">{t('legal.termsOfService')}</a>
          <a href="/cookies">{t('legal.cookiePolicy')}</a>
        </p>
      </section>
    </div>
  )
}
