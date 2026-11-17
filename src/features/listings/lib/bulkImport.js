// Publishing many listings from one spreadsheet. Pure, for `npm test`; the
// phone app imports it through bulkImport.d.ts. Every rule here mirrors a check
// on public.properties, so a row that passes cannot be refused for its content.

import { validZone } from '../../properties/lib/searchFilters.js'

export const MAX_IMPORT_ROWS = 200
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024

const fold = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
const headerKey = (s) => fold(s).replace(/[\s_\-/.]+/g, '')

// Each column by its Albanian and English names.
const COLUMNS = {
  title: ['titulli', 'titull', 'title'],
  price: ['cmimi', 'cmim', 'price'],
  city: ['qyteti', 'qytet', 'city'],
  listing_type: ['lloji', 'njoftimi', 'listingtype'],
  property_type: ['tipi', 'tip', 'propertytype'],
  sqft: ['siperfaqja', 'siperfaqe', 'm2', 'area', 'sqft'],
  photos: ['foto', 'fotot', 'photos', 'images'],
  address: ['adresa', 'adrese', 'address'],
  zone: ['zona', 'zone', 'lagjja'],
  currency: ['monedha', 'currency'],
  beds: ['dhoma', 'dhomagjumi', 'bedrooms', 'beds'],
  baths: ['banjo', 'tualete', 'bathrooms', 'baths'],
  floor: ['kati', 'floor'],
  total_floors: ['kategjithsej', 'totalfloors'],
  year_built: ['viti', 'vitiindertimit', 'yearbuilt'],
  description: ['pershkrimi', 'pershkrim', 'description'],
  features: ['karakteristikat', 'features'],
  contact_phone: ['telefoni', 'telefon', 'phone'],
  latitude: ['lat', 'latitude'],
  longitude: ['lng', 'lon', 'longitude'],
}

/** The name each column goes by in messages and in the screen's guide. */
export const COLUMN_NAMES = Object.fromEntries(Object.entries(COLUMNS).map(([k, names]) => [k, names[0]]))
export const REQUIRED_COLUMNS = ['title', 'price', 'city', 'listing_type', 'property_type', 'sqft', 'photos']

const LISTING_TYPES = { shitje: 'sale', shitet: 'sale', sale: 'sale', qira: 'rent', qera: 'rent', rent: 'rent', qiraditore: 'daily_rent', ditore: 'daily_rent', dailyrent: 'daily_rent' }
const PROPERTY_TYPES = { apartament: 'apartment', apartment: 'apartment', shtepi: 'house', house: 'house', vile: 'villa', vila: 'villa', villa: 'villa', toke: 'land', truall: 'land', land: 'land', komerciale: 'commercial', biznes: 'commercial', dyqan: 'commercial', commercial: 'commercial', zyre: 'office', office: 'office', garazh: 'garage', garage: 'garage' }
const FEATURES = { ballkon: 'balcony', balcony: 'balcony', parking: 'parking', ashensor: 'elevator', elevator: 'elevator', kopesht: 'garden', garden: 'garden', pishine: 'pool', pool: 'pool', mobiluar: 'furnished', emobiluar: 'furnished', furnished: 'furnished', kondicionim: 'airConditioning', airconditioning: 'airConditioning', siguri: 'security', security: 'security', magazine: 'storage', storage: 'storage' }

/** Excel writes ";" in much of Europe; a sheet pasted out is tab-separated. */
function detectDelimiter(text) {
  const first = text.split(/\r?\n/, 1)[0] ?? ''
  const counts = [',', ';', '\t'].map((d) => [d, first.split(d).length])
  return counts.sort((a, b) => b[1] - a[1])[0][0]
}

/** CSV with quoted cells, doubled quotes and line breaks inside quotes. */
export function parseCsv(input) {
  const text = String(input ?? '').replace(/^﻿/, '')
  const delimiter = detectDelimiter(text)
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  let line = 1
  let rowLine = 1
  const endRow = () => {
    row.push(cell)
    cell = ''
    if (row.some((c) => c.trim() !== '')) rows.push({ line: rowLine, cells: row })
    row = []
    rowLine = line
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else {
        if (ch === '\n') line++
        cell += ch
      }
    } else if (ch === '"' && cell === '') quoted = true
    else if (ch === delimiter) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n') {
      line++
      endRow()
    } else if (ch !== '\r') cell += ch
  }
  if (cell !== '' || row.length) endRow()
  return rows
}

/**
 * "125.000 €", "125,000" and "85,5" as numbers. A lone separator followed by
 * exactly three digits is a thousands mark, as prices are written here.
 */
