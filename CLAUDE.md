# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This file is the stable index Claude reads every session — keep it lean. Deep specifics (full data model, live-vs-planned feature matrix, language list, open business questions) live in `shtepia-ime-overview.md`. If something here ever conflicts with those, fix the conflict — don't let two sources of truth drift apart. (`README.md`'s "legacy note" calling the mobile app a non-shipping prototype is one such conflict, already stale — see Repository shape below.)

## Role

Act as technical co-founder and principal engineer, not a code-completion tool. Bar: what a senior engineer at Airbnb, Zillow, Stripe, Linear, or Vercel would approve in review. If an approach is weak, say why and propose the better one before writing code. Design for where this is going — thousands of agencies, hundreds of thousands of listings — without gold-plating what nobody's asked for yet.

## Product

Shtëpia.ime ("My Home") is a multilingual real estate marketplace built by **Future Home Orange (FHO)**, Albanian-first, connecting buyers/renters, agents, and agencies across Albania — genuinely usable by diaspora (Italy, Germany, etc.) and foreign investors in their own language.

**Design/product bar** — study these, don't clone them:

- **Zillow** — trust-building UX around imperfect data: a clearly-labeled value estimate (Zestimate), an affordability calculator (BuyAbility), saved searches with personalized re-surfacing, agent-review pages, dual map/list search. Our own price-insight feature needs the same "estimate, not advice" framing already flagged for it.
- **Indomio.al / Immobiliare.it** (same network) — closest functional match: map search plus a reverse "buyer posts what they want" flow, functionally our `wanted_homes` table, already live in this exact market.
- **Duashpi.al** — largest Albanian portal by volume; a scale/SEO benchmark, not a UX one.
- **Airbnb / Compass / Notion / Linear** — whitespace, restraint, typography: the bar for cards, forms, and empty states.

## Repository shape — two apps, one Supabase backend

One `package.json`, two independently-shipping frontends against the **same** Supabase project (`xzzzhlwmzotibrxdqmcm`) — no mock data, no second backend, no forked schema:

- **Web** (deployed to Vercel) — Vite + React 19 + React Router DOM v7, feature-first under `src/`.
- **Mobile** (Expo, targeting an installed dev-client on Android/iOS, not a legacy prototype) — Expo SDK 54, React Native 0.81.5, `expo-router` (file-based, typed routes) at the repo root: `app/`, `components/`, `contexts/`, `hooks/`, `constants/`, `data/`, `lib/format.ts` + `lib/supabase.ts`.

Web is the design source of truth; mobile is expected to reach and hold visual/functional parity with it, adapted only where touch/native platform mechanics require it (see `CLAUDE_CODE_BRIEF.md` if present for the full parity spec). i18n locale files are **shared** — `src/i18n/locales/*.json` is imported directly by both `src/i18n/index.js` (web) and `i18n/index.ts` (mobile); never fork them per-platform.

Each app has its own Supabase client singleton (`src/lib/supabase.js` for web, `lib/supabase.ts` for mobile) — that's correct, not a violation of the "one client" rule below, which is per-app (never a second `createClient()` call *within* either app).

## Commands

Web:
- `npm run dev` — Vite dev server, http://localhost:5173
- `npm run build` — production build to `dist/`
- `npm test` — Node's built-in test runner over `tests/**/*.test.mjs`; run a single file with `npm test -- tests/aiSchemas.test.mjs`

Mobile:
- `npm run expo:lan` — start Metro; auto-detects the machine's real Wi-Fi LAN IP (`scripts/start-expo-lan.cjs`) instead of trusting Expo's own detection, which can pick a virtual adapter (Hyper-V, Bluetooth PAN) on this environment and hand the phone an unreachable address
- `npm run expo:go` — same, but forces Expo-Go-compatible mode. Needed because `expo-dev-client` is an installed dependency, which makes plain `expo start` (and `expo:lan`) target a custom dev-client deep link by default, not Expo Go — pass `--go` (or use this script) whenever the phone only has Expo Go installed
- `npm run expo:tunnel` — tunnel mode (ngrok-backed) when LAN isn't reachable (client isolation, different subnets)
- `npm run android` / `npm run ios` — `expo run:android` / `expo run:ios`, local native build. `ios` needs macOS + Xcode; not available on Windows — use EAS Build instead (`eas.json` already has a `development` profile: `developmentClient: true, distribution: internal`). Building an iOS dev-client via EAS requires a paid Apple Developer Program account — no free/local workaround exists once native modules or config plugins are involved (Expo Go remains free but drops any capability outside its fixed SDK, e.g. Apple Sign-In)
- `npx expo-doctor` — SDK/config compatibility checks; one persistent known-failure is expected (app.json native-config fields not syncing under EAS Build now that `android/` exists — see AUDIT.md)

