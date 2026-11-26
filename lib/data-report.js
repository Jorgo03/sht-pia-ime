// "Download my data" as a report people can read: an Excel workbook with a
// summary, the person's journey on Shtëpia.ime in date order, and one sheet
// per kind of data with every column (lib/data-export-plan.js says which).
// Pure, so tests/dataReport.test.mjs runs it; the website builds the file.

import { buildXlsx } from './xlsx.js'

const pad = (n) => String(n).padStart(2, '0')

/** "2026-11-20 14:05" in the reader's time zone, so dates sort as text too. */
export function readableDate(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const isDateColumn = (key) => key.endsWith('_at') || key === 'promoted_until'

/** Every row of a table as a sheet: the columns as the header, dates readable. */
export function tableRows(rows) {
  const keys = []
  for (const r of rows) for (const k of Object.keys(r)) if (!keys.includes(k)) keys.push(k)
  return [keys, ...rows.map((r) => keys.map((k) => (isDateColumn(k) ? readableDate(r[k]) : r[k] ?? '')))]
}

const short = (s, n = 200) => {
  const text = String(s ?? '').replace(/\s+/g, ' ').trim()
  return text.length > n ? `${text.slice(0, n - 1)}…` : text
}

/**
 * What the person did, oldest first: [{ at, kind, detail, status }].
 * `titles` maps a listing id to its title, for listings that are not theirs.
 */
export function journeyEvents(userId, s, titles = {}) {
  const title = (id) => titles[id] || (id ? `#${String(id).slice(0, 8)}` : '')
  const own = Object.fromEntries((s.properties ?? []).map((p) => [p.id, p.title]))
  const listing = (id) => own[id] || title(id)
  const events = []
  const add = (at, kind, detail = '', status = '') => at && events.push({ at, kind, detail, status })

  for (const p of s.profiles ?? []) add(p.created_at, 'joined', [p.full_name, p.agency_name].filter(Boolean).join(' · '))
  for (const p of s.properties ?? [])
    add(p.created_at, 'listed', [p.title, p.city, p.price != null ? `${p.price} ${p.currency ?? 'EUR'}` : ''].filter(Boolean).join(' · '), p.status)
  for (const f of s.favorites ?? []) add(f.created_at, 'saved', listing(f.property_id))
  for (const q of s.saved_searches ?? []) add(q.created_at, 'savedSearch', q.name || short(JSON.stringify(q.filters ?? {}), 120))
  for (const w of s.wanted_homes ?? [])
    add(w.created_at, 'wanted', [w.city, w.max_price != null ? `≤ ${w.max_price}` : '', w.min_bedrooms ? `${w.min_bedrooms}+` : ''].filter(Boolean).join(' · '), w.status)
  for (const v of s.viewings ?? [])
    add(v.created_at, v.client_id === userId ? 'viewingRequested' : 'viewingAsAgent', [listing(v.property_id), readableDate(v.scheduled_at)].filter(Boolean).join(' · '), v.status)
  for (const c of s.conversations ?? []) add(c.created_at, 'conversation', listing(c.property_id))
  for (const m of s.messages ?? []) add(m.created_at, m.sender_id === userId ? 'messageSent' : 'messageReceived', short(m.body) || (m.attachment ? '📎' : ''))
  for (const l of s.leads ?? []) add(l.created_at, 'lead', l.name, l.status)
  for (const n of s.notifications ?? []) add(n.created_at, 'notification', n.kind)
  for (const r of s.content_reports ?? []) add(r.created_at, 'report', r.reason, r.status)
  for (const b of s.user_blocks ?? []) add(b.created_at, 'blocked')

  return events.sort((a, b) => new Date(a.at) - new Date(b.at))
}

/** Sheet order and the label key for each kind of data. */
export const REPORT_SECTIONS = [
  'profiles', 'properties', 'favorites', 'saved_searches', 'wanted_homes', 'viewings',
  'conversations', 'messages', 'leads', 'notifications', 'notification_preferences', 'content_reports', 'user_blocks',
]

/** The workbook's sheets, ready for buildXlsx. `t` is i18next's. */
export function reportSheets({ userId, email, sections, titles, t, now = new Date() }) {
  const profile = sections.profiles?.[0] ?? {}
  const label = (key) => t(`dataExport.sections.${key}`)
  const present = REPORT_SECTIONS.filter((k) => Array.isArray(sections[k]))

  const summary = [
    [t('dataExport.field'), t('dataExport.value')],
    [t('dataExport.name'), profile.full_name ?? ''],
    [t('dataExport.email'), email ?? ''],
    [t('dataExport.accountType'), profile.role ? t(profile.role === 'agent' ? 'auth.roleAgent' : 'auth.roleClient') : ''],
    ...(profile.agency_name ? [[t('auth.officeName'), profile.agency_name]] : []),
    [t('dataExport.memberSince'), readableDate(profile.created_at)],
    [t('dataExport.exportedOn'), readableDate(now)],
    [t('dataExport.userId'), userId],
    ['', ''],
    [t('dataExport.section'), t('dataExport.records')],
    ...present.map((k) => [label(k), sections[k].length]),
  ]

  // Statuses in the reader's language where the site already words them; the stored value otherwise.
  const STATUS_KEYS = { listed: 'listing.status', viewingRequested: 'viewings.status', viewingAsAgent: 'viewings.status', lead: 'leads.status', report: 'moderation.status' }
  const status = (kind, value) => (value && STATUS_KEYS[kind] ? t(`${STATUS_KEYS[kind]}.${value}`, { defaultValue: value }) : value ?? '')
  const journey = [
    [t('dataExport.date'), t('dataExport.activity'), t('dataExport.details'), t('dataExport.status')],
    ...journeyEvents(userId, sections, titles).map((e) => [readableDate(e.at), t(`dataExport.events.${e.kind}`), e.detail, status(e.kind, e.status)]),
  ]

  return [
    { name: t('dataExport.sheetSummary'), rows: summary, filter: false },
    { name: t('dataExport.sheetJourney'), rows: journey },
    ...present.map((k) => ({ name: label(k), rows: sections[k].length ? tableRows(sections[k]) : [[t('dataExport.none')]], header: sections[k].length > 0 })),
  ]
}

/** The .xlsx file, as bytes. */
export const buildReport = (args) => buildXlsx(reportSheets(args))

export const reportFileName = (now = new Date()) => `shtepia-ime-${now.toISOString().slice(0, 10)}.xlsx`
