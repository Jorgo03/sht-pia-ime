// Pure logic for message/viewing push notifications (docs/LAUNCH_TASKS.md
// F14): no Deno, no network, no database. index.ts does the I/O;
// tests/pushDispatch.test.mjs runs this under Node.

/** Expo's push service accepts up to 100 messages per request. */
export const EXPO_BATCH = 100

/** Off unless switched on: push_settings.enabled, or the old env variable. */
export function dispatchEnabled(env, settingEnabled = false) {
  return settingEnabled === true || env.PUSH_DISPATCH_ENABLED === 'true'
}

// The kinds added with the notification centre.
const MORE = {
  sq: { inquiry: (n) => (n ? `Pyetje e re për pronën tënde nga ${n}` : 'Pyetje e re për pronën tënde'), hidden: 'Një listim yt u fsheh për rishikim', restored: 'Listimi yt është sërish publik', welcome: 'Mirë se erdhe në Shtëpia.ime' },
  en: { inquiry: (n) => (n ? `New inquiry about your property from ${n}` : 'New inquiry about your property'), hidden: 'One of your listings was hidden for review', restored: 'Your listing is public again', welcome: 'Welcome to Shtëpia.ime' },
  de: { inquiry: (n) => (n ? `Neue Anfrage zu deiner Immobilie von ${n}` : 'Neue Anfrage zu deiner Immobilie'), hidden: 'Ein Inserat wurde zur Prüfung ausgeblendet', restored: 'Dein Inserat ist wieder öffentlich', welcome: 'Willkommen bei Shtëpia.ime' },
  it: { inquiry: (n) => (n ? `Nuova richiesta per il tuo immobile da ${n}` : 'Nuova richiesta per il tuo immobile'), hidden: 'Un tuo annuncio è stato nascosto per revisione', restored: 'Il tuo annuncio è di nuovo pubblico', welcome: 'Benvenuto su Shtëpia.ime' },
  es: { inquiry: (n) => (n ? `Nueva consulta sobre tu propiedad de ${n}` : 'Nueva consulta sobre tu propiedad'), hidden: 'Uno de tus anuncios se ocultó para revisión', restored: 'Tu anuncio vuelve a ser público', welcome: 'Bienvenido a Shtëpia.ime' },
  fr: { inquiry: (n) => (n ? `Nouvelle demande pour votre bien de ${n}` : 'Nouvelle demande pour votre bien'), hidden: 'Une annonce a été masquée pour vérification', restored: 'Votre annonce est de nouveau publique', welcome: 'Bienvenue sur Shtëpia.ime' },
  pl: { inquiry: (n) => (n ? `Nowe zapytanie o Twoją nieruchomość od ${n}` : 'Nowe zapytanie o Twoją nieruchomość'), hidden: 'Twoje ogłoszenie ukryto do weryfikacji', restored: 'Twoje ogłoszenie jest znów publiczne', welcome: 'Witamy w Shtëpia.ime' },
  ru: { inquiry: (n) => (n ? `Новый запрос о вашем объекте от ${n}` : 'Новый запрос о вашем объекте'), hidden: 'Ваше объявление скрыто для проверки', restored: 'Ваше объявление снова опубликовано', welcome: 'Добро пожаловать в Shtëpia.ime' },
}

// A saved search with new matches. Never the search's name: lock screens are public.
const SEARCH = {
  sq: { one: "Një pronë e re përputhet me kërkimin tënd", many: (n) => `${n} prona të reja përputhen me kërkimin tënd` },
  en: { one: "A new home matches your saved search", many: (n) => `${n} new homes match your saved search` },
  de: { one: "Ein neues Angebot passt zu deiner Suche", many: (n) => `${n} neue Angebote passen zu deiner Suche` },
  it: { one: "Un nuovo immobile corrisponde alla tua ricerca", many: (n) => `${n} nuovi immobili corrispondono alla tua ricerca` },
  es: { one: "Una vivienda nueva coincide con tu búsqueda", many: (n) => `${n} viviendas nuevas coinciden con tu búsqueda` },
  fr: { one: "Un nouveau bien correspond à votre recherche", many: (n) => `${n} nouveaux biens correspondent à votre recherche` },
  pl: { one: "Nowa oferta pasuje do Twojego wyszukiwania", many: (n) => `Nowe oferty pasujące do wyszukiwania: ${n}` },
  ru: { one: "Новый объект подходит под ваш поиск", many: (n) => `Новых объектов по вашему поиску: ${n}` },
}