Shared:
- `npx tsc --noEmit` — type-checks both apps from one `tsconfig.json`
- `npm run lint` — runs `expo lint` (ESLint) across the whole repo, not a web-only linter

## Tech Stack — Ground Truth

| Layer | Web | Mobile |
|---|---|---|
| Frontend | Vite + React 19 + React Router DOM v7 | Expo SDK 54 + React Native 0.81.5 + expo-router |
| Styling | Tailwind CSS | `StyleSheet` + `constants/theme.ts` tokens, hand-ported 1:1 from web's `--fho-*` CSS custom properties — update both when a token changes |
| Typography | `@import` Newsreader/Manrope/JetBrains Mono in `src/styles/theme.css` | Same three families via `@expo-google-fonts/*`, loaded in `app/_layout.tsx`'s `useFonts()` and gated behind the splash screen; family-name strings live in `constants/theme.ts`'s `Fonts` export. These are static per-weight font files, not variable fonts — pick the matching weight constant (`Fonts.sansBold`, etc.) rather than layering a `fontWeight` override on top |
| Backend | Supabase — Postgres, Auth, Storage, Edge Functions (shared by both apps) | same |
| i18n | i18next, JSONB per-listing translations, locale files shared with mobile | i18next, device-language detection, same shared locale files |
| Maps | Leaflet — not Google Maps, already decided | `react-native-maps` |
| Native gesture/motion | — | `react-native-gesture-handler` + `react-native-reanimated` (already installed; `GestureHandlerRootView` wraps the app in `app/_layout.tsx`) |
| AI | Anthropic API, always via Supabase Edge Functions, never client-side | same Edge Functions |

> **Web migration status (2026-07-04): LANDED, incl. preflight.** Router v7 (7.18.x), Tailwind v4 with **preflight enabled**, feature-first `src/`. Cascade is `theme < base < components < utilities`, pinned by the inline `<style>@layer …</style>` in `index.html` — it must stay there and stay first (module hoisting loads page CSS before `tailwind.css`, so without it the first `@layer components` block would re-order the cascade and preflight would clobber component CSS). All legacy stylesheets are wrapped in `@layer components`, so utilities now override them. Fully converted to utilities: NotFound, SkeletonCard, ImageLightbox, MyListings (`skeleton.css`/`lightbox.css` deleted). Convert the rest opportunistically when touching a screen — delete each CSS file once empty. Compat shims (`.page-title`, `.page-subtitle`, button cursor) live in `@layer base` in `src/styles/tailwind.css`.

Supabase project ref: `xzzzhlwmzotibrxdqmcm`. Don't add a new library for something Tailwind, an existing hook, or an already-installed native module already solves — ask first.

**Design tokens**: accent `#ff7d1a` → `#e85d00` gradient; light + dark theme, persisted; mobile-first at every breakpoint (web) / phone-first with tablet split-view adaptations (mobile app, via `hooks/use-responsive.ts`).

## File Structure

**Web** — feature-first: `src/features/<domain>/{components,hooks,api,types}`. Shared UI in `src/shared/`, cross-cutting hooks in `src/hooks/`, Supabase + Anthropic clients in `src/lib/`. A new feature gets a new folder under `features/`, not a grab-bag file in `shared/`.

**Mobile** — route files under `app/` (expo-router: file path = route), reusable screen-agnostic components under `components/` (`components/property/`, `components/ui/`, `components/map/`), React Context providers under `contexts/` (auth, favorites, filters, theme), cross-cutting hooks under `hooks/`. `lib/format.ts` mirrors `src/lib/format.js`'s helpers (`priceSuffixKey`, `listingBadgeKey`, `getLocalizedText`, `whatsappUrl`, `formatPrice`) — when one gains a case (e.g. a new listing type), update both, they're two files with parallel APIs, not code-shared.

## Roles

Two live roles, chosen at signup:

- **Klient** (buyer/renter) — browse, filter, search · save favorites · contact an agent via WhatsApp · request a viewing · post a "wanted" listing when nothing matches (`wanted_homes`) · view agent profiles.
- **Agjent** — create/edit/delete listings · upload photos and video · manage leads and inquiries · manage viewings · view analytics · mark sold/rented · feature a listing.

**Planned — don't refactor around, but don't block on either**: Agency-admin, Super Admin, Photographer, Property Owner, Developer/Builder, Mortgage Partner. Keep `role` an extensible field plus a permissions layer, not a two-way `if/else` — that's what lets these slot in later without a rewrite.

## Non-Negotiable Rules

Proven across every build pass — enforce on every one, both apps:

- **Supabase** — one client per app (import the singleton, never call `createClient()` again) · RLS on every table, tested as Klient **and** Agjent · no polling, use realtime subscriptions or one-shot fetches · never write to the DB inside render, only in event handlers or `useEffect`.
- **React** — every data-dependent component ships all 3 states, loading (skeleton) → error (retry) → empty · memoize expensive card/list components (`PropertyCard`, etc.) with `React.memo` · never `navigate()`/`router.push()` inside `useEffect` without a `useRef` one-shot guard.
- **i18n** — zero hardcoded UI strings, everything through `t('...')` · DB content translation goes through the `translate` Edge Function, cached · a key added on one platform's code path needs the underlying locale JSON key to exist for both, since the files are shared.
- **Security** — Anthropic key never in client code, Edge Functions only · photo/video uploads validate MIME type and size before upload (both apps do this client-side before the request, not just server-side) · storage bucket policies scoped by role, same as table RLS · AI Edge Functions rate-limit per user with a graceful fallback, not a silent failure.
- **Performance** — pagination 24 at a time via `.range()`, "Load more" appends, no unbounded fetches · web images always `loading="lazy" decoding="async"`; mobile images via `expo-image` · no `console.log` in shipped code, use the no-op-in-prod debug util.
- **Process** — match existing conventions in the file you're touching before introducing new ones · new work on a feature branch, never straight to `main`.

## Feature Request Protocol

When asked for a feature, work in this order — tight, not padded:

1. **Requirement** — restate it in a line or two, confirm scope.
2. **Where it lives** — feature-first path (and which app(s): web, mobile, or both).
3. **Data** — schema/RLS changes, or "none."
4. **Edge Function** — new/changed function, or "none."
5. **UX** — key calls: i18n keys, dark mode, mobile behavior (touch targets, safe areas, keyboard).
6. **Plan** — short step list.
7. **Code** — complete and compiling. No `// TODO`, no `// same as above`.
8. **Edge cases** — think like QA, not the happy-path author.
9. **Performance** — anything beyond the defaults above.
10. **Security** — anything beyond the defaults above.
11. **Future path** — one line on how this scales toward the planned roles.

## Don't Duplicate Here

- Full data model, feature status, language list, open business questions → `shtepia-ime-overview.md`
- Audit history / severity-ranked findings → `AUDIT.md`
- Pending human decisions & judgment-call log → `DECISIONS.md`
- Visual design system → `design-system/MASTER.md`

There is no `/godmode` skill file in this repo despite earlier documentation referencing one — running it will fail with "Unknown skill." The equivalent manual process (what actually shipped the audit passes in `AUDIT.md`): read-only diagnostics + live Supabase state gathered and written to `AUDIT.md` *before* any code change, findings classified (FIXED/DEFERRED/FALSE POSITIVE/NO ACTION REQUIRED/CONFIGURATION REQUIRED), only then fix — and only what the audit actually proved broken.

## Model Strategy in Claude Code

- Default: **Opus 4.8** for day-to-day work.
- Switch to **Fable 5** (`/model fable`) for big autonomous passes — multi-file migrations, long refactors, full-repo audits. It runs roughly 2x Opus's cost per token, so reserve it rather than defaulting to it.
- RLS/OAuth/security-adjacent steps may auto-reroute mid-run to Opus 4.8 — that's Fable 5's safety classifier, not a failure. `/model fable` switches back once you're past that step.

## Open Questions — Flag, Don't Guess

- Monetization model (listing fees vs. subscriptions vs. boosts)
- Full scope of the agency-admin role
- Whether Outlook/Microsoft OAuth is in scope
- Whether/when to pursue the paid Apple Developer Program account (blocks an installed iOS dev-client and any eventual App Store submission)

---
*Update as decisions land — keep this file true, not just thorough.*
