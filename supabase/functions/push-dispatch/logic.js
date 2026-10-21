// Pure logic for message/viewing push notifications (docs/LAUNCH_TASKS.md
// F14): no Deno, no network, no database. index.ts does the I/O;
// tests/pushDispatch.test.mjs runs this under Node.

/** Expo's push service accepts up to 100 messages per request. */
export const EXPO_BATCH = 100

/** Off unless the owner has switched it on. */
export function dispatchEnabled(env) {
  return env.PUSH_DISPATCH_ENABLED === 'true'
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
  return typeof url === 'string' && /^\/(messages\/[0-9a-f-]{36}|viewings)$/.test(url) ? url : '/'
}
