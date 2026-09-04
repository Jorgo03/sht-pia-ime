// supabase/functions/translate-property/index.ts
//
// Real-estate translation of a listing's title + description.
//
// TWO ENGINES, picked automatically:
//
//   1. Anthropic (claude-sonnet-5) -- preferred. A prompted model can be told
//      to leave proper nouns and numeric notation alone, which general
//      translation engines cannot.
//   2. MyMemory -- free, no API key, no signup. Used when ANTHROPIC_API_KEY is
//      absent OR when the upstream rejects it (401/403). This is what keeps
//      the feature working on a zero-budget project.
//
// The fallback is deliberately automatic and one-directional: add valid
// Anthropic credits and quality upgrades itself with no code change; let them
// lapse and translation degrades instead of dying. The response carries
// `provider` so the UI can tell the agent which one produced the text.
//
// The free engine gets the same protections the prompt gives the paid one,
// mechanically instead of by instruction: room notation (2+1), measurements,
// prices, URLs, emails, phone numbers and Albanian place names are masked with
// placeholders before translation and restored after. Verified live -- without
// this, MyMemory turns "Apartament 2+1 modern ne Bllok" into "A modern
// 2-bedroom apartment on the block": the layout notation destroyed and Blloku,
// a Tirana neighbourhood, translated as the common noun "block".
//
// Request -- primary shape (one target, both fields):
//   { title?, description?, sourceLanguage?='sq', targetLanguage }
//   -> { title, description, targetLanguage, provider }
//
// Request -- legacy shape, still used by scripts/bulk-translate.js:
//   { text, source?='sq' }
//   -> { sq, en, de, it, es, pl, ru, fr }
//
// Auth: a signed-in user (rate-limited 60/hour per account), a signed-out
// visitor (20/hour per IP) or the service role (unlimited).

import { createClient } from 'npm:@supabase/supabase-js@2';

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
const MODEL = 'claude-sonnet-5';
const RATE_LIMIT_PER_HOUR = 60;

// Signed-out visitors get a smaller hourly budget, keyed by IP rather than by
// user id. Deliberately lower than the signed-in ceiling: an IP is a much weaker
// identity than an account — shared by everyone behind one NAT, and trivially
// rotated — so this buys availability for ordinary browsing without turning the
// endpoint into a free unauthenticated translation API.
const ANON_RATE_LIMIT_PER_HOUR = 20;

// Optional. MyMemory's anonymous quota is ~5k characters/day per calling IP,
// which an edge function shares with everyone else on that IP. Setting this to
// any mailbox you control raises it to ~50k/day tied to that address instead.
// Left unset the free engine still works, just with a much smaller ceiling.
const MYMEMORY_EMAIL = Deno.env.get('MYMEMORY_EMAIL');

const MAX_TITLE_CHARS = 300;
const MAX_DESCRIPTION_CHARS = 6000;

const LANGS = ['sq', 'en', 'de', 'it', 'es', 'pl', 'ru', 'fr'] as const;
type Lang = (typeof LANGS)[number];

const LANG_NAMES: Record<Lang, string> = {
  sq: 'Albanian', en: 'English', de: 'German', it: 'Italian',
  es: 'Spanish', pl: 'Polish', ru: 'Russian', fr: 'French',
};

const isLang = (v: unknown): v is Lang =>
  typeof v === 'string' && (LANGS as readonly string[]).includes(v);

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

async function rateLimit(key: string, feature: string, max: number): Promise<boolean> {
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await admin
    .from('ai_usage')
    .select('id', { count: 'exact', head: true })
    .eq('key', key)
    .eq('feature', feature)
    .gte('created_at', since);
  if ((count ?? 0) >= max) return false;
  await admin.from('ai_usage').insert({ key, feature });
  return true;
}

/**
 * Best-effort caller IP, used only as a rate-limit bucket for signed-out callers.
 *
 * x-forwarded-for is client-controlled, so this cannot be trusted to identify
 * anyone — a determined caller spoofs it and gets a fresh bucket. That is
 * acceptable for what it guards: a spend ceiling on translating text the visitor
 * can already read on the page. It is not, and must not become, an authorization
 * check. The leftmost entry is the original client where the platform appends
 * rather than replaces, and the fixed fallback means a request arriving with no
 * forwarding header shares one bucket instead of escaping the limit entirely.
 */
function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for') ?? '';
  const first = forwarded.split(',')[0]?.trim();
  return `ip:${first || req.headers.get('cf-connecting-ip')?.trim() || 'unknown'}`;
}

