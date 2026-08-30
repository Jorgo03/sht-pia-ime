# Pre-Launch Audit — Shtëpia.ime (Vite web app)

## ═══ PASS 12 — 2026-08-29: QUALITY PASS II (ergonomics, flagged items) ═══

Second run of `QUALITY-PASS.md`, scoped to what Pass 11 under-covered plus the
items it explicitly left flagged. Also covers the nav change applied from
`IMPLEMENTATION.md` §1 in the same session.

### Categories re-audited and found already sound (no action)

Worth recording so a third pass does not re-litigate them:

- **Fragile / double-submit** — `Profile.jsx` guards with an explicit
  `if (loading) return` *inside* the handler, with a comment noting that a
  disabled CTA only stops the mouse while the password inputs still fire the
  same handler from `onKeyDown` Enter. AddSheet's three submit paths all hold a
  `loading` flag.
- **Enter-to-submit** — the web app has no `<form>` elements at all, which
  looked like a gap; it is wired per-input via `onKeyDown`, including the OTP
  screen and the password-recovery screen.
- **Incomplete / focus states** — `polish.css` §5 sets one `:focus-visible`
  ring (`--fho-ring`, 2px, offset 2px) across button/a/input/textarea/select/
  `[role=button]`, with a tighter offset for text fields.
- **Alt text** — every `<img>` in `src/` has one (re-confirmed).

### Fixed

| Sev | Problem | Fix |
|---|---|---|
| Degrades | **`PropertyDashboard` dropped its query error.** `.then(({ data }))` discarded `error`, so a failed fetch left `activity` empty and rendered a *real-looking* dashboard reading zero views, zero calls, zero leads. An agent would conclude their listing was getting no interest rather than that the query broke — the same silent-failure class as Pass 11's Search bug, on the one screen where the number *is* the product | Capture the error, dedicated error card + retry (`errors.generic` / `common.retry`, both already in all 8 locales) |
| Cosmetic | Touch targets below the 44px minimum, measured at 375px: `.heart-mini` 24×24 (search), `.compact-card__heart` 30×30 (home carousel), `.field-eye` 26×26, `.auth-forgot` 47×19. Favouriting is a primary action | `polish.css` §11: centred `::after` at `max(100%, 44px)`, so the hit area grows and **nothing moves or repaints**. Verified by hit-testing points 18px off-centre and by confirming no neighbouring control loses its own centre |
| Cosmetic | 3 unused imports (`useState` in `Home.jsx`, `Phone`/`MessageCircle` in `PropertyDetail.jsx`) | Removed. Lint warnings 15 → 12 |

### Regression I introduced and caught

The first version of the touch-target rule set `position: relative` on all four
selectors. Three of them (`.heart-mini`, `.compact-card__heart`, `.field-eye`)
are already `position: absolute` with `top`/`right` pinning, and `polish.css`
is imported last — so it won the tie and **knocked every card heart out of its
corner into normal flow at the top-left**. Caught on the screenshot, not by
reasoning. An absolutely-positioned element already establishes a containing
block for its `::after`, so the line was unnecessary as well as wrong; it now
applies only to `.auth-forgot`. Re-verified: hearts back at 6px/6px from the
card's top-right, hit area still expanded.

### Theme tokens from IMPLEMENTATION.md §1 (values only)

The spec's `theme.css` is a whole-file REPLACE that would drop `@layer base`
and 9 tokens carrying 74 live `var()` references, so only its **values** were
taken, into the existing structure:

- Dark theme is now a warm dusk rather than near-neutral charcoal —
  `--fho-bg #141210 → #0e0b09`, surface `#1e1b18 → #1a1612`, surface-2
  `#252220 → #221d18`, text `#f0ece6 → #faf6ef`, and muted/faint moved from a
  neutral to a warm cast (`rgba(255,235,210,…)`).
- Status palette moved from the saturated web-safe set to the spec's earthy one
  (`--fho-status-active #27ae60 → #5b8a5a`, paused `#f39c12 → #d4a23a`, rented
  `#8e44ad → #8a4d80`, draft `#7f8c8d → #7f7a72`).
- Added `--fho-danger` and `--fho-text-on-dark-dim`; `--fho-input-bg` /
  `--fho-input-border` now take literal values instead of aliasing surface-2 /
  border-strong; Newsreader is loaded on its `opsz` axis with 700 available.

**Contrast measured before/after, both themes** (the reason for taking values
rather than trusting them): dark *improved* — text/bg 18.21, text-muted/bg
**5.53** (passes AA), orange-1/bg 7.66.

Two spec omissions deliberately not followed:
- The spec's dark block does not override `--fho-orange-tint`, which would let
  the light `#fff1e6` bleed through — a near-white chip on a near-black ground.
  The existing `rgba(255,125,26,0.12)` override was kept.
- The spec defines status colours only under `:root`. The app's separate,
  brighter dark-theme variants were kept; inventing warm dark equivalents would
  breach CLAUDE_CODE_BRIEF's "never invent design tokens".

### Nav change from IMPLEMENTATION.md §1 (same session)

`liquid-nav.css` was replaced with the spec's version — the one §1 file whose
selectors match what `BottomNav.jsx` actually renders. Active item is now a
filled orange gradient pill with a white glyph; the `[+]` gained a 4px
surface-coloured ring. Two integrations the spec could not know about:

- The old active indicator was a 4px dot in `polish.css` drawn in
  `currentColor` — white once the pill landed, so it read as a speck inside the
  pill. Removed, along with its now-orphaned `navDotIn` keyframes.
- **The spec contains a specificity bug.** Its
  `[data-theme="dark"] .nav-item { color: rgba(255,255,255,0.55) }` ties
  `.nav-item.active` at (0,2,0) and comes later, so in dark mode the active
  glyph rendered at 55% white on an orange pill. Measured, then fixed with an
  explicit `[data-theme="dark"] .nav-item.active { color: #fff }`.

### Still flagged, deliberately untouched

- Signed-in routes (`/my-listings`, `/my-listings/:id/dashboard`,
  `/agent-dashboard`, `/new-listing`, `/viewings`, `/saved-searches`) remain
  **statically reviewed only** — exercising them needs real credentials this
  pass does not have. The `PropertyDashboard` fix above is therefore verified by
  build/lint/type-check, not by seeing it render.
- `.theme-btn` (34×34) and `.featured-card__heart` (38×38) are under 44px but
  are sizes `CLAUDE_CODE_BRIEF.md` §3.7 / §3.2 specify outright — design
  decisions, left alone.
- The "me qera" listing tagged FOR SALE is still a data-entry issue, not code.
- **Pre-existing, not introduced here:** light-theme `--fho-text-muted` on
  `--fho-bg` measures **3.8:1**, under the 4.5:1 AA floor for body text (dark is
  fine at 5.53). Those two light values are byte-identical before and after this
  pass. Fixing it means darkening a token the spec does not change — a design
  call, flagged rather than taken.

### Verification

`npm test` 93/93 · `npx tsc --noEmit` clean · `npm run lint` 0 errors /
12 warnings (was 15) · `npm run build` clean · nav and hearts screenshotted in
both themes at 375px.

---

## ═══ PASS 11 — 2026-08-28: QUALITY PASS (silent failures, error states) ═══

Run against `QUALITY-PASS.md`. Not a redesign pass: no page was restyled, no
schema/RLS/auth config was touched, no working logic was rewritten.

### Two handed-over specs were deliberately NOT applied

`IMPLEMENTATION.md` and `WAVE-2-HOME.md` were provided alongside
`QUALITY-PASS.md`. Both are stale against this repo and applying them verbatim
would have broken the app:

- **`IMPLEMENTATION.md`** is Wave 1, already shipped in better form. Its REPLACE
  targets (`src/pages/Profile.jsx`, `src/components/BottomNav.jsx`,
  `src/contexts/AddSheetContext.jsx`, …) no longer exist — the repo moved to
  feature-first. Its `App.jsx` imports `./pages/Home` and `./contexts/AuthContext`
  (neither exists → white screen), drops `ProtectedRoute` from 8 routes (making
  `/new-listing`, `/my-listings`, `/agent-dashboard` public — an auth bypass),
  and deletes `/auth/callback` (breaking Google sign-in). Its `theme.css` drops
  the `@layer base` wrapper and 9 tokens with **74 live `var()` references**.
- **`WAVE-2-HOME.md`** states in its own §3 that it was written without sight of
  `Home.jsx`. Its chips + 2-col-grid design contradicts `CLAUDE_CODE_BRIEF.md`
  §3.2, which is what is actually built.

### Phase 0 — route status (signed-out sweep, 430×920)

| Route | Renders | Notes |
|---|---|---|
| `/` | ok | editorial head, featured, carousels |
| `/search` | ok | 3 homes, filter sheet, map toggle |
| `/favorites` `/messages` `/profile` | ok | gate to auth |
| `/agent-dashboard` `/my-listings` `/new-listing` `/viewings` `/saved-searches` | ok | gate to auth via `ProtectedRoute` |
| `/property/:id` | ok | valid-but-missing id → "No properties found" |
| `/agent/:id` | **was broken** | see below |
| unknown route | ok | 404 page |

### Fixed

| Sev | Problem | Fix |
|---|---|---|
| Blocks | **Search silently lied when the query failed.** `Search.jsx` destructured everything from `useProperties` *except* `error`, so a failed fetch left `properties` empty and rendered the *empty* state — "No properties found / Try adjusting your search filters". The visitor retunes filters forever against a database error. Proven by forcing a 500 on `/rest/v1/properties` | Destructure `error`; render an error branch **before** the empty branch, reusing the existing `.empty-state` shell + `errors.generic` + `common.retry` (both already in all 8 locales). No new CSS |
| Blocks | Same bug on mobile: `app/(tabs)/explore.tsx` ignored react-query's `isError` | Destructure `isError`/`refetch`, error branch before the list, mirroring the web fix and the existing `app/(tabs)/index.tsx` error card |
| Degrades | **`/agent/:id` rendered a bare word: "Error".** `.single()` on a user-supplied id rejects with PGRST116 for a removed/nonexistent agent, leaving `agent` null → `t('common.error')`. Both query errors were also discarded, so a network failure and "no such agent" were indistinguishable. No way out of the dead end | `.maybeSingle()`; separate error vs not-found states; `notFound.*` (already in all 8 locales) for not-found and `errors.generic` for real failures; `BackButton to="/search"` on both — this page is reachable from a shared link with no in-app history |
| Degrades | `app/agent/[id].tsx` had the identical defect (its own comment says "Same shape as the web app's AgentProfile.jsx") | Same fix, for parity |
| Degrades | `app/messages/index.tsx` discarded the conversations fetch error → an agent whose leads failed to load was told they had no conversations | Capture the error, dedicated error state + retry reusing the home screen's `retryText` treatment |
| Degrades | `t('listing.priceLabel')` printed the literal string **"listing.priceLabel"** above the price on every mobile property detail page, in all 8 languages. Key never existed (`listing.price` does). Also required by `CLAUDE_CODE_BRIEF.md` §5 | Added to all 8 locales |
| Degrades | `t('auth.signIn')` printed **"auth.signIn"** on the sign-in Alert button. The `auth` namespace has `signInTitle`/`signInWith`/`signInWithEmail`, never a bare `signIn` | Call site → `common.signIn`, already translated in all 8. No duplicate key added |
| Cosmetic | `listing.latitude`, `listing.longitude`, `map.webUnavailableTitle`, `map.webUnavailableHint` shipped hardcoded English defaults, so non-English users read "Latitude" | Translated into all 8 locales |

