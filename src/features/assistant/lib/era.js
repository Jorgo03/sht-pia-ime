// Era without a paid AI model (owner decision 2026-11-28, DECISIONS.md C2):
// she reads the question with plain rules (type, sale or rent, city, budget,
// rooms, area, amenities, order), counts the matching listings straight from
// the database and shows them, and answers questions about the app and the
// website from a fixed list of topics. Shared by the website (EraChat.jsx)
// and the phone apps (lib/assistant.ts). The search itself reuses the
// assistant's checked criteria and filters (supabase/functions/ai-assistant/
// logic.js), so it matches the same listings the apps' Search shows.

import { applyCriteria, canonicalCity, cardFor, mergeCriteria, normalizeCriteria } from '../../../../supabase/functions/ai-assistant/logic.js'

/** Listings shown under one answer; "më shumë" shows the next ones. */
export const PAGE_SIZE = 12

const COLUMNS =
  'id, title, title_i18n, price, currency, listing_type, property_type, city, zone, address, sqft, beds, baths, floor, total_floors, features, image_urls, ref_code, created_at, status, latitude, longitude'

/** Lower case, no accents, "Shtëpia.ime" taken out so it never reads as "house". */
export function fold(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/shtepia[ .]?ime/g, ' ')
    .replace(/[’'`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const tokensOf = (folded) => folded.split(/[^\p{L}\p{N}+]+/u).filter(Boolean)
const startsAny = (token, stems) => stems.some((s) => token.startsWith(s))

const PROPERTY_STEMS = [
  // Checked in this order: "garsoniere" is an apartment, "vilë" a villa.
  ['apartment', ['apartament', 'apartment', 'appartament', 'appartement', 'apartamento', 'garsonier', 'wohnung', 'mieszkan', 'квартир', 'daire', 'flat']],
  ['villa', ['vil', 'вилл']],
  ['house', ['shtepi', 'house', 'casa', 'haus', 'maison', 'дом']],
  ['land', ['toke', 'toka', 'truall', 'land', 'terreno', 'grundst', 'terrain', 'dzialk', 'участ', 'arsa']],
  ['office', ['zyr', 'office', 'ufficio', 'buro', 'bureau', 'oficina', 'biur', 'офис', 'ofis']],
  ['commercial', ['dyqan', 'biznes', 'lokal', 'ambient', 'commerc', 'shop', 'store', 'negozi', 'geschaft', 'sklep', 'магазин', 'dukkan']],
  ['garage', ['garazh', 'garage', 'garag', 'garaz', 'гараж']],
]
const EXACT_APARTMENT = new Set(['studio', 'piso'])

const DAILY = /\b(ditore|per dite|per nate|nate|daily|per night|nightly|giornalier|tageweise|pro nacht|a la nuit|por noche|na doby|посуточн)\b/
const RENT_STEMS = ['qira', 'qera', 'rent', 'affitt', 'miet', 'louer', 'alquil', 'arriend', 'wynaj', 'аренд', 'снять', 'kiral', 'ενοικ']
const SALE_STEMS = ['shitj', 'shitet', 'blej', 'bleje', 'blerj', 'sale', 'buy', 'vendita', 'compra', 'kauf', 'vente', 'achet', 'venta', 'sprzeda', 'kupi', 'продаж', 'купит', 'satil', 'πωλ', 'αγορ']

const FEATURE_STEMS = [
  ['balcony', ['ballkon', 'balcon', 'balkon', 'балкон']],
  ['parking', ['parkim', 'parking', 'parchegg', 'parkplatz', 'stellplatz', 'aparcam', 'парков', 'otopark']],
  ['elevator', ['ashensor', 'elevator', 'lift', 'ascensor', 'ascenseur', 'aufzug', 'fahrstuhl', 'winda', 'лифт', 'asansor']],
  ['garden', ['kopsht', 'garden', 'giardin', 'garten', 'jardin', 'ogrod', 'сад', 'bahce']],
  ['pool', ['pishin', 'pool', 'piscin', 'schwimm', 'basen', 'бассейн', 'havuz']],
  ['furnished', ['mobilu', 'mobilim', 'furnish', 'arredat', 'moebl', 'mobl', 'meubl', 'amuebl', 'umebl', 'мебл', 'esyal']],
  ['airConditioning', ['kondicion', 'klimatiz', 'aircon', 'climatiz', 'klima', 'кондиц']],
  ['heating', ['ngrohj', 'heating', 'riscald', 'heizung', 'chauffag', 'calefac', 'ogrzew', 'отоплен']],
]
const NEGATIONS = new Set(['pa', 'without', 'senza', 'ohne', 'sans', 'sin', 'bez', 'без', 'no'])

const SORTS = [
  ['price_asc', /\b(me te lir|me lir|me i lir|cheapest|cheaper|lowest price|piu economic|economic|billigst|moins cher|mas barat|najtan|дешев|ucuz)/],
  ['price_desc', /\b(me te shtrenjt|me shtrenjt|most expensive|highest price|piu car|teuerst|plus cher|mas car|najdroz|дорог)/],
  ['area_desc', /\b(me te medh|me e madh|me i madh|biggest|largest|piu grand|grosst|plus grand|mas grand|najwieksz|больш)/],
  ['newest', /\b(me te rej|me te fundit|newest|latest|recent|piu recent|ultim|neuest|plus recent|mas nuev|najnowsz|нов)/],
]

/** A refinement of the last search ("po me ashensor?") rather than a new one. */
const FOLLOW_UP = /^(po|edhe|dhe|and|also|but|what about|ma|und|aber|et|mais|pero)\b/
const MORE = /^(me shume|te tjera|te tjerat|tregom me shume|more|show more|next|altri|altre|mehr|weitere|plus|mas|wiecej|еще|ещё|daha)\b/

// Short city names that are also everyday words: only after "në", "in", "a"…
const AMBIGUOUS_CITY = new Set(['has', 'mat', 'lac', 'vora', 'vore'])
const BEFORE_PLACE = new Set(['ne', 'in', 'a', 'nach', 'en', 'w', 'в', 'para', 'te', 'tek', 'per'])
const SUFFIXES = ['it', 'in', 'es', 'se', 's', 'i', 'a', 'e', 'u']

function findCity(tokens) {
  for (let n = 3; n >= 1; n--) {
    for (let i = 0; i + n <= tokens.length; i++) {
      const words = tokens.slice(i, i + n)
      const tries = [words.join(' ')]
      const last = words[n - 1]
      for (const s of SUFFIXES) {
        if (last.length - s.length >= 3 && last.endsWith(s)) tries.push([...words.slice(0, -1), last.slice(0, -s.length)].join(' '))
      }
      for (const key of tries) {
        const city = canonicalCity(key)
        if (!city) continue
        if (n === 1 && AMBIGUOUS_CITY.has(key) && !BEFORE_PLACE.has(tokens[i - 1])) continue
        return city
      }
    }
  }
  return null
}

const NUMBER = String.raw`(\d{1,3}(?:[.,\s]\d{3})+|\d+(?:[.,]\d+)?)`
const toNumber = (raw) => {
  const s = raw.replace(/\s/g, '')
  // "120.000" / "120,000" are thousands; "1.5" / "1,5" a decimal.
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ''))
  return Number(s.replace(',', '.'))
}

