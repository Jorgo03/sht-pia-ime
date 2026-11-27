// The per-listing assistant without a paid AI model (owner, 2026-11-28,
// DECISIONS.md C2): it answers from this one listing's own fields (price,
// area, rooms, bathrooms, floor, year, location, sale or rent, amenities,
// status) and from sentences of its description that mention what was
// asked. Anything the listing does not say hands the person to the seller
// (`contact: true`), as the AI version did. No network: the listing page
// already has the listing. Shared by website/src/components/ListingAssistant.jsx
// and components/property/listing-assistant.tsx.

import { FEATURE_STEMS, fold } from '../../assistant/lib/era.js'
import { formatPrice, priceSuffixKey } from '../../../lib/format.js'

const words = (folded) => folded.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
// Stems of up to three letters ("ku", "kat", "wo") must be the whole word.
const has = (tokens, stems) => tokens.some((tk) => stems.some((s) => (s.length <= 3 ? tk === s : tk.startsWith(s))))

// Each topic: the word starts that ask about it, in the 10 languages.
const TOPICS = {
  price: ['cmim', 'kushton', 'kushto', 'sa ben', 'price', 'cost', 'expens', 'cheap', 'prezz', 'cost', 'preis', 'kost', 'prix', 'precio', 'cuesta', 'cena', 'ceny', 'kosztuj', 'цен', 'стои', 'fiyat', 'τιμ', 'κοστ'],
  area: ['siperfaq', 'metra', 'm2', 'katror', 'madh', 'area', 'size', 'big', 'large', 'sqm', 'superfic', 'grande', 'metri', 'flache', 'grosse', 'surface', 'superficie', 'powierzchn', 'duz', 'площад', 'метр', 'metrekare', 'buyuk', 'εμβαδ', 'τετραγων'],
  beds: ['dhom', 'gjum', 'bedroom', 'room', 'camer', 'stanz', 'local', 'zimmer', 'schlaf', 'chambre', 'piece', 'habitac', 'dormitor', 'pokoj', 'sypial', 'комнат', 'спальн', 'oda', 'δωματ', 'υπνοδωμ'],
  baths: ['banj', 'tualet', 'wc', 'bath', 'toilet', 'bagn', 'bad', 'salle', 'bano', 'lazien', 'ванн', 'санузел', 'banyo', 'μπαν'],
  floor: ['kat', 'kati', 'katin', 'katit', 'floor', 'piano', 'etage', 'stock', 'planta', 'pietr', 'этаж', 'kat', 'οροφ'],
  year: ['vit', 'viti', 'vitin', 'vitit', 'ndert', 'vjet', 'year', 'built', 'old', 'new', 'anno', 'costru', 'baujahr', 'gebaut', 'alt', 'annee', 'construi', 'ano', 'constru', 'rok', 'zbudow', 'год', 'постро', 'yil', 'insa', 'ετος', 'χτισ', 'κατασκευ'],
  location: ['ku', 'vendndodh', 'adres', 'zon', 'lagj', 'rrug', 'where', 'location', 'address', 'neighbo', 'area of', 'dove', 'zona', 'indirizz', 'quartier', 'wo', 'lage', 'adresse', 'ou', 'donde', 'ubicac', 'direcc', 'barrio', 'gdzie', 'lokaliz', 'dzielnic', 'где', 'адрес', 'район', 'nerede', 'adres', 'semt', 'που', 'διευθυν', 'περιοχ'],
  deal: ['shitj', 'shitet', 'qira', 'qera', 'sale', 'rent', 'buy', 'vendit', 'affitt', 'kauf', 'miet', 'vente', 'vendre', 'louer', 'venta', 'alquil', 'sprzeda', 'wynaj', 'продаж', 'аренд', 'satil', 'kiral', 'πωλ', 'ενοικ'],
  status: ['disponue', 'ende', 'shitur', 'available', 'still', 'sold', 'disponib', 'ancora', 'venduto', 'verfugbar', 'noch', 'verkauft', 'encore', 'vendu', 'todavia', 'vendid', 'dostepn', 'sprzedan', 'доступ', 'продан', 'musait', 'satildi', 'διαθεσ', 'πουλη'],
}
const GREETING = /^(pershendetje|tung|mirdita|miredita|hello|hi|hey|ciao|salve|hallo|bonjour|salut|hola|czesc|привет|merhaba|γεια)\b/
// Never looked up in the description: question words, fillers, the listing itself.
const STOP = new Set(['kjo', 'kete', 'keto', 'eshte', 'jane', 'ka', 'kane', 'per', 'nga', 'apo', 'cfare', 'sa', 'si', 'cili', 'cila', 'pse', 'kur', 'mund', 'dua', 'prona', 'prone', 'shtepia', 'shtepi', 'apartamenti', 'apartament', 'this', 'that', 'there', 'does', 'have', 'with', 'what', 'which', 'when', 'where', 'there', 'about', 'property', 'apartment', 'house', 'home', 'listing', 'questo', 'questa', 'casa', 'diese', 'dieses', 'haben', 'gibt', 'cette', 'est', 'quel', 'quelle', 'esta', 'tiene', 'para', 'czy', 'jest', 'есть', 'это', 'var', 'mi', 'είναι', 'έχει'])