### Verified clean (no action)

- **i18n parity**: 448 leaf keys × 7 non-English locales — **0 missing, 0 empty**.
  The apparent "orphans" in `pl`/`ru`/`it` are CLDR plural forms (`_few`, `_many`)
  those languages require and English cannot have — **do not delete them**. The
  two `fr` strings identical to English ("Conversations", "Notifications") are
  genuinely the same word in French.
- No raw i18n key leaks in any route × {en, sq} after the fixes.
- No horizontal scroll on any route at 430×920 (`scrollWidth === clientWidth`).
- `console.log` in `contexts/auth-context.tsx` is `__DEV__`-gated — not a violation.
- Every `<img>` in `src/` has `alt`.
- Remaining 12 `.single()` calls are `INSERT…select().single()` (row always
  exists) or already guarded — checked individually, not pattern-matched.

### Flagged, deliberately not fixed

- `PropertyDashboard.jsx` has no error state — a failed analytics fetch renders
  as zeroed charts. Lower stakes than the list surfaces above; own-listing
  analytics sub-page. Left for a follow-up rather than widening this diff.
- Unused imports: `useState` in `Home.jsx`, `Phone`/`MessageCircle` in
  `PropertyDetail.jsx` (lint warnings, not user-visible).
- Signed-in flows were **not** exercised — that needs real credentials, which
  this pass does not have. Everything above is signed-out or static.
- A listing titled "Apartament 1+1 **me qera**" (for rent) is tagged FOR SALE at
  €150,000. Data-entry issue in the row, not a code bug — unchanged from earlier
  passes.

### Verification

`npm test` 93/93 · `npx tsc --noEmit` clean (gates mobile) · `npm run lint`
0 errors / 15 pre-existing warnings (gates web) · browser sweep of 13 routes
with a forced-failure test on the Search fix.

---

## ═══ PASS 10 — 2026-08-22: AUTH RE-AUDIT (logout races, event coverage) ═══

Follow-up to Pass 9, scoped to authentication. The database foundation and
the mobile fixes from the previous pass were re-checked and left alone.

### `npx tsc --noEmit` does NOT cover the web app — use `npm run lint`

Worth correcting, because several earlier passes (including Pass 9) reported
"tsc clean" as though it validated both apps. `tsconfig.json`'s `include` is
`**/*.ts` / `**/*.tsx` only, and the entire Vite app is `.jsx`. Proven
empirically: deleting `useRef` from `AuthContext.jsx`'s import left
`tsc --noEmit` completely silent, while `npm run lint` failed with
`'useRef' is not defined  no-undef`.

**`tsc` gates mobile. `npm run lint` gates web. Both must be run.**

### Fixed

| Sev | Problem | Fix |
|---|---|---|
| P2 | **Logout could resurrect the signed-out user, in both apps.** `generation` lived inside the auth `useEffect` closure, so `signOut()` could not bump it. A profile fetch already in flight still matched the current generation and committed on top of the cleared state — the user reappeared until `SIGNED_OUT` arrived and cleared it a second time | `generation` is now a `useRef` at component scope; `signOut()` bumps it *before* clearing, invalidating in-flight work |
| P2 | Mobile `signOut()` cleared state **only** via the `SIGNED_OUT` event, unlike web which also cleared directly | Clears synchronously as well, so sign-out no longer depends on event delivery |
| P3 | Both apps discarded `signOut()`'s error entirely | Returned to the caller. The local session is dropped regardless, so callers surface it without blocking |
| P3 | `USER_UPDATED` was unhandled by the shared classifier, so after `updateUser()` (password change, which rotates tokens) the context kept the superseded session object | Classified as `sync`. No call site reads `session.access_token` directly — everything goes through the supabase client, which tracks the new token itself — so nothing was breaking today, but it would the moment an email change is added |

### Email delivery — precise diagnosis

`over_email_send_rate_limit` is **GoTrue's own per-hour limiter**, applied
*before* any SMTP handoff. That is why configuring Resend did not clear it.
Supabase's docs confirm the built-in service carries an hourly cap; the
governing setting is **Authentication → Rate Limits → "Rate limit for
sending emails"**, which is separate from the SMTP provider config and stays
low by default even once Custom SMTP is enabled.

Not an application bug — no code change made, and none is appropriate.
`auth_logs` could not be consulted: `query_logs` has returned a Supabase-side
`Backend error!` on every attempt across three separate sessions.

### Verification

`npm test` 45/45 (2 new `USER_UPDATED` cases) · `npm run lint` 0 errors ·
`npx tsc --noEmit` clean · `npm run build` clean · iOS Metro bundle 200 ·
live browser: fresh load of `/profile`, zero console errors.

## ═══ PASS 9 — 2026-08-22: FULL-APP AUDIT (i18n, crash safety, realtime) ═══

Whole-application sweep, both apps. Everything below was reproduced before
being changed, and every fix re-verified afterwards — the new tests were each
run against the *un*fixed code first to confirm they actually fail.

### Corrects an earlier mistaken finding

Pass 7's notes recorded "missing `home.*` keys in `pl.json`" as an unrelated
locale gap. That reading was backwards. `pl.json`/`ru.json` were the only two
files that were **correct**: they carried the `_one`/`_few`/`_many` categories
Polish and Russian require. The other six locales were the broken ones — they
had a single bare key and no plural variants at all.

### Fixed

| Sev | Problem | Fix |
|---|---|---|
| P2 | `search.results` had no `_few`/`_many` in pl/ru, so those counts fell through `fallbackLng: 'sq'` and rendered **Albanian** ("5 prona") to Polish and Russian users | Added the missing categories to both locales |
| P2 | `components/map/map-screen-content.tsx` called `t('search.results_other', {count})` — naming a plural suffix pins one category regardless of count and never reaches `few`/`many` | Switched to the base key. Note the two are coupled: fixing only this would have *surfaced* the Albanian fallback above |
| P2 | No React error boundary anywhere in the web app — any uncaught render error unmounted the tree to a blank white page | `src/shared/ErrorBoundary.jsx`, wired in `main.jsx`. Verified with a real injected render throw |
| P2 | Mobile relied on expo-router's built-in fallback, which renders `Error: {error.message}` with no `__DEV__` guard — raw internal error text shown to production users, in English | `components/ui/error-boundary.tsx`, exported as `ErrorBoundary` from `app/_layout.tsx` |
| P2 | `useUpcomingViewings` polled every 5 min, against the repo's own "no polling" rule | Converted to `postgres_changes`. **`public.viewings` was not in the `supabase_realtime` publication** — a naive conversion would have silently killed the bell, so migration `20260823180919` adds it first |
| P2 | `lib/supabase.ts` used `!` non-null assertions on env vars, so a missing value surfaced as an opaque failure inside supabase-js | Explicit check naming both vars, matching what `src/lib/supabase.js` already did |
| P3 | `home.matchesToday`, `favourites.savedCount`, `messages.client.kicker`, `search.showHomes` had no plural forms → "1 new matches today.", "Show 1 homes" | Plural categories added per language, read from i18next's own `pluralResolver` rather than hardcoded |
| P3 | `search.homesInView` and `property.beds`/`baths` — same bug in a shape the first sweep missed: the number is a separate styled node, so the string never contains `{{count}}` → "1 homes in view", "1 beds" | `count` still selects the category. `beds`/`baths` also double as **form labels**, so they got separate `bedsCount`/`bathsCount` keys rather than being converted in place |
| P3 | `sq.favourites.headlinePre` was the only empty string across all 8 locales; RN does not collapse the literal space in `{pre} <em>{em}</em>`, so Albanian shipped a stray leading space | Split "Lista jote" into `Lista` + `jote` |
| P3 | `FeaturedCard`/`Avatar` images missing `loading="lazy"`/`decoding="async"` that `PropertyCard` already set | Added |
| P3 | `home.homesCount` — zero references repo-wide | Removed (recoverable from git) |

### New regression tests (`tests/localePlurals.test.mjs`, +`localeSync.test.mjs`)

Required plural categories per language · no cross-language fallback at
runtime · no `t()` call naming a plural suffix · base-keyset parity with
suffixes normalised · no empty string in any locale. Each was confirmed to
fail against the pre-fix code.

### Checked and found sound (no action)

`ai_usage` RLS-with-no-policy is correct — it is written only by Edge
Functions via the service role, which bypasses RLS · no secrets in client
code (Edge Functions read `SUPABASE_SERVICE_ROLE_KEY` from `Deno.env`) ·
only `.env.example` is tracked · the two remaining `setInterval`s are OTP
resend countdowns, not polling · empty `catch {}` blocks are legitimate
`localStorage` guards · `PropertyCard`/`FeaturedCard` are `React.memo`'d ·
auth guards redirect correctly and `/404` renders · zero console errors on
load · the `zona`/`id-referenca` TODOs are honest, documented blockers on a
missing `zone` column, and the UI correctly does not offer a dead control.

### Verification

`npm test` 43/43 · `npx tsc --noEmit` clean · `npm run build` clean ·
`npm run lint` 0 errors / 16 pre-existing warnings (unchanged) ·
`npx expo-doctor` 17/18 (the one known app.json-vs-prebuild drift) ·
Metro bundle HTTP 200 on both `ios` and `android` · live browser: plural
output confirmed through the app's real i18n instance in 6 languages, and
the crash screen confirmed rendering localised in both English and Albanian.

### Not fixed, deliberately

- `messages.agent.kicker` interpolates **two** quantities (`{{leads}}`,
  `{{newToday}}`); i18next can only pluralise on one, so "1 active leads"
  remains. Needs a copy rewrite, not a code fix.
- `app/listing/create.tsx` (1136 lines) is unreachable by navigation — only
  `listing/new.tsx` is linked — but it is still registered in `_layout.tsx`
  and its own comments say it is deliberately retained. Flagged, not deleted.
- Unindexed FKs / unused indexes from the performance advisor: the unused
  ones simply reflect low traffic, and a prior migration deliberately indexed
  only *verified* query patterns. Removing or adding blindly would be worse.
- Root-level `test-*.cjs` / `test-*.png` scratch files are untracked; deleting
  untracked files is unrecoverable, so they were left alone.

## ═══ PASS 8 — 2026-08-19: EXPO SDK 54 → 57 UPGRADE — REVERTED ═══

