# Authentication Incident Audit

**Status: Remediated.** See §11 for what was fixed, in a separate implementation pass on branch `fix/auth-recovery-and-validation`. Sections 1–10 below are preserved exactly as originally written, as the historical record of the audit that drove the fix.

**Scope:** `src/` (shipping Vite app) only, per instruction. The legacy Expo tree (`app/`, `components/`, `contexts/`, `data/`) was not diagnosed or modified. Audit-only pass — no application code, migrations, Vercel settings, Supabase settings, or production data were changed. The only file created is this one.

**Evidence sources:** direct read of the specified source files; live Supabase project introspection via the Supabase MCP (`xzzzhlwmzotibrxdqmcm`, `ACTIVE_HEALTHY`, Postgres 17.6.1) — schema, RLS policies, triggers, function bodies, security advisors, identity table, and unified auth logs; direct inspection of the installed `@supabase/auth-js` source for the lock-related hypothesis; live browser reproduction against both the local dev server and the production URL; `curl` against both stated production domains; `npm test` / `npm run build`.

---

## 1. Executive conclusion

**There is no evidence of a system-wide login outage.** Live reproduction this session — email/password with deliberately wrong credentials, Google OAuth initiation, Apple OAuth initiation, LinkedIn OAuth initiation — all behaved correctly end-to-end, and the last 24 hours of production auth logs show 18 successful (`200`) auth requests, proving real users are authenticating right now. The `onAuthStateChange`/async-work "deadlock" hypothesis in the brief is **disproven** by direct inspection of the installed `@supabase/auth-js` source: this codebase's callback never calls another `supabase.auth.*` method from inside itself, and the app's own profile/RPC calls go through a completely separate client (PostgREST) that shares no lock with GoTrue's internal mutex. The suspicion that the `auth.users` trigger might not exist live is also **disproven** — it exists, is enabled, and is correctly configured (`SECURITY DEFINER`, pinned `search_path`). What the audit did find, with evidence: (1) a **genuinely incomplete password-recovery flow** — no `PASSWORD_RECOVERY` event handling anywhere in the app, so a user who clicks a reset-email link lands on the ordinary signed-in dashboard with their old password still in effect, never having been shown a way to set a new one; (2) **massive, real migration drift** — the live database has 24 applied migrations, the repository contains 6 migration files, which means schema conclusions drawn from the repo alone (as opposed to the live DB, which this audit queried directly) would have been wrong; (3) a **real client-side validation defect** — the 8-character password minimum is enforced identically on login and signup, which would silently block any legitimate existing user whose password predates that rule and is 6–7 characters, before any network request fires. None of these three defects presents as "no one can log in" — they are real, worth fixing, and ranked below. **Confidence that there is no active, system-wide login-blocking defect: high (evidence-based, not absence-of-proof).** Confidence that the three defects above are real and reproducible from evidence: high for all three.

---

## 2. Reproduction matrix

