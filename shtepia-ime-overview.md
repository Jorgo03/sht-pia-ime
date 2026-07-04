# Shtëpia.ime — Deep Overview

Companion to `CLAUDE.md` (the lean index). This file holds the specifics.
Generated from the 2026-07 audit + AI feature pass; update when schema or
feature status changes. Severity-ranked findings live in `AUDIT.md`; pending
human decisions in `DECISIONS.md`; AI feature specs in `FEATURES.md`.

## Languages

8 locales, `sq` is fallback: **sq, en, de, it, es, pl, ru, fr**.
Locale files: `src/i18n/locales/*.json` — keep all 8 in sync (checker script
pattern lives in the audit history; pl/ru legitimately carry `_one/_few/_many`
plural suffixes where others use the base key).

## Data Model (public schema — ground truth as of 2026-07)

| Table | Purpose | RLS status |
|---|---|---|
| `profiles` | extends auth.users; `role` ('buyer'/'client'/'agent'), `agency_name`, `preferred_language` | public read; self insert/update; signup trigger `handle_new_user` copies role/agency/language from metadata |
| `properties` | listings; `owner_id` canonical, `agent_id` nullable; `*_i18n` JSONB; `status` active/paused/sold/rented/draft | public sees `active` only; owner/agent full CRUD on own |
| `favorites` | user ↔ property | own rows only |
| `conversations` | client ↔ agent per property; unread counters; `handle_new_message` trigger maintains counters + `last_message_at` | participants only; in `supabase_realtime` publication |
| `messages` | chat messages | participants only; realtime |
| `saved_searches` | named filter sets (AddSheet) | own rows only |
| `wanted_homes` | reverse listings (buyer posts wants) | owner CRUD; agents may read `open` ones |
| `viewings` | viewing requests (schema only, no UI yet) | client + property owner/agent |
| `leads` | agent's private lead tracker | own rows only |
| `property_activity` | view/call/message/meeting analytics | insert open (anon tracking, flagged in advisor); owner read |
| `property_views` | legacy, unused by app | locked (owner read only) |
| `ai_usage` | AI rate-limit ledger | RLS on, zero policies — service-role only |

Storage: `property-images`, `avatars` — both public buckets, folder-scoped
(`<uid>/...`) insert/update/delete, no listing policy (advisor-clean).

## Edge Functions (deployed)

| Function | Purpose | Model / backend |
|---|---|---|
| `translate-property` | text → 8 languages | Google Translate + DeepL |
| `translate-description` | on-the-fly listing translation fallback | Google + DeepL |
| `ai-generate-listing` | Feature A: wizard copy generation | claude-sonnet-5 |
| `ai-parse-search` | Feature B: NL query → filters | claude-haiku-4-5 |
| `ai-listing-assistant` | Feature C: grounded per-listing chat | claude-haiku-4-5 |

AI functions require the `ANTHROPIC_API_KEY` secret (see DECISIONS.md); until
set they return `503 ai_unavailable` and the client falls back to non-AI paths.

## Feature Status

| Feature | Status |
|---|---|
| Browse / search / filters / map | live |
| Property detail + stored-i18n translation | live |
| Favorites | live |
| Listing wizard (draft → publish, images, video URL) | live |
| My listings + per-property analytics dashboard | live |
| Messaging (list + thread + realtime + unread) | live (v1, this pass) |
| Saved searches / wanted homes / leads (create via AddSheet) | live; no manage/view UI yet |
| Auth: email+password, email OTP, Google OAuth | live |
| Auth: Apple, LinkedIn OIDC | buttons live, provider consoles pending (DECISIONS.md §2–3) |
| AI: listing generator / NL search / listing assistant | built, behind flags, awaiting ANTHROPIC_API_KEY |
| Auto-translate listings (Feature E) | live (DeepL/Google pipeline, wizard button) |
| Viewings scheduling | schema only |
| Agent dashboard | placeholder |
| Smart recommendations, photo tagging, price insight | not started (price insight flagged in DECISIONS.md) |

## Open Business Questions

- Monetization: listing fees vs. subscriptions vs. boosts
- Agency-admin role scope
- Outlook/Microsoft OAuth in or out
- Role vocabulary cleanup: DB default `buyer` vs. signup `client` (DECISIONS.md §7)
- Free-tier auto-pause: upgrade vs. keep-alive (DECISIONS.md §1)
