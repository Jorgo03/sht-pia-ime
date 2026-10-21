// Notification preferences (docs/LAUNCH_TASKS.md F14). One row per user in
// notification_preferences; no row means everything is on. Shared so the
// phone app (and a future web settings page) read and write it the same way.

export const DEFAULT_PREFERENCES = Object.freeze({ messages: true, viewings: true })

/** The person's preferences, or the defaults when none are saved or on error. */
export async function loadPreferences(client, userId) {
  try {
    const { data, error } = await client
      .from('notification_preferences')
      .select('messages, viewings')
      .eq('user_id', userId)
      .maybeSingle()
    if (error || !data) return { ...DEFAULT_PREFERENCES }
    return { messages: data.messages !== false, viewings: data.viewings !== false }
  } catch {
    return { ...DEFAULT_PREFERENCES }
  }
}

/** Save both switches; user_id comes from the session (column default). */
export async function savePreferences(client, prefs) {
  try {
    const { error } = await client
      .from('notification_preferences')
      .upsert({ messages: Boolean(prefs.messages), viewings: Boolean(prefs.viewings) }, { onConflict: 'user_id' })
    return !error
  } catch {
    return false
  }
}
