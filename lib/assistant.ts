import { supabase } from '@/lib/supabase';
import { askEra } from '@/src/features/assistant/lib/era';

/**
 * Era, the assistant (docs/AI_ASSISTANT.md): the shapes both chats show.
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

/**
 * Era's answer, without a paid AI model: src/features/assistant/lib/era.js
 * reads the question and counts the matching listings straight from the
 * database (RLS applies, as for Search). A failed read is offered as a retry.
 */
export async function askAssistant({
  question,
  state,
  t,
  propertyId,
}: {
  question: string;
  state: AssistantState;
  t: (key: string, options?: Record<string, unknown>) => string;
  propertyId?: string | null;
}): Promise<{ ok: true; answer: AssistantAnswer } | { ok: false; error: AssistantError }> {
  try {
    const answer = await askEra({ db: supabase, question, state, t, propertyId });
    return { ok: true, answer: { ...answer, screens: answer.screens as AssistantAnswer['screens'] } };
  } catch {
    return { ok: false, error: 'network' };
  }
}
