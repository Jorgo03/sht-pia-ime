# Security Audit — Shtëpia.ime

**Date:** 2026-08-30 · **Branch:** `fix/silent-failures-and-raw-i18n-keys`
**Scope:** Vite web app (`src/`), Expo app (`app/`, `components/`, `contexts/`,
`lib/`), Supabase project `xzzzhlwmzotibrxdqmcm` (schema, RLS, RPCs, storage,
grants), Edge Functions, build output, dependencies.

No secrets are reproduced in this document.

## Executive summary

The application's security posture is **strong**, and unusually so in the two
places that matter most: **no service-role key reaches any client**, and
**Row Level Security is comprehensive, correct, and empirically verified** —
not merely "enabled".

Every ownership policy is expressed against `auth.uid()`. There is no
`USING (true)`, no policy trusting a client-supplied user id for reads, and no
cross-user read or write path. This was proven by probing the live REST API as
an unauthenticated attacker, not by reading policy text alone.

One genuine flaw was found and fixed: the sole permissive policy in the schema
allowed anyone to forge analytics attributed to other users.

**No CRITICAL or HIGH findings.**

## Overall risk

| | Count |
|---|---|
| 🔴 Critical | **0** |
| 🟠 High | **0** |
| 🟡 Medium | **2** (1 fixed in this pass, 1 needs a dashboard toggle) |
| 🟢 Low | **3** |

**Security Rating: 8.5 / 10.**

The deductions are: the permissive INSERT policy that existed until this pass,
the absence of any rate limiting on write and auth endpoints, and leaked-password
protection being switched off. None of these expose user data; all are
abuse/integrity concerns.

---

## Critical findings

**None.**

The most important negative result, stated explicitly because it is the finding
that would matter most if it went the other way:

**Finding:** No Supabase service-role key is exposed to any client.
**Evidence:** Every reference to `SERVICE_ROLE` in the repository is server-side
— three Deno Edge Functions reading `Deno.env.get(...)`, and one Node script
reading `process.env`. None appear in `src/`, `app/`, `components/`,
`contexts/`, or `lib/`. The built web bundle (`dist/assets/*.js`) was scanned
for JWT and key material: it contains only the project ref and an
`sb_publishable_…` key, which is public by design. No `sb_secret_`, no
`SERVICE_ROLE`, no `ANTHROPIC` string is present in shipped code.
**Verification:** re-run the bundle scan after any `npm run build`.

## High findings

**None.** Specifically, no IDOR was found — see Authorization below.

---

## Medium findings

### M1 — Anyone could forge analytics attributed to other users ✅ FIXED

**Severity:** Medium (integrity / business logic; no data disclosure)
**Affected area:** `public.property_activity` INSERT policy
**Status:** Fixed and verified in this pass —
`supabase/migrations/20260830160000_constrain_property_activity_insert.sql`

**Finding:** `property_activity`'s INSERT policy was `WITH CHECK (true)` — the
only permissive policy in the entire schema — and `anon` holds the INSERT grant.

**Attack scenario:** `user_id` is supplied by the client. With no check, an
unauthenticated attacker could POST rows attributing views, calls, messages and
meetings to **any other user's uuid**, against any property. An agent's
dashboard is the product surface that reads this table, so the result is
fabricated engagement — inflating one's own listings, distorting a competitor's,
or planting another real user's id against listings they never opened. `type`
was unconstrained free text and `property_id` could reference a non-existent
property.

**Why it matters:** the dashboard's numbers are what an agent uses to judge
their listings. Poisoned analytics are silent — nothing looks broken.

**Evidence:** `pg_policies` showed `with_check = true`; `role_table_grants`
confirmed `anon` holds INSERT. Live probes then confirmed each abuse path was
accepted before the fix and rejected after.

**Fix:** the policy now requires all three of:
- `user_id is null` (anonymous) **or** `user_id = auth.uid()` — never a third party
- `type` in the five kinds the dashboards read
- `property_id` references a real property