| # | Flow | Result | Request | Auth event | Session result | Profile result | Final UI |
|---|---|---|---|---|---|---|---|
| 1 | Existing confirmed user + password | **Requires a human test account** — no credentials available or fabricated. Wrong-password path tested instead (below) as a proxy for the network/error-handling path. | — | — | — | — | — |
| — | *(proxy)* wrong password, real-format email | Reproduced live, this session and prior turns | `POST .../auth/v1/token?grant_type=password` | none (rejected before session) | none created | not queried | "Invalid email or password." shown; button not stuck loading; console showed the expected single `400` |
| 2 | Existing unconfirmed user + password | **Cannot reproduce — no unconfirmed users exist.** Live query: `0` unconfirmed / `12` confirmed / `12` total in `auth.users`. | — | — | — | — | — |
| 3 | New buyer signup + confirmation | **Requires explicit permission + a disposable test account** — not created, per the security rules in the brief. Code path read and is consistent with the confirmed-live trigger (§7). | — | — | — | — | — |
| 4 | New agent signup + confirmation | Same as #3. | — | — | — | — | — |
| 5 | Email OTP code | **Not exercised this pass** (would consume the account's OTP rate-limit budget, which live logs show is already tight — 4× `429` on `/otp` in the last 24h). Code path read: `sendOtp`/`verifyOtp` correctly call `signInWithOtp`/`verifyOtp({type:'email'})`. | — | — | — | — | — |
| 6 | Magic-link login | Not exercised (same rate-limit concern; also requires a live inbox). Code path shares `emailRedirectTo: {origin}/auth/callback` with OTP send. | — | — | — | — | — |
| 7 | Google OAuth | Reproduced live, twice this session (once before this audit, once during it) | `GET .../auth/v1/authorize?provider=google` | n/a (redirect only; stopped before entering real Google credentials, per this agent's standing rule against handling credentials) | n/a | n/a | Full-page navigation to `accounts.google.com`, correct project name shown, no error |
| 8 | Reload with existing session | **Requires a human test account** — needs a real prior session to reload. Code path (`getSession()` + `INITIAL_SESSION`, `persistSession:true`, `localStorage`) is architecturally sound; see §4 for the one real inefficiency found (duplicate hydration, not a failure). | — | — | — | — | — |
| 9 | Protected-route navigation after login | Same as #8 — code path read (`ProtectedRoute.jsx`), logic is correct (`loading` → spinner, `!user` → redirect to `/profile` with intent state, `requireRole` mismatch → redirect `/`), but exercising it needs a real session. | — | — | — | — | — |
| 10 | Sign-out then second login | Code path read only. `signOut()` calls `supabase.auth.signOut()` then synchronously clears local state; no evidence of stale state persisting. Not exercised live (needs a real session first). | — | — | — | — | — |
| 11 | Password reset + new-password completion | Reproduced via code-path analysis only (did not trigger a real reset email — see §9 for why). **Confirmed incomplete — see §7.** | `POST .../auth/v1/recover` (not called this pass) | `PASSWORD_RECOVERY` (per GoTrue source; never handled by the app) | Session *is* created by Supabase on link click | Never queried for this event | User lands on `/profile`, sees the ordinary signed-in dashboard if already resolved as signed-in — no new-password form ever appears |
| — | Apple OAuth (not in the numbered list, but required by the mission) | Reproduced live | `GET .../auth/v1/authorize?provider=apple` | n/a | n/a | n/a | Raw Supabase JSON: `{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}` — provider not toggled on in dashboard, not an app defect |
| — | LinkedIn OAuth | Reproduced live | `GET .../auth/v1/authorize?provider=linkedin_oidc` | n/a | n/a | n/a | Identical to Apple — provider not enabled |

---

## 3. Confirmed root cause

**There is no single confirmed root cause for "users cannot log in," because the evidence does not support that premise as a current, system-wide condition.** Live reproduction of the flows that don't require a real account all behaved correctly, and the last 24h of Supabase's own auth logs show 18 successful requests. If a specific user is reporting a specific failure, the three defects below are the concrete, evidence-backed places most likely to explain a real individual case:

- **Password recovery never completes.** `src/features/auth/AuthContext.jsx`'s `onAuthStateChange` handler (lines 86–111) has branches for `SIGNED_IN`, `TOKEN_REFRESHED`, `SIGNED_OUT`, `INITIAL_SESSION` — no `PASSWORD_RECOVERY` branch. `resetPassword()` (same file, line 214) sets `redirectTo: {origin}/profile`, not a dedicated recovery route. `@supabase/auth-js`'s `GoTrueClient.js` confirms `PASSWORD_RECOVERY` is a real, distinct event the installed SDK fires (`_notifyAllSubscribers('PASSWORD_RECOVERY', session)`) — it's just never listened for. Sequence: user clicks the emailed link → lands on `/profile` with recovery tokens in the URL → SDK's `detectSessionInUrl` exchanges them and creates a real session, firing `PASSWORD_RECOVERY` → `AuthContext` ignores that specific event but the session is real, so the next `INITIAL_SESSION`/state read shows the user as signed in → `Profile.jsx` renders the ordinary signed-in dashboard, never a new-password form → the user's password is unchanged and they have no way to complete what they came to do.
- **Login re-uses signup's password-length gate.** `src/features/auth/pages/Profile.jsx`'s `validate()` (lines 75–95): `if (password.length < 8) { ...; return false }` runs unconditionally, before the `if (isSignUp)` block that's supposed to hold signup-only checks. Supabase's own `/token` endpoint has no minimum-length opinion at sign-in time (only at set-time) — this is a purely client-side gate, applied to a flow it shouldn't touch, and it fails **before any network request is made**, so it wouldn't even appear in the auth logs. Whether any of the 12 existing users actually has a sub-8-character password can't be determined (passwords are hashed, never inspectable) — but the defect in the code is real and unconditional on that fact.

---

## 4. Contributing defects (ranked)

**P1 — Password recovery is structurally incomplete.** See §3. User-facing: a "forgot password" click silently fails to let the user set a new password. Files: `src/features/auth/AuthContext.jsx` (missing event branch), `src/features/auth/pages/Profile.jsx` (no recovery-mode UI state).

**P1 — Migration drift between Git and the live database.** Live: 24 applied migrations (`list_migrations`). Repo (`supabase/migrations/`): 6 files. 18 migrations exist live with no corresponding file in the repository, including several directly relevant to this audit's subject matter: `restrict_profile_role_writes`, `fix_profiles_role_column_grant`, `restrict_profile_select_to_relationship`, `fix_profiles_policy_recursion`, `fix_helper_function_inlining`, `fix_cross_table_policy_recursion`, `grant_anon_public_agent_profile_read` (all 2026-08-09/10), plus `init_marketplace_schema`, `setup_property_images_storage`, `harden_security_advisors`, and others from May–August. This means the schema, RLS policies, and function definitions actually protecting auth-adjacent data **cannot be reconstructed from the repository alone** — every conclusion in this report about live RLS/trigger/function state came from querying the database directly, not from reading migration files, precisely because the files don't reflect current reality. This is a process/reproducibility defect, not itself a login blocker (the live DB is healthy), but it means any *future* audit or environment rebuild starting from Git alone would draw wrong conclusions.

**P2 — Login enforces a signup-only password-length rule.** See §3. Affects only accounts with legacy short passwords (unverifiable count), but the defect is unconditional. File: `src/features/auth/pages/Profile.jsx:75-83`.

**P2 — Three `SECURITY DEFINER` functions are more broadly executable than they need to be.** Supabase's own security advisor flags `public.claim_role(text)`, `public.current_user_is_agent()`, and `public.buyer_has_open_wanted_home(uuid)` as callable by both `anon` and `authenticated` via RPC. Read `claim_role`'s actual body (full source pulled live): it operates only on `where id = auth.uid()`, which is `NULL` for an anonymous caller, so an anon call safely no-ops into `raise exception 'no profile for current user'` — **not an active exploit**, but broader-than-necessary grants on a role-changing function are worth tightening (`REVOKE EXECUTE ... FROM anon`) as defense-in-depth. Not login-related.

**P3 — Duplicate profile hydration on initial load.** `AuthContext.jsx` calls `sync()` from both the top-level `supabase.auth.getSession().then(...)` (line 84) and from the `INITIAL_SESSION` branch of `onAuthStateChange` (line 108). Both fire independently and close together, each doing its own `profiles` select (and, for a fresh OAuth account, potentially both racing to call `claim_role`). Not harmful — both reads are idempotent, and `claim_role`'s own row lock plus its `if (result.role === pending) return profile` guard make a duplicate call a no-op — but it's two network round-trips where one would do. Not a login blocker.

**P3 — `auth_leaked_password_protection` disabled.** Confirmed still off via the live security advisor. Already tracked as a known, pre-existing item (`DECISIONS.md` #10) before this audit — not new, not login-blocking, purely a hardening recommendation, one-click toggle in the Supabase Dashboard.

---

## 5. Ruled-out hypotheses

**"`onAuthStateChange` async work deadlocks the client."** Disproven by reading `node_modules/@supabase/auth-js/dist/module/GoTrueClient.js` directly (installed version, pinned by `@supabase/supabase-js: ^2.45.0`). The internal `_acquireLock`/`navigatorLock` mechanism is scoped to methods on the **auth** client (`this._acquireLock(...)` inside `GoTrueClient` methods like `getSession`, `signInWithPassword`, etc.). `AuthContext.jsx`'s callback is a plain (non-`async`) arrow function that calls `sync(session)` without `await`ing it — the callback itself returns near-instantly regardless of how long `sync()` takes. `sync()`'s own work (`loadProfile` → `supabase.from('profiles')...`, `applyPendingRole` → `supabase.rpc('claim_role', ...)`) goes through the separate PostgREST client, which shares no lock with `GoTrueClient`. `_emitInitialSession` (which fires `INITIAL_SESSION`) does run inside an acquired lock and does `await` the registered callback — but since that callback isn't `async` and doesn't return `sync()`'s promise, the `await` resolves on `undefined` almost immediately, releasing the lock well before `sync()`'s internal network calls complete. No re-entrant lock acquisition occurs anywhere in this path.

**"The `auth.users` trigger may not exist live."** Disproven. Live query against `pg_trigger`/`pg_proc` confirms `on_auth_user_created` exists, is enabled (`tgenabled = 'O'`), invokes `public.handle_new_user()`, which is `SECURITY DEFINER` with `search_path=public` pinned (safe against search-path injection).

**"Wrong production URL — Site URL/redirect mismatch."** The brief supplied `real-estate-app-hazel-seven.vercel.app`; this session's prior work used `real-estate-app-my-self-f307.vercel.app`. Both return `200`. Direct comparison of response headers and the served HTML: **identical `ETag` (`e275888d909ba0c8070a8f88eea04cd2`), identical asset bundle hash (`/assets/index-DHNdu9te.js`)** on both. These are two Vercel aliases pointing at the exact same deployment, not drifted or stale copies — ruled out as a cause of anything.

**"RLS blocks a user from reading their own profile after login."** Disproven. Live policy on `public.profiles` (`SELECT`, `cmd=SELECT`): `role = 'agent' OR auth.uid() = id OR <relationship exists> ...` — `auth.uid() = id` unconditionally permits self-select for every authenticated user, independent of role or relationship state.

**"Orphaned `auth.users` rows with no matching `profiles` row (trigger silently failing for some users)."** Disproven. Live counts: `auth.users` = 12, `public.profiles` = 12. Exact match.

**"Rate limiting is blocking primary login/OAuth."** Live unified-log query, last 24h: 7 total `429`s, broken down by path as 4× `/otp` and 3× `/recover` — **zero** on `/token` (password) or `/authorize` (OAuth). Whatever tripped these was OTP/recovery-email traffic, not password or OAuth sign-in.

**"Google is broken."** Disproven — reproduced live twice, reaches the real `accounts.google.com` consent screen with the correct project identified, no error before that point.

**"Duplicate Supabase client instances inside the shipping app cause session confusion."** Disproven. `grep -rn "createClient("` across `src/`, `app/`, `lib/` returns exactly two hits: `src/lib/supabase.js` (the shipping web app, one client, matches `CLAUDE.md`'s documented architecture) and `lib/supabase.ts` (the legacy Expo app, explicitly out of scope per this audit's own instructions). Zero duplicates within `src/`.

---

## 6. Live configuration comparison

| Setting | Expected (from code) | Actual (verified) | Method |
|---|---|---|---|
| Supabase project health | Active | `ACTIVE_HEALTHY`, Postgres 17.6.1 | `get_project`/`list_projects` (direct) |
| Anon key / URL env vars | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` required, else `src/lib/supabase.js` throws at import | App loads and successfully issues real requests to the correct project in production (auth logs show live traffic against `xzzzhlwmzotibrxdqmcm`) | Indirect — functional evidence, not a direct read of Vercel's env panel (no Vercel access available this pass) |
| Email provider | Enabled (password + OTP both used) | 18× `200` and 12× `400` on password/email-related auth endpoints in 24h logs — endpoint is live and responding | `query_logs` |
| Google provider | Enabled | `GET /authorize?provider=google` → `302` to real Google consent screen | Live browser reproduction |
| Apple provider | Implemented, expected disabled per `DECISIONS.md` | `400 "Unsupported provider: provider is not enabled"` | Live browser reproduction |
| LinkedIn (OIDC) provider | Implemented, expected disabled per `DECISIONS.md` | `400 "Unsupported provider: provider is not enabled"` | Live browser reproduction |
| Email confirmation policy | 12/12 confirmed currently | 0 unconfirmed in `auth.users` | Live query |
| Password minimum length (server-side) | Not directly testable without Dashboard access | N/A this pass | Not verified — Dashboard-only setting |
| Rate limits | Default Supabase limits assumed | 4× `429` on `/otp`, 3× on `/recover` in 24h — consistent with default limits under repeated testing | `query_logs` |
| CAPTCHA | Not referenced anywhere in `src/features/auth/` | No captcha widget/token in any auth call | Static search |
| Site URL / production redirect URL | Both `real-estate-app-hazel-seven.vercel.app` and `real-estate-app-my-self-f307.vercel.app` must be reachable and serve `/auth/callback`, `/profile` | Both return `200` for `/`, `/profile`, `/auth/callback`; both are the *same* deployment (§5) | `curl`, live |
| Local dev redirect URL | `http://localhost:5173/auth/callback` | Confirmed accepted by `/authorize` in prior-session live testing (not re-verified this pass to avoid redundant `/authorize` calls against the OTP-adjacent rate limit) | Prior-session live test |
| Google Cloud OAuth redirect URI | Must be exactly `https://xzzzhlwmzotibrxdqmcm.supabase.co/auth/v1/callback` | Confirmed via the `redirect_uri` param Supabase actually sends to Google in the `/authorize` → Google redirect, captured in prior-session live testing | Prior-session live test (direct `curl -D -` on `/authorize`) |
| Production Vercel env vars, exact deployed commit | N/A — no Vercel dashboard/API access available this pass | **Not verified — requires Vercel access this audit does not have** | — |

---

## 7. Database/schema comparison

- **`auth.users` trigger**: `on_auth_user_created`, enabled, `EXECUTE FUNCTION public.handle_new_user()`. Confirmed live (§5). The brief's suspicion that repo migrations "redefine `handle_new_user()` but may not create the trigger" does not hold — the trigger exists in the live database regardless of what the (drifted) repo migration files show.
- **`handle_new_user()`**: `SECURITY DEFINER`, `search_path=public` (pinned — safe).
- **`claim_role(new_role text)`**: exists, `SECURITY DEFINER`, `search_path=public` pinned, full body reviewed live (§4 P2) — internally scoped to `auth.uid()`, validates role enum, enforces row lock + 5-minute window matching the client-side comment's stated intent.
- **`public.profiles`**: 9 columns present as expected (`id, full_name, avatar_url, phone, role, agency_name, bio, created_at, updated_at, preferred_language`), `role` constrained to `('buyer','agent')` via a `CHECK`, `preferred_language` constrained to the 8 shipped locales. **No `client` value exists in the live constraint** — `AuthContext.jsx`'s `isClient` getter (`profile?.role === 'client' || profile?.role === 'buyer'`) checks for a value the database will never actually contain going forward; harmless (the `buyer` half of the OR still matches), but the `client` half is dead code against the current constraint. This is a legacy-vocabulary leftover, not a bug — already tracked in `DECISIONS.md` §7 as a known, deliberate non-fix.
- **RLS on `profiles`**: 3 policies (SELECT/INSERT/UPDATE), all reviewed in full (§5). Self-access is unconditional; no RLS-driven login blocker.
- **`auth.users` ↔ `profiles` integrity**: 12 = 12, zero orphans.
- **`auth.identities`**: 8 `google` + 5 `email` = 13 identities across 12 users — direct proof that Supabase's automatic identity-linking-by-verified-email is functioning in this live database (one real user has both linked), satisfying the account-linking requirement without any app-side linking table.
- **Migrations**: 24 live, 6 in repo. **Confirmed drift**, ranked P1 above (§4). Cannot state migrations are "complete, ordered and reproducible" from the repository as it stands — they are, evidently, complete and ordered *in the live database*, but the repository is not a faithful record of how it got there.
- **Security advisors** (live, full list pulled): one `INFO` (`ai_usage` has RLS enabled with zero policies — locks the table down entirely, not auth-related), three `WARN`s for broad `SECURITY DEFINER` EXECUTE grants (§4 P2), one `WARN` for leaked-password protection being off (§4 P3, pre-existing/tracked). No `ERROR`-level findings.

---

## 8. Minimal remediation plan (not implemented — audit only)

1. **Password recovery** — add a `PASSWORD_RECOVERY` branch to `AuthContext.jsx`'s `onAuthStateChange` handler that sets a distinct auth-context state (e.g., `passwordRecovery: true`) instead of falling through to the ordinary signed-in path; add a new-password form to `Profile.jsx` (or a new route) that renders when that state is set, calling `supabase.auth.updateUser({ password })` on submit, then clearing the recovery state and routing to the signed-in dashboard normally. No schema change required.
2. **Login validation** — in `Profile.jsx`'s `validate()`, move the `password.length < 8` check inside the existing `if (isSignUp)` block (alongside the `fullName`/`confirmPassword` checks already scoped there); for the sign-in path, only check that a password was entered at all and let `/token`'s own response be authoritative.
3. **Migration drift** — pull the 18 missing migrations from the live database (`supabase db pull` or equivalent) and commit them to `supabase/migrations/`, so the repository becomes a faithful record of live schema state going forward. No live change required — this is a repo-only fix.
4. **`SECURITY DEFINER` grants** — `REVOKE EXECUTE ON FUNCTION public.claim_role(text), public.current_user_is_agent(), public.buyer_has_open_wanted_home(uuid) FROM anon;` (keep `authenticated` where the function is meant to be called by signed-in users; re-verify each function's actual intended caller before revoking from `authenticated` too, since `current_user_is_agent()` is likely used inside the `profiles` SELECT policy itself and revoking too broadly could break that policy — check its usage in the policy `qual` expressions first).
5. **Double hydration** (optional, P3) — drop either the standalone `getSession().then(sync)` call or the `INITIAL_SESSION` branch's `sync()` call, since both fire for the same initial-load case; keep whichever ordering guarantee the team prefers.
6. **Leaked-password protection** — one-click enable in Supabase Dashboard → Authentication → Providers → Email (pre-existing recommendation, unrelated to this incident).

---

## 9. Acceptance-test plan

**Password**: sign in with a real confirmed account (6, 7, and 8+ character passwords, pre- and post-fix for item 2 above) → correct accept/reject behavior, no client-side false rejection for short-but-valid existing passwords.

**Signup + confirmation**: new buyer and new agent signup on a disposable test address → confirmation email arrives → 6-digit code verifies → `profiles` row created with the correct `role`/`agency_name` → session established → lands signed in.

**OTP**: request a code → arrives → verifies → session established. Re-request before cooldown expires → correctly blocked client-side (already implemented) and does not silently retry against the `429`-prone `/otp` endpoint.

**Google OAuth**: full round-trip with a real Google account (something this audit could not do) → returns to `/auth/callback` → `SIGNED_IN` fires → `AuthCallback.jsx` navigates to `/` → session persists on refresh.

**Refresh with existing session**: sign in → hard refresh → still signed in, no flash of signed-out UI, no duplicate `profiles` fetch visible in the network tab after fix item 5.

**Role (`claim_role`)**: OAuth signup as agent → `fho_pending_role` stashed → callback lands → `claim_role` applied within the 5-minute window → `profiles.role = 'agent'`. Attempt the same RPC unauthenticated (no session) → confirms the `anon`-safe rejection already proven in this audit continues to hold after item 4's grant tightening.

**Recovery**: request a reset on a disposable test account → click the link → **after fix item 1** — lands on a distinct new-password form (not the ordinary dashboard) → submits a new password → can then sign in with the new password and not the old one.

---

## 10. Manual owner actions

These cannot be completed through code changes in this repository:

- **Apple provider**: Apple Developer Program enrollment, Services ID, Sign In with Apple key, then enable in Supabase Dashboard → Authentication → Providers → Apple. (Already documented with the exact checklist in `DECISIONS.md` §2.)
- **LinkedIn provider**: LinkedIn Developer app with the OIDC product, then enable in Supabase Dashboard → Authentication → Providers → **LinkedIn (OIDC)**. (`DECISIONS.md` §3.)
- **Leaked-password protection**: toggle in Supabase Dashboard → Authentication → Providers → Email.
- **Vercel environment variables and exact deployed commit**: this audit had no Vercel dashboard/API access; confirming `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` are set correctly in the Production environment, and that the live deployment matches the expected Git commit, needs to be done by someone with Vercel access.
- **Production Auth-log review beyond 24h**: the log tool used this pass caps at a 24-hour window; a longer historical review (if the incident is intermittent or predates that window) needs direct Supabase Dashboard log access with a wider range.
- **A disposable test account with explicit permission**: needed to actually execute reproduction flows 1, 3, 4, 5, 6, 8, 9, 10, 11 rather than analyze their code paths — this audit deliberately did not fabricate credentials or create production users without that permission.

---

**Confirmed root cause:** No system-wide login-blocking defect was found or reproduced. Two real, narrower defects were confirmed with direct evidence: (1) the password-recovery flow never completes because `PASSWORD_RECOVERY` is not handled anywhere in the app, and (2) the sign-in path incorrectly re-uses the 8-character signup password minimum, which would silently block any legitimate account with a shorter legacy password before any network request is sent.

**Confidence:** 90% that no active, system-wide login outage exists (based on live reproduction + 24h production auth logs showing successful traffic, not absence of testing). 95% that the two defects above are real, given full source/config evidence for both. Lower confidence (this audit could not directly test) on flows 1, 3, 4, 5, 6, 8, 9, 10 in the reproduction matrix, which require a real or disposable test account this pass did not have permission to create.

**Exact failing sequence (password recovery, the one fully-confirmed end-to-end defect):** `resetPassword(email)` → Supabase sends recovery email → user clicks link → lands on `/profile?...recovery tokens...` → `detectSessionInUrl` exchanges tokens, creates a real session → GoTrue fires `PASSWORD_RECOVERY` → `AuthContext.jsx`'s `onAuthStateChange` switch has no matching branch → event is silently dropped → user's subsequent state resolves as an ordinary authenticated session → `Profile.jsx` renders the signed-in dashboard → no new-password form is ever shown → password is unchanged.

**Files/settings implicated:** `src/features/auth/AuthContext.jsx` (missing `PASSWORD_RECOVERY` branch), `src/features/auth/pages/Profile.jsx` (`validate()`'s unconditional password-length check; no recovery-mode UI), `supabase/migrations/` (18 migrations behind live), three `public.*` functions' `EXECUTE` grants (advisor-flagged, low real risk).

**Whether Prompt 2 can safely proceed:** Yes, with scope corrected. A "fix everything, users can't log in" framing is not supported by this audit's evidence and would risk unnecessary changes to a system that is largely working. A scoped Prompt 2 targeting the two confirmed defects (password recovery completion, login validation) plus the migration-drift pull would be safe, evidence-backed, and directly traceable to this report.

---

## 11. Remediation (implemented on `fix/auth-recovery-and-validation`)

Only the items confirmed above were touched. The `onAuthStateChange` deadlock and redirect/Site-URL hypotheses, both disproven in §5, were **not** acted on — no OAuth config, redirect URLs, or session-sync architecture were rearchitected.

**Password recovery (§3, §4 P1) — implemented in full.**
`src/features/auth/AuthContext.jsx` now handles `PASSWORD_RECOVERY` as its own event: sets a `passwordRecovery` flag (distinct from an ordinary `SIGNED_IN`) and still hydrates the session/profile normally, since the recovery session is real. `src/features/auth/pages/Profile.jsx` checks that flag before its signed-in/signed-out branches and renders a dedicated new-password + confirm form when set, calling the new `updatePassword()` context method (`supabase.auth.updateUser({ password })`), which clears the flag on success. Confirmed via direct inspection of the installed `@supabase/auth-js` source that `detectSessionInUrl: true` (already configured) automatically exchanges the recovery link's PKCE code and fires `PASSWORD_RECOVERY` — no change was needed to `AuthCallback.jsx` or the redirect target. Not live-tested end-to-end (would require sending a real reset email — see §10's note on test-account permission, unchanged); verified via source-level tracing of the exact event path instead.

**Login validation (§3, §4 P2) — fixed.**
`Profile.jsx`'s `validate()`: the `password.length < 8` check moved inside the existing `isSignUp` block; sign-in now only requires a non-empty password (new `errors.passwordRequired` key, all 8 locales) and lets `/token`'s own response be authoritative. Live-verified: submitting a 7-character password on sign-in now reaches Supabase and returns its real "Invalid email or password" rejection, instead of being blocked client-side before any request — confirmed by direct observation of the network behavior, not inferred.

**Duplicate profile hydration (§4 P3) — fixed, plus one hardening pass beyond what was strictly confirmed.**
Removed the standalone `supabase.auth.getSession().then(sync)` call; a single `onAuthStateChange` subscription now drives both initial hydration and every later event, relying on GoTrue's documented guarantee that `INITIAL_SESSION` fires exactly once per subscriber. Added a generation counter so a slow in-flight profile fetch from an old event can't commit its result after a newer event (e.g. sign-out) has already superseded it — this specific race wasn't directly observed failing, but it was a genuine gap the duplicate-hydration fix made easy to close correctly at the same time, at negligible additional risk. `loadProfile()` now wraps its query in try/catch so a thrown exception (as opposed to an RLS/API-level `{error}`, which already degraded gracefully) can't leave `loading` stuck forever or take the session down with it.

**Event routing made testable.**
The event → action decision that used to live inline in the `onAuthStateChange` callback was extracted to `src/lib/authEvents.js` (`classifyAuthEvent`), a pure function with no imports and no I/O — `AuthContext.jsx` now calls it and acts on the returned descriptor. Behavior is unchanged (verified live pre/post-refactor); the extraction exists purely so the routing logic has real unit test coverage without needing a live Supabase client or a React render environment, which this repo's plain `node --test` setup doesn't support.

**`try/finally` on loading state.**
`handleAuth`, `handleSendOtp`, `handleResend`, `handleVerifyOtp` in `Profile.jsx` now wrap their body in `try/finally` so `setLoading(false)` always runs, even on an unexpected exception (previously called manually after each `await`, which an uncaught throw would skip).

**Migration drift (§4 P1, §7) — closed.**
Pulled the exact SQL (`supabase_migrations.schema_migrations.statements`, verbatim, not reconstructed) for all 18 migrations that existed live but not in the repo, and committed them as new files. Repo now has 24 migration files matching all 24 live migrations exactly (confirmed by count and by version). New files use full `<timestamp>_<name>.sql` filenames (Supabase CLI's actual convention) rather than the 6 pre-existing files' shortened date-only names, since several of the pulled migrations share the same date and date-only names would collide.

**`SECURITY DEFINER` grants (§4 P2, §7) — partially tightened, with the rest deliberately deferred.**
New migration `20260819213249_revoke_anon_execute_on_claim_role.sql`, applied live and verified (`has_function_privilege('anon', ..., 'EXECUTE')` now `false`; `authenticated` unaffected, confirmed still `true`). `current_user_is_agent()` and `buyer_has_open_wanted_home(uuid)` were deliberately **not** touched: both are called inside `public.profiles`' SELECT policy, which `anon` also evaluates for the public `/agent/:id` and property-listing agent-info reads. Live-confirmed the actual mechanism behind the advisor finding in the first place: Supabase grants `EXECUTE` on new `public`-schema functions to `anon`/`authenticated` via a project-level default-privilege rule, which a plain `revoke ... from public` in the creating migration doesn't override (`public` here means the Postgres pseudo-role, not the schema) — that's why the advisor still flagged all three despite two of them having an explicit revoke in their own migration. For `claim_role`, revoking `anon` is risk-free (nothing in RLS evaluation calls it). For the other two, revoking `anon` would very likely break the public agent-profile feature the moment a policy evaluation reaches a non-agent row, because Postgres can't short-circuit past a function call it lacks EXECUTE on — it errors the whole query rather than just excluding the row. Fixing this properly needs restructuring the policy (e.g., splitting an anon-only branch that never calls either function), not a plain grant change, and is out of scope for this pass. Flagged in `DECISIONS.md`.

**Deliberately not done.**
No change to Google/Apple/LinkedIn configuration, redirect URLs, Site URL, or the core session-sync architecture beyond the two items above — none were confirmed broken. `handle_new_user()`'s `buyer`/`client`/`agent` compatibility was already correct live (§7) and untouched. No new state-management or auth library was added.

**Verification:** `npx tsc --noEmit` clean · `npm run lint` 0 errors, 16 warnings (unchanged pre-existing baseline) · `npm run build` ✓ · `npm test` 37/37 (23 pre-existing + new: 8 `authEvents` classifier tests, 4 `localeSync` tests scoped to this change's own keys) · static search confirms exactly one `createClient()` in `src/` · static search confirms `authEvents.js` (the code the `onAuthStateChange` callback now delegates to) makes zero `supabase.*` calls · live browser re-verification of both the login-validation fix and unchanged rendering after the classifier refactor.

**Production verification: pending.** Everything above was verified via source inspection, live database queries against the production Supabase project, and local dev-server browser testing — not against the deployed production build, and not with a real user account completing the recovery flow end-to-end. See the final response for the exact remaining steps.