const MAX_WORDS = /(deri|nen|max|maks|maksimum|jo me shume|under|below|up to|less than|at most|budget|buxhet|fino a|sotto|massimo|bis|unter|hochstens|jusqu|moins de|maximum|hasta|menos de|do|ponizej|до|меньше|kadar|en fazla)\s*(ne|a|zu|en|me|$)?\s*$/
const MIN_WORDS = /(mbi|min|minimum|me shume se|over|above|more than|at least|from|nga|sopra|almeno|piu di|ab|uber|mindestens|plus de|au moins|desde|mas de|od|powyzej|от|больше|en az)\s*$/

/**
 * Prices, rooms and area in the question. Area and rooms are read first and
 * taken out, so "100 m2" is never a budget and "2+1" never a price.
 */
function readNumbers(folded) {
  const out = {}
  let text = ` ${folded} `

  const plusOne = text.match(/\b(\d)\s*\+\s*1\b/)
  if (plusOne) {
    out.beds = Number(plusOne[1])
    text = text.replace(plusOne[0], ' ')
  } else if (/\b(garsonier|studio|monolocal)/.test(text)) {
    out.beds = 0
  }
  const rooms = text.match(/\b(\d{1,2})\s*(dhoma|dhome|dhom|bedroom|bed|room|camer|stanz|zimmer|schlafz|chambre|pieces|habitacion|dormitor|pokoj|комнат|спальн|oda)/)
  if (rooms) {
    if (out.beds == null) out.min_beds = Number(rooms[1])
    text = text.replace(rooms[0], ' ')
  }

  const area = text.match(new RegExp(String.raw`${NUMBER}\s*(m2|m²|mq|sqm|sq m|metra katror|metra|meter|metri|metres|meters|кв|м2|m\b)`))
  if (area) {
    const before = text.slice(0, area.index)
    const n = toNumber(area[1])
    if (MAX_WORDS.test(before)) out.max_area = n
    else out.min_area = n
    text = text.replace(area[0], ' ')
  }

  const price = new RegExp(String.raw`${NUMBER}\s*(k\b|mije|mij\b|mila|tausend|mille|mil\b|tys|тыс|bin|milion|million|mln|mio)?\s*(€|eur|euro|euros|lek|leke|leku|all\b|\$|usd|dollar|dollari)?`, 'g')
  for (const m of text.matchAll(price)) {
    let n = toNumber(m[1])
    const scale = m[2] ?? ''
    if (/^(k|mije|mij|mila|tausend|mille|mil|tys|тыс|bin)$/.test(scale)) n *= 1000
    else if (/^(milion|million|mln|mio)$/.test(scale)) n *= 1000000
    const unit = m[3] ?? ''
    // A bare small number ("3", "2026") is not a price.
    if (!scale && !unit && (n < 1000 || (Number.isInteger(n) && n >= 1900 && n <= 2100))) continue
    if (/^(lek|leke|leku|all)$/.test(unit)) out.currency = 'ALL'
    else if (/^(\$|usd|dollar|dollari)$/.test(unit)) out.currency = 'USD'
    const before = text.slice(Math.max(0, m.index - 24), m.index)
    if (MIN_WORDS.test(before)) out.min_price = n
    else out.max_price = n
  }
  return out
}

