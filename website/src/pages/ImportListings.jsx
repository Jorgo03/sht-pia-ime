import { useEffect, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { FileUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { batches, buildImport, COLUMN_NAMES, MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, REQUIRED_COLUMNS } from '@/src/features/listings/lib/bulkImport.js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'

const ERRORS_SHOWN = 30
const OPTIONAL = Object.keys(COLUMN_NAMES).filter((c) => !REQUIRED_COLUMNS.includes(c))

// CSV import for agents, as in the app (app/listing/import.tsx): parse and
// check every row first, show what is ready and what is wrong, then publish
// in batches, skipping duplicates of the agent's existing listings.
export default function ImportListings() {
  const { t } = useTranslation()
  const { user, profile, ready: authReady } = useAuth()
  const qc = useQueryClient()
  const input = useRef(null)
  const publishing = useRef(false)
  const [reading, setReading] = useState(false)
  const [problem, setProblem] = useState(null)
  const [rows, setRows] = useState(null)
  const [progress, setProgress] = useState(null)
  const [result, setResult] = useState(null)

  useEffect(() => {
    document.title = `${t('import.entry')} | ${t('common.appName')}`
  }, [t])

  if (authReady && !user) return <Navigate to="/login?next=/listing/import" replace />
  if (authReady && profile && profile.role !== 'agent') {
    return <div className="page container section"><p className="state">{t('import.agentsOnly')}</p></div>
  }

  const good = rows?.filter((r) => r.columns) ?? []
  const bad = rows?.filter((r) => !r.columns) ?? []
  const describe = (e) =>
    e.kind === 'required' || e.kind === 'invalid' ? t(`import.err.${e.kind}`, { field: COLUMN_NAMES[e.field ?? ''] ?? e.field }) : t(`import.err.${e.kind}`)

  const read = async (file) => {
    setProblem(null)
    setRows(null)
    setResult(null)
    if (!file) return
    if (file.size > MAX_IMPORT_BYTES) return setProblem(t('import.fileTooBig'))
    setReading(true)
    try {
      const text = await file.text()
      const { data: mine, error } = await supabase.from('properties').select('title, address, price').eq('owner_id', user.id).limit(5000)
      if (error) throw error
      const parsed = buildImport(text, mine ?? [])
      if (parsed.problem === 'columns') setProblem(t('import.missingColumns', { list: (parsed.missing ?? []).map((c) => COLUMN_NAMES[c]).join(', ') }))
      else if (parsed.problem === 'tooMany') setProblem(t('import.tooMany', { max: MAX_IMPORT_ROWS }))
      else if (parsed.problem) setProblem(t(`import.${parsed.problem === 'excel' ? 'fileExcel' : 'fileEmpty'}`))
      else setRows(parsed.rows)
    } catch {
      setProblem(t('import.readFailed'))
    } finally {
      setReading(false)
      if (input.current) input.current.value = ''
    }
  }

  const insertAll = async (items) => !(await supabase.from('properties').insert(items)).error

  const publish = async () => {
    if (publishing.current || good.length === 0) return
    publishing.current = true
    let ok = 0
    let failed = 0
    setProgress({ done: 0, total: good.length })
    const owned = good.map((r) => ({ ...r.columns, owner_id: user.id, agent_id: user.id, owner_type: 'agent', status: 'active' }))
    for (const group of batches(owned)) {
      if (await insertAll(group)) ok += group.length
      else for (const item of group) {
        if (await insertAll([item])) ok += 1
        else failed += 1
      }
      setProgress({ done: ok + failed, total: good.length })
    }
    publishing.current = false
    setProgress(null)
    setRows(null)
    setResult({ ok, failed })
    qc.invalidateQueries()
  }

  const picker = (
    <>
      <input ref={input} type="file" accept=".csv,text/csv,text/plain" className="visually-hidden" id="csv" onChange={(e) => read(e.target.files?.[0])} />
      <label htmlFor="csv" className={`btn ${rows ? 'btn-outline' : 'btn-primary'}`} aria-disabled={reading}>
        <FileUp size={18} aria-hidden="true" />
        {reading ? t('common.loading') : rows ? t('import.chooseAnother') : t('import.pick')}
      </label>
    </>
  )

  return (
    <div className="page container section narrow">
      <h1 className="page-title">{t('import.headlinePre')} {t('import.headlineEm')}</h1>
      {progress ? (
        <p className="state" role="status">{t('import.publishing', { done: progress.done, total: progress.total })}</p>
      ) : result ? (
        <div className="state" role="status">
          <p className="state-title">{t('import.doneBody', { ok: result.ok })}</p>
          {result.failed > 0 && <p>{t('import.doneFailed', { total: result.failed })}</p>}
          <div className="row-actions">
            <Link to="/my-listings" className="btn btn-primary">{t('listing.myListings')}</Link>
            <button type="button" className="btn btn-outline" onClick={() => setResult(null)}>{t('import.another')}</button>
          </div>
        </div>
      ) : rows ? (
        <>
          <div className="stat-grid">
            <div className="stat"><strong>{good.length}</strong><span>{t('import.ready')}</span></div>
            <div className="stat"><strong>{bad.length}</strong><span>{t('import.withErrors')}</span></div>
          </div>
          {bad.length > 0 && (
            <ul className="panel activity">
              {bad.slice(0, ERRORS_SHOWN).map((r) => (
                <li key={r.line}>
                  <strong>{t('import.line', { n: r.line })}</strong>
                  <span className="muted small">{r.errors.map(describe).join(' · ')}</span>
                </li>
              ))}
              {bad.length > ERRORS_SHOWN && <li className="muted small">{t('import.more', { total: bad.length - ERRORS_SHOWN })}</li>}
            </ul>
          )}
          <div className="row-actions">
            {good.length > 0 && <button type="button" className="btn btn-primary" onClick={publish}>{t('import.publish', { total: good.length })}</button>}
            {picker}
          </div>
        </>
      ) : (
        <>
          <p>{t('import.intro')}</p>
          <div className="row-actions">{picker}</div>
          {problem && <p className="form-error" role="alert">{problem}</p>}
          <div className="panel prose">
            <h2 className="panel-title">{t('import.required')}</h2>
            <p className="mono">{REQUIRED_COLUMNS.map((c) => COLUMN_NAMES[c]).join(', ')}</p>
            <h2 className="panel-title">{t('import.optional')}</h2>
            <p className="mono">{OPTIONAL.map((c) => COLUMN_NAMES[c]).join(', ')}</p>
            <p className="muted small">{t('import.valuesHint')}</p>
            <p className="muted small">{t('import.photosHint')}</p>
            <p className="muted small">{t('import.rightsHint')}</p>
          </div>
        </>
      )}
      {rows && problem && <p className="form-error" role="alert">{problem}</p>}
    </div>
  )
}
