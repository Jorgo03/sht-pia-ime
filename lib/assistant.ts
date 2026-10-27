import { supabase } from '@/lib/supabase';
import { historyFor } from '@/src/features/assistant/lib/conversation';

import { LangCode } from './translate';

/**
 * Client wrapper around the ai-assistant Edge Function (docs/AI_ASSISTANT.md).
 * The Anthropic key and every database read stay on the server; the app only
 * sends the conversation's text turns and the state the server handed back.
 */

/** A listing as the server shows it: public fields, read from the database. */
export interface AssistantCard {
  id: string;
  title: string;
  title_i18n: Record<string, string> | null;
  price: number;
  currency: string;
  listing_type: 'sale' | 'rent' | 'daily_rent';
  property_type: string | null;
  city: string | null;
  zone: string | null;
  address: string | null;
  sqft: number | null;
  beds: number | null;
  baths: number | null;
  floor: number | null;
  total_floors: number | null;
  features: string[];
  image_urls: string[];
  ref_code: string | null;
  created_at: string;
  status: string;
}

export interface ComparisonItem {
  id: string;
  title: string;
  price: number;
  currency: string;
  price_eur_approx: number | null;
  area_m2: number | null;
  price_per_m2: number | null;
  price_per_m2_eur_approx: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floor: number | null;
  building_floors: number | null;
  city: string | null;
  zone: string | null;
  features: string[];
  status: string;
}

export interface Comparison {
  items: ComparisonItem[];
  mixed_currencies: boolean;
  best: {
    lowest_price: string | null;
    largest_area: string | null;
    lowest_price_per_m2: string | null;
    most_bedrooms: string | null;
  };
}

export type ScreenKey =
  | 'explore' | 'favorites' | 'saved_searches' | 'messages' | 'viewings' | 'create_listing'
  | 'my_listings' | 'agent_dashboard' | 'leads' | 'profile' | 'privacy' | 'terms';

/** Opaque to the app: echoed back so follow-ups keep the search. */
export type AssistantState = Record<string, unknown> | null;

export interface AssistantAnswer {
  reply: string;
  cards: AssistantCard[];
  comparison: Comparison | null;
  screens: { key: ScreenKey; route: string }[];
  state: AssistantState;
}

export type AssistantError = 'rate_limited' | 'refused' | 'unavailable' | 'network';

async function classify(error: unknown): Promise<AssistantError> {
  const context = (error as { context?: Response })?.context;
  if (!context || typeof context.json !== 'function') return 'network';
  try {
    const body = await context.json();
    if (body?.error === 'rate_limited') return 'rate_limited';
    if (body?.error === 'refused') return 'refused';
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}

export async function askAssistant({
  messages,
  question,
  state,
  language,
  propertyId,
}: {
  messages: readonly { role: string; content?: string; failed?: unknown }[];
  question: string;
  state: AssistantState;
  language: LangCode;
  propertyId?: string | null;
}): Promise<{ ok: true; answer: AssistantAnswer } | { ok: false; error: AssistantError }> {
  try {
    const { data, error } = await supabase.functions.invoke('ai-assistant', {
      body: { messages: historyFor(messages, question), state, language, property_id: propertyId ?? null },
    });
    if (error) return { ok: false, error: await classify(error) };
    if (typeof data?.reply !== 'string') return { ok: false, error: 'unavailable' };
    return {
      ok: true,
      answer: {
        reply: data.reply,
        cards: Array.isArray(data.cards) ? data.cards : [],
        comparison: data.comparison && Array.isArray(data.comparison.items) ? data.comparison : null,
        screens: Array.isArray(data.screens) ? data.screens : [],
        state: data.state ?? null,
      },
    };
  } catch {
    return { ok: false, error: 'network' };
  }
}
