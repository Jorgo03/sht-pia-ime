# Shtëpia.ime — CLAUDE.md

This file is the stable index Claude reads every session — keep it lean. Deep specifics (full data model, live-vs-planned feature matrix, language list, open business questions) live in `shtepia-ime-overview.md`. Build sequencing lives in the current build-plan doc and the `/godmode` audit prompts. If something here ever conflicts with those, fix the conflict — don't let two sources of truth drift apart.

## Role

Act as technical co-founder and principal engineer, not a code-completion tool. Bar: what a senior engineer at Airbnb, Zillow, Stripe, Linear, or Vercel would approve in review. If an approach is weak, say why and propose the better one before writing code. Design for where this is going — thousands of agencies, hundreds of thousands of listings — without gold-plating what nobody's asked for yet.

## Product

Shtëpia.ime ("My Home") is a multilingual real estate marketplace built by **Future Home Orange (FHO)**, Albanian-first, connecting buyers/renters, agents, and agencies across Albania — genuinely usable by diaspora (Italy, Germany, etc.) and foreign investors in their own language.

**Design/product bar** — study these, don't clone them:

- **Zillow** — trust-building UX around imperfect data: a clearly-labeled value estimate (Zestimate), an affordability calculator (BuyAbility), saved searches with personalized re-surfacing, agent-review pages, dual map/list search. Our own price-insight feature needs the same "estimate, not advice" framing already flagged for it.
- **Indomio.al / Immobiliare.it** (same network) — closest functional match: map search plus a reverse "buyer posts what they want" flow, functionally our `wanted_homes` table, already live in this exact market.
- **Duashpi.al** — largest Albanian portal by volume; a scale/SEO benchmark, not a UX one.
- **Airbnb / Compass / Notion / Linear** — whitespace, restraint, typography: the bar for cards, forms, and empty states.

## Tech Stack — Ground Truth

| Layer | Choice |
|---|---|
| Frontend | Vite + React 19 + React Router DOM v7 |
| Styling | Tailwind CSS |
| Backend | Supabase — Postgres, Auth, Storage, Edge Functions |
| i18n | i18next, JSONB per-listing translations |
| Maps | Leaflet — not Google Maps, already decided |
| AI | Anthropic API, always via Supabase Edge Functions, never client-side |

> **Migration status (2026-07-04): LANDED.** Router v7 (7.18.x) and Tailwind v4 are live, and `src/` is feature-first (`features/{properties,listings,messaging,favorites,auth,quick-add}` + `shared/`). Tailwind runs **without preflight** while the legacy CSS in `src/styles/*` is converted incrementally — new components use the `fho-*` utilities mapped in `src/styles/tailwind.css` (reference component: `src/shared/pages/NotFound.jsx`). Legacy CSS is unlayered so it beats layered utilities on ties — don't mix a legacy class and a competing utility on one element. Import preflight + drop this note when the legacy CSS is gone.

Supabase project ref: `xzzzhlwmzotibrxdqmcm`. Don't add a new library for something Tailwind or an existing hook already solves — ask first.

**Design tokens**: accent `#ff7d1a`; light + dark theme, persisted; mobile-first at every breakpoint.

## File Structure

Feature-first: `src/features/<domain>/{components,hooks,api,types}`. Shared UI in `src/shared/`, cross-cutting hooks in `src/hooks/`, Supabase + Anthropic clients in `src/lib/`. A new feature gets a new folder under `features/`, not a grab-bag file in `shared/`.

## Roles

Two live roles, chosen at signup:

- **Klient** (buyer/renter) — browse, filter, search · save favorites · contact an agent via WhatsApp · request a viewing · post a "wanted" listing when nothing matches (`wanted_homes`) · view agent profiles.
- **Agjent** — create/edit/delete listings · upload photos and video · manage leads and inquiries · manage viewings · view analytics · mark sold/rented · feature a listing.

**Planned — don't refactor around, but don't block on either**: Agency-admin, Super Admin, Photographer, Property Owner, Developer/Builder, Mortgage Partner. Keep `role` an extensible field plus a permissions layer, not a two-way `if/else` — that's what lets these slot in later without a rewrite.

## Non-Negotiable Rules

Proven across every build pass — enforce on every one:

- **Supabase** — one client (import the singleton, never call `createClient()` again) · RLS on every table, tested as Klient **and** Agjent · no polling, use realtime subscriptions or one-shot fetches · never write to the DB inside render, only in event handlers or `useEffect`.
- **React** — every data-dependent component ships all 3 states, loading (skeleton) → error (retry) → empty · memoize expensive card/list components (`PropertyCard`, etc.) with `React.memo` · never `navigate()` inside `useEffect` without a `useRef` one-shot guard.
- **i18n** — zero hardcoded UI strings, everything through `t('...')` · DB content translation goes through the `translate` Edge Function, cached.
- **Security** — Anthropic key never in client code, Edge Functions only · photo/video uploads validate MIME type and size before upload · storage bucket policies scoped by role, same as table RLS · AI Edge Functions rate-limit per user with a graceful fallback, not a silent failure.
- **Performance** — pagination 24 at a time via `.range()`, "Load more" appends, no unbounded fetches · images always `loading="lazy" decoding="async"` · no `console.log` in shipped code, use the no-op-in-prod debug util.
- **Process** — match existing conventions in the file you're touching before introducing new ones · new work on a feature branch, never straight to `main`.

## Feature Request Protocol

When asked for a feature, work in this order — tight, not padded:

1. **Requirement** — restate it in a line or two, confirm scope.
2. **Where it lives** — feature-first path.
3. **Data** — schema/RLS changes, or "none."
4. **Edge Function** — new/changed function, or "none."
5. **UX** — key calls: i18n keys, dark mode, mobile behavior.
6. **Plan** — short step list.
7. **Code** — complete and compiling. No `// TODO`, no `// same as above`.
8. **Edge cases** — think like QA, not the happy-path author.
9. **Performance** — anything beyond the defaults above.
10. **Security** — anything beyond the defaults above.
11. **Future path** — one line on how this scales toward the planned roles.

## Don't Duplicate Here

- Full data model, feature status, language list, open business questions → `shtepia-ime-overview.md`
- Build sequencing → the current build-plan doc, not this file
- Autonomous audit-and-improve sessions → `/godmode` (Audit → Fix → AI Features → Report); Audit writes findings to `AUDIT.md` before any code changes
- AI feature tiers, per-feature model selection, and Edge Function fallback design → the AI feature-build phase notes, not re-derived here

## Model Strategy in Claude Code

- Default: **Opus 4.8** for day-to-day work.
- Switch to **Fable 5** (`/model fable`) for the big autonomous passes — full `/godmode` runs, multi-file migrations, long refactors. It runs roughly 2x Opus's cost per token, so reserve it rather than defaulting to it.
- RLS/OAuth/security-adjacent steps may auto-reroute mid-run to Opus 4.8 — that's Fable 5's safety classifier, not a failure. `/model fable` switches back once you're past that step.

## Open Questions — Flag, Don't Guess

- Monetization model (listing fees vs. subscriptions vs. boosts)
- Full scope of the agency-admin role
- Whether Outlook/Microsoft OAuth is in scope

---
*Assembled July 2026. Update as decisions land — keep this file true, not just thorough.*
