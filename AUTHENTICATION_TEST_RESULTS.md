# Authentication test results — 2026-11-18

Branch `fix/registration`. Statuses: **PASSED** (run and passed), **FAILED**,
**NOT TESTED**, **BLOCKED** (needs something not available here). "Simulated"
means the app ran in Chromium against the fake Supabase in
`e2e/support/backend.ts` with the server's real answers replayed; nothing was
written to production.

## Live production evidence (read-only)

| Check | Result | Source |
| --- | --- | --- |
| Sign-ups on 2026-11-17 | 28, all 422 `user_already_exists`, 5 addresses, all existing accounts (3 made with Google) | Supabase auth logs |
| Password sign-ins 23:28 UTC | 3 × 400 `invalid_credentials` (wrong password), then Google sign-in **succeeded** for the same person | Supabase auth logs |
| Password sign-in with the right password | Works: successful `login` at 16:15 UTC the same day | Supabase auth logs |
| Password reset / email code to a non-owner address | **FAILED on the server**: 500, Resend 550 "only send testing emails to your own email address" | Supabase auth logs, 21:48:07 |
| Confirm email | Off (`mailer_autoconfirm: true`) | `GET /auth/v1/settings` |
| New account, profile, role | Last new email account (2026-11-08) created, signed in, profile `buyer`; last new agent (2026-11-06) has role `agent` and an office | `auth.users` ⨝ `profiles` (no addresses read) |
| Live site, existing address (before the fix) | One faint line, no next step | Playwright on the live site, 422 replayed in the browser |
| Live site after deploy `c11d7f3` (Vercel READY), in Albanian | **PASSED**: sign-up → "Ky email është regjistruar më parë." + hint + Hyr me këtë email / Ke harruar fjalëkalimin? / Vazhdo me Google; "Hyr me këtë email" keeps the address; wrong password → "Email ose fjalëkalim i gabuar." + reset and Google | Playwright on the live site, server answers replayed in the browser, nothing sent to Supabase |

## Automated

| Suite | Result |
| --- | --- |
| `npx tsc --noEmit` | PASSED (0 errors) |
| `npm run lint` | PASSED (0 errors; 34 warnings, all pre-existing) |
| `npm test` | PASSED 634/634 |
| `supabase/tests_handle_new_user.test.mjs` (PGlite) | PASSED 4/4, including "the current live function aborts an 81-character office" |
| `npm run test:e2e:expo` (the production website build), full | PASSED 444, 142 skipped, 0 failed (before X112 was added) |
| Same, every auth case after the last change (X03, X17, X18, X27, X30–X32, X56–X62, X109–X112) | PASSED 36/36 (phone 390×844 and desktop) |
| `npm run test:e2e` (legacy Vite site, still in CI) | PASSED 271, 9 skipped |

## Scenarios

| # | Scenario | Website (Expo web) | Phone app | How |
| --- | --- | --- | --- | --- |
| A | Client sign-up, Confirm email off → signed in, profile | PASSED (simulated, X110 for agent; X03 sign-in) | Same code; not run on a device | e2e |
| A' | Client sign-up with code (Confirm email on) → verify → signed in | PASSED (simulated, X56/X57) | Same code; not run on a device | e2e |
| B | Agent with office: role `agent` and office sent; trigger keeps both; buyer never gets an office; `admin` request becomes `buyer` | PASSED (X56, X110 + PGlite) | Same code | e2e + PGlite |
| C | Phone app on a real device | **NOT TESTED** (no device here); the screen is the same `app/(tabs)/profile.tsx` | | |
| D | Account made on one platform signs in on the other | Same Supabase project and code path; **NOT TESTED** with a new account (would write production data) | | |
| E1 | Invalid email | PASSED (X56 validation path; Vite F4-N2) | Same code | e2e |
| E2 | Weak / mismatched password | PASSED (Vite F4-N2; X31) | Same code | e2e |
| E3 | Existing email → message + sign in / reset / Google | PASSED (X60, X109) | Same code | e2e |
| E4 | Wrong password → reset / Google | PASSED (X112) | Same code | e2e |
| E5 | Wrong code, 5-attempt cap, expired code, resend | PASSED (X57–X59) | Same code | e2e |
| E6 | Unverified session refused; dashboard shut | PASSED (X61, X62) | Same code | e2e |
| E7 | Name/office over 80 characters | PASSED (X111 form; PGlite trigger) | Same code | e2e + PGlite |
| E8 | Email provider failure shown as "could not send" | Mapping unit-tested (`authErrors`); live provider failure seen in logs | | unit |
| F | Real email delivery to a non-owner address | **BLOCKED**: SMTP sender (owner step 1 in `REGISTRATION_FIX_REPORT.md`) | | |
| G | Google sign-in | Live success in the logs at 23:28:57 UTC; not changed | | logs |

## Password rules (2026-11-18 afternoon)

| Check | Result | How |
| --- | --- | --- |
| Unit: each missing class gives its own message; the symbol set matches Supabase's; ë/Ë and € do not count; 72-byte limit kept; checklist agrees with the rule | PASSED (`npm test` 636/636) | `tests/password.test.mjs` |
| `npx tsc --noEmit`, `npm run lint` | PASSED (0 errors) | |
| Vercel preview of `03ae82b` (the real web build), phone size, Albanian | **PASSED**: `shtepia2026` → checklist shows uppercase and special missing; Create Account refused with "Fjalëkalimi duhet të ketë një shkronjë të madhe (A–Z)." and nothing sent; `Shtepia-2026` → all five ticked, sent once, verify step opens | Playwright, sign-up request intercepted |
| Live website after deploy `4e95d87` (Vercel READY), Albanian | **PASSED**: no lowercase / no number / no special character each refused with its own message, nothing sent; `Shtepia-2026` sent once and the verify step opens | Playwright on the live site, sign-up intercepted |
| e2e X113 / F4-N2 (new) and both full suites | **PASSED on GitHub CI**, run 44337550434 on master `cd4ed78` (contains every commit here): lint/types/unit, End-to-end, End-to-end Expo web build all green. Locally the website suite passed; the Expo-web export could not run on this laptop (out of memory) | CI |
| Phone devices | NOT TESTED (same screen code as the web build) | |