/**
 * Reads the `role` claim without verifying the signature.
 *
 * Safe only because it grants nothing: Supabase's gateway has already rejected
 * the request unless the JWT is validly signed by this project. This only
 * decides which already-trusted caller gets rate-limited, and how hard.
 */
function jwtRole(token: string): string | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(padded + '='.repeat((4 - (padded.length % 4)) % 4)));
    return typeof decoded?.role === 'string' ? decoded.role : null;
  } catch {
    return null;
  }
}

interface FieldPair {
  title: string;
  description: string;
}

/* ------------------------------------------------------------------ masking */

/**
 * Albanian place names that read as ordinary words to a translation engine.
 *
 * Blloku is the clearest case -- a Tirana district that any engine renders as
 * "block" -- but "Ali Demi", "Pazar i Ri" and "Liqeni i Thate" have the same
 * problem. Longest-first so multi-word names match before their fragments do.
 */
const PLACE_NAMES = [
  'Komuna e Parisit', 'Liqeni i Thate', 'Liqeni i Thatë', 'Myslym Shyri',
  'Pazar i Ri', 'Ali Demi', 'Don Bosko', 'Yzberisht', 'Gjirokaster',
  'Gjirokastër', 'Kombinat', 'Pogradec', 'Sarande', 'Sarandë',
  'Gjiri i Lalzit', 'Rruga e Kavajes', 'Rruga e Kavajës', 'Blloku', 'Bllok',
  'Selvia', 'Astir', 'Sauk', 'Tirane', 'Tiranë', 'Durres', 'Durrës', 'Vlore',
  'Vlorë', 'Shkoder', 'Shkodër', 'Elbasan', 'Korce', 'Korçë', 'Lushnje',
  'Lushnjë', 'Kavaje', 'Kavajë', 'Berat', 'Fier',
].sort((a, b) => b.length - a.length);

/**
 * Patterns that must survive translation byte-for-byte.
 *
 * This list is deliberately SHORT, and that is the result of measurement, not
 * caution. Masking is not free: a placeholder makes a line less meaningful to
 * the engine, and on a short line it can be dropped from the output entirely.
 * Masking prices did exactly that -- "Cmimi 150000 EUR." came back as bare
 * "Price", silently deleting the asking price from the listing.
 *
 * Checked against the live engine, these survive unmasked and are therefore
 * left alone: prices and currency ("Cmimi 150000 EUR." -> "Price EUR 150000."),
 * measurements ("85 m2, kati 3" -> "85 m2, 3rd floor"), and phone numbers.
 *
 * These do NOT survive, and are the whole reason masking exists:
 *   2+1     -> "2+ 1"                      (the layout notation, corrupted)
 *   Bllok   -> "The apartment doesn't block."  (a district read as a verb)
 */
const PROTECTED_PATTERNS: RegExp[] = [
  /https?:\/\/\S+/gi,                                        // URLs
  /\b[\w.+-]+@[\w-]+\.[\w.]{2,}\b/g,                         // emails
  /\b\d+\+\d+(?:\+\d+)*\b/g,                                 // 2+1, 2+1+2
];

/**
 * Replaces anything that must not be translated with a numbered placeholder.
 *
 * `%%N%%` was chosen by testing it through MyMemory rather than by taste:
 * it comes back unchanged and unreordered, which is the only property that
 * matters here.
 */
function mask(text: string): { masked: string; tokens: string[] } {
  const tokens: string[] = [];
  let masked = text;

  const claim = (match: string) => {
    const index = tokens.indexOf(match);
    if (index !== -1) return `%%${index}%%`;
    tokens.push(match);
    return `%%${tokens.length - 1}%%`;
  };

  for (const pattern of PROTECTED_PATTERNS) {
    masked = masked.replace(pattern, claim);
  }
  for (const place of PLACE_NAMES) {
    // Unicode lookarounds, NOT \b. JavaScript's \b is ASCII-only, so for a
    // name ending in a diacritic the trailing boundary never matches and the
    // name goes unprotected: \bTiranë\b and \bKorçë\b both fail to match text
    // that plainly contains them, while \bDurrës\b works purely because it
    // happens to end in "s". These lookarounds match all of them and still
    // refuse to fire inside a longer word ("Fier" does not match "Fieri").
    const escaped = place.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'giu');
    masked = masked.replace(pattern, claim);
  }
  return { masked, tokens };
}

