# FEATURES.md — AI features

Architecture shared by every feature: the Anthropic key lives ONLY as a
Supabase Edge Function secret (`ANTHROPIC_API_KEY`, see DECISIONS.md §0 to set
it). Every function rate-limits per user-or-IP via the `ai_usage` table,
times out defensively, and returns `503 { error: 'ai_unavailable' }` on any
failure — the client treats that as "AI off" and keeps the non-AI path
working. All user-facing strings go through i18next (8 locales). Model
responses cross a sanitizer boundary (`src/lib/aiSchemas.js`, unit-tested via
`npm test`) before touching app state.

Feature flags (`src/lib/flags.js`): env `VITE_FLAG_*=false` in `.env.local`,
or at runtime `localStorage.setItem('fho_flags', JSON.stringify({ aiSearch: false }))`.

| # | Feature | Model | Edge function | Flag | Rate limit |
|---|---|---|---|---|---|
| A | AI listing generator | `claude-sonnet-5` | `supabase/functions/ai-generate-listing` | `aiListingGenerator` / `VITE_FLAG_AI_LISTING_GENERATOR` | 20/h/user |
| B | Natural-language search | `claude-haiku-4-5-20251001` | `supabase/functions/ai-parse-search` | `aiSearch` / `VITE_FLAG_AI_SEARCH` | 60/h/key |
| C | Listing buyer assistant | `claude-haiku-4-5-20251001` | `supabase/functions/ai-listing-assistant` | `aiAssistant` / `VITE_FLAG_AI_ASSISTANT` | 30/h/key |
| E | Auto-translate listings | Google + DeepL (no Anthropic) | `supabase/functions/translate-property` (pre-existing) | `autoTranslate` / `VITE_FLAG_AUTO_TRANSLATE` | n/a |

## A — AI listing generator (flagship)

- **What**: panel at the top of the wizard's Basics step ([AiListingPanel.jsx](src/components/AiListingPanel.jsx)). Agent types free-form notes; Sonnet writes an Albanian title, 70–130-word description, and 3–5 highlight bullets (folded into the description). Output lands in the normal editable inputs — nothing publishes without human review ("review before publishing" hint shown).
- **Grounding**: the function whitelists exactly the structured fields + capped notes; the system prompt forbids invented amenities/claims; structured output enforced via tool-use.
- **Auth**: signed-in users only (401 otherwise).
- **Fallback**: on 503/timeout the panel shows "AI unavailable — write manually"; the wizard is unaffected.
- **Est. cost/call**: ~600 in / ~450 out tokens ≈ **$0.008–0.01** at Sonnet-class pricing (~$3/$15 per MTok). At 20/h cap: worst case ~$0.20/user/hour.

## B — Natural-language search

- **What**: sparkle button in the Search field ([Search.jsx](src/pages/Search.jsx)); Enter also triggers it. "apartament me 2 dhoma në Tiranë nën 100000 euro" → Haiku extracts city/type/listing/beds/min/max (EUR default, "100 mijë"→100000, "2+1"→2 beds) → written into the existing URL-param filter pipeline, so back/share/reset all behave normally.
- **Fallback**: parse failure or AI-off shows a one-line status and the typed text keeps working as the normal city search. Client caches parses per session.
- **Anon**: allowed (search is public); rate-limited per user-or-IP.
- **Est. cost/call**: ~350 in / ~80 out ≈ **$0.0008** at Haiku 4.5 pricing (~$1/$5 per MTok). Effectively free at this scale.

## C — Listing buyer assistant

- **What**: floating "Ask about this home" chat on active listing pages ([ListingAssistant.jsx](src/components/ListingAssistant.jsx)). Grounded server-side: the function fetches the listing itself (active status enforced — drafts can never leak) and injects it as the ONLY source of truth; the prompt refuses outside facts, forbids financial/legal advice, allows labeled arithmetic (price/m²), and ignores injection attempts in user messages. Replies in the app's current language; permanent disclaimer in the panel footer.
- **History**: capped at 10 turns × 1000 chars server-side.
- **Fallback**: localized "can't answer now, contact the seller" bubble; input stays usable.
- **Est. cost/call**: ~800 in / ~150 out ≈ **$0.0016** per message at Haiku pricing.

## E — Auto-translate listings (write once, publish in 8 languages)

- **What**: "Translate to all languages" button under the wizard's description field ([AutoTranslateButton.jsx](src/components/AutoTranslateButton.jsx), previously dead code — rewritten with i18n + wired in). Translates the Albanian title + description into all 8 locales via the pre-existing Google→DeepL pipeline and merges into `title_i18n`/`description_i18n`, never overwriting anything the agent typed manually and never touching `sq`.
- **Status**: wiring verified; the pipeline currently fails because the stored `GOOGLE_TRANSLATE_KEY` is invalid — see DECISIONS.md §0c. Costs are Google/DeepL, not Anthropic.

## Not built (deliberately)

- **D — Smart recommendations**: skipped in favor of shipping A–C well; a Haiku re-ranker over favorites+recently-viewed is the natural v1. Next pass.
- **F — Photo tagging**: needs vision calls per image at upload time; cost/UX design first. Next pass.
- **G — Price insight**: flagged per constraints, not shipped — decision checklist in DECISIONS.md §0b.
