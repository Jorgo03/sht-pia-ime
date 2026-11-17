// Loading a conversation's messages, shared by both apps (thread.d.ts for the
// phone app).

/**
 * How many of the newest messages a thread opens with. The history used to
 * load whole, unbounded, which a long-running lead conversation would turn
 * into a slow first paint on a phone.
 */
export const MESSAGE_HISTORY_LIMIT = 200

/**
 * The newest MESSAGE_HISTORY_LIMIT messages, oldest first, or { error }.
 * A failure is reported instead of returning [], which used to make a load
 * that failed look exactly like a conversation with nothing in it.
 */
export async function loadThreadMessages(client, conversationId) {
  try {
    const { data, error } = await client
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(MESSAGE_HISTORY_LIMIT)
    if (error) return { messages: null, error }
    return { messages: [...(data ?? [])].reverse(), error: null }
  } catch (error) {
    return { messages: null, error }
  }
}

/** True when PostgREST answered "no such row" (or none visible to you). */
export const isNotFound = (error) => error?.code === 'PGRST116'