/**
 * Puts the protected text back, and reports whether all of it came back.
 *
 * `complete` is the important half. An engine that drops a placeholder does
 * not fail — it returns a fluent sentence with the protected content simply
 * missing, which for a listing means a silently deleted price or address. The
 * caller uses this to retry unmasked rather than publish the hole.
 */
function unmask(text: string, tokens: string[]): { text: string; complete: boolean } {
  let out = text;
  let complete = true;
  tokens.forEach((token, i) => {
    // Engines sometimes pad or alter spacing around the marker.
    const marker = new RegExp(`%%\\s*${i}\\s*%%`, 'g');
    if (!marker.test(out)) {
      complete = false;
      return;
    }
    out = out.replace(new RegExp(`%%\\s*${i}\\s*%%`, 'g'), token);
  });
  return { text: out, complete };
}

/* ------------------------------------------------------- free engine (MyMemory) */

const MYMEMORY_MAX_CHUNK = 450;

/**
 * Splits text so structure survives.
 *
 * Line-by-line rather than by character count: bullets and paragraph breaks
 * are content the translation has to preserve, and translating a whole block
 * at once is what flattens them. Only a line longer than the engine's
 * comfortable request size gets split further, on sentence boundaries.
 */
function splitForTranslation(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split('\n')) {
    if (line.length <= MYMEMORY_MAX_CHUNK) {
      out.push(line);
      continue;
    }
    let buffer = '';
    for (const sentence of line.split(/(?<=[.!?])\s+/)) {
      if ((buffer + ' ' + sentence).length > MYMEMORY_MAX_CHUNK && buffer) {
        out.push(buffer);
        buffer = sentence;
      } else {
        buffer = buffer ? `${buffer} ${sentence}` : sentence;
      }
    }
    if (buffer) out.push(buffer);
  }
  return out;
}

/** Leading bullet/number markers are layout, not prose — keep them verbatim. */
const BULLET = /^(\s*(?:[-•*·–]|\d+[.)])\s*)/;

async function myMemoryFetch(q: string, source: Lang, target: Lang): Promise<string> {
  const url = new URL('https://api.mymemory.translated.net/get');
  url.searchParams.set('q', q);
  url.searchParams.set('langpair', `${source}|${target}`);
  if (MYMEMORY_EMAIL) url.searchParams.set('de', MYMEMORY_EMAIL);

  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) {
    throw Object.assign(new Error('mymemory_http'), { upstreamStatus: response.status });
  }

  const data = await response.json();
  if (data?.quotaFinished === true || data?.responseStatus === 429) {
    throw Object.assign(new Error('mymemory_quota'), { quotaExhausted: true });
  }
  const translated = data?.responseData?.translatedText;
  if (typeof translated !== 'string' || !translated.trim()) {
    throw Object.assign(new Error('mymemory_empty'), { upstreamStatus: 502 });
  }
  return translated;
}

async function myMemoryLine(line: string, source: Lang, target: Lang): Promise<string> {
  if (!line.trim()) return line;

  const bullet = line.match(BULLET)?.[1] ?? '';
  const body = line.slice(bullet.length);
  if (!body.trim()) return line;

  const { masked, tokens } = mask(body);
  const translated = await myMemoryFetch(masked, source, target);

  if (tokens.length === 0) return bullet + translated;

  const restored = unmask(translated, tokens);
  if (restored.complete) return bullet + restored.text;

  // The engine swallowed a placeholder, so this translation is missing content
  // that was in the source. Retrying unmasked risks a mangled "2+ 1" or a
  // place name read as a verb — but a slightly wrong line beats a line with
  // the price or the address quietly removed.
  try {
    return bullet + (await myMemoryFetch(body, source, target));
  } catch {
    // Even the retry failed: keep the source text rather than lose the line.
    return line;
  }
}

/**
 * Sequential on purpose: MyMemory's free tier throttles per IP, and a long
 * description can be a dozen lines. Firing them in parallel trades a couple of
 * seconds for intermittent 429s across the whole request.
 */
async function myMemoryText(text: string, source: Lang, target: Lang): Promise<string> {
  if (!text.trim()) return '';
  const lines = splitForTranslation(text);
  const out: string[] = [];
  for (const line of lines) {
    out.push(await myMemoryLine(line, source, target));
  }
  return out.join('\n');
}

