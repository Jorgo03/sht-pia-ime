// Pure logic for saved-search email alerts (docs/LAUNCH_TASKS.md F13): no
// Deno, no network, no database. index.ts does the I/O; tests/
// savedSearchAlerts.test.mjs runs this file under Node.

/** At most this many listings in one email; the rest are counted, not listed. */
export const MAX_LISTINGS_PER_EMAIL = 10

/**
 * A saved search's price range is in euros, across EUR, ALL and USD listings.
 * Copied from src/features/properties/lib/priceRange.js, because this function
 * is deployed on its own; tests/priceRange.test.mjs keeps the two identical.
 */
export const UNITS_PER_EUR = Object.freeze({ EUR: 1, ALL: 98, USD: 1.15 })

const bound = (value) => {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function priceRangeExpression(minEur, maxEur) {
  const min = bound(minEur)
  const max = bound(maxEur)
  if (min === null && max === null) return null
  const range = (rate) =>
    [min === null ? null : `price.gte.${Math.round(min * rate)}`, max === null ? null : `price.lte.${Math.round(max * rate)}`]
      .filter(Boolean)
      .join(',')
  const codes = Object.keys(UNITS_PER_EUR)
  return [
    ...codes.map((code) => `and(currency.eq.${code},${range(UNITS_PER_EUR[code])})`),
    `and(currency.is.null,${range(1)})`,
    `and(currency.not.in.(${codes.join(',')}),${range(1)})`,
  ].join(',')
}

/**
 * The same filter rules as the apps (src/features/saved-searches/lib/matches.js
 * and the Search page). Zone applies only together with a city; the apps only
 * ever save a zone that belongs to the saved city.
 */
export function applySavedFilters(query, filters) {
  const f = filters ?? {}
  const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))
  if (f.city) query = query.ilike('city', `%${f.city}%`)
  if (f.city && f.zone) query = query.eq('zone', f.zone)
  if (f.listing_type) query = query.eq('listing_type', f.listing_type)
  if (f.type && f.type !== 'all') query = query.eq('property_type', f.type)
  const price = priceRangeExpression(f.minPrice, f.maxPrice)
  if (price) query = query.or(price)
  if (num(f.beds) !== null) query = query.gte('beds', num(f.beds))
  return query
}

/** New matches are listings created after this moment. */
export function windowStart(search) {
  return search.last_alerted_at ?? search.created_at
}

/**
 * Sending is OFF unless the owner has set all three: an email provider key, a
 * verified sender address, and the explicit switch. Until then alerts are
 * queued in email_outbox (status 'pending') and nothing leaves the server.
 */
export function dispatchEnabled(env) {
  return env.ALERTS_DISPATCH_ENABLED === 'true' && Boolean(env.RESEND_API_KEY) && Boolean(env.ALERT_EMAIL_FROM)
}

const STRINGS = {
  sq: { subject: (n) => `${n} shtëpi të reja për "{name}"`, intro: 'Këto njoftime përputhen me kërkimin tuaj të ruajtur:', more: (n) => `dhe ${n} të tjera`, open: 'Shiko', stop: 'Mos më dërgo më email për këtë kërkim' },
  en: { subject: (n) => `${n} new homes for "{name}"`, intro: 'These listings match your saved search:', more: (n) => `and ${n} more`, open: 'View', stop: 'Stop emails for this search' },
  de: { subject: (n) => `${n} neue Angebote für "{name}"`, intro: 'Diese Anzeigen passen zu deiner gespeicherten Suche:', more: (n) => `und ${n} weitere`, open: 'Ansehen', stop: 'Keine E-Mails mehr für diese Suche' },
  it: { subject: (n) => `${n} nuove case per "{name}"`, intro: 'Questi annunci corrispondono alla tua ricerca salvata:', more: (n) => `e altri ${n}`, open: 'Vedi', stop: 'Non inviarmi più email per questa ricerca' },
  es: { subject: (n) => `${n} viviendas nuevas para "{name}"`, intro: 'Estos anuncios coinciden con tu búsqueda guardada:', more: (n) => `y ${n} más`, open: 'Ver', stop: 'No enviar más correos para esta búsqueda' },
  fr: { subject: (n) => `${n} nouveaux biens pour « {name} »`, intro: 'Ces annonces correspondent à votre recherche enregistrée :', more: (n) => `et ${n} de plus`, open: 'Voir', stop: 'Ne plus recevoir d’e-mails pour cette recherche' },
  pl: { subject: (n) => `${n} nowych ofert dla „{name}”`, intro: 'Te ogłoszenia pasują do Twojego zapisanego wyszukiwania:', more: (n) => `i ${n} więcej`, open: 'Zobacz', stop: 'Nie wysyłaj więcej e-maili dla tego wyszukiwania' },
  ru: { subject: (n) => `${n} новых объявлений по «{name}»`, intro: 'Эти объявления подходят под ваш сохранённый поиск:', more: (n) => `и ещё ${n}`, open: 'Открыть', stop: 'Больше не присылать письма по этому поиску' },
}

const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

/** Plain listing title for the person's language, falling back to the source. */
function titleFor(listing, lang) {
  const map = listing.title_i18n && typeof listing.title_i18n === 'object' ? listing.title_i18n : {}
  return map[lang] || listing.title || ''
}

/**
 * One email for one saved search. No tracking pixels, no remote images and no
 * personal data beyond what the recipient already owns (their search name).
 */
export function buildAlertEmail({ lang, searchName, listings, siteUrl, unsubscribeUrl }) {
  const s = STRINGS[lang] ?? STRINGS.en
  const name = String(searchName ?? '').slice(0, 80)
  const shown = listings.slice(0, MAX_LISTINGS_PER_EMAIL)
  const extra = listings.length - shown.length
  const subject = s.subject(listings.length).replace('{name}', name)
  const lines = shown.map((l) => {
    const price = l.price != null ? ` · ${Number(l.price).toLocaleString('en-US')} ${l.currency ?? 'EUR'}` : ''
    return { label: `${titleFor(l, lang)} — ${l.city ?? ''}${price}`, url: `${siteUrl}/property/${l.id}` }
  })
  const text = [
    s.intro,
    '',
    ...lines.map((l) => `• ${l.label}\n  ${l.url}`),
    ...(extra > 0 ? [s.more(extra)] : []),
    '',
    `${s.stop}: ${unsubscribeUrl}`,
  ].join('\n')
  const html = [
    `<p>${escapeHtml(s.intro)}</p>`,
    '<ul>',
    ...lines.map((l) => `<li>${escapeHtml(l.label)} — <a href="${escapeHtml(l.url)}">${escapeHtml(s.open)}</a></li>`),
    '</ul>',
    ...(extra > 0 ? [`<p>${escapeHtml(s.more(extra))}</p>`] : []),
    `<p style="font-size:12px;color:#666"><a href="${escapeHtml(unsubscribeUrl)}">${escapeHtml(s.stop)}</a></p>`,
  ].join('\n')
  return { subject, text, html }
}

/**
 * One short key per search and batch of listings, so a retried run cannot
 * queue the same email twice. Hashed (two FNV-1a variants) rather than the
 * raw id list, which could outgrow a btree index entry.
 */
export function dedupeKey(searchId, listingIds) {
  const input = [...listingIds].sort().join(',')
  const fnv = (seed) => {
    let h = seed
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i)
      h = Math.imul(h, 0x01000193) >>> 0
    }
    return h.toString(36)
  }
  return `ssa:${searchId}:${listingIds.length}:${fnv(0x811c9dc5)}${fnv(0x01234567)}`
}
