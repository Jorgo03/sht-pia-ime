import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Camera, Download, LogOut, Trash2, X } from 'lucide-react'
import { changePassword, hasPasswordSignIn, newPasswordError, providerLabels } from '@/src/features/auth/lib/password.js'
import { avatarSourceError, removeAvatar, saveAvatar } from '@/src/features/auth/lib/avatar.js'
import { resizeToSquareJpeg } from '@/src/features/auth/lib/resizeAvatar.js'
import { readPreferences, savePreferences } from '@/src/features/notifications/lib/preferences.js'
import { EXPORT_TABLES, MAX_ROWS, PAGE, exportDocument, exportFileName, ownerFilter, stripColumns } from '@/lib/data-export-plan.js'
import { profileInitials } from '@/src/features/profiles/lib/publicProfile.js'
import { friendlyError } from '@/src/lib/authErrors.js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'

// The signed-in Profile tab's sections from the app (app/(tabs)/profile.tsx
// and components/profile/*), for the website's My account page.

/** Photo: choose (JPEG/PNG/WebP, resized square in the browser) or remove. */
export function AvatarEditor() {
  const { t } = useTranslation()
  const { user, profile, refreshProfile } = useAuth()
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const name = profile?.full_name || user?.email || ''

  const choose = async (file) => {
    setError(null)
    if (!file) return
    const problem = avatarSourceError({ type: file.type, size: file.size })
    if (problem) return setError(t(problem === 'size' ? 'profile.edit.photoSize' : 'profile.edit.photoType'))
    setBusy(true)
    try {
      const body = await resizeToSquareJpeg(file)
      const result = await saveAvatar(supabase, user.id, body, profile?.avatar_url ?? null)
      if (result.status === 'tooLarge') return setError(t('profile.edit.photoSize'))
      if (result.status !== 'saved') throw new Error('save')
      await refreshProfile()
    } catch {
      setError(t('profile.edit.photoFailed'))
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }
  const remove = async () => {
    setBusy(true)
    setError(null)
    try {
      if ((await removeAvatar(supabase, user.id, profile?.avatar_url ?? null)) !== 'saved') throw new Error('remove')
      await refreshProfile()
    } catch {
      setError(t('profile.edit.photoFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="avatar-editor">
      {profile?.avatar_url ? <img className="profile-avatar" src={profile.avatar_url} alt="" /> : <span className="profile-avatar agent-initials" aria-hidden="true">{profileInitials(name)}</span>}
      <div className="row-actions">
        <input ref={input} id="avatar-file" type="file" accept="image/jpeg,image/png,image/webp" className="visually-hidden" onChange={(e) => choose(e.target.files?.[0])} disabled={busy} />
        <label htmlFor="avatar-file" className="btn btn-outline btn-sm" aria-disabled={busy}>
          <Camera size={15} aria-hidden="true" />
          {busy ? t('common.loading') : profile?.avatar_url ? t('profile.edit.changePhoto') : t('profile.edit.photo')}
        </label>
        {profile?.avatar_url && (
          <button type="button" className="btn btn-outline btn-sm" onClick={remove} disabled={busy}>
            <X size={15} aria-hidden="true" />
            {t('profile.edit.removePhoto')}
          </button>
        )}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  )
}

/** Change password (current, then new), as in the app's security sheet. */
export function SecuritySection() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  if (!user) return null
  if (!hasPasswordSignIn(user)) {
    return <p className="muted">{t('security.providerOnly', { providers: providerLabels(user).join(', ') })}</p>
  }
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const submit = async (e) => {
    e.preventDefault()
    setMsg(null)
    if (!form.current) return setMsg({ tone: 'error', text: t('errors.passwordRequired') })
    const problem = newPasswordError(form.next, form.confirm, { current: form.current })
    if (problem) return setMsg({ tone: 'error', text: t(problem) })
    setBusy(true)
    const result = await changePassword(supabase, { email: user.email, currentPassword: form.current, newPassword: form.next })
    setBusy(false)
    if (result.status === 'wrongCurrent') return setMsg({ tone: 'error', text: t('errors.currentPasswordWrong') })
    if (result.status !== 'changed') return setMsg({ tone: 'error', text: friendlyError(result.error, t) })
    setForm({ current: '', next: '', confirm: '' })
    setMsg({ tone: 'ok', text: `${t('security.success')} ${result.othersSignedOut ? t('security.othersSignedOut') : ''}` })
  }
  return (
    <form className="form-grid" onSubmit={submit} noValidate>
      <label className="field span-2"><span>{t('security.currentPassword')}</span><input className="input" type="password" autoComplete="current-password" value={form.current} onChange={set('current')} /></label>
      <label className="field"><span>{t('auth.newPassword')}</span><input className="input" type="password" autoComplete="new-password" value={form.next} onChange={set('next')} /></label>
      <label className="field"><span>{t('auth.confirmPassword')}</span><input className="input" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} /></label>
      {msg && <p className={msg.tone === 'ok' ? 'form-note span-2' : 'form-error span-2'} role={msg.tone === 'ok' ? 'status' : 'alert'}>{msg.text}</p>}
      <div className="span-2"><button type="submit" className="btn btn-primary" disabled={busy}>{busy ? t('common.loading') : t('security.save')}</button></div>
    </form>
  )
}

/** Which notifications the account wants, saved to notification_preferences. */
export function NotificationSettings() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [prefs, setPrefs] = useState(null)
  const [state, setState] = useState('loading')
  useEffect(() => {
    if (!user) return
    readPreferences(supabase, user.id).then(({ ok, prefs: p }) => {
      setPrefs(p)
      setState(ok ? 'ready' : 'error')
    })
  }, [user])
  const toggle = async (key) => {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    setState('saving')
    const ok = await savePreferences(supabase, next)
    if (!ok) setPrefs(prefs)
    setState(ok ? 'ready' : 'saveFailed')
  }
  if (state === 'loading') return <p className="muted">{t('common.loading')}</p>
  if (state === 'error') return <p className="form-error">{t('notifications.loadFailed')}</p>
  return (
    <div className="toggles">
      {['messages', 'viewings'].map((key) => (
        <label key={key} className="toggle">
          <span>{t(`notifications.${key}`)}</span>
          <input type="checkbox" role="switch" checked={prefs[key]} onChange={() => toggle(key)} disabled={state === 'saving'} />
        </label>
      ))}
      {state === 'saveFailed' && <p className="form-error" role="alert">{t('notifications.saveFailed')}</p>}
    </div>
  )
}

/** Download my data (GDPR): every row of mine as one JSON file. */
async function collectMyData(userId) {
  const readAll = async (table, filter, omit) => {
    const rows = []
    for (let from = 0; from < MAX_ROWS; from += PAGE) {
      const { data, error } = await filter(supabase.from(table).select('*')).range(from, from + PAGE - 1)
      if (error) throw error
      rows.push(...(data ?? []))
      if (!data || data.length < PAGE) break
    }
    return stripColumns(rows, omit)
  }
  const sections = {}
  for (const { table, match, omit } of EXPORT_TABLES) sections[table] = await readAll(table, (q) => q.or(ownerFilter(match, userId)), omit)
  const ids = (sections.conversations ?? []).map((c) => String(c.id))
  sections.messages = []
  for (let i = 0; i < ids.length; i += 50) sections.messages.push(...(await readAll('messages', (q) => q.in('conversation_id', ids.slice(i, i + 50)).order('created_at'))))
  return exportDocument(userId, sections)
}

export function AccountActions() {
  const { t } = useTranslation()
  const { user, signOut } = useAuth()
  const [exporting, setExporting] = useState(false)
  const [exportFailed, setExportFailed] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteFailed, setDeleteFailed] = useState(false)
  const dialog = useRef(null)

  const download = async () => {
    if (exporting) return
    setExporting(true)
    setExportFailed(false)
    try {
      const json = await collectMyData(user.id)
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = exportFileName()
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setExportFailed(true)
    } finally {
      setExporting(false)
    }
  }
  const deleteAccount = async () => {
    if (deleting) return
    setDeleting(true)
    setDeleteFailed(false)
    try {
      // The Edge Function takes the account from the verified access token.
      const { error } = await supabase.functions.invoke('delete-account', { body: {} })
      if (error) throw error
      dialog.current?.close()
      await signOut()
    } catch {
      setDeleteFailed(true)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="account-actions-list">
      <button type="button" className="btn btn-outline" onClick={() => window.confirm(t('common.confirmSignOut')) && signOut()}>
        <LogOut size={16} aria-hidden="true" />
        {t('common.signOut')}
      </button>
      <button type="button" className="btn btn-outline" onClick={download} disabled={exporting}>
        <Download size={16} aria-hidden="true" />
        {exporting ? t('account.downloadDataBusy') : t('account.downloadData')}
      </button>
      {exportFailed && <p className="form-error" role="alert">{t('account.downloadDataFailed')}</p>}
      <button type="button" className="btn btn-outline danger" onClick={() => dialog.current?.showModal()}>
        <Trash2 size={16} aria-hidden="true" />
        {t('account.deleteAccount')}
      </button>
      <dialog ref={dialog} className="dialog" aria-labelledby="del-title">
        <div className="dialog-body">
          <h2 id="del-title">{t('account.deleteAccount')}</h2>
          <p>{t('account.deleteConfirmBody')}</p>
          {deleteFailed && <p className="form-error" role="alert">{t('account.deleteFailed')}</p>}
          <div className="dialog-actions">
            <button type="button" className="btn btn-outline" onClick={() => dialog.current?.close()}>{t('common.cancel')}</button>
            <button type="button" className="btn btn-primary danger-fill" onClick={deleteAccount} disabled={deleting}>
              {deleting ? t('common.loading') : t('account.deleteConfirmCta')}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  )
}