const STRINGS = {
  sq: { message: (n) => (n ? `Mesazh i ri nga ${n}` : 'Mesazh i ri'), requested: 'Kërkesë e re për vizitë', confirmed: 'Vizita juaj u konfirmua', declined: 'Vizita juaj u refuzua', cancelled: 'Një vizitë u anulua', updated: 'Një vizitë u përditësua' },
  en: { message: (n) => (n ? `New message from ${n}` : 'New message'), requested: 'New viewing request', confirmed: 'Your viewing was confirmed', declined: 'Your viewing was declined', cancelled: 'A viewing was cancelled', updated: 'A viewing was updated' },
  de: { message: (n) => (n ? `Neue Nachricht von ${n}` : 'Neue Nachricht'), requested: 'Neue Besichtigungsanfrage', confirmed: 'Deine Besichtigung wurde bestätigt', declined: 'Deine Besichtigung wurde abgelehnt', cancelled: 'Eine Besichtigung wurde abgesagt', updated: 'Eine Besichtigung wurde geändert' },
  it: { message: (n) => (n ? `Nuovo messaggio da ${n}` : 'Nuovo messaggio'), requested: 'Nuova richiesta di visita', confirmed: 'La tua visita è stata confermata', declined: 'La tua visita è stata rifiutata', cancelled: 'Una visita è stata annullata', updated: 'Una visita è stata aggiornata' },
  es: { message: (n) => (n ? `Nuevo mensaje de ${n}` : 'Nuevo mensaje'), requested: 'Nueva solicitud de visita', confirmed: 'Tu visita fue confirmada', declined: 'Tu visita fue rechazada', cancelled: 'Se canceló una visita', updated: 'Se actualizó una visita' },
  fr: { message: (n) => (n ? `Nouveau message de ${n}` : 'Nouveau message'), requested: 'Nouvelle demande de visite', confirmed: 'Votre visite est confirmée', declined: 'Votre visite a été refusée', cancelled: 'Une visite a été annulée', updated: 'Une visite a été modifiée' },
  pl: { message: (n) => (n ? `Nowa wiadomość od ${n}` : 'Nowa wiadomość'), requested: 'Nowa prośba o oglądanie', confirmed: 'Twoje oglądanie zostało potwierdzone', declined: 'Twoje oglądanie zostało odrzucone', cancelled: 'Oglądanie zostało odwołane', updated: 'Oglądanie zostało zmienione' },
  ru: { message: (n) => (n ? `Новое сообщение от ${n}` : 'Новое сообщение'), requested: 'Новая заявка на просмотр', confirmed: 'Ваш просмотр подтверждён', declined: 'Ваш просмотр отклонён', cancelled: 'Просмотр отменён', updated: 'Просмотр изменён' },
}

/** First name only: enough to recognise, little to expose on a lock screen. */
export function firstName(fullName) {
  return String(fullName ?? '').trim().split(/\s+/)[0]?.slice(0, 40) ?? ''
}

/**
 * Title, body and the in-app route for one queued push. Never includes a
 * message's text, an address or a price: lock screens are public.
 */
export function buildPush({ kind, data, lang, senderName }) {
  const s = STRINGS[lang] ?? STRINGS.en
  const m = MORE[lang] ?? MORE.en
  if (kind === 'inquiry') {
    return { title: 'Shtëpia.ime', body: m.inquiry(firstName(senderName)), url: `/messages/${data.conversation_id}` }
  }
  if (kind === 'listing_hidden' || kind === 'listing_restored') {
    return { title: 'Shtëpia.ime', body: kind === 'listing_hidden' ? m.hidden : m.restored, url: `/property/${data.property_id}` }
  }
  if (kind === 'saved_search') {
    const copy = SEARCH[lang] ?? SEARCH.en
    const count = Number(data?.count) || 1
    return {
      title: 'Shtëpia.ime',
      body: count > 1 ? copy.many(count) : copy.one,
      url: count === 1 && data?.property_id ? `/property/${data.property_id}` : '/saved-searches',
    }
  }
  if (kind === 'welcome') return { title: 'Shtëpia.ime', body: m.welcome, url: '/notifications' }
  // The people sending announcements wrote these words for everyone to read.
  if (kind === 'announcement') {
    return { title: String(data?.title ?? 'Shtëpia.ime').slice(0, 80), body: String(data?.body ?? '').slice(0, 178), url: '/notifications' }
  }
  if (kind === 'message') {
    return { title: 'Shtëpia.ime', body: s.message(firstName(senderName)), url: `/messages/${data.conversation_id}` }
  }
  if (kind === 'viewing_requested') {
    return { title: 'Shtëpia.ime', body: s.requested, url: '/viewings' }
  }
  const status = data?.status
  const body = status === 'confirmed' ? s.confirmed : status === 'declined' ? s.declined : status === 'cancelled' ? s.cancelled : s.updated
  return { title: 'Shtëpia.ime', body, url: '/viewings' }
}

/**
 * Whether the person still wants this kind of push, read again at send time:
 * a push queued before they switched that kind off must not go out. No saved
 * row means everything is on (same rule as queue_push in the database).
 */
export function stillWanted(kind, prefs) {
  if (!prefs) return true
  if (kind === 'message' || kind === 'inquiry') return prefs.messages !== false
  if (kind === 'viewing_requested' || kind === 'viewing_updated') return prefs.viewings !== false
  return true
}

/** Split into Expo-sized batches. */
export function chunk(items, size = EXPO_BATCH) {
  const out = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/**
 * Read Expo's per-message tickets (same order as the messages sent). Returns
 * the tokens Expo says no longer exist, so they can be forgotten, and whether
 * anything was accepted.
 */
export function readTickets(tickets, sentTokens) {
  const deadTokens = []
  let ok = 0
  ;(tickets ?? []).forEach((t, i) => {
    if (t?.status === 'ok') ok++
    else if (t?.details?.error === 'DeviceNotRegistered' && sentTokens[i]) deadTokens.push(sentTokens[i])
  })
  return { ok, deadTokens }
}

/** Only routes the app knows; anything else opens the home screen. */
export function safeRoute(url) {
  return typeof url === 'string' && /^\/(messages\/[0-9a-f-]{36}|property\/[0-9a-f-]{36}|viewings|notifications|saved-searches)$/.test(url) ? url : '/'
}
