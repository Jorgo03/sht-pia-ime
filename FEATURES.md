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
| B | Natural-language search | `claude-haiku-4-5-20251001` | `supabase/functions/ai-parse-search` | `aiSearch` / `VITE_FLAG_AI_SEARCH` | 60/h/key |
| C | Listing buyer assistant | `claude-haiku-4-5-20251001` | `supabase/functions/ai-listing-assistant` | `aiAssistant` / `VITE_FLAG_AI_ASSISTANT` | 30/h/key |
| E | Auto-translate listings | `claude-sonnet-5` | `supabase/functions/translate-property` | `autoTranslate` / `VITE_FLAG_AUTO_TRANSLATE` | 60/h/user |

**Retired — Feature A, AI listing generator ("Gjenero me AI"), removed 2026-08-25.** It wrote a brand-new Albanian title/description from property facts — a different feature from translation (E), which never touched it. Removed at the owner's request rather than kept alongside the translation-bar rework, to leave one unambiguous way to fill the title field. `supabase/functions/ai-generate-listing` is stubbed to `410 Gone` (this project's tooling has no function-delete operation — delete it for real from the Supabase Dashboard when convenient); `AiTitleButton`/`AiListingPanel`, `generateListing()`, `sanitizeGeneratedListing()` and its tests, and the `aiListingGenerator` flag are deleted from the repo.

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

- **What**: **selecting a language IS the translate action.** One language bar sits above the wizard's title and description ([TranslationBar](src/features/listings/components/TranslationBar.jsx) on web, [translation-bar.tsx](components/listing/translation-bar.tsx) on mobile); tapping EN/DE/IT/ES/PL/RU/FR translates *both* fields from Albanian in a single request and shows the result in the inputs, ready to edit. The separate "Translate to all languages" button is gone — a language tab that showed an empty box next to a button somewhere below that filled it was two ways to do one thing.
- **How it decides**: [translationCore.js](src/lib/translationCore.js) fingerprints the Albanian title+description; [useListingTranslation.ts](src/features/listings/hooks/useListingTranslation.ts) is the shared state machine both apps run. A language is re-translated only when it is missing or its fingerprint no longer matches; a translation an agent edited by hand is pinned and never regenerated without an explicit **Translate again**. Provenance lives in `properties.translation_meta`.
- **Why Anthropic and not Google/DeepL**: neither takes an instruction, and both got the listings in this DB wrong in the ways that matter — "Apartament 2+1 në **Bllok**" (a Tirana neighbourhood) came back as "in Block", and the `2+1` room notation, m2 values and bullet layout were all fair game for reformatting. The prompt pins proper nouns, numeric notation and formatting explicitly.
- **Status**: live. This also retires the `GOOGLE_TRANSLATE_KEY` / `DEEPL_API_KEY` dependency that had auto-translate down entirely — see DECISIONS.md §0c.
- **Est. cost/call**: one call per language per listing, title+description together, cached thereafter.

## Not built (deliberately)

- **D — Smart recommendations**: skipped in favor of shipping A–C well; a Haiku re-ranker over favorites+recently-viewed is the natural v1. Next pass.
- **F — Photo tagging**: needs vision calls per image at upload time; cost/UX design first. Next pass.
- **G — Price insight**: flagged per constraints, not shipped — decision checklist in DECISIONS.md §0b.
