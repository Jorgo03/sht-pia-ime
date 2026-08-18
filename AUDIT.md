# Pre-Launch Audit — Shtëpia.ime (Vite web app)

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
