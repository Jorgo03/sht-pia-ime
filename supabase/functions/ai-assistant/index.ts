// supabase/functions/ai-assistant/index.ts
//
// The Shtëpia.ime assistant (docs/AI_ASSISTANT.md): answers questions about
// the app and finds, ranks and compares real listings. The model only calls
// the tools in logic.js; every listing it sees is read here AS THE CALLER, so
// the properties table's row-level security applies exactly as in the app.
// The service role is used for one thing: counting AI usage (ai_usage).
//
// Model: ASSISTANT_MODEL secret, default claude-opus-5-5, at low effort.
// Auth: anon allowed (listings are public). Rate limit: 20 turns/hour per
// user-or-IP, plus the project-wide AI_DAILY_CALL_CAP.

import Anthropic from 'npm:@anthropic-ai/sdk@1.3.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

import { SYSTEM_PROMPT } from './knowledge.js';
import { TOOLS, applyCriteria, runTurn } from './logic.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const MODEL = Deno.env.get('ASSISTANT_MODEL') || 'claude-opus-5-5';
const EFFORT = (['low', 'medium', 'high'].includes(Deno.env.get('ASSISTANT_EFFORT') ?? '') ? Deno.env.get('ASSISTANT_EFFORT') : 'low') as 'low' | 'medium' | 'high';
const RATE_LIMIT_PER_HOUR = 20;
const FEATURE = 'assistant';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const admin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const anthropic = ANTHROPIC_KEY ? new Anthropic({ apiKey: ANTHROPIC_KEY, timeout: 25_000, maxRetries: 1 }) : null;

// Same accounting as the other AI functions (ai-listing-assistant).
async function rateLimit(key: string, max: number): Promise<boolean> {
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count, error } = await admin
    .from('ai_usage')
    .select('id', { count: 'exact', head: true })
    .eq('key', key)
    .eq('feature', FEATURE)
    .gte('created_at', since);
  // Fail closed: if usage cannot be counted, no paid call is made.
  if (error || (count ?? 0) >= max) return false;
  await admin.from('ai_usage').insert({ key, feature: FEATURE });
  return true;
}

const AI_DAILY_CALL_CAP = Number(Deno.env.get('AI_DAILY_CALL_CAP') ?? '2000');

async function underDailyCap(): Promise<boolean> {
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count, error } = await admin
    .from('ai_usage')
    .select('id', { count: 'exact', head: true })
    .eq('feature', FEATURE)
    .gte('created_at', since);
  if (error) return false;
  return (count ?? 0) <= AI_DAILY_CALL_CAP;
}

async function callerKey(token: string, req: Request): Promise<string> {
  const { data } = await admin.auth.getUser(token);
  if (data?.user) return data.user.id;
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
}

// Every column the assistant can read. No owner ids, contact details or
// moderation fields: those stay on the listing page, behind its own rules.
const COLUMNS =
  'id, title, title_i18n, description, price, currency, listing_type, property_type, city, zone, address, sqft, beds, baths, floor, total_floors, year_built, features, image_urls, ref_code, created_at, status, latitude, longitude';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    if (!anthropic) return json({ error: 'ai_unavailable' }, 503);

    let body: { messages?: unknown; state?: unknown; language?: unknown; property_id?: unknown };
    try {
      body = await req.json();
    } catch {
      return json({ error: 'bad_request' }, 400);
    }
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const lastUser = [...messages].reverse().find((m) => m?.role === 'user');
    if (!lastUser || typeof lastUser.content !== 'string' || !lastUser.content.trim()) {
      return json({ error: 'empty_query' }, 400);
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    if (!(await rateLimit(await callerKey(token, req), RATE_LIMIT_PER_HOUR))) {
      return json({ error: 'rate_limited' }, 429);
    }
    if (!(await underDailyCap())) return json({ error: 'ai_unavailable' }, 503);

    // Reads as the person asking: anon key + their own token, so RLS decides.
    const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader || `Bearer ${ANON_KEY}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const db = {
      async search(criteria: Record<string, unknown>, anchor: { latitude: number; longitude: number } | null, limit: number) {
        let q = asCaller.from('properties').select(COLUMNS, { count: 'exact' });
        q = applyCriteria(q, criteria, anchor);
        q = criteria.sort === 'price_asc' || criteria.sort === 'price_desc'
          ? q.order('price', { ascending: criteria.sort === 'price_asc' })
          : q.order('created_at', { ascending: false });
        const { data, count, error } = await q.order('id', { ascending: true }).limit(limit);
        if (error) throw error;
        return { rows: data ?? [], count };
      },
      async byIds(ids: string[]) {
        if (!ids.length) return [];
        const { data, error } = await asCaller.from('properties').select(COLUMNS).in('id', ids);
        if (error) throw error;
        const byId = new Map((data ?? []).map((r: { id: string }) => [r.id, r]));
        return ids.map((id) => byId.get(id)).filter(Boolean);
      },
      async anchorFor(id: string) {
        const { data } = await asCaller.from('properties').select('latitude, longitude').eq('id', id).maybeSingle();
        return data && Number.isFinite(data.latitude) && Number.isFinite(data.longitude) ? data : null;
      },
    };

    const callModel = (turnMessages: unknown[]) =>
      anthropic.beta.messages.create({
        model: MODEL,
        max_tokens: 4096,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: EFFORT },
        // Stable text first and cached: the rules and platform notes never
        // change within a deploy; the per-turn context rides in the messages.
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        tools: TOOLS,
        messages: turnMessages,
      } as never);

    const result = await runTurn({
      history: messages,
      state: body.state,
      contextPropertyId: typeof body.property_id === 'string' ? body.property_id : null,
      language: typeof body.language === 'string' ? body.language : 'sq',
      callModel,
      db,
    });
    if ('error' in result && result.error) {
      if (result.error === 'empty_query') return json({ error: 'empty_query' }, 400);
      if (result.error === 'refused') return json({ error: 'refused' }, 422);
      return json({ error: 'ai_unavailable' }, 503);
    }
    return json(result);
  } catch (err) {
    // No message content in logs: only the kind of failure.
    const status = err instanceof Anthropic.APIError ? err.status : null;
    console.error('ai-assistant error', status ?? (err instanceof Error ? err.name : 'unknown'));
    return json({ error: 'ai_unavailable' }, 503);
  }
});