/**
 * The question -> what Era should do: `search` (with criteria), `more`,
 * `similar`, or a help `topic`. Pure, so tests/era.test.mjs checks it.
 */
export function readQuestion(question) {
  const folded = fold(question)
  const tokens = tokensOf(folded)
  const raw = {}

  for (const [type, stems] of PROPERTY_STEMS) {
    if (tokens.some((tk) => startsAny(tk, stems))) { raw.property_type = type; break }
  }
  if (!raw.property_type && tokens.some((tk) => EXACT_APARTMENT.has(tk))) raw.property_type = 'apartment'
  if (DAILY.test(folded)) raw.listing_type = 'daily_rent'
  else if (tokens.some((tk) => startsAny(tk, RENT_STEMS))) raw.listing_type = 'rent'
  else if (tokens.some((tk) => tk === 'shes' || startsAny(tk, SALE_STEMS))) raw.listing_type = 'sale'
  const city = findCity(tokens)
  if (city) raw.city = city

  Object.assign(raw, readNumbers(folded))

  const required = []
  for (const [feature, stems] of FEATURE_STEMS) {
    const at = tokens.findIndex((tk) => startsAny(tk, stems))
    // "Garazh" is a parking feature only when the person wants a home with it.
    if (at >= 0 && !NEGATIONS.has(tokens[at - 1])) required.push(feature)
  }
  if (raw.property_type && raw.property_type !== 'garage' && tokens.some((tk) => tk.startsWith('garazh') || tk.startsWith('garage'))) required.push('parking')
  if (required.length) raw.required_features = [...new Set(required)]
  for (const [sort, re] of SORTS) if (re.test(folded)) { raw.sort = sort; break }

  const criteria = normalizeCriteria(raw)
  const hasSearch = Object.keys(criteria).length > 0
  const wantsHomes = /\b(prona|prone|pronat|shtepi|home|homes|listing|properties|property|immobil|annunc|wohnung|logement|inmueble|nieruchom|недвиж|emlak)\b/.test(folded)

  if (MORE.test(folded) && !hasSearch) return { kind: 'more' }
  if (/\b(ngjashm|similar|simil|ahnlich|semblabl|podobn|похож|benzer)/.test(folded)) return { kind: 'similar', criteria }
  if (SELL_MINE.test(folded)) return { kind: 'topic', topic: 'publish' }
  const topic = topicOf(folded)
  if (topic && !(criteria.property_type || criteria.city || criteria.listing_type)) return { kind: 'topic', topic }
  if (hasSearch || wantsHomes || /\b(gjej|kerko|me gjej|find|search|show|cerca|trova|such|zeig|cherche|busca|szuk|найд|bul)/.test(folded)) {
    return { kind: 'search', criteria, refine: FOLLOW_UP.test(folded) || !(criteria.property_type || criteria.city || criteria.listing_type) }
  }
  return { kind: 'topic', topic: 'help' }
}