Attempted to fix "app stuck on Expo, wants an update" by upgrading SDK 54 →
57 (root cause: Expo Go only runs the current SDK, and this project had
fallen three majors behind). Upgrade succeeded — fresh bundle fetches for
both platforms returned 200, live browser smoke test through tab navigation
and a property detail screen all worked, `tsc`/`expo-doctor`/build/tests all
clean. **Reverted at owner's request** in a follow-up commit (`git revert`
of `2e49e9a`, which had already been pushed) — owner confirmed understanding
this restores the original "Expo Go can't open the project" problem before
asking for the revert. `DECISIONS.md`'s unrelated Google OAuth checklist
(added in the same original commit) was deliberately kept, not rolled back
with the rest.

If mobile testing needs to work again, the fix is the same upgrade —
`npm install expo@^57.0.0 && npx expo install --fix` plus the breaking-change
fixes already worked out once (see this pass's commit history for the exact
diffs, since this section itself was reverted along with the code).

## ═══ PASS 7 — 2026-08-18: AUTHENTICATION RE-AUDIT (owner super-prompt) ═══

Scope per owner request, unchanged from Pass 6: auth and Login/Sign Up only.
Re-read `contexts/auth-context.tsx` (mobile), `src/features/auth/AuthContext.jsx`
(web), `ProtectedRoute.jsx`, `AuthCallback.jsx`, both Profile screens, and the
role-consuming call sites across mobile end-to-end against the owner's
checklist before touching anything, rather than assuming Pass 6 was still
complete. Three of the four items below were already correct; the fourth
(role source on mobile) was a real, previously-undiscovered gap.

### Status

| Method | UI | Backend | Callback | Session | Status |
|---|---|---|---|---|---|
| Email + Password | ✅ | ✅ | n/a | ✅ | **Fully working** |
| Google | ✅ | ✅ | ✅ | ✅ | **Fully working** — role now correctly reaches `profiles` on mobile too (see GAP 1) |
| Apple | ✅ | ✅ | ✅ (shared) | ✅ once enabled | **App code complete; blocked on external config** (unchanged from Pass 6) |
| LinkedIn | ✅ | ✅ | ✅ (shared) | ✅ once enabled | **App code complete; blocked on external config** (unchanged from Pass 6) |
| Email 6-digit Code | ✅ | ✅ | n/a | ✅ | **Fully working** |
| Sign Up | ✅ | ✅ | n/a | ✅ | **Fully working** on both platforms, all four entry paths |

### Findings

**GAP 1 (mobile, real, pre-existing) — role was read from `user.user_metadata.role`
instead of the `profiles` table, and OAuth/email-code signups never claimed a
role at all.** Web's `AuthContext.jsx` has always treated `profiles.role` as
the single source of truth: it fetches the profile row on every session sync,
and for OAuth/OTP signups — which can't carry a custom `role` field through a
provider redirect or a magic-link email — it stashes the toggle the user
picked (`localStorage['fho_pending_role']`) before the redirect and claims it
afterward via the `claim_role` RPC once a session lands (5-minute window, new
accounts only). Mobile's `contexts/auth-context.tsx` never fetched `profiles`
at all — it exposed only the raw Supabase auth `user` — and three call sites
(`app/(tabs)/profile.tsx`, `hooks/use-profile-stats.ts`,
`app/messages/index.tsx`) independently computed `isAgent` from
`user.user_metadata?.role`. That field is populated only by the password-signup
path (`signUp()`'s own `options.data.role`); Google/Apple/LinkedIn never set
it, and Supabase doesn't sync the RPC's `profiles.role` write back into auth
metadata. Net effect: **every agent who signed up via Google/Apple/LinkedIn on
mobile was permanently shown and treated as a buyer** — wrong role badge,
wrong stat card, wrong messages inbox unread column/copy, and the Agent
Dashboard link never appeared, with no way to fix it from within the app,
because mobile also never stashed a pending role before those redirects in
the first place. This was live and would have hit any real mobile OAuth agent
signup — not a hypothetical.

Fixed by porting web's exact architecture: `contexts/auth-context.tsx` now
fetches the `profiles` row on every session sync, runs `applyPendingRole`
(same RPC, same 5-minute/new-account guard, using `AsyncStorage` in place of
`localStorage`), and exposes `profile`/`isAgent`/`isClient`/`refreshProfile`
on the context. `app/(tabs)/profile.tsx`'s `handleProvider` and `handleSendOtp`
now stash `fho_pending_role` before their respective redirects, mirroring
web's `handleProvider`/`handleSendOtp` exactly (including clearing a stale
stash before a password signup, so an abandoned OAuth click can't leak a role
choice into it). The three call sites now read `isAgent`/`profile` from
context instead of re-deriving it from metadata.

**GAP 2 (both platforms, minor, real) — email wasn't trimmed before
validation or submission.** A pasted email with leading/trailing whitespace
failed the `EMAIL_RE` regex outright (`^[^\s@]+...`) and surfaced a false
"invalid email" instead of being silently cleaned up, which is standard
practice everywhere else. Fixed in both `validate()`/`validateAuth()` (test
the trimmed value) and every submit path (`handleAuth`, `handleSendOtp`,
`handleResend`, `handleForgotPassword` and mobile's equivalents) — trimmed
once, then written back into state so downstream handlers on the same screen
stay consistent. Worth noting live-testing found this mostly moot on desktop
web: `<input type="email">` already strips whitespace at the DOM level before
React ever sees it (verified directly in the browser). React Native's
`TextInput` has no such built-in sanitization, so this was a live, unmitigated
bug on mobile specifically; the web-side fix is defense-in-depth for engines
that don't sanitize (older WebViews, Expo's own web target).

**Everything else re-verified, no regression, nothing to redo:** session
restoration / welcome-toast dedup / redirect race (web); `onAuthStateChange`
listener cleanup (both); `handle_new_user` trigger idempotency; storage
config (`AsyncStorage`, `flowType: 'pkce'`, `persistSession`,
`autoRefreshToken`); double-submit guards (`disabled={loading}` on every
submit button, both platforms); show/hide password toggle (both platforms,
pre-existing); `ProtectedRoute`'s loading/redirect/role-gate logic;
`AuthCallback`'s `settled` ref + 15s timeout + `getSession()`-then-listener
race handling; friendly, localized error mapping on all 6 mobile call sites
and web's equivalent; confirm-password field and 2×2 social-button grid
(Pass 6); Apple/LinkedIn buttons restored and still correctly blocked only by
external provider config, not app code (re-confirmed live below).

```
GET /auth/v1/authorize?provider=google        -> 302 accounts.google.com  (enabled)
GET /auth/v1/authorize?provider=apple         -> 400 provider is not enabled
GET /auth/v1/authorize?provider=linkedin_oidc -> 400 provider is not enabled
```

### External configuration required (unchanged from Pass 6 — no invented values)

**Apple** — Provider: Apple. Missing: Apple Developer Program enrollment +
Services ID + Sign In with Apple key, plus the Supabase Dashboard provider
toggle. Where: Apple Developer console, then Supabase Dashboard →
Authentication → Providers → Apple. Redirect URL:
`https://xzzzhlwmzotibrxdqmcm.supabase.co/auth/v1/callback`. Full checklist:
DECISIONS.md §2.

**LinkedIn** — Provider: LinkedIn (OIDC). Missing: a LinkedIn Developer app
with the "Sign In with LinkedIn using OpenID Connect" product, plus the
Supabase Dashboard provider toggle (the **LinkedIn (OIDC)** entry
specifically, not the deprecated plain "LinkedIn" one). Where: LinkedIn
Developer portal, then Supabase Dashboard → Authentication → Providers.
Redirect URL: `https://xzzzhlwmzotibrxdqmcm.supabase.co/auth/v1/callback`.
Full checklist: DECISIONS.md §3.

No code changes needed on either once the dashboard toggles are on — Google
already proves the exact same app-side code path end-to-end.

### Files changed

- `contexts/auth-context.tsx` — added `Profile` type, `loadProfile`,
  `applyPendingRole` (ported from web, `AsyncStorage` in place of
  `localStorage`), rewrote the session-sync effect to fetch/refresh the
  profile on every auth event, added `profile`/`isAgent`/`isClient`/
  `refreshProfile` to the context value and its type.
- `app/(tabs)/profile.tsx` — destructure `profile`/`isAgent` from context
  instead of computing a local `isAgent` from `user.user_metadata`; `handleProvider`
  and `handleSendOtp` now stash `fho_pending_role` via `AsyncStorage` before
  their redirects (and `handleAuth`'s password-signup path clears a stale
  stash first); `displayName` now prefers `profile?.full_name`, matching
  web; email trimmed in `validateAuth` and every submit path.
- `hooks/use-profile-stats.ts` — reads `isAgent` from `useAuth()` instead of
  `user.user_metadata?.role`.
- `app/messages/index.tsx` — same fix, for the unread-column selection and
  the empty-state copy.
- `src/features/auth/pages/Profile.jsx` — email trimmed in `validate()` and
  every submit path (`handleAuth`, `handleSendOtp`, `handleForgotPassword`);
  no role-source change needed, web already read `profiles.role` correctly.

### Verification

- `npx tsc --noEmit` — clean.
- `npm run lint` (`expo lint`) — 0 errors, 16 warnings (unchanged baseline).
- `npm run build` — ✓ (web, 8.70s).
- `npm test` — 10/10.
- `npx expo-doctor` — 17/18 (the one failure is the pre-existing,
  already-documented `android/`-prebuild-vs-`app.json` drift; unrelated to
  auth).
- Live browser: submitted the sign-in form with a nonexistent account —
  got the correctly localized "Email ose fjalëkalim i gabuar." message, not a
  raw Supabase error; confirmed no request-side effect beyond the expected
  401 (no account created, no side effect). Verified light and dark mode on
  the login card (text/inputs/buttons/error message all legible in both).
  Verified the sign-up form still renders the confirm-password field, role
  toggle, and all four social buttons (Google/Apple/LinkedIn/Email-code)
  correctly. Confirmed via DOM inspection that the email-trim fix is moot on
  desktop web specifically (browser-level `type="email"` sanitization already
  strips whitespace) but real and now fixed on mobile's `TextInput`, which has
  no equivalent.

### Not done / needs the owner

- Apple + LinkedIn Dashboard/Developer-console configuration (external,
  documented above and in DECISIONS.md §2–3 — cannot be done from code).
- Did not create a live test account (password or OAuth) against the shared
  production Supabase project to avoid seeding real rows into `auth.users`/
  `profiles` — the invalid-credentials path was tested instead, which
  exercises the same validation/error-handling code without side effects.
  If the owner wants full password/OAuth signup verified end-to-end on a
  real account, that's a five-minute manual pass on either app.

## ═══ PASS 6 — 2026-08-18: AUTHENTICATION-ONLY AUDIT & FIX ═══

Scope per owner request: auth and Login/Sign Up only. No other feature area
touched. Audited both `src/features/auth/AuthContext.jsx` (web) and
`contexts/auth-context.tsx` (mobile) line-by-line, plus
`AuthCallback.jsx`, both Supabase clients, and the `handle_new_user` trigger
migration, before changing anything.

### Status

