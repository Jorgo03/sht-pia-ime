// The conversation the listing assistant is sent, for both apps
// (supabase/functions/ai-listing-assistant).
//
// The function keeps the last 10 messages, and the Messages API needs the
// first one to be the person's. Both apps sent the whole chat, so from the
// 6th question on (11 messages, cut at an odd index) the history began with
// an assistant reply and every later question failed as "unavailable".
// A failed reply is not an answer, so it is left out together with the
// question it failed to answer; otherwise "unavailable" became context.

/** Odd, so an alternating history that ends with a question starts with one. */
export const ASSISTANT_HISTORY_LIMIT = 9

/** The messages to send for `question`, given the chat so far. */
export function assistantHistory(messages, question) {
  const turns = []
  for (const m of messages ?? []) {
    if (m?.failed) {
      if (turns.length && turns[turns.length - 1].role === 'user') turns.pop()
      continue
    }
    if ((m?.role === 'user' || m?.role === 'assistant') && m.content) {
      turns.push({ role: m.role, content: String(m.content) })
    }
  }
  turns.push({ role: 'user', content: question })
  const recent = turns.slice(-ASSISTANT_HISTORY_LIMIT)
  while (recent.length && recent[0].role !== 'user') recent.shift()
  return recent
}