/** Someone selling or letting their own home wants to publish it, not to search. */
const SELL_MINE = /\b(dua te shes|si te shes|te shes|dua te jap me qira|i want to sell|how (do i|to|can i) sell|rent out my|voglio vendere|ich mochte verkaufen|je veux vendre|quiero vender)\b/

const TOPICS = [
  ['greeting', /^(pershendetje|tung|tungjatjeta|mirdita|miredita|mirembrema|mirmengjes|hello|hi|hey|ciao|salve|hallo|bonjour|salut|hola|czesc|привет|merhaba|γεια)\b/],
  ['thanks', /\b(faleminderit|flm|rrofsh|thanks|thank you|thx|grazie|danke|merci|gracias|dziekuj|спасибо|tesekkur|ευχαριστ)/],
  ['publish', /\b(publik|posto|postoj|shpall|shto (nje )?prone|listo|publish|post (a|my)|list (a|my)|add (a|my) (home|property|listing)|pubblic|inserir|veroffentlich|inserat|annonce|publicar|anunci|opublik|размест|ilan)/],
  ['pricing', /\b(falas|pagese|paguaj|kosto|sa kushton|free|cost|price of|pay|plan|gratis|kostenlos|gratuit|darmow|бесплатн|ucret)/],
  ['favorites', /\b(preferuar|favorit|zemer|favourite|preferit|merkliste|ulubion|избранн)/],
  ['saved', /\b(kerkim(et)? (e |te )?ruajtur|ruaj kerkim|njoftim|saved search|alert|avvis|suchauftrag|alerte|alerta|powiadom|уведомл|bildirim)/],
  ['viewings', /\b(vizit|shikim|takim|viewing|visit|appuntament|besichtig|visite|visita|ogladan|просмотр|randevu)/],
  ['agent', /\b(agjent|agent|kontakt|whatsapp|telefon|thirr|call|contatt|contact|звон)/],
  ['messages', /\b(mesazh|message|messaggi|nachricht|wiadomo|сообщен|mesaj)/],
  ['account', /\b(llogari|profil|fjalekalim|fshij|account|password|delete|konto|compte|cuenta|аккаунт|hesap)/],
  ['privacy', /\b(privatesi|te dhenat|gdpr|privacy|datenschutz|confidentialit|privacidad|prywatn|конфиденц|gizlilik)/],
  ['compare', /\b(krahas|compar|vergleich|porown|сравн|karsilastir)/],
  ['budget', /\b(buxhet|budget|presupuesto|бюджет|butce)/],
  ['howItWorks', /\b(si funksionon|cfare eshte|cfare ben|kush je|how (does|do)|what is|what can you|who are you|come funziona|wie funktioniert|comment ca marche|como funciona|jak dziala|как работает|nasil)/],
]
function topicOf(folded) {
  for (const [topic, re] of TOPICS) if (re.test(folded)) return topic
  return null
}

/** Where each help topic sends the person (lib/assistant.ts ScreenKey -> app route). */
const TOPIC_SCREENS = {
  publish: ['create_listing', 'my_listings'],
  favorites: ['favorites'],
  saved: ['saved_searches'],
  viewings: ['viewings'],
  messages: ['messages'],
  agent: ['explore', 'messages'],
  account: ['profile'],
  privacy: ['privacy', 'terms'],
  compare: ['explore', 'favorites'],
  help: ['explore'],
  howItWorks: ['explore', 'create_listing'],
}
const ROUTES = {
  explore: '/explore', favorites: '/favorites', saved_searches: '/saved-searches', messages: '/messages', viewings: '/viewings',
  create_listing: '/listing/create', my_listings: '/my-listings', profile: '/profile', privacy: '/privacy', terms: '/terms',
}
const screensFor = (keys) => keys.map((key) => ({ key, route: ROUTES[key] }))