export function parseNumber(raw) {
  let s = String(raw ?? '').replace(/[^\d.,-]/g, '')
  if (!/\d/.test(s)) return null
  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  if (lastDot >= 0 && lastComma >= 0) {
    const decimal = lastDot > lastComma ? '.' : ','
    const thousands = decimal === '.' ? ',' : '.'
    s = s.split(thousands).join('').replace(decimal, '.')
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? '.' : ','
    const parts = s.split(sep)
    s = parts.length > 2 || parts[parts.length - 1].length === 3 ? parts.join('') : parts.join('.')
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const PHONE = /^\+?[0-9 ()-]{6,32}$/

export const duplicateKey = (title, address, price) => `${fold(title)}|${fold(address)}|${Number(price)}`

function readRow(get, line, seen) {
  const errors = []
  const bad = (field) => errors.push({ kind: 'invalid', field })
  const need = (field) => {
    const v = get(field)
    if (!v) errors.push({ kind: 'required', field })
    return v
  }
  const number = (field, { min, max, integer = true, fallback = null }) => {
    const v = get(field)
    if (!v) return fallback
    const n = parseNumber(v)
    if (n === null || n < min || n > max) {
      bad(field)
      return fallback
    }
    return integer ? Math.round(n) : n
  }

  const title = need('title')
  if (title.length > 200) bad('title')
  const rawPrice = need('price')
  const price = rawPrice ? parseNumber(rawPrice) : null
  if (rawPrice && (price === null || price <= 0 || price > 999999999)) bad('price')
  const city = need('city')
  if (city.length > 80) bad('city')

  const rawListing = need('listing_type')
  const listing_type = LISTING_TYPES[headerKey(rawListing)]
  if (rawListing && !listing_type) bad('listing_type')
  const rawType = need('property_type')
  const property_type = PROPERTY_TYPES[headerKey(rawType)]
  if (rawType && !property_type) bad('property_type')

  if (!get('sqft')) errors.push({ kind: 'required', field: 'sqft' })
  const sqft = number('sqft', { min: 1, max: 100000 })

  const rawPhotos = need('photos')
  const image_urls = rawPhotos.split('|').map((u) => u.trim()).filter(Boolean)
  if (rawPhotos && (image_urls.length === 0 || image_urls.length > 20 || !image_urls.every((u) => /^https:\/\/\S+$/i.test(u)))) bad('photos')

  const address = get('address')
  if (address.length > 300) bad('address')
  const description = get('description')
  if (description.length > 10000) bad('description')
  const currency = (get('currency') || 'EUR').toUpperCase()
  if (!['EUR', 'ALL', 'USD'].includes(currency)) bad('currency')

  const features = []
  for (const part of get('features').split('|').map((f) => f.trim()).filter(Boolean)) {
    const key = FEATURES[headerKey(part)]
    if (key) features.push(key)
    else bad('features')
  }

  const contact_phone = get('contact_phone') || null
  if (contact_phone && (!PHONE.test(contact_phone) || contact_phone.replace(/\D/g, '').length < 6)) bad('contact_phone')

  const latitude = number('latitude', { min: -90, max: 90, integer: false })
  const longitude = number('longitude', { min: -180, max: 180, integer: false })
  if ((latitude === null) !== (longitude === null)) bad(latitude === null ? 'latitude' : 'longitude')

  const columns = {
    title,
    title_i18n: { sq: title },
    description,
    description_i18n: { sq: description },
    source_language: 'sq',
    listing_type,
    property_type,
    city,
    zone: validZone(city, get('zone')),
    address,
    latitude,
    longitude,
    price,
    currency,
    sqft,
    beds: number('beds', { min: 0, max: 50, fallback: 0 }),
    baths: number('baths', { min: 0, max: 50, integer: false, fallback: 0 }),
    floor: number('floor', { min: -10, max: 200 }),
    total_floors: number('total_floors', { min: 1, max: 200 }),
    year_built: number('year_built', { min: 1800, max: 2100 }),
    features: [...new Set(features)],
    image_urls,
    contact_phone,
    whatsapp_enabled: Boolean(contact_phone),
  }

  if (errors.length === 0) {
    const key = duplicateKey(title, address, price)
    if (seen.has(key)) errors.push({ kind: 'duplicate' })
    seen.add(key)
  }
  return { line, title, columns: errors.length ? null : columns, errors }
}

/**
 * Reads a whole file. `existing` is the agent's listings, so importing the same
 * file twice (after a dropped connection, say) publishes nothing twice.
 */
export function buildImport(text, existing = []) {
  if (/^PK/.test(text ?? '')) return { problem: 'excel', rows: [] }
  const table = parseCsv(text)
  if (table.length < 2) return { problem: 'empty', rows: [] }
  const header = table[0].cells.map(headerKey)
  const index = Object.fromEntries(Object.entries(COLUMNS).map(([field, names]) => [field, header.findIndex((h) => names.includes(h))]))
  const missing = REQUIRED_COLUMNS.filter((field) => index[field] < 0)
  if (missing.length) return { problem: 'columns', missing, rows: [] }
  const body = table.slice(1)
  if (body.length > MAX_IMPORT_ROWS) return { problem: 'tooMany', rows: [] }

  const seen = new Set(existing.map((e) => duplicateKey(e.title, e.address, e.price)))
  const rows = body.map(({ line, cells }) => {
    if (cells.some((c) => c.includes('�'))) return { line, title: '', columns: null, errors: [{ kind: 'encoding' }] }
    const get = (field) => (index[field] >= 0 ? String(cells[index[field]] ?? '').trim() : '')
    return readRow(get, line, seen)
  })
  return { problem: null, rows }
}

/** Splits into groups for inserting. */
export function batches(items, size = 25) {
  const out = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}
