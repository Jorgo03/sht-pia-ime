# Pre-Launch Fixes — Shtëpia.ime

Worked from `LAUNCH_READINESS.md` and `SECURITY_AUDIT.md` (both 2026-08-30).
Every row below is either **implemented and verified**, or explicitly marked as
an owner/external action. Nothing is marked fixed without evidence.

| ID | Finding | Sev | Fix type | Implemented | Verification performed | Remaining |
|---|---|---|---|---|---|---|
| C1 | No Privacy Policy / Terms | 🔴 | Owner + code | **Infrastructure done** | Config module + Profile links on web & mobile; links hidden unless a real `https://` URL is set | **Owner: publish the two documents and set the URLs** |
| F1 | Account deletion missing | 🔴 | Code | **Done** (previous pass) | Auth boundary re-verified: 4 attack cases rejected | Owner: run once against a disposable account |
| F2 | `SYSTEM_ALERT_WINDOW` shipped | 🟠 | Code | **Done** | `tools:node="remove"` confirmed after a clean prebuild | — |
| M1 | No rate limiting | 🟡 | Mixed | **Assessed, not invented** | 3 Edge Functions already limit 30–60/hr per user-or-IP | Owner: confirm Supabase Auth limits; edge/WAF for anon writes |
| M2 | Splash flash (white/black) | 🟡 | Code | **Done** | Native `colors.xml` = `f1ede6`, `values-night` = `0e0b09` after prebuild | — |
| M3 | `property_activity` unbounded | 🟡 | Code + owner | **Function done** | Executed live: deleted 0 rows, 174 intact | **Owner: `create extension pg_cron` + schedule** (SQL in migration) |
| L1 | Anon-callable oracle | 🟢 | Code | **Done** | Returns constant `false` to non-agents; anon profile reads still 200 | — |
| L2 | Leaked-password protection off | 🟢 | Dashboard only | **Not possible in code** | — | **Owner: enable in Supabase Auth** |
| L3 | 30 npm audit findings | 🟢 | Assessed | **No change, deliberately** | All Expo CLI / Metro / PostCSS build tooling; not shipped | Address at next SDK upgrade |
| L4 | 12 lint warnings | 🟢 | Code | **Done** | `npm run lint` → **0 problems** | — |

---

## C1 — Privacy Policy / Terms infrastructure

**No legal text was written or invented.** What was built is the plumbing so the
URLs drop in:

- `lib/legal.ts` (Expo) and `src/lib/legal.js` (Vite) — one place per app,
  reading `EXPO_PUBLIC_PRIVACY_POLICY_URL` / `VITE_PRIVACY_POLICY_URL` and the
  matching terms vars.
- Links rendered in Profile on **both** apps.
- `.env.example` documents all four variables.

**The deliberate design choice:** a URL only counts as configured if it starts
with `https://`. Empty, placeholder, and relative values are all treated as
absent, and the links are then **hidden entirely** rather than rendered dead.
A link that 404s in front of a reviewer is worse than an honestly absent one —
reviewers click them.

```
Privacy Policy URL: OWNER ACTION REQUIRED
Terms URL:          OWNER ACTION REQUIRED
```

## F1 — Account deletion re-verified

Implementation unchanged (correctly, per the brief's §26 — the custom teardown
must not be replaced by a bare `deleteUser()`). Re-verified the auth boundary
against the live function:

| Attack | Result |
|---|---|
| No `Authorization` header | 401 |
| Anon key as bearer (valid JWT, not a user) | 401 |
| Forged/garbage token | 401 |
| `GET` instead of `POST` | 405 |
| Forged `user_id` in body | ignored — uid comes from the verified token |

```
CODE VERIFICATION:      PASS
REAL ACCOUNT EXECUTION: OWNER ACTION REQUIRED
```

Not executed because it permanently destroys real data, and no disposable
account exists in this project.

## L1 — The fix that had to be redone

Worth recording because the obvious fix was wrong.

The audit recommended `revoke execute ... from anon`, with precedent in
`20260819213249_revoke_anon_execute_on_claim_role.sql`. **Applied, and it broke
public agent profiles.**

RLS evaluates a policy's function calls as the *calling* role, and the
`profiles` SELECT policy ends with
`(current_user_is_agent() AND buyer_has_open_wanted_home(id))`. Postgres did not
short-circuit the `AND`, so every anonymous read of `profiles` failed with
`42501 permission denied for function buyer_has_open_wanted_home` — taking out
every public agent page.

Caught by testing anon profile reads immediately after applying, and rolled
back in the same session. **What shipped instead:** keep the grant so the policy
still evaluates, and move the gate *inside* the function. The policy already
ANDs with `current_user_is_agent()`, so no policy outcome changes — but a direct
RPC call from a non-agent now returns a constant `false`.

Verified after: anon `/profiles` → **200, 5 rows**; anon RPC → **`false`**.

## M3 — Retention, and a correction

`pg_cron` is **available but not installed** — an earlier query of mine returned
it from `pg_available_extensions` and I initially read that as installed. The
authoritative `pg_extension` join returns no row.

Enabling a Postgres extension on a production database is a deliberate
infrastructure change, so it was not done unprompted. The retention *function*
shipped and was executed live (**0 rows deleted, 174 intact**). The exact SQL to
enable scheduling is in the migration header.

Retention is **400 days**, derived from what the app queries (both dashboards
use a rolling 30-day window), not picked arbitrarily — flagged for your
confirmation.

## L4 — Lint: 12 → 0

Not silenced blindly. Three categories:

- **Genuinely dead code removed** — unused `meIsClient`, unused `ArrowLeft`
  import, unnecessary `router` dependency.
- **Expression extracted to a named variable** — `JSON.stringify(ids)` →
  `idsKey`, and `cooldown > 0` → `isCoolingDown`. This resolves the
  "complex expression in dependency array" warnings *legitimately* rather than
  suppressing them.
- **Documented suppressions (5)** — every remaining effect depends on
  `user?.id` / `property?.id`, a stable string, rather than the object. Adding
  the object would re-run the effect on every Supabase refresh — and in
  `useUnreadCount` and `useUpcomingViewings` would tear down and re-open a
  realtime channel each time. Each suppression carries the reason inline.

## Verified clean, no change needed

- **Secrets** — rebuilt bundle contains no `sb_secret_`, `SERVICE_ROLE`, or
  `ANTHROPIC_API_KEY`; only the public `sb_publishable_…` key.
- **Dev URLs** — the single `localhost:9999` hit in the bundle is
  **supabase-js's own internal GoTrue default constant** (it sits beside the
  library version string), overridden by the real URL at `createClient()`. Not
  our code, never used.
- **Security regression** — all 21 anon boundary probes still pass after every
  database change above.
- **Permissions** — after a clean prebuild, both `SYSTEM_ALERT_WINDOW` and
  `RECORD_AUDIO` carry `tools:node="remove"`; `VIBRATE` and the storage
  permissions remain justified by `expo-haptics` and `expo-image-picker`.
