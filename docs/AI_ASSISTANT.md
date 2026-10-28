# The Shtëpia.ime AI assistant

A chat in the phone app (and the website built from it) that answers questions
about the app and finds, ranks and compares real listings. Built 2026-10-27
(AUDIT.md Pass 27). The per-listing assistant on a listing page
(`ai-listing-assistant`) is separate and unchanged, apart from a link into this one.

## Architecture

```
app/assistant.tsx ──► lib/assistant.ts ──► Edge Function ai-assistant ──► Claude (tool use)
   (chat UI)         (invoke, errors)      index.ts: auth, limits, I/O      │
                                            logic.js: tools, validation ◄────┘ tool calls
                                            knowledge.js: platform notes
                                                 │ reads AS THE CALLER (RLS)
                                                 ▼
                                           public.properties
```

- **Server** `supabase/functions/ai-assistant/`
  - `index.ts`: CORS, rate limits, the Anthropic SDK call, and the database adapter.
    Listings are read with the anon key **plus the caller's own token**, so the
    `properties` RLS policies apply exactly as in the app (visitors see only
    `status = 'active'`; owners also see their own). The service role is used
    only to count usage in `ai_usage`.
  - `logic.js`: pure, Node-tested. The tools, input validation, query building,
    ranking, price per m², comparison, and the tool loop (`runTurn`).
  - `knowledge.js`: what the assistant knows about the app (`PLATFORM`) and how it
    must behave (`RULES`). Written from the code, versioned (`KNOWLEDGE_VERSION`).
- **App**: `app/assistant.tsx` (screen), `components/assistant/` (comparison
  table, Home entry), `lib/assistant.ts`, `src/features/assistant/lib/conversation.js`
  (what is sent, what is kept on the device). Entry points: Home (under the
  search bar), Search header (✦ button), and the listing assistant's "Gjej të
  ngjashme ose më të lira" link (opens with the question typed, not sent).

## Tools the model can call

| Tool | What it does | Guard |
|---|---|---|
| `search_properties` | Structured criteria → the same filters as the app's search (`data/properties.ts`), plus amenities, floor, keywords and "near this listing". `refine` keeps the current criteria, `new` starts over, `remove` drops some. Returns up to 6 ranked listings and the match count. | Every value is validated against the schema (`normalizeCriteria`); text has PostgREST syntax stripped; no SQL from the model, ever. |
| `get_properties` | Current facts and the owner-written description for up to 4 ids. | Description is marked `description_untrusted` and the prompt treats it as data. |
| `compare_properties` | Side-by-side table computed on the server (`compareRows`). | Price per m² compared only in one currency; mixed currencies get approximate euros, labelled. |
| `show_properties` | Which listings appear as cards. | Only ids a tool returned in this conversation; cards are re-read from the database, never built from model text. |
| `open_screen` | A button to an app screen. | Fixed allow-list (`SCREENS`). |

There is no platform-knowledge tool: the notes are small (about 2,000 tokens)
and are sent as the cached system prompt, which is cheaper and simpler than
retrieval. No vector database: every listing field the assistant needs is
structured, and the free-text part (title, description, zone) is covered by a
keyword filter. Revisit both if the notes grow past ~10k tokens or listings
reach the tens of thousands.

## Data used

`properties`: `id, title, title_i18n, description, price, currency, listing_type,
property_type, city, zone, address, sqft, beds, baths, floor, total_floors,
year_built, features, image_urls, ref_code, created_at, status, latitude,
longitude`. Never read: owner ids, contact phone/email, moderation fields,
other tables. Amenities are the `features` keys of the listing form.

Not in the schema, so the assistant says "nuk është specifikuar" instead of
guessing: mortgage / ownership documents, net vs gross area (one `sqft` in m²),
construction status, valuation or yield data.

## Conversation state

The server returns `state = { criteria, result_ids, seen_ids }`; the app sends
it back with the next question, and the server re-validates it. Criteria are
what make "po me ashensor?" keep the earlier search; `result_ids` are what "e
para" refers to. Listing facts are always re-read from the database, never
taken from the state or the model's memory.

The conversation is kept **on the device only** (AsyncStorage / localStorage),
per account, at most 40 messages, forgotten after 30 days or on "Bisedë e re".
No conversation table, so no cross-user access is possible on the server.

## Model, limits, cost

- Model `claude-opus-5-5` at `effort: low` (chat), set by the `ASSISTANT_MODEL`
  / `ASSISTANT_EFFORT` secrets. A cheaper option is `claude-haiku-5-5`
  ($0.10 / $0.50 per MTok against $4 / $20); it has no server-side refusal
  fallback. Server-side refusal fallback (`fallbacks: "default"`) is on.
- Rate limits: 20 questions per hour per account or IP; the project-wide
  `AI_DAILY_CALL_CAP` (default 2000 per day). Each question makes at most 6
  model calls (tool loop), `max_tokens` 4096, 25 s timeout, 1 retry.
- Messages over 1,000 characters are cut; 12 turns of history at most.
- The real spending cap belongs in the Anthropic console.

## Deploying

The function needs the `ANTHROPIC_API_KEY` secret (shared with the other AI
functions). Deploy `index.ts`, `logic.js` and `knowledge.js` together (Supabase
dashboard, CLI `supabase functions deploy ai-assistant`, or the MCP deploy
tool). `verify_jwt` stays on: the app always sends the anon key or the user's
token. After a change to the app's screens or rules, update `knowledge.js` in
the same commit and redeploy.

## Tests

- `tests/aiAssistant.test.mjs` (node --test): validation and injection
  attempts, follow-up merging, query predicates, ranking, price per m² and
  comparison, card fields, history/state sanitising, and full tool loops with
  a scripted model (search, follow-up, no results, compare with a sold listing,
  screens, refusal, empty reply, tool failure, runaway loop), plus the app's
  history and storage rules.
- `e2e-expo/flows.spec.ts` X43–X47 (phone + desktop): starter → cards → listing;
  follow-up sends history and state, survives reload, new chat clears; comparison
  table with "not specified"; outage + retry; entry points. `/assistant` is also in
  the axe scan (light + dark) and the 320px / 280px layout checks.

Not verified until the Anthropic key works: real model answers (quality,
language, tool choice). See AUDIT.md Pass 27.