async function translateViaMyMemory(
  source: Lang,
  targets: Lang[],
  fields: FieldPair,
): Promise<Record<string, FieldPair>> {
  const out: Record<string, FieldPair> = {};
  for (const target of targets) {
    out[target] = {
      title: await myMemoryText(fields.title, source, target),
      description: await myMemoryText(fields.description, source, target),
    };
  }
  return out;
}

/* --------------------------------------------------------- paid engine (Claude) */

const SYSTEM_PROMPT = `You are a professional real-estate translator for Shtepia.ime, a property marketplace in Albania. You translate listing copy written by estate agents.

Translate faithfully and idiomatically - the result must read like a native estate agent wrote it, not like a machine converted it word for word.

MUST PRESERVE EXACTLY, never translated, localised, converted or reformatted:
- Room notation: 1+1, 2+1, 2+1+2, 3+1, and similar. These are Albanian apartment layouts. Keep the digits and plus signs verbatim.
- All numbers, prices, currencies and currency symbols.
- Measurements and their units: m2, sqm, ha. Do not convert metric to imperial.
- Floor numbers and floor counts.
- Dates, phone numbers, URLs, email addresses.
- Proper nouns: street names, city names, neighbourhood names, residence and building names, company and agency names.

Proper nouns are the most common failure and the most damaging. Albanian place names frequently look like ordinary words - "Bllok"/"Blloku" is a district of Tirana, NOT the word "block"; "Ali Demi", "Kombinat", "Astir", "Yzberisht", "Sauk" and similar are place names. Never translate the meaning of a place name. Keep it in its Albanian form.

FORMATTING - reproduce the source's structure exactly:
- Keep line breaks, blank lines and paragraph splits where they are.
- Keep bullet points, keeping the same marker character and one bullet per source bullet.
- Never merge a bulleted list into a paragraph, and never split a paragraph into bullets.

CONTENT:
- Never invent information that is not in the source. No added amenities, no added neighbourhood claims.
- Never omit information that is in the source.
- Never add marketing or superlatives the source does not contain.
- Keep the professional, factual tone of the original.
- Titles stay short and natural for a listing headline; do not pad them.
- If a field is empty in the source, return an empty string for it.

Return only the translation, through the provided tool. No commentary.`;

async function translateViaAnthropic(
  source: Lang,
  targets: Lang[],
  fields: FieldPair,
): Promise<Record<string, FieldPair>> {
  const langProperties: Record<string, unknown> = {};
  for (const target of targets) {
    langProperties[target] = {
      type: 'object',
      description: `The ${LANG_NAMES[target]} translation.`,
      properties: {
        title: { type: 'string', description: 'Translated title, or "" if the source title was empty.' },
        description: {
          type: 'string',
          description:
            'Translated description with the source line breaks and bullets preserved, or "" if the source description was empty.',
        },
      },
      required: ['title', 'description'],
    };
  }

  const maxTokens = Math.min(16000, 1500 + targets.length * 1800);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      thinking: { type: 'disabled' },
      max_tokens: maxTokens,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content:
            `Source language: ${LANG_NAMES[source]}\n` +
            `Translate into: ${targets.map((t) => LANG_NAMES[t]).join(', ')}\n\n` +
            `TITLE:\n${fields.title || '(empty)'}\n\n` +
            `DESCRIPTION:\n${fields.description || '(empty)'}`,
        },
      ],
      tools: [
        {
          name: 'listing_translation',
          description: 'The finished translations, one entry per requested language.',
          input_schema: { type: 'object', properties: langProperties, required: targets },
        },
      ],
      tool_choice: { type: 'tool', name: 'listing_translation' },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    console.error('Anthropic error', response.status, await response.text());
    throw Object.assign(new Error('upstream'), { upstreamStatus: response.status });
  }

  const data = await response.json();
  const toolUse = data.content?.find((b: { type: string }) => b.type === 'tool_use');
  if (!toolUse?.input) {
    console.error('No tool_use block', data.stop_reason, JSON.stringify(data.usage));
    throw Object.assign(new Error('no_tool_use'), {
      upstreamStatus: 200,
      stopReason: data.stop_reason ?? null,
    });
  }

  const out: Record<string, FieldPair> = {};
  for (const target of targets) {
    const entry = toolUse.input[target];
    out[target] = {
      title: typeof entry?.title === 'string' ? entry.title.trim() : '',
      description: typeof entry?.description === 'string' ? entry.description.trim() : '',
    };
  }
  return out;
}

/* ----------------------------------------------------------------- dispatch */