Verified against production data *before* applying: 108 of 160 existing view
rows are anonymous (so anonymous logging had to keep working), types in use are
`view`/`message`/`meeting`, and there are zero null and zero orphan
`property_id` values. `WITH CHECK` applies only to new inserts; existing rows
are untouched.

**Verification (executed, as anon):**

| Case | Result |
|---|---|
| Legitimate anonymous view | **201 allowed** — analytics intact |
| Forge another user's `user_id` | rejected — RLS violation |
| Arbitrary `type` string | rejected — RLS violation |
| Non-existent `property_id` | rejected — RLS violation |
| Null `property_id` | rejected — RLS violation |

Two probe rows created during testing were deleted afterwards.

> **Testing note worth keeping.** The first regression run reported the
> legitimate insert failing with 401 and looked like a serious regression. The
> harness was wrong, not the policy: it sent `Prefer: return=representation`,
> which makes PostgREST read the row back after inserting, and
> `property_activity`'s SELECT policy is owner-scoped — so anon cannot read its
> own write and *every* request 401s regardless of the INSERT check. Testing an
> INSERT policy on an owner-scoped table requires `return=minimal`.

**Not fixed:** request *volume*. Nothing stops a script inserting many
well-formed rows. That needs edge rate limiting — see L4.

### M2 — Leaked-password protection is disabled

**Severity:** Medium · **Affected area:** Supabase Auth configuration
**Finding:** Supabase Auth can reject passwords known to appear in the
HaveIBeenPwned corpus. It is currently off.
**Attack scenario:** users register with already-breached passwords, making
credential-stuffing against this app materially more likely to succeed.
**Evidence:** Supabase security advisor, `auth_leaked_password_protection`.
**Recommended fix:** Dashboard → Authentication → Policies → enable leaked
password protection. **This is a dashboard toggle — I cannot set it from here,
and it is your call to make.**
**Verification:** attempt signup with a known-breached password; expect rejection.

---

## Low findings

### L1 — `buyer_has_open_wanted_home` is an anon-callable oracle

**Severity:** Low · **Affected area:** `public.buyer_has_open_wanted_home(uuid)`
**Finding:** a `SECURITY DEFINER` function taking an **arbitrary** user id,
executable by `anon` via `/rest/v1/rpc/`. Inside the `profiles` SELECT policy it
is correctly gated behind `current_user_is_agent()`, but calling the RPC
*directly* skips that gate.
**Attack scenario:** an unauthenticated attacker who knows or guesses a user
uuid learns whether that person has an open "wanted home" request. Confirmed
live: the call returns `false` for an arbitrary uuid rather than an error.
**Why it is Low:** it discloses one boolean, v4 uuids are not practically
enumerable, and agent ids (the discoverable ones) are not the interesting
targets. No PII is returned.
**Recommended fix:** `revoke execute on function public.buyer_has_open_wanted_home(uuid) from anon;`
The RLS policy calls it as `SECURITY DEFINER` and is unaffected by the anon
grant. There is precedent in this repo —
`20260819213249_revoke_anon_execute_on_claim_role.sql` did exactly this for
`claim_role`. **Left for your approval rather than applied**, since it changes a
production grant and the audit brief asks for high-risk items first.

### L2 — Dependency vulnerabilities in the build toolchain

**Severity:** Low (developer/CI risk, not shipped runtime)
**Finding:** `npm audit` reports 30 vulnerabilities (1 critical, 15 high). The
critical is `shell-quote`; the highs are `@expo/cli`, `metro*`, `postcss`,
`js-yaml`, `nanoid`, `image-size`, `brace-expansion`.
**Why it is Low:** every one is Expo CLI / Metro / PostCSS — build-time
tooling. They do not reach the browser bundle or the React Native JS bundle.
They matter on a developer machine or in CI, not to end users.
**Recommended fix:** do **not** run `npm audit fix --force` — it would move
Expo/Metro across major versions and this repo has already had one painful
native-config migration. Address them when next upgrading the Expo SDK.

### L3 — Storage buckets are public-read (accepted by design)

