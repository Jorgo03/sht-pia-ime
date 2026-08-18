import { supabase } from '@/lib/supabase';

import { LangCode } from './translate';

/**
 * Client wrapper around the ai-generate-listing Edge Function.
 *
 * The Anthropic key lives only in that function's server-side env — nothing
 * here touches it, and nothing AI-related is bundled into the app. The
 * function also enforces auth (signed-in users only) and a 20/hour/user rate
 * limit, so this file deliberately adds no gating of its own.
 *
 * Mirrors src/lib/ai.js so the web and native clients behave identically
 * against the same deployed function.
 */

export type AiErrorCode = 'ai_unavailable' | 'rate_limited' | 'error';

/** Thrown (not returned) so callers must handle failure explicitly. */
export interface AiError {
  code: AiErrorCode;
}

export interface GeneratedListing {
  title: string;
  description: string;
}

/** Whatever the form has so far — every field is optional context. */
export interface ListingDetails {
  listing_type?: string;
  property_type?: string;
  city?: string | null;
  address?: string;
  price?: string | number;
  sqft?: string | number;
  beds?: string | number;
  baths?: string | number;
  notes?: string;
}

/**
 * Model output is untrusted input: clamp lengths and reject anything missing
 * the fields we actually use. Mirrors sanitizeGeneratedListing in
 * src/lib/aiSchemas.js.
 */
function sanitize(raw: unknown): GeneratedListing | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  const title =
    typeof obj.title === 'string' ? obj.title.trim().slice(0, 120) : '';
  let description =
    typeof obj.description === 'string'
      ? obj.description.trim().slice(0, 4000)
      : '';
  if (!title || !description) return null;

  const highlights = (Array.isArray(obj.highlights) ? obj.highlights : [])
    .filter((h): h is string => typeof h === 'string' && h.trim().length > 0)
    .slice(0, 5)
    .map((h) => `• ${h.trim().slice(0, 120)}`);
  if (highlights.length > 0) {
    description = `${description}\n\n${highlights.join('\n')}`;
  }

  return { title, description };
}

export async function generateListing(
  details: ListingDetails,
  language: LangCode = 'sq',
): Promise<GeneratedListing> {
  let res;
  try {
    res = await supabase.functions.invoke('ai-generate-listing', {
      body: { details, language },
    });
  } catch {
    throw { code: 'error' } as AiError;
  }

  if (res.error) {
    // 429 is the rate limiter; anything else (including a 503 when
    // ANTHROPIC_API_KEY is unset) reads as "unavailable, write it yourself".
    const status = (res.error as { context?: { status?: number } })?.context
      ?.status;
    throw { code: status === 429 ? 'rate_limited' : 'ai_unavailable' } as AiError;
  }

  const clean = sanitize(res.data);
  if (!clean) throw { code: 'ai_unavailable' } as AiError;
  return clean;
}

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Client wrapper around the ai-listing-assistant Edge Function — the
 * per-listing buyer chat (Feature C). Mirrors src/lib/ai.js's function of the
 * same name exactly: `null` on any failure (rate limit, unavailable, network)
 * rather than a typed error, since the caller only ever needs to render one
 * generic "can't answer right now" bubble either way.
 */
export async function askListingAssistant(
  propertyId: string,
  messages: AssistantMessage[],
  language: LangCode = 'sq',
): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('ai-listing-assistant', {
      body: { property_id: propertyId, messages, language },
    });
    if (error || typeof data?.reply !== 'string') return null;
    return data.reply;
  } catch {
    return null;
  }
}
