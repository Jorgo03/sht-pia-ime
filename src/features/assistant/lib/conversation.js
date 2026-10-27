// The app side of the Shtëpia.ime assistant (docs/AI_ASSISTANT.md): what is
// sent with each question, and what is kept on the device. Pure, so it runs
// under `node --test` and is shared by every screen that talks to it.

/** Turns sent with a question (the server keeps 12; this keeps requests small). */
export const HISTORY_TURNS = 12

/** Messages kept on the device per conversation. */
export const STORE_LIMIT = 40

/** A conversation left alone this long is not restored. */
export const MAX_AGE_MS = 30 * 24 * 3600 * 1000

/** Longest question accepted (the server cuts anything longer). */
export const MAX_QUESTION_CHARS = 1000

/** One conversation per account on each device; signed-out visitors share "guest". */
export const storageKey = (userId) => `fho_assistant_v1:${userId || 'guest'}`

/**
 * The text turns to send for `question`: failed answers are left out together
 * with the question they failed on, cards and tables never travel back, and
 * the list always starts with a question.
 */
export function historyFor(messages, question) {
  const turns = []
  for (const m of messages ?? []) {
    if (m?.failed) {
      if (turns.length && turns[turns.length - 1].role === 'user') turns.pop()
      continue
    }
    if ((m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.trim()) {
      turns.push({ role: m.role, content: m.content.slice(0, MAX_QUESTION_CHARS) })
    }
  }
  turns.push({ role: 'user', content: String(question).slice(0, MAX_QUESTION_CHARS) })
  const recent = turns.slice(-HISTORY_TURNS)
  while (recent.length && recent[0].role !== 'user') recent.shift()
  return recent
}

/** What is written to storage: the last messages, the server's state, the time. */
export function toStored(messages, state, now = Date.now()) {
  return { v: 1, savedAt: now, messages: (messages ?? []).filter((m) => !m?.pending).slice(-STORE_LIMIT), state: state ?? null }
}

/** A stored conversation, or null when it is missing, malformed or too old. */
export function fromStored(raw, now = Date.now()) {
  let data = raw
  if (typeof raw === 'string') {
    try { data = JSON.parse(raw) } catch { return null }
  }
  if (!data || data.v !== 1 || !Array.isArray(data.messages)) return null
  if (!Number.isFinite(data.savedAt) || now - data.savedAt > MAX_AGE_MS) return null
  return { messages: data.messages.slice(-STORE_LIMIT), state: data.state ?? null }
}