**Severity:** Low · **Affected area:** `avatars`, `property-images`
**Finding:** both buckets are `public: true`, so any object is world-readable by
URL without passing `storage.objects` RLS.
**Why it is acceptable:** listing photos and agent avatars are meant to be
publicly viewable, and paths are `{user_uuid}/{filename}` — not enumerable.
**What is correctly protected:** *writes*. All eight storage policies scope
SELECT/INSERT/UPDATE/DELETE to `(storage.foldername(name))[1] = auth.uid()`, so
no user can upload into, overwrite, or delete another user's folder. Both
buckets enforce server-side MIME allowlists and size caps (avatars 2 MB, images
50 MB), so client-side validation is not the only gate.
**Recommendation:** none, beyond not placing private documents in these buckets.

### L4 — No rate limiting on auth or write endpoints

**Severity:** Low–Medium depending on exposure
**Finding:** no rate limiting was found in front of signup, sign-in, OTP,
password reset, `property_activity` inserts, or agent-contact writes.
**Attack scenario:** credential stuffing, OTP brute force, analytics flooding
(M1's residual), inflated Supabase costs.
**Recommended fix:** Supabase Auth has built-in per-IP auth rate limits worth
confirming in the dashboard; application writes would need an edge/WAF rule.

---

## Authentication

- PKCE flow (`flowType: 'pkce'`) on the web client — correct for a public client.
- Sessions in `localStorage` with `autoRefreshToken`. Standard for a SPA; means
  a successful XSS would yield the session — mitigated by there being **no XSS
  sink anywhere in the codebase** (see Frontend security).
- `claim_role` — audited closely because it is `SECURITY DEFINER` and callable
  by any authenticated user. **It is correctly written**: whitelists
  `('agent','buyer')` so `admin`/`service_role` are unreachable, operates only
  on `auth.uid()` so it cannot target another user, takes a `FOR UPDATE` row
  lock against races, and **expires 5 minutes after account creation** so an
  established session cannot escalate. Anon execution is already revoked
  (verified live: 401). **Not a vulnerability.**
- No client-controlled role check was found gating server data.

## Authorization

**No IDOR found.** Verified empirically against the live API as an
unauthenticated attacker:

| Probe | Result |
|---|---|
| SELECT `conversations`, `messages`, `favorites`, `saved_searches`, `leads`, `viewings`, `property_activity`, `property_views`, `ai_usage` | **0 rows** each |
| SELECT `wanted_homes` | 401 |
| SELECT `profiles.email` | **400 — column not granted** |
| SELECT `properties` | only `status='active'`; **0 non-active rows** |
| INSERT `properties` / `profiles` | 401 |
| UPDATE every property (`id=neq.<nil uuid>`) | **0 rows affected** |
| DELETE every property | **0 rows affected** |
| RPC `claim_role` as anon | 401 |

Every ownership policy uses `auth.uid()`. Relationship-based reads
(`messages` → `conversations` participants; `property_activity`/`property_views`
→ property owner) are expressed as `EXISTS` subqueries against the owning row
rather than trusting a client value.

## Supabase / RLS

RLS is enabled on **all 12 public tables**. Policy counts and commands were
enumerated; the notable shapes:

- `ai_usage` — RLS on, **zero policies** → fail-closed, unreachable by any
  client. Correct: it is written by Edge Functions under the service role.
- `messages`, `property_activity`, `property_views` — no UPDATE/DELETE policies
  → those operations are denied. Appropriate: an immutable audit/message trail.
- `profiles` SELECT is the most complex policy and is correctly built: self, or
  `role='agent'` (public agent cards), or an existing viewing/conversation
  relationship, or an agent viewing a buyer with an open wanted-home.

**Column-level grants are a strong second layer**, independent of RLS:

| Role | Readable `profiles` columns |
|---|---|
| `anon` | `id, full_name, phone, agency_name, avatar_url` |
| `authenticated` | + `bio, role, created_at, preferred_language, updated_at` |

**`email` is readable by neither role** — email harvesting is blocked at the
grant layer even if a policy were later loosened. This is good defensive design.

Table-level grants are Supabase's permissive defaults (all DML to
`anon`/`authenticated` on every table). That is normal and safe *here* because
RLS is the real gate — proven by the probe table above.