/** Sentences of the description that mention a word of the question. */
function fromDescription(tokens, description) {
  const text = String(description ?? '')
  if (!text.trim()) return []
  const wanted = tokens.filter((tk) => tk.length >= 4 && !STOP.has(tk)).map((tk) => tk.slice(0, Math.max(4, tk.length - 2)))
  if (!wanted.length) return []
  const sentences = text.split(/(?<=[.!?\n])\s+/).map((s) => s.trim()).filter(Boolean)
  return sentences.filter((s) => {
    const w = words(fold(s))
    return wanted.some((stem) => w.some((x) => x.startsWith(stem)))
  }).slice(0, 2)
}

/**
 * A question about this listing -> `{ reply, contact }`. `reply` answers what
 * the listing's data covers; `contact` is true when it does not cover all of
 * it, so the screen shows the seller's card under the reply. `t` is i18next.
 */
export function answerAboutListing(question, property, t, lang = 'sq') {
  const folded = fold(question)
  const tokens = words(folded)
  const p = property ?? {}
  const parts = []
  let missing = false
  const asked = (topic) => has(tokens, TOPICS[topic]) || TOPICS[topic].some((s) => s.includes(' ') && folded.includes(s))

  if (asked('price') && p.price != null) {
    const suffix = priceSuffixKey(p.listing_type)
    parts.push(t('assistant.local.price', { price: `${formatPrice(p.price, lang, p.currency)}${suffix ? ` ${t(suffix)}` : ''}` }))
    const area = Number(p.sqft)
    if (p.listing_type === 'sale' && area > 0) parts.push(t('assistant.local.pricePerM2', { price: formatPrice(Math.round(Number(p.price) / area), lang, p.currency) }))
  }
  if (asked('area')) {
    if (p.sqft) parts.push(t('assistant.local.area', { area: p.sqft }))
    else missing = true
  }
  if (asked('beds')) {
    if (p.beds != null) parts.push(t('assistant.local.beds', { count: p.beds }))
    else missing = true
  }
  if (asked('baths')) {
    if (p.baths != null) parts.push(t('assistant.local.baths', { count: p.baths }))
    else missing = true
  }
  if (asked('floor')) {
    if (p.floor != null) parts.push(p.total_floors ? t('assistant.local.floorOf', { floor: p.floor, total: p.total_floors }) : t('assistant.local.floor', { floor: p.floor }))
    else missing = true
  }
  if (asked('year')) {
    if (p.year_built) parts.push(t('assistant.local.year', { year: p.year_built }))
    else missing = true
  }
  if (asked('location')) {
    const where = [p.address, p.zone, p.city].filter((x) => typeof x === 'string' && x.trim()).join(', ')
    if (where) parts.push(t('assistant.local.location', { where }))
    else missing = true
  }
  if (asked('deal') && p.listing_type) {
    parts.push(t('assistant.local.deal', { what: t(`era.local.noun.${p.property_type ?? 'property'}`, { count: 1 }), deal: t(`era.local.for.${p.listing_type}`) }))
  }
  if (asked('status') && p.status) {
    parts.push(t(['active', 'sold', 'rented'].includes(p.status) ? `assistant.local.status.${p.status}` : 'assistant.local.status.other'))
  }

  // Amenities: "a ka ballkon?", "parking?"; "garazh" counts as parking here.
  const features = Array.isArray(p.features) ? p.features : []
  for (const [feature, stems] of FEATURE_STEMS) {
    const mentioned = has(tokens, feature === 'parking' ? [...stems, 'garazh', 'garage'] : stems)
    if (!mentioned) continue
    const name = t(`listing.feature.${feature}`)
    if (features.includes(feature)) parts.push(t('assistant.local.featureYes', { feature: name }))
    else {
      parts.push(t('assistant.local.featureUnknown', { feature: name }))
      missing = true
    }
  }

  // A field it was asked about is empty: say so and offer the seller, rather
  // than quote a description sentence that happens to share a word.
  if (!parts.length && missing) return { reply: t('assistant.notInListing'), contact: true }
  if (!parts.length) {
    if (GREETING.test(folded)) return { reply: t('assistant.intro'), contact: false }
    const said = fromDescription(tokens, p.description)
    if (said.length) return { reply: t('assistant.local.fromDescription', { text: said.join(' ') }), contact: false }
    return { reply: t('assistant.notInListing'), contact: true }
  }
  return { reply: parts.join(' '), contact: missing }
}
