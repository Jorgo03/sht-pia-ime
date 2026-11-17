import { supabase } from '@/lib/supabase';

import { LangCode } from './translate';

/**
 * Client wrapper around the ai-listing-assistant Edge Function.
 *
 * The Anthropic key lives only in that function's server-side env — nothing
 * here touches it, and nothing AI-related is bundled into the app.
 *
 * Mirrors src/lib/ai.js so the web and native clients behave identically
 * against the same deployed function.
 */

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Client wrapper around the ai-listing-assistant Edge Function — the
 * per-listing buyer chat (Feature C). Mirrors src/lib/ai.js's function of the
 * same name exactly: `null` on any failure (rate limit, unavailable, network)
 * rather than a typed error, since the caller only ever needs to render one
 * generic "can't answer right now" bubble either way. `contact` is true when
 * the listing does not hold the answer: the chat then shows the seller's
 * contact. `reply` is null when the server sent only that signal.
 */
export interface ListingAssistantReply {
  reply: string | null;
  contact: boolean;
}

export async function askListingAssistant(
  propertyId: string,
  messages: AssistantMessage[],
  language: LangCode = 'sq',
): Promise<ListingAssistantReply | null> {
  try {
    const { data, error } = await supabase.functions.invoke('ai-listing-assistant', {
      body: { property_id: propertyId, messages, language },
    });
    if (error || !data) return null;
    const contact = data.contact === true;
    const reply = typeof data.reply === 'string' && data.reply.trim() ? data.reply : null;
    if (!reply && !contact) return null;
    return { reply, contact };
  } catch {
    return null;
  }
}