## API security

Edge Functions (`translate-property`, `ai-parse-search`, `ai-listing-assistant`)
hold the service-role key server-side via `Deno.env`, which is correct.
`translate-property` checks the caller's role and treats `service_role`
specially — worth keeping an eye on as that function evolves, but no bypass was
found from a client.

## Storage security

Covered in L3. Writes are correctly owner-scoped; reads are public by design;
MIME and size limits are enforced server-side on the bucket, not only in the
client.

## OAuth security

PKCE is enabled. `detectSessionInUrl: true`. Redirect handling goes through
`/auth/callback`. No open-redirect sink was found (no `window.location =
<user-controlled>` pattern). Note that a previously documented issue — Supabase
not rejecting an unrecognised `redirect_to` up front — is a provider behaviour,
handled in `contexts/auth-context.tsx` with dev-gated diagnostics.

## Frontend security

**No XSS sink exists in the codebase.** `dangerouslySetInnerHTML`, `innerHTML`,
`eval`, `new Function`, and `document.write` return **zero matches** across the
entire repository. All user-supplied content — titles, descriptions, names,
messages — renders through React's escaping. Stored XSS via a listing
description is therefore not reachable.

The one `console.log` in shipped code (`contexts/auth-context.tsx`) is
`__DEV__`-gated and logs no tokens.

## Mobile security

Only `EXPO_PUBLIC_*` values are bundled — URL and publishable key, both public
by design. Nothing bundled is treated as secret. `.env` and `.env.local` are
gitignored (`.env*`); only `.env.example` is tracked, and it contains
placeholders plus an explicit warning never to put `service_role` there.

## Business logic

- A brand-new account can switch buyer→agent within 5 minutes (`claim_role`).
  This is **not** an escalation: signup already offers the Agent role directly.
- Property `INSERT` requires `auth.uid() = owner_id`; `UPDATE`/`DELETE` require
  owner or assigned agent, with matching `USING` **and** `WITH CHECK` on UPDATE
  (so a row cannot be updated into someone else's ownership).
- Non-active properties are invisible to anon — unpublished drafts do not leak.

## Attack paths

The chains worth checking were followed and **all terminate**:

1. *anon → read private data* — every private table returns 0 rows.
2. *anon → write/modify listings* — INSERT 401; UPDATE/DELETE affect 0 rows.
3. *authenticated → escalate to admin* — `claim_role` whitelists two non-privileged
   roles and expires after 5 minutes.
4. *authenticated → read another user's messages* — gated by an `EXISTS` check on
   conversation participation.
5. *anon → poison agent analytics* — **this one was open**, and is now closed (M1).

## Recommended fixes, in priority order

1. **M2** — enable leaked-password protection (dashboard toggle, your call).
2. **L1** — `revoke execute on function public.buyer_has_open_wanted_home(uuid) from anon;`
3. **L4** — confirm Supabase Auth rate limits; consider an edge rule for writes.
4. **L2** — address toolchain CVEs at the next Expo SDK upgrade, not via
   `npm audit fix --force`.

## Verification plan

- Re-run the bundle secret scan after every `npm run build`.
- Re-run the anon boundary probe after any RLS or grant change.
- Re-run the `property_activity` regression after touching that policy —
  remembering `Prefer: return=minimal`.
- Re-run `get_advisors(security)` after any DDL.

## What was actually verified vs. reasoned about

**Verified empirically:** service-role absence from the built bundle; anon
read/write boundaries on 10 tables; column-grant enforcement on `profiles.email`;
property status filtering; `claim_role` anon rejection; the anon oracle's live
response; the `property_activity` policy before and after the fix.

**Reasoned about from source/config, not executed:** cross-user
*authenticated* IDOR (would require creating two throwaway accounts in the
production project — not done, since the policies are uniformly `auth.uid()`-based
and the anon boundary held); OAuth provider-side redirect validation; Vercel
response headers (not inspected — the deployed site was not probed in this pass).