| Method | UI | Backend | Callback | Session | Status |
|---|---|---|---|---|---|
| Email + Password | ✅ | ✅ | n/a | ✅ | **Fully working** |
| Google | ✅ | ✅ | ✅ | ✅ | **Fully working** — verified live (302 to accounts.google.com) |
| Apple | ✅ (restored) | ✅ | ✅ (shared) | ✅ once enabled | **App code complete; blocked on external config** |
| LinkedIn | ✅ (restored) | ✅ | ✅ (shared) | ✅ once enabled | **App code complete; blocked on external config** |
| Email 6-digit Code | ✅ | ✅ | n/a | ✅ | **Fully working** |

### Findings — most were already correct; four were real gaps

**Session restoration / welcome-toast dedup / redirect race** — already fixed
in an earlier session pass (`sessionStorage` pending-welcome flag,
`pendingRedirect` deferred navigation, `AuthCallback`'s `settled` ref +
15s timeout). Re-verified this pass, no regression, nothing to redo.

**`onAuthStateChange` listener cleanup** — correct on both platforms: one
subscription per mount, `unsubscribe()` in the effect's cleanup. No leak, no
duplicate.

**Profile creation / new-vs-existing-user race safety** — `handle_new_user`
(migration `20260702_tighten_properties_select_fix_signup_trigger.sql`) is a
`SECURITY DEFINER` trigger with `on conflict (id) do nothing` — idempotent,
race-safe, fires identically for password/OAuth/OTP signup since they all
insert into the same `auth.users` row. Reads `full_name` OR `name` from
metadata (covers both this app's own signup shape and whatever a given OAuth
provider populates) and validates `role` against a fixed set rather than
trusting it blindly. Not touched — no flaw found, and per this repo's
standing rule, `SECURITY DEFINER` functions only get modified for a *found*
authorization flaw, not on general principle.

**Storage/session config** — mobile's `AsyncStorage` (not `expo-secure-store`)
is the Supabase-recommended choice for Expo specifically (`SecureStore` has a
2KB value cap a JWT session can exceed) — correct as-is, not a bug.
`flowType: 'pkce'`, `persistSession`, `autoRefreshToken`,
`detectSessionInUrl` (web-only) all already correct on both clients.

**GAP 1 — mobile had no client-side validation.** `handleAuth` only checked
for non-empty fields. Web already validates email format, 8-character
password minimum, and full-name-on-signup. Added the identical `validateAuth()`
to mobile, same rules, same order, reusing the same (already-shared,
already-translated) `errors.*` keys web uses.

**GAP 2 — mobile exposed raw Supabase errors to the user.** Every failure
path on mobile (`handleAuth`, OTP send/resend/verify, forgot-password) did
`Alert.alert(t('common.error'), error.message)` — Supabase's own English
driver text, unlocalized, shown directly, on all 6 call sites. Web has had a
`friendlyError()` mapper for this since before this session. Ported it to
mobile as `friendlyAuthError()` (same match strings, same fallback), applied
at all 6 sites.

**GAP 3 — no confirm-password field, either platform.** Added to both,
sign-up only, validated in the same function as the other sign-up rules.
Two new shared i18n keys (`auth.confirmPassword`, `errors.passwordMismatch`)
in all 8 locale files.

**GAP 4 (found live, not from code review) — Apple/LinkedIn buttons showed a
raw JSON error page, not a friendly in-app message.** Restored the buttons
per owner request (see "Apple/LinkedIn" below), wrote a comment claiming
`friendlyAuthError`/`friendlyError` would catch a disabled-provider failure
for them — then actually clicked both buttons in a live browser on all three
targets (Vite web, Expo-as-web, and reasoned through the true-native path)
before trusting that comment. It was wrong for two of the three:
`signInWithOAuth` does a full-page navigation to Supabase's `/authorize`
endpoint rather than a fetchable request, so a disabled provider's raw
`{"code":400,...}` JSON replaces the page before any React/RN code runs —
confirmed identically on the real Vite app and on Expo's own web target.
True native (iOS/Android) is better-behaved: `WebBrowser.openAuthSessionAsync`
returns control to JS either way, so the same failure surfaces as this
screen's own (generic, but localized) error Alert. Corrected the comment in
both files to describe the verified behavior instead of the incorrect
assumption, rather than leave confidently-wrong documentation in place.

### Apple/LinkedIn — a decision, not a bug

Both were fully implemented app-side since 2026-07-12
(`signInWithProvider('apple'|'linkedin_oidc')`, shared `AuthCallback`,
native `signInWithAppleNative` already built and wired on iOS) but the
*buttons* were deliberately removed from the UI that same day, per an
explicit owner instruction, specifically to avoid shipping a button that
fails on every tap. Before touching this, verified live whether that
Supabase Dashboard state had changed since — it hadn't:

```
GET /auth/v1/authorize?provider=google        -> 302 accounts.google.com  (enabled)
GET /auth/v1/authorize?provider=apple         -> 400 provider is not enabled
GET /auth/v1/authorize?provider=linkedin_oidc -> 400 provider is not enabled
```

Flagged the conflict between that prior decision and this task's "all five
methods must be integrated" requirement rather than silently picking a side;
owner chose to show the buttons now, accepting they'll fail until the
external config below is done. Buttons restored on both apps.

### External configuration required (cannot be done from code — no invented values)

**Apple** — Provider: Apple. What's missing: Apple Developer Program
enrollment + Services ID + Sign In with Apple key, and the Supabase Dashboard
provider toggle. Where: Apple Developer console, then Supabase Dashboard →
Authentication → Providers → Apple. Exact redirect URL required:
`https://xzzzhlwmzotibrxdqmcm.supabase.co/auth/v1/callback` (Services ID's
Return URL). Full checklist already in DECISIONS.md §2 — unchanged by this
pass, still accurate.

**LinkedIn** — Provider: LinkedIn (OIDC). What's missing: a LinkedIn
Developer app with the "Sign In with LinkedIn using OpenID Connect" product,
plus the Supabase Dashboard provider toggle. Where: LinkedIn Developer
portal, then Supabase Dashboard → Authentication → Providers → **LinkedIn
(OIDC)** specifically (not the deprecated plain "LinkedIn" entry). Exact
redirect URL required: `https://xzzzhlwmzotibrxdqmcm.supabase.co/auth/v1/callback`.
Full checklist already in DECISIONS.md §3 — unchanged by this pass, still
accurate.

No code changes will be needed on either once the dashboard toggles are on —
confirmed by the fact that Google, which needed the exact same app-side code
path, already works end-to-end.

### Files changed

- `app/(tabs)/profile.tsx` — added `friendlyAuthError()`, `EMAIL_RE`,
  `validateAuth()`; replaced 6 raw `error.message` sites; added
  `confirmPassword` state + field; generalized `handleGoogleLogin` →
  `handleProvider(provider)`; added Apple + LinkedIn buttons; fixed
  `socialRow`/`socialButton` to wrap into a 2×2 grid for 4 buttons; removed a
  stale comment.
- `src/features/auth/pages/Profile.jsx` — added `confirmPassword` state +
  field + match validation; restored Apple + LinkedIn buttons (`Apple`,
  `Linkedin` icons from the already-installed `lucide-react`); corrected the
  removal-era comment to document the live-verified OAuth-redirect
  error-catch limitation.
- `src/i18n/locales/{sq,en,de,it,es,pl,ru,fr}.json` — `auth.confirmPassword`,
  `errors.passwordMismatch`.

### Verification

- `npx tsc --noEmit` — clean.
- `npx expo lint` — 0 errors, 16 warnings (unchanged pre-existing baseline).
- `npm run build` — ✓ (web).
- `npm test` — 10/10.
- `npx expo-doctor` — 17/18 (the one failure is the pre-existing, already-
  documented `android/`-prebuild-vs-`app.json` drift; unrelated to auth).
- Fresh iOS Metro bundle — HTTP 200, new mobile auth code confirmed present.
- Live browser: web sign-up form (confirm-password field renders, 2×2 social
  grid renders); Expo-as-web equivalent (same); clicked Apple on both web
  targets and observed the actual failure mode directly rather than assuming
  the error-handling code covered it (see GAP 4 above).

### Not done / needs the owner

- Apple + LinkedIn Dashboard/Developer-console configuration (external,
  documented above and in DECISIONS.md §2–3 — cannot be done from code).
- The Apple-button raw-JSON-page failure mode on web is not fixable from
  client-side error handling — it disappears once the Dashboard config is
  done, not before.

## ═══ PASS 5 — 2026-08-18: TARGETED AUDIT (auth / dates / dark-mode notifications / WhatsApp / AI) ═══

Scope: a user-supplied generic "full audit" template covering five areas.
Rather than executing it blindly, each area was checked against this actual
codebase first; only genuine findings were fixed. No DB/RLS changes.

**Auth** — no new findings. Everything the template asks for (listener
cleanup, no duplicate welcome toast, no auth-state flash, session
restoration) was already fixed in the 2026-08-18 mobile-parity pass earlier
this session. Re-verified `onAuthStateChange` subscribes once and
`unsubscribe()`s on cleanup, both platforms.

**Calendar** — doesn't exist as a feature; there is no calendar-grid UI
anywhere in the app. The closest analog is the viewing-scheduling date
picker (native `DateTimePicker` on mobile, `<input type="date">` on web).
Not something to invent.

**Date format → DD/MM/YYYY (owner decision, 2026-08-18)** — `formatDate()`
in `src/lib/format.js` / `lib/format.ts` used
`Intl.DateTimeFormat(lang, {month:'short', ...})`, producing per-locale
month names (e.g. "18 gush 2026"). Owner chose to standardize on a fixed
numeric `DD/MM/YYYY` in every language instead. Changed both files
(mirrored, per their own "two files, parallel APIs" convention) to build
the string from local date components directly; `formatRelativeTime()`'s
"more than a week ago" fallback now calls `formatDate()` instead of
duplicating a second `toLocaleDateString` rule. All source values are
`timestamptz` (`scheduled_at`, `created_at`) — never a bare date-only
string — so there's no UTC-midnight-parsed-as-local off-by-one-day risk.
Verified with real ISO timestamps at the boundary (`2026-12-31T23:59:00Z`
→ `01/01/2027` in a UTC+ timezone, correct local-day resolution, not a
bug). 11 display call sites across both apps confirmed unaffected by
signature (the now-unused `lang` param was kept rather than touched, to
avoid a churn-only edit to all 11 call sites for zero behavior change).

**Dark-mode notification bug — FOUND AND FIXED.** `.addsheet-toast`
(globals.css; used by 7 toasts: viewing confirmations, 4 error banners,
login prompt) set `background: var(--fho-text)` /
`color: var(--fho-text-on-dark)`. In light mode that's near-black-on-cream
— fine, matches its "always-dark chip" design intent. In dark mode
`--fho-text` flips to near-white (`#f0ece6`) while `--fho-text-on-dark`
stays near-white (`#faf6ef`) — **near-invisible white-on-white text**,
dark mode only. Root cause: a theme-*reactive* token used where an
always-dark value was needed; `--fho-text-on-dark` was already correctly
"always light," it just had no "always dark" partner. Fixed: background is
now a fixed `#1a1714` in both themes. This is web-only — mobile has no
directly-equivalent toast component.