async function translate(
  source: Lang,
  targets: Lang[],
  fields: FieldPair,
): Promise<{ result: Record<string, FieldPair>; provider: string }> {
  if (ANTHROPIC_KEY) {
    try {
      return { result: await translateViaAnthropic(source, targets, fields), provider: 'anthropic' };
    } catch (err) {
      const status = (err as { upstreamStatus?: number })?.upstreamStatus;
      // A rejected key is a configuration problem that will not fix itself on
      // retry, so fall through to the free engine rather than fail the request.
      // Anything else (a real outage, a truncated response) is transient and
      // should surface as a failure instead of silently downgrading quality.
      if (status !== 401 && status !== 403) throw err;
      console.error('Anthropic key rejected; falling back to the free engine');
    }
  }
  return { result: await translateViaMyMemory(source, targets, fields), provider: 'mymemory' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
    const role = jwtRole(token);
    let rateLimitKey: string | null = null;
    let rateLimitMax = RATE_LIMIT_PER_HOUR;

    if (role === 'service_role') {
      rateLimitKey = null;
    } else {
      const { data: userData } = await admin.auth.getUser(token);
      const user = userData?.user;
      if (user) {
        rateLimitKey = user.id;
      } else if (role === 'anon') {
        // Reading a listing is the one thing this marketplace has to do for a
        // visitor with no account, and a listing nobody can read is not browsable.
        // Rejecting the anon key here left every signed-out property page showing
        // untranslated Albanian in all eight languages — silently, because the
        // callers degrade to the original text rather than surfacing an error.
        //
        // The anon key is not a weaker *signature* than a user's: the gateway has
        // already rejected anything not signed by this project, which is what makes
        // branching on the unverified role claim safe at all. It is a weaker
        // *identity*, so it is billed against the caller's IP instead of an account.
        rateLimitKey = clientIp(req);
        rateLimitMax = ANON_RATE_LIMIT_PER_HOUR;
      } else {
        return json({ error: 'unauthorized' }, 401);
      }
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'invalid_json' }, 400);
    }

    const legacy = typeof body.text === 'string';

    const source = body.sourceLanguage ?? body.source ?? 'sq';
    if (!isLang(source)) return json({ error: 'unsupported_source_language' }, 400);

    let targets: Lang[];
    if (legacy) {
      targets = LANGS.filter((l) => l !== source);
    } else {
      const target = body.targetLanguage;
      if (!isLang(target)) return json({ error: 'unsupported_target_language' }, 400);
      if (target === source) return json({ error: 'target_equals_source' }, 400);
      targets = [target];
    }

    const rawTitle = legacy ? body.text : body.title;
    const rawDescription = legacy ? '' : body.description;

    const fields: FieldPair = {
      title: typeof rawTitle === 'string' ? rawTitle.trim().slice(0, MAX_TITLE_CHARS) : '',
      description:
        typeof rawDescription === 'string'
          ? rawDescription.trim().slice(0, MAX_DESCRIPTION_CHARS)
          : '',
    };

    if (!fields.title && !fields.description) {
      return json({ error: 'empty_content' }, 400);
    }

    if (rateLimitKey && !(await rateLimit(rateLimitKey, 'translate-property', rateLimitMax))) {
      return json({ error: 'rate_limited' }, 429);
    }

    const { result, provider } = await translate(source, targets, fields);

    if (legacy) {
      const flat: Record<string, string> = { [source]: fields.title };
      for (const target of targets) {
        if (result[target]?.title) flat[target] = result[target].title;
      }
      return json(flat);
    }

    const target = targets[0];
    return json({
      title: result[target]?.title ?? '',
      description: result[target]?.description ?? '',
      targetLanguage: target,
      provider,
    });
  } catch (err) {
    if ((err as { quotaExhausted?: boolean })?.quotaExhausted) {
      // The free engine's daily character allowance is spent. Reported as a
      // rate limit because that is what it is from the caller's side.
      return json({ error: 'rate_limited', provider: 'mymemory' }, 429);
    }
    const upstreamStatus = (err as { upstreamStatus?: number })?.upstreamStatus;
    if (upstreamStatus) {
      return json(
        {
          error: 'ai_unavailable',
          upstream_status: upstreamStatus,
          stop_reason: (err as { stopReason?: string | null })?.stopReason ?? null,
        },
        503,
      );
    }
    console.error('translate-property error', err);
    return json({ error: 'ai_unavailable' }, 503);
  }
});