/** "10 apartamente në shitje në Durrës". */
function describe(criteria, count, t) {
  const what = t(`era.local.noun.${criteria.property_type ?? 'property'}`, { count })
  const details = [
    criteria.listing_type ? t(`era.local.for.${criteria.listing_type}`) : '',
    criteria.city ? t('era.local.inCity', { city: criteria.city }) : '',
  ].filter(Boolean)
  return [what, ...details].join(' ')
}

async function search(db, criteria, offset) {
  let q = db.from('properties').select(COLUMNS, { count: 'exact' })
  q = applyCriteria(q, criteria, null)
  if (criteria.sort === 'price_asc' || criteria.sort === 'price_desc') q = q.order('price', { ascending: criteria.sort === 'price_asc' })
  else if (criteria.sort === 'area_desc') q = q.order('sqft', { ascending: false, nullsFirst: false })
  else q = q.order('created_at', { ascending: false })
  const { data, count, error } = await q.order('id', { ascending: true }).range(offset, offset + PAGE_SIZE - 1)
  if (error) throw error
  return { rows: data ?? [], count: count ?? (data ?? []).length }
}

const answer = (reply, { cards = [], screens = [], state = null } = {}) => ({ reply, cards, comparison: null, screens, state })

/**
 * One question -> Era's answer, in the shape both chats already show:
 * { reply, cards, comparison, screens, state }. `db` is the app's Supabase
 * client (RLS decides what is visible), `t` the i18next function. The state
 * remembers the last search so "po me ashensor?" and "më shumë" follow on.
 */
export async function askEra({ db, question, state, t, propertyId = null }) {
  const read = readQuestion(question)
  const last = state && typeof state === 'object' && state.criteria && typeof state.criteria === 'object' ? normalizeCriteria(state.criteria) : null
  const lastOffset = Number.isInteger(state?.offset) ? state.offset : 0
  const lastCount = Number.isInteger(state?.count) ? state.count : 0

  if (read.kind === 'topic') {
    return answer(t(`era.local.topic.${read.topic}`), { screens: screensFor(TOPIC_SCREENS[read.topic] ?? []), state })
  }

  let criteria
  let offset = 0
  if (read.kind === 'more') {
    if (!last) return answer(t('era.local.topic.help'), { screens: screensFor(['explore']), state })
    offset = lastOffset + PAGE_SIZE
    if (offset >= lastCount) return answer(t('era.local.noMore'), { state })
    criteria = last
  } else if (read.kind === 'similar') {
    const id = propertyId ?? state?.propertyId ?? null
    if (!id) return answer(t('era.local.topic.help'), { screens: screensFor(['explore']), state })
    const { data } = await db.from('properties').select('id, property_type, listing_type, city').eq('id', id).maybeSingle()
    if (!data) return answer(t('era.local.topic.help'), { screens: screensFor(['explore']), state })
    criteria = normalizeCriteria({ property_type: data.property_type, listing_type: data.listing_type, city: data.city, exclude_property_id: data.id, ...read.criteria })
  } else {
    criteria = read.refine && last ? mergeCriteria(last, read.criteria) : read.criteria
  }

  const { rows, count } = await search(db, criteria, offset)
  const nextState = { criteria, offset, count, propertyId: propertyId ?? state?.propertyId ?? null }
  const counting = t('era.local.counting')
  if (count === 0) {
    return answer(`${counting} ${t('era.local.none', { what: describe(criteria, 0, t) })}`, { screens: screensFor(['explore', 'saved_searches']), state: nextState })
  }
  const parts = [counting, t('era.local.result', { total: count, what: describe(criteria, count, t) })]
  if (offset > 0) parts.push(t('era.local.page', { from: offset + 1, to: offset + rows.length, total: count }))
  else if (count > rows.length) parts.push(t('era.local.firstOnes', { shown: rows.length }))
  return answer(parts.join(' '), { cards: rows.map(cardFor), screens: screensFor(['explore']), state: nextState })
}