**WhatsApp** — already fully implemented (`whatsappUrl()` in
`lib/format.ts`/`.js`, defaults to Albania's country code when one isn't
present, strips formatting characters). No gap found.

**AI — corrected finding.** My first pass concluded `ai-listing-assistant`
(the per-listing buyer chat backend — grounded server-side in one listing,
prompt-injection-hardened, rate-limited) had "zero UI consumer on either
platform." **That was wrong on web** — `src/features/properties/components/
ListingAssistant.jsx` already existed (dated 2026-08-05, predates this
session), fully wired to `askListingAssistant()` in `lib/ai.js`, gated
behind the pre-existing `aiAssistant` feature flag, and rendered from
`PropertyDetail.jsx`. The mistake: I grepped for the literal Edge Function
name as a string and for the AI-generator's own symbol names, never for
callers of the *wrapper function* itself — the one search that would have
found it. **Mobile genuinely had no equivalent** — that part of the
finding stood. Built `components/property/listing-assistant.tsx` +
`askListingAssistant()` in `lib/ai.ts`, matching web's component
behaviorally (same flow, same already-translated `assistant.*` i18n keys
in all 8 locales — a full FAB→panel→intro-bubble→thinking→disclaimer set
that already existed, unused) and wired into `app/property/[id].tsx`
behind the same `status === 'active'` gate web uses (mobile has no flags
module, so it ships unconditionally like the other two AI features already
do there).

**Live verification, not just code review**: opened the public (no-auth-
required) `/property/:id` route, opened the assistant panel, sent a real
question through the actual UI. Got back the graceful `unavailable`
fallback bubble. Traced this to source with a direct `curl` against both
`ai-listing-assistant` and `ai-parse-search` (bypassing the UI's
error-swallowing) — both return `503 {"error":"ai_unavailable"}`. This is
**not a bug**: DECISIONS.md §0 (dated 2026-07-02, predates this session)
already documents that `ANTHROPIC_API_KEY` has never been set as a
Supabase secret, by deliberate choice ("I don't create or handle
secrets"), with the exact one-line command to enable it. All three AI
functions degrade to this same clean 503 until the owner runs it — the new
mobile assistant will start working the instant the key is set, with no
further code changes.

Verification this pass: `tsc --noEmit` clean · `expo lint` 0 errors / 16
warnings (unchanged baseline) · web build ✓ · `npm test` 10/10 · fresh iOS
Metro bundle HTTP 200, new component confirmed present · live browser
round-trip against the public property-detail route and the deployed Edge
Functions.

## ═══ PASS 4 — 2026-08-15: FULL APPLICATION FUNCTIONAL AUDIT ═══

Scope: not source inspection alone — every flow below was actually exercised
against the live dev server (`localhost:5173`) and the live Supabase project
via the in-app browser, using the existing test account
(`claude-test@shtepia.dev`, role: agent, per DECISIONS.md §0d) plus direct
`curl` calls against `/rest/v1/...` with the anon key where a signed-out
perspective was needed. No new listings/conversations/accounts were created
to avoid writing production data purely for testing — favoriting/
unfavoriting the existing test account's own listing and sending one message
into the pre-existing test conversation were the only writes, both
reversible and both already owned by the test account. No database/RLS
changes were made this pass — Pass 3's remediation stands untouched.

### P4.1 Findings

| # | Severity | Feature | Summary |
|---|---|---|---|
| 1 | **P2** | Auth — session restore | Welcome-back toast re-fired on every page reload/refresh for an already-signed-in user, not just on a genuine sign-in |
| 2 | **P2** | Auth — protected-route redirect | Signing in from a `ProtectedRoute`-triggered redirect (e.g. hitting `/favorites` signed out) silently bounced back to `/profile` instead of returning to the originally-requested page |
| 3 | **P3** | Auth — OAuth callback | `AuthCallback` had no timeout; a provider redirect that never resolves to `SIGNED_IN`/`SIGNED_OUT` (closed popup, dropped network, misconfigured provider) left the user on an infinite loading screen with no way out |
| 4 | **P3** | Properties — favorites (signed out) | Clicking "Save" on a property card while signed out redirects to `/profile` without carrying `from`, so post-login the user lands on Home instead of back where they were |
| 5 | INFO | Profile | No UI exists to edit `full_name`/`agency_name`/avatar after signup — `profiles.avatar_url` is read (Header.jsx) but never written anywhere in the app. Not a bug (nothing crashes or leaks), a missing feature. Flagging per DECISIONS.md convention rather than building it — a profile-edit screen is new scope, not a fix, and CLAUDE.md's Feature Request Protocol applies if you want it built |

**#1 — root cause**: `@supabase/supabase-js` v2.45 replays a `SIGNED_IN`
event when it restores a persisted session from storage on **every** page
load — confirmed live by instrumenting the listener (`SIGNED_IN` fired with
`baselineUserId=undefined` on a plain reload, i.e. before any real sign-in
context existed). [AuthContext.jsx](../src/features/auth/AuthContext.jsx)
called `showWelcome()` on every `SIGNED_IN` event without distinguishing a
replay from a real sign-in. Also confirmed the replay fires **before**
`INITIAL_SESSION`, so event-ordering heuristics can't tell them apart — an
initial fix attempt using an ordering-based baseline was tried, proven wrong
live, and replaced.
**Fix**: `signInWithProvider` now sets a `fho_pending_welcome` sessionStorage
flag immediately before the OAuth redirect; the `SIGNED_IN` handler only
calls `showWelcome()` if that flag is present (then clears it). Password and
OTP sign-in already call `showWelcome()` directly on success and don't rely
on the event handler for it — unaffected by this change. **Validated live**:
reload → no toast (repeated twice); sign out → sign in with password → toast
appears exactly once. No console errors.

**#2 — root cause**: `Profile.jsx`'s `handleAuth()` called
`navigate(location.state?.from, { replace: true })` immediately after
`signIn()` resolved — but `AuthContext`'s `user` doesn't update until its
own async `onAuthStateChange` handler finishes (`loadProfile` await
included), which hadn't happened yet. Navigating to a protected route with a
stale `user === null` in context made `ProtectedRoute` immediately redirect
right back to `/profile`. **Reproduced live**: signed out → hit `/favorites`
→ redirected to `/profile` (correct) → signed in → landed back on `/profile`
instead of `/favorites`, confirmed via `location.pathname` and
`window.history.state` (still carrying the original `from: "/favorites"`,
proving the second bounce, not a lost intent).
**Fix**: sign-in success now sets `pendingRedirect` state instead of
navigating immediately; a `useEffect` watching `[user, pendingRedirect]`
performs the navigate only once `user` has actually become truthy in
context. Applied to both the password (`handleAuth`) and OTP
(`handleVerifyOtp`) success paths — the OTP path previously hardcoded
`navigate('/')` and ignored `from` entirely, same class of gap, fixed
alongside. **Validated live**: repeated the same repro after the fix — lands
on `/favorites` correctly, confirmed via `location.pathname`.

**#3 — fix**: added a 15s `setTimeout` fallback in
[AuthCallback.jsx](../src/features/auth/pages/AuthCallback.jsx) that
redirects to `/profile?error=oauth_failed` (the same path the existing
error handling already uses) if neither `SIGNED_IN` nor `SIGNED_OUT` arrives
in time; cleared on unmount/settle like the existing listener. Not
independently live-testable (would require deliberately breaking a real
OAuth provider mid-flow), but the change is minimal, uses the app's
existing error-recovery path verbatim, and cannot fire on a successful flow
(both success and failure signals still win the race in the normal case).

**#4 — not fixed this pass**: correctly classified as P3 per the audit's
own instruction not to spend time on P3 polish. Documented for a future
pass — the fix is the same `pendingRedirect`-style pattern as #2, applied to
`PropertyCard.jsx`/`FeaturedCard.jsx`'s `navigate('/profile')` calls.

### P4.2 Verified working, no action required

- **Navigation**: 404 catch-all renders correctly for unknown routes;
  role-gated route (`/agent-dashboard`) redirects signed-out users to
  `/profile`; deep-linked `/property/:id` renders directly with correct SEO
  title; production SPA rewrite already correct
  ([vercel.json](../vercel.json) — catch-all → `index.html`, confirmed
  present, not a gap).
- **Properties**: search + city filter narrows results correctly (verified
  Durrës filter → 1/2 results); property detail renders full content
  (price, specs, description, amenities, map) with no console errors;
  favorite add/remove round-tripped correctly against the live DB (added,
  confirmed in `/favorites`, removed, confirmed empty state restored).
  Image/video upload MIME-type + size validation confirmed present in
  [NewListing.jsx](../src/features/listings/pages/NewListing.jsx) (client
  picker `accept` is a hint only; real enforcement is in code, matching
  CLAUDE.md's non-negotiable rule) — storage-cleanup-on-failure (remove
  already-uploaded paths if a later step fails) also confirmed present,
  matching the fix DECISIONS.md §P2-B already documented. Did not submit a
  real listing (would write production data purely for a test).
- **Messaging**: conversation list loads and renders correctly for an
  agent; opening a thread loads prior messages; sending a message succeeds
  and appears instantly (verified via a real send into the existing test
  conversation); realtime channel subscriptions in both
  [Messages.jsx](../src/features/messaging/pages/Messages.jsx) and
  [useUnreadCount.js](../src/features/messaging/hooks/useUnreadCount.js)
  are correctly scoped per-effect and unsubscribed on cleanup (`() =>
  supabase.removeChannel(channel)`), no duplicate-subscription risk found.
  Client/agent permission boundaries were already live-verified in Pass 3
  (anon gets `[]` from `conversations`; RLS untouched since).
- **Mobile (Expo/RN)**: [contexts/auth-context.tsx](../contexts/auth-context.tsx)
  is a materially simpler implementation than the web `AuthContext` — no
  welcome-toast logic exists at all (nothing to replay), and no
  `from`-based redirect pattern exists either, so neither web bug (#1, #2)
  has a mobile equivalent. `SafeAreaView` present on all 14 real screens
  (root/tab layout files correctly excluded); `KeyboardAvoidingView` present
  on all 4 screens with text input (profile/login, message thread, listing
  create, property detail's request sheet). No Expo dev server was started
  this pass — the prior session's screen-by-screen web-parity pass already
  verified all 12 restyled screens via `tsc`/`eslint`/live Expo-web-target
  render; nothing changed in the RN tree this pass to warrant re-running it.

### P4.3 Final regression check (fresh, after the auth fixes above)

- `npx tsc --noEmit` — clean, 0 errors.
- `npm run build` (Vite web) — clean, ~8.5s, same pre-existing chunk-size/
  dynamic-import advisories as Pass 3 (cosmetic, unchanged).
- `npm run lint` — same 3 pre-existing false-positive errors + 16
  pre-existing warnings as Pass 3, unchanged counts — no new lint issues
  from this pass's edits.
- `npx expo-doctor` — 17/18, same single known app.json/prebuild-drift
  warning as Pass 3, unchanged.
- No database/RLS changes made — Pass 3's advisor state stands as last
  verified.

### P4.4 Net assessment

Zero P0s (no security/data-loss/app-failure issues), zero P1s (no major
feature was actually broken for a normal user's golden path — auth, search,
property browsing, favorites, and messaging all work end-to-end for both
client and agent perspectives on the flows tested). Two real P2 bugs found,
root-caused, fixed, and live-validated (not just claimed): the spurious
welcome-toast replay, and the post-sign-in redirect race that silently
dropped the user's original destination. One P3 (OAuth callback timeout)
fixed defensively since it was a one-line, self-contained, zero-risk
addition using an existing error path. One P3 (signed-out favorite-toggle
losing `from`) documented, deliberately not fixed, per the audit's own
"don't polish P3s" instruction. One INFO-level product gap (no profile-edit
UI) flagged for a future scoping decision, not built. **Answering the
audit's stated objective directly: yes, a normal client or agent can use the
app end-to-end — signup/login through property browsing, favorites, and
messaging — without hitting a real bug on the tested flows, modulo the two
P2s above which are now fixed.**

---

## ═══ PASS 3 — 2026-08-15 ═══

Read-only verification pass (no `/godmode` skill exists as an actual file
despite CLAUDE.md referencing it — this is the equivalent process run by
hand: diagnostics + live Supabase state, findings written here, before any
code change). Scope: `src/` web app + the Expo RN app (`app/`, `components/`,
`contexts/`) — the latter was never covered by Pass 1/2, which were scoped to
`src/` only. Backend: ACTIVE_HEALTHY, Postgres 17.6.1.

**A month of untracked drift since Pass 2**, most of it this session: the
Vercel web deployment went live, and the Expo app got a full visual-parity
pass against the web app (nav, Profile/Login, Filters, Create Listing,
Messages, Favorites, property cards, Saved Searches, Viewings, My Listings,
Agent Dashboard) plus a real bug fix (WhatsApp deep links were missing
Albania's country code, both apps). None of that is reflected in Pass 1/2.

### P3.1 Diagnostics (actually run, not assumed)

- `npx tsc --noEmit` — **clean, 0 errors.**
- `npx expo-doctor` — 17/18 checks pass. 1 fails: app.json has native-config
  fields (`orientation`, `icon`, `scheme`, `ios`, `android`, `plugins`, etc.)
  that won't sync via EAS Build now that `android/` (and presumably `ios/`)
  native folders exist in the tree — the project has drifted from
  CNG-managed to a prebuild layout without updating app.json accordingly.
  Not urgent (no EAS build has been attempted), but will bite the first time
  one is.
- `npm run lint` — 3 errors, 16 warnings. **The 3 errors are now FIXED** (see
  below); current state is 0 errors, 16 warnings.
  - All 3 errors were **false positives**: `import/no-unresolved` on
    `.native.tsx`/`.web.tsx` platform-split files (`location-picker`,
    `location-preview-map`, `map-canvas`). ESLint's resolver doesn't
    understand Metro's `moduleSuffixes` convention that `tsconfig.json`
    already configures for `tsc`; `tsc --noEmit` resolves these correctly.
    Not a real bug — a resolver gap, pre-existing before this session.
  - **Root cause (found 2026-08-18):** `eslint-config-expo` passes its
    platform-suffix extension list to the *node* import resolver but enables
    the TypeScript resolver as a bare `typescript: true` with no options
    (`flat/utils/core.js:41`), so that resolver runs on stock extensions
    (`.ts/.tsx/.d.ts/.js/.jsx`). `@/…` is a tsconfig `paths` alias, which only
    the TypeScript resolver can follow — so every aliased import was resolved
    by the one resolver that doesn't know about `.native.tsx`. Fixed in
    `eslint.config.js` by re-declaring `import/resolver.typescript` with
    expo's own `computeExpoExtensions()` list. Not a suppression: the three
    imports now genuinely resolve.
  - 16 warnings are `react-hooks/exhaustive-deps` (missing deps: `user`,
    `cooldown`, `ids`, `property`, `session`; a couple with "complex
    expression in dep array") plus a handful of unused imports
    (`ArrowLeft`, `Mail`, `Phone`, `MessageCircle`, `useState`). All in
    `src/` web files, all pre-existing (not touched this session). Worth a
    cleanup pass but none are live bugs — the effects in question are either
    mount-only by design or the missing dep is stable across the component's
    lifetime.

### P3.2 Supabase security advisors (live, re-verified — not assumed from Pass 1/2)

- **`public.ai_usage` — RLS enabled, zero policies.** Same silent-failure
  shape as the 7 tables Pass 1 found — but checked: `ai_usage` is only ever
  touched by the three AI Edge Functions via the **service-role** client
  (`admin = createClient(..., SUPABASE_SERVICE_ROLE_KEY)`), which bypasses
  RLS entirely. No client-side code references it. **Verified harmless in
  practice** — not the Pass-1 bug recurring, just a missing explicit
  deny-policy for defense-in-depth. Low-priority hardening, not a live bug.
- **3 `SECURITY DEFINER` functions callable by `anon`**
  (`buyer_has_open_wanted_home`, `current_user_is_agent`, `claim_role`) —
  inspected all three function bodies directly:
  - `buyer_has_open_wanted_home` / `current_user_is_agent` just return a
    boolean derived from `auth.uid()`; an anonymous caller gets `auth.uid()
    = NULL`, so both safely return `false`/no-match. No data leak.
  - `claim_role(new_role text)` is gated by `auth.uid()` matching an
    existing `profiles` row **and** a hard 5-minute post-signup window
    (`created_at < now() - interval '5 minutes'` raises). Well-commented,
    clearly already hardened in a prior pass (references "isNewAccount
    check", row-locks against a race). An anonymous or post-window caller
    gets a clean exception, not a role change.
  **All three are linter false-positives on RPC reachability, not real
  vulnerabilities.** No fix needed.
- **Leaked password protection still disabled** — same as DECISIONS.md §10
  a month ago. One-click dashboard toggle, not something fixable via API/
  code. Still open.

### P3.3 Supabase performance advisors (live)

All INFO/WARN, none correctness-affecting:
- 8 unindexed foreign keys (`conversations`, `leads`, `messages`,
  `property_activity`, `property_views`, `saved_searches`, `viewings`,
  `wanted_homes`) — fine at current row counts, worth indexing before scale.
- RLS policies on 9 tables call `auth.<fn>()` directly instead of
  `(select auth.<fn>())` — the standard Supabase perf pattern, re-evaluates
  per-row instead of once per query. Correctness unaffected; a mechanical
  fix when there's a reason to touch these policies anyway.
- 1 genuine duplicate index: `favorites` has both `idx_favorites_user` and
  `idx_favorites_user_id` — identical, drop one.
- 5 unused indexes (never hit by a query yet) — expected at this data
  volume, not a signal to remove them.

### P3.4 Still-open from DECISIONS.md (re-verified today, unchanged)

- **`GOOGLE_TRANSLATE_KEY` still invalid** — re-confirmed earlier this
  session via direct `curl` to `translate-property`: Google still rejects it
  with "API key not valid." Auto-translate (wizard button + fallback) is
  still down; app still degrades gracefully to untranslated text. User
  explicitly deprioritized fixing this ("it's ok for the moment").
- **8 orphaned `property-images` files** — same count as Pass 2
  (`9c47f15e…`, 2026-07-04). Not growing (the submit-failure cleanup fix is
  holding), still awaiting owner approval to delete.
- **Apple/LinkedIn OAuth** — buttons already removed from both web (Pass 2,
  owner's call) and the Expo app (this session, same reasoning: verified via
  bundle inspection that only `handleGoogleLogin` exists, no residual
  Apple/LinkedIn handlers). Providers still not enabled in the Supabase
  dashboard per DECISIONS.md §P2-G's checklist — unchanged, still your
  console access needed if you want them back.

### P3.5 Mobile app (Expo/RN) — not previously audited

The RN app shares the same Supabase project/RLS/auth as the web app (same
`@supabase/supabase-js` client, same table access patterns), so none of the
database-layer findings above are web-only — they apply identically to the
mobile app's queries. Checked specifically for the mobile app:
- Image upload (`lib/upload.ts`, used by `app/listing/create.tsx`) already
  validates MIME type + size before upload (the same fix Pass 2 required
  for web's wizard) — confirmed present, not a gap here.
- No mobile-specific RLS bypass or service-role key found in client code —
  grepped for `SERVICE_ROLE` across `app/`, `components/`, `contexts/`,
  `lib/`: no matches. Only the singleton anon-key client
  (`lib/supabase.ts`) is used, matching the non-negotiable rule.
- WhatsApp deep-link country-code bug (fixed this session, both apps) was a
  genuine functional bug, not previously caught by any audit pass since
  Pass 1/2 never inspected `whatsappUrl`.

### P3.6 Net assessment

No new Severity-1 or Severity-2 issues found. The codebase is materially
healthier than a month ago (Pass 1/2's fixes are holding — verified, not
assumed), and everything found in this pass is either already a known,
explicitly-deferred decision (DECISIONS.md) or low-priority hardening
(unindexed FKs, one duplicate index, an explicit deny-policy on
`ai_usage`). Nothing here justifies a sweeping, high-risk rewrite of
auth/RLS/database code.

### P3.7 ADDENDUM — 2026-08-15: migrations applied + classification of every P3 finding

Scope note: this addendum was written under a tightened, explicitly-scoped
follow-up brief (no dropped tables/deleted data/disabled RLS/weakened auth/
permissive-policy-for-linter/resets/destructive schema changes; safe
reversible migrations only; classify don't blanket-fix; verify RLS changes
against live REST behavior for anon + authenticated + owner + non-owner).
Three migrations were applied, each read-verified against `get_advisors`
before/after and, for the RLS change, against live `/rest/v1/...` calls.
Nothing below was rewritten from P3.1–P3.6 above — this is additive.

**Migrations applied (all via `apply_migration`, all `IF EXISTS`/`IF NOT
EXISTS`/policy-clause-only, all reversible):**

1. `drop_duplicate_favorites_user_index` — `favorites` had two identical
   indexes (`idx_favorites_user`, `idx_favorites_user_id`). Dropped the
   older-named duplicate, kept the `_id`-suffixed one. Confirmed via
   `pg_indexes` the two had identical `indexdef` before dropping either.
2. `add_fk_indexes_for_verified_query_patterns` — of the 8 unindexed-FK
   findings in P3.3, added indexes for the 6 actually hit by app query
   patterns (grepped: `conversations.agent_id`/`property_id`,
   `leads.agent_id`, `saved_searches.user_id`, `wanted_homes.client_id`,
   `viewings.property_id` — all filtered/joined-on in `AgentDashboard.jsx`,
   `MyListings`, `Viewings`, `SavedSearches` queries). Deliberately **did
   not** index `messages.sender_id` or `property_activity.user_id` — no
   query in either codebase filters or joins on those columns today: `get_advisors`
   (re-run above, this session) confirms both remain in the unindexed-FK
   list post-migration, exactly as intended, not an oversight.
3. `wrap_auth_uid_calls_in_rls_policies_for_perf` — 24 `ALTER POLICY ... USING
   (...) WITH CHECK (...)` statements across 11 tables, each rewriting a bare
   `auth.uid()`/`auth.<fn>()` call to `(select auth.uid())` (Postgres
   InitPlan hoisting — evaluates once per statement instead of once per
   row). Every non-`auth.*` clause byte-for-byte preserved from the
   pre-migration `pg_policies` definitions fetched beforehand. `ALTER POLICY`
   was used specifically because that statement form cannot touch `cmd` or
   `roles` or reassign the policy to a different table — only the boolean
   clauses — chosen to make an authorization-semantics change structurally
   impossible.
   - **Live behavioral verification (not just advisor-level)**: called
     `/rest/v1/properties?status=eq.active`, `?status=eq.draft`,
     `/rest/v1/favorites`, `/rest/v1/saved_searches`, `/rest/v1/conversations`
     with the anon key. Result: active properties returned normally, draft
     properties returned `[]` (owner-only policy still enforced), and all
     three owner-scoped tables returned `[]` rather than erroring or leaking
     rows — `(select auth.uid()) = user_id` correctly evaluates to no-match
     against a NULL anon `auth.uid()`, identical to pre-migration behavior.
     Authenticated/owner-vs-non-owner spot checks were not separately run
     (no second test account with rows in every affected table was
     available this session) — the InitPlan rewrite is a Postgres-documented
     semantics-preserving transform and every non-`auth.*` clause was copied
     verbatim, so residual risk here is judged low, but this is flagged
     explicitly rather than claimed as fully exhaustive.

**Post-migration `get_advisors` re-check (this session, both types) confirms:**
cleared — duplicate index gone, all 9 `auth_rls_initplan` warnings gone, FK
list shrank from 8 to exactly the 3 intentionally-skipped columns. No new
WARN/ERROR appeared. One WARN not previously called out in P3.3 was
observed on this re-check: `multiple_permissive_policies` on
`wanted_homes` SELECT (`"Agents can view open wanted homes"` +
`"Clients manage own wanted homes"` both apply per role) — pre-existing
schema design (two intentionally-separate policies for two different
audiences), not introduced by any migration this session. Not fixed here —
flagged as a new low-priority performance line item, correctness unaffected,
left for a future pass since collapsing two policies into one touches
authorization logic and this addendum's brief was migrations-only for
already-verified-safe mechanical changes.

**Classification of every P3.1–P3.6 finding:**

| Finding | Classification |
|---|---|
| `expo-doctor` app.json/prebuild-drift warning | DEFERRED — no EAS build attempted yet, not urgent |
| 3 `import/no-unresolved` lint errors (`.native`/`.web` split files) | FALSE POSITIVE → **FIXED** 2026-08-18 — expo's flat config leaves the TypeScript resolver (the only one that follows the `@/` alias) on stock extensions; `eslint.config.js` now gives it expo's platform list. Lint is 0 errors. |
| 16 `react-hooks/exhaustive-deps` + unused-import warnings | DEFERRED — pre-existing, not live bugs, worth a cleanup pass |
| `ai_usage` RLS-enabled-no-policy | NO ACTION REQUIRED — service-role-only access, verified no client-side reference; explicit deny-policy would be defense-in-depth, not a fix for a real gap |
| 3 anon-callable `SECURITY DEFINER` functions | FALSE POSITIVE — linter flags RPC reachability only; all 3 bodies inspected, all safely no-op/deny for `auth.uid() = NULL` |
| Leaked password protection disabled | CONFIGURATION REQUIRED — dashboard-only toggle, not code-fixable |
| 8 unindexed FKs | FIXED (6 of 8) — see migration 2 above; 2 intentionally left unindexed (no query pattern hits them) |
| 9 tables' `auth.<fn>()` not wrapped in `(select ...)` | FIXED — see migration 3 above, live-verified |
| Duplicate `favorites` index | FIXED — see migration 1 above |
| 5 unused indexes | NO ACTION REQUIRED — expected at current data volume, not a removal signal |
| `GOOGLE_TRANSLATE_KEY` invalid | DEFERRED — user's own explicit call, requires their Google Cloud Console access |
| 8 orphaned `property-images` storage files | DEFERRED — awaiting owner approval, not auto-deleted per instruction |
| Apple/LinkedIn OAuth disabled | CONFIGURATION REQUIRED — dashboard provider config, not code-fixable |
| WhatsApp deep-link missing country code | FIXED — this session, both `lib/format.ts` and `src/lib/format.js` |
| Mobile app upload validation / no service-role-in-client / RLS sharing | NO ACTION REQUIRED — all verified already-correct, not gaps |

**Final regression check (fresh, run after all 3 migrations, this session):**
- `npx tsc --noEmit` — clean, 0 errors (unchanged from P3.1).
- `npm run build` (Vite web) — clean, succeeds in ~18s, only the
  pre-existing chunk-size/dynamic-import advisories (unchanged, cosmetic).
- `npx expo-doctor` — 17/18, same single known app.json/prebuild-drift
  warning as P3.1, unchanged.
- `npm run lint` — same 3 false-positive errors + 16 pre-existing warnings
  as P3.1, unchanged counts.
- No new orphaned storage files (still 8, matching P3.4).
- No security regression: `get_advisors` security list is identical in
  substance to P3.2's, modulo nothing — same 3 SECURITY DEFINER WARNs, same
  `ai_usage` INFO, same leaked-password WARN, no new entries.

**Net assessment**: three low-risk, fully-reversible, live-verified fixes
landed with zero regressions across type-checking, build, lint, doctor, or
the security/performance advisor lists. Every P3 finding is now classified.
Nothing outstanding requires further code action without new user input —
remaining items are either DEFERRED (explicit prior user decisions) or
CONFIGURATION REQUIRED (dashboard-only, outside code).

---

## ═══ PASS 2 — 2026-07-11 ═══

Fresh audit of the current state (post-2026-07-02 fixes + the auth/home
commits since). Backend: ACTIVE_HEALTHY. Locales: all 8 in sync (326 base
keys; pl/ru +4 plural forms — correct). Tests: 10/10 pass. Build: clean.
RLS: every table has policies; realtime publication carries
`conversations`+`messages`; storage folder-scoped — the July-2 DB fixes held.
Google OAuth unchanged (live); Apple/LinkedIn still awaiting provider-console
config (DECISIONS.md §2–3 — nothing new code-side).

### P2.1 SEVERITY 2 — feature broken or wrong

- **P2.1.1 `daily_rent` listings display as "For Sale"** — badge/suffix logic
  everywhere is binary (`listing_type === 'rent' ? … : forSale`):
  PropertyCard, FeaturedCard, PropertyDetail, Favorites row. A daily-rent
  listing gets a "For Sale" badge and no price suffix. No `property.perDay`
  key exists in any locale. **Fix: shared `listingBadge`/`priceSuffix`
  helpers + `perDay`/`forDailyRent` keys ×8 locales.**
- **P2.1.2 Home fetches ALL active properties unbounded** —
  `useProperties({})` with no pagination/limit; violates the repo's own
  no-unbounded-fetches rule. Fine at 8 rows, a full-table scan at 100k.
  PropertyDetail's "similar" fetch has the same problem (fetches every match,
  slices 4 client-side). **Fix: `limit` option in `useProperties`; Home
  caps at 24, Similar at 8.**
- **P2.1.3 Wizard image upload fails silently** — `uploadImages()` ignores
  per-file errors; a listing can publish with 0 images even though step-4
  validation demanded 3. Also **no MIME/size validation** before upload
  (security rule violation — `accept="image/*"` is only a picker hint;
  `compressImage` passes non-images straight through). **Fix: validate
  type+size (10 MB cap) at selection with i18n error; abort submit if any
  upload fails; best-effort cleanup of already-uploaded files on failure.**
- **P2.1.4 Orphaned storage files confirmed** — 8 files in `property-images`
  (user folder `9c47f15e…`, 2026-07-04) referenced by no property: the
  upload-before-insert leak happening in practice. All 8 seed listings use
  external Unsplash URLs (valid, not broken refs). **Fix: submit-failure
  cleanup (above); existing 8 orphans flagged in DECISIONS.md §12 — not
  deleted without owner approval.**
- **P2.1.5 Dead Profile menu rows** — "Saved searches" and "Settings" render
  chevron rows with `to: null`; tapping does nothing. Saved searches +
  wanted homes have create-flows and RLS but **no view/manage UI at all**
  (data goes in, nothing comes out). **Fix: Phase 3 feature (management
  screen) + wire the row.**

### P2.2 SEVERITY 3 — wrong/risky but survivable

- **P2.2.1 i18n violations (hardcoded UI strings)** — `Header.jsx`
  aria-label "Toggle theme"; `ImageLightbox.jsx` aria-labels
  "Close"/"Previous"/"Next". **Fix: `common.toggleTheme`,
  `common.previous`, `common.next` keys ×8 (reuse `common.close`).**
- **P2.2.2 `NewListing` navigates during render** — `if (!user)
  navigate('/profile')` in the render body (route is already inside
  `ProtectedRoute`, so it's a latent-pattern violation, not a live bug).
  **Fix: return null; drop the render-phase navigate.**
- **P2.2.3 Silent failures in messaging + listings management** — thread
  `send()` failure gives no feedback (message quietly not sent);
  `startChat()` ignores insert errors; MyListings `toggleStatus`/`delete`
  are optimistic with no revert on error. **Fix: i18n error feedback +
  revert.**
- **P2.2.4 `messages` UPDATE RLS is participant-wide** — either participant
  can UPDATE any column of any message in the conversation, including the
  other side's `body`. Nothing in the app updates messages (mark-read lives
  on `conversations`). **Fix: drop the unused policy (re-add sender-scoped
  when message editing ships).**
- **P2.2.5 Not-memoized cards + non-lazy images** — PropertyCard,
  FeaturedCard re-render on every parent state change (rule: `React.memo`);
  card/hero `<img>`s lack `loading="lazy" decoding="async"` (rule). **Fix
  both.**
- **P2.2.6 Single 1.26 MB bundle (372 KB gzip)** — no route-level code
  splitting; recharts (PropertyDashboard-only) and the full wizard load on
  first paint for every anonymous visitor. Konva is NOT bundled (floorplan
  components unwired — confirmed). **Fix: `React.lazy` the heavy routes.**
- **P2.2.7 A11y gaps** — icon-only buttons without accessible names
  (Search view-toggle, filter button, PropertyDetail hero back/nav,
  NewListing back); main clickable cards are `<div onClick>` with no
  keyboard path (PropertyCard, FeaturedCard, fav rows, msg rows). Heading
  hierarchy is otherwise sound (one h1 per screen, sections use h2/h3).
  **Fix: aria-labels everywhere; keyboard access (role/tabIndex/Enter) on
  the card components.**
- **P2.2.8 Dead code** — `QueryCacheProvider` mounted in App.jsx with zero
  consumers. **Fix: unmount + delete module.** (Floorplan editor/viewer and
  `CustomDropdown` stay — plausible future features, cost nothing.)

### P2.3 Noted, not fixed (deliberate)

- Search price-slider hardcodes € and a 50k–800k EUR range regardless of
  listing currency — needs a product decision on currency-aware filtering
  (all listings are priced in EUR today).
- `console.error` in FavoritesContext / translate.js kept — they log
  genuine failures, not debug noise.
- `usePropertiesByIds` `JSON.stringify(ids)` dep — smelly but correct.
- AddSheet client "visit" action navigates to `/search?intent=schedule`
  (intent ignored) — superseded by the Phase 3 viewings feature on the
  property page; agent "viewing"/"open" actions pass `?openHouse=` params
  the wizard ignores (logged in DECISIONS.md §13).
- `property_activity` INSERT `WITH CHECK (true)` — accepted anon analytics
  (advisor WARN, known since pass 1).
- Test artifacts (`test-*.cjs/png`) still at repo root (DECISIONS.md §9).

---

# PASS 1 — 2026-07-02 (historical)

Date: 2026-07-02 · Auditor: Claude Code (autonomous pass)
Scope: `src/` (active Vite app), Supabase project `xzzzhlwmzotibrxdqmcm`, i18n, RLS, storage, OAuth.

> **Note on the 13-step plan:** the plan text was not included in the prompt
> (the placeholder was left empty), so plan-vs-reality gaps below are
> reconstructed from what the schema/code imply was intended. See §6.

---

## 1. SEVERITY 1 — Breaks the whole app

### 1.1 Supabase project was PAUSED (status: INACTIVE)
The entire backend was offline — every query, auth call, and image URL failed.
**Action taken:** restored the project during the audit (non-destructive; no
keys touched). Root cause: free-tier auto-pause after inactivity. Long-term:
upgrade the project or set up a keep-alive ping; logged in DECISIONS.md.

### 1.2 Buyers cannot publish listings — `properties.agent_id` is NOT NULL
`NewListing.jsx` inserts `agent_id: null` for non-agent users, but the column
is `NOT NULL` (legacy from when only agents could list). Every buyer/client
submission fails with a 23502 violation. The error is shown, but there is no
way around it. **Fix: migration to make `agent_id` nullable** (owner_id is the
canonical owner; RLS already keys on it).

### 1.3 RLS enabled with ZERO policies on 7 tables
`conversations`, `messages`, `leads`, `saved_searches`, `viewings`,
`wanted_homes`, `property_views` all have RLS on and no policies → all reads
return empty, all writes are rejected. Silent casualties:
- AddSheet "Save search" / "Wanted home" / "New lead" forms: insert fails and
  the form **silently closes as if it succeeded** (see 3.6).
- `useUnreadCount` (nav badge) always 0.
- `useProfileStats` saved-searches / viewings counts always 0.
**Fix: add buyer/agent-scoped policies for all 7 tables** (see migration).

### 1.4 Realtime publication is empty
`supabase_realtime` publication contains no tables, so the
`postgres_changes` subscription in `useUnreadCount` (and any future messaging
realtime) never fires. **Fix: add `conversations` + `messages` to the
publication.**

---

## 2. SEVERITY 2 — Breaks a feature

### 2.1 Agent signups can lose their role (become `buyer`)
`handle_new_user` trigger only copies `full_name`/`avatar_url`; it ignores
`role` and `agency_name` metadata. The client-side follow-up
`profiles.update(...)` in `AuthContext.signUp` only works when a session
exists — with email confirmation enabled there is no session yet, RLS blocks
the update, and the profile stays at the DB default `'buyer'`.
**Fix: trigger reads `role`, `agency_name`, `preferred_language` from
`raw_user_meta_data` (validated).**

### 2.2 Language preference never persists
`Header.jsx` writes `profiles.language` — that column does not exist
(real column: `preferred_language`). The update fails silently, so the
chosen language never syncs across devices. `AuthContext` reads
`profile.language || profile.preferred_language` (dead first branch).
**Fix: use `preferred_language` in both places.**

### 2.3 `sq` (fallback locale!) missing 10 actively-used keys
Albanian users see raw keys (`search.headline`, `favourites.savedCount`, …)
on the Search and Favorites screens. Locale sync status: en 291 keys,
sq 259, pl/ru 232, de/es/fr/it 230 (union 294). **Fix: sync all 8 locales to
the same key set.**

### 2.4 Stored property translations are ignored
The wizard writes `title_i18n` / `description_i18n` (8 languages, and there
is a migration + GIN indexes for them), but `useTranslatedProperty` never
reads them — it always calls the `translate-description` edge function
(cost + latency + flash of untranslated text). Two competing translation
architectures. **Fix: prefer the stored `*_i18n` values; fall back to the
edge function only when the language is missing.**

### 2.5 Agent "listings" stat always 0
`useProfileStats` counts `properties` with `status = 'published'` — that
status does not exist anywhere; the app writes `'active'`. **Fix: 'active'.**

### 2.6 `video_url` collected but never saved
NewListing step 4 has a video URL field, the DB has the column, and the
insert payload omits it. **Fix: include it.**

### 2.7 WhatsApp messages can go to a stranger
`PropertyDetail` falls back to hardcoded phone `'355691234567'` when a
listing has no contact phone → "Schedule viewing" opens WhatsApp to a random
real number. **Fix: hide contact CTAs when there is no phone.**

### 2.8 Messaging is a mock (plan gap, half-built)
Full schema exists (`conversations`, `messages`, unread counters,
`useUnreadCount` hook) but `Messages.jsx` renders hardcoded mock
conversations + "coming soon". **Fix: build a functional conversation list +
thread view with send, mark-read, and realtime updates** (needs 1.3 + 1.4).

---

## 3. SEVERITY 3 — Wrong/risky but survivable

### 3.1 `formatPrice` hardcodes EUR
Listings can be EUR / ALL / USD (wizard + DB `currency` column), but every
price renders as €. **Fix: pass the listing currency through.**

### 3.2 Hardcoded user-facing strings (i18n constraint violations)
- `AuthCallback.jsx`: "Duke u kyçur…" (Albanian)
- `Profile.jsx`: "NEW ACCOUNT", "WELCOME BACK", "Start finding home today.",
  "Your next door is open."
- `Home.jsx`: "· Tirana" (also a dead conditional — both branches identical),
  "Albania", "{n} homes"
- `PropertyDetail.jsx`: stat labels "Beds/Baths/Area/Year", raw
  `property_type`, raw feature names (not through `listing.feature.*`)
- `Favorites.jsx`: "Loading", "FAVORITES", "Your …", "/mo" suffix
**Fix: route all through i18next; add keys to all 8 locales.**

### 3.3 Overly-permissive `properties` SELECT policy
`qual: true` exposes drafts/paused listings (incl. contact phone/email) of
every user to anyone who queries the table directly. **Fix:
`status = 'active' OR owner/agent`.** (Public pages only show active anyway.)

### 3.4 Storage policy sprawl on `property-images`
3 INSERT policies (an agent-only one made meaningless by two broader
unscoped ones), 2 SELECT, 2 UPDATE, 3 DELETE — some folder-scoped, some
owner-scoped. Net effect: any authenticated user can upload to *any* path.
**Fix: consolidate to one folder-scoped policy per operation.**
`avatars` bucket has **no policies at all** (uploads impossible; public read
only works because the bucket is public). Added own-folder write policies.

### 3.5 Role model inconsistency
DB default `'buyer'`, signup writes `'client'`, code checks accept both,
`Messages.jsx` reads `user_metadata.role` while everything else uses
`profile.role`. **Fix: keep accepting both values (data may contain either),
but make Messages.jsx use the profile-based `isAgent` like the rest.**

### 3.6 AddSheet swallows insert errors
`else onClose()` — failures look like success. **Fix: show error toast.**

### 3.7 Debug leftovers
`console.log('[TOAST] …')` in WelcomeToast. Test scripts + screenshots
(`test-*.cjs`, `test-*.png`) at repo root (left in place; flagged).

---

## 4. Code smells / dead-or-unwired code (documented, mostly left alone)

- **Hybrid repo:** the Expo RN app (`app/`, `components/`, `contexts/`,
  `data/`, `lib/*.ts`) and the Vite web app (`src/`) coexist; `package.json`
  mixes both worlds; CLAUDE.md documents only the Expo app (stale).
- **Unwired components** (plausible future features, DB columns exist —
  kept): `floorplan/FloorPlanEditor|Viewer` (DB `floor_plan` jsonb exists),
  `AutoTranslateButton.jsx` (edge fn `translate-property` deployed),
  `CustomDropdown.jsx`.
- **Unused:** `QueryCache` provider mounted in App.jsx but no consumer;
  `@vis.gl/react-google-maps` dependency unused in either app.
- `useProperties.usePropertiesByIds` uses `JSON.stringify(ids)` as dep (works,
  smelly). `property_activity` INSERT policy is `true` (spammable analytics —
  acceptable, noted).
- Search filter sheet lacks `daily_rent` option though the wizard can create
  daily-rent listings.

---

## 5. OAuth status

- **Google** — implemented and reported working (PKCE, redirect to
  `/auth/callback`, handled by `AuthCallback.jsx`). ✔
- **Apple** — nothing in the web app: no button, no provider call. The old
  Expo app has native Apple sign-in, but the web app has zero Apple code.
- **LinkedIn** — nothing anywhere: no button, no provider call.
- Client code needs only `signInWithProvider('apple' | 'linkedin_oidc')` +
  buttons (added in this pass, gated until providers are configured — see
  DECISIONS.md for the exact dashboard/provider-console checklist; I cannot
  and did not create any credentials).

---

## 6. Reconstructed plan status (plan text was not provided)

| Area (inferred step) | Status |
|---|---|
| Project scaffold (Vite + router + theme) | done |
| i18n (8 locales) | done, locales out of sync (fixed) |
| Auth: email/password + OTP | done |
| Auth: Google OAuth | done |
| Auth: Apple + LinkedIn | **not started** (console setup needed) |
| Property browse/search/filters/map | done |
| Property detail + translation | done, used edge fn instead of stored i18n (fixed) |
| Favorites | done (worked once backend restored) |
| Listing wizard (draft → publish) | half-done: buyer publish broken, video_url dropped (fixed) |
| Listing management (my-listings, dashboard) | done |
| Saved searches / wanted / leads (AddSheet) | half-done: UI exists, RLS blocked all writes (fixed); no UI to view saved searches |
| Messaging | **schema only; UI was a mock** (functional v1 built in this pass) |
| Viewings scheduling | schema only; "Book a visit" navigates to a search page that ignores the intent |
| Agent dashboard | placeholder ("coming soon") |

---

## 7. Fix order (Phase 2)

1. DB migrations: agent_id nullable · RLS for 7 tables · properties SELECT
   tightening · storage consolidation · handle_new_user role fix · realtime
   publication.
2. Locale sync (all 8 files) + new keys for previously hardcoded strings.
3. Code fixes: language column, stats status, video_url, currency,
   translations-from-DB, fake phone, AddSheet errors, hardcoded strings,
   Messages role source, console.log.
4. Messaging v1 (list + thread + send + mark-read + realtime).
5. OAuth buttons (Apple/LinkedIn) behind provider config, checklist in
   DECISIONS.md.
6. Browser verification of each screen.
