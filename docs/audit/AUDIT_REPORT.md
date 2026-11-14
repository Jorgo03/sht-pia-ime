# Shtëpia.ime full audit: report

Covers 2026-11-13 and 2026-11-14, branch `audit/full-sweep`.

- **Companion files:**
  - `FINDINGS.md`: the checkpoint-1 table.
  - `FIRST_PASS_DETAIL.md`: the first pass's baseline and Supabase evidence.
  - `WORKLOG.md`: the running log.
  - `../LAUNCH_PLAN.md`: publishing to web, App Store and Google Play.

## Summary

**Health score: 7/10 → 8.5/10.**

The app was in good shape before the audit, with no Critical issues. The audit found 31 problems: **2 High, 8 Medium, 21 Low**.

**17 are fixed**, each shown failing first by a test or a check (npm audit, expo-doctor). The exception is AUDIT-026, a type correction that `tsc` already accepted. 4 of them are live on the database or Edge Functions, applied with the owner's OK.

**Main fixes:**
- **Viewings:**
  - no double booking;
  - a confirmed time can't be moved behind the agent's back;
  - times are Tirana time on every device.
- **Listing page:** a failed load offers a retry instead of "no longer available".
- **Account deletion:** it now also removes chat files.
- **Signed-out visitors:** they lose database permissions they never used.
- **Chat:** an open conversation catches up after a dropped connection.
- **Favourites:** a quick unsave is no longer lost on a slow connection.
- **iPhone permission prompts:** now in Albanian as well as English.
- **Apple button:** hidden until Sign in with Apple works.

**Still open:**
- **0 Critical.** 1 High: Confirm email. It is the owner's setting, blocked until email sending (SMTP) works.
- The other open items need the owner (accounts, the domain, settings) or a separate OK (a database change, a new dependency). Three are deferred, with reasons below.

**Row-level security** was verified on all 29 tables on the live database, as a signed-out visitor, as the owner and as another user: **51/51**.

## Numbers by severity

| Severity | Found | Fixed | Open, needs owner or OK | Deferred |
|---|---|---|---|---|
| 🔴 Critical | 0 | 0 | 0 | 0 |
| 🟠 High | 2 | 1 | 1 | 0 |
| 🟡 Medium | 8 | 6 | 2 | 0 |
| ⚪ Low | 21 | 10 | 8 | 3 |
| **Total** | **31** | **17** | **11** | **3** |

## All findings

Status: ✅ fixed · ✅🔴 fixed and **live** in production (DB or Edge Function) · 👤 owner · ⏸ needs an OK · 🕓 deferred.

| ID | Sev | Area | Platform | Problem | Evidence | Fix | Status | Commit |
|---|---|---|---|---|---|---|---|---|
| AUDIT-001 | 🟠 | Auth | all | "Continue with Apple" was shown, but the Apple provider is off, so it always failed | `/auth/v1/settings` has no `apple` | Hidden behind `APPLE_SIGN_IN_ENABLED` in both apps | ✅ (owner: turn Apple on before App Store review) | `d8f4bf0` |
| AUDIT-002 | 🟠 | Auth config | all | Confirm email is off: an API sign-up gets a confirmed session for any address | `mailer_autoconfirm: true` | Turn it on after SMTP works (DECISIONS.md order) | 👤 | — |
| AUDIT-003 | 🟡 | Viewings | backend | Double booking per listing or per agent | `rls_full_matrix.sql` D1; `rls_viewing_schedule.sql` 5/12 before | Overlap trigger with advisory locks (23P01) and a "time taken" message in both apps | ✅🔴 live (`20261113194212`), 12/12 | `8edec5c` |
| AUDIT-004 | 🟡 | Viewings | backend | A client could re-time a confirmed viewing, even into the past, and it stayed confirmed | D2, D3 | `guard_viewing_update`: no past times; a client's move sets it back to requested | ✅🔴 live (`20261113194202`) | `4b4e74f` |
| AUDIT-005 | 🟡 | Viewings / time | all | Times followed the device's zone, not Europe/Tirane | `app/viewings/index.tsx:62` (before) | `src/lib/tiranaTime.js`; pickers and lists use Tirana time, labelled when the device is elsewhere | ✅ (e2e X104 in a London browser) | `83486c4` |
| AUDIT-006 | 🟡 | UX states | all | A failed listing load was shown as "no longer available", with no retry | `data/properties.ts:219` (before) | Only PGRST116 means not found; otherwise LoadError with retry | ✅ (e2e X103) | `93f74b4` |
| AUDIT-007 | 🟡 | Privacy | all | Account deletion left chat files in storage | `delete-account/index.ts:57` (before) | Empties each of the account's conversation folders first | ✅🔴 deployed v2 | `ef96e81` |
| AUDIT-008 | 🟡 | Deep links | iOS, Android | No universal links or app links | `app.json` | Associated domains, intent filters, AASA and assetlinks, once the domain exists | 👤 domain | — |
| AUDIT-024 | 🟡 | Chat | all | An open thread and the unread badge missed messages sent during a dropped connection or while the app was in the background | `app/messages/[id].tsx:200-214` (before) | `createCatchUp`: re-read on resubscribe and on returning to the foreground; merge by id | ✅ | `5752d09` |
| AUDIT-025 | 🟡 | Wanted homes | backend | No notification when a listing matches a wanted home; agents see only the newest 10, from any city | only `buyer_has_open_wanted_home` mentions the table; `agent-dashboard/index.tsx:124` | A notification trigger on publish | ⏸ schema change, needs OK | — |
| AUDIT-009 | ⚪ | Offline | iOS, Android | No offline detection or banner | `lib/query-client.ts` | NetInfo plus `onlineManager` | ⏸ new dependency | — |
| AUDIT-010 | ⚪ | Dependencies | dev | npm audit: 1 high, 9 moderate | `npm audit` | `npm audit fix` without major upgrades; 8 dev/build-only moderates remain | ✅ | `5efa93f` |
| AUDIT-011 | ⚪ | Dependencies | iOS, Android | Expo patch versions behind | `expo-doctor` 19/20 | Patch versions installed; 20/20 | ✅ | `2d603df` |
| AUDIT-012 | ⚪ | Migrations | backend | Local migration version differed from the live one | `list_migrations` | Renamed; a test keeps versions unique | ✅ | `97e2fd3` |
| AUDIT-013 | ⚪ | Secrets hygiene | local | `.env.local.backup` holds a Clerk secret (gitignored) | key names | Delete the file, rotate the secret | 👤 | — |
| AUDIT-014 | ⚪ | Config docs | all | 13 env vars missing from `.env.example` | grep | Documented; a test keeps the file complete | ✅ | `a3e472b` |
| AUDIT-015 | ⚪ | Performance | all | My listings and Messages loaded every row at once | code | 24 at a time with Load more | ✅ | `a1f8f30` |
| AUDIT-016 | ⚪ | Storage | backend | `property-images` takes 50 MB of any type | bucket row | Size-by-type policy or a separate video bucket | ⏸ needs a live upload test and an owner choice | — |
| AUDIT-017 | ⚪ | DB grants | backend | `anon` held grants on 12 private tables | `has_table_privilege` | Revoked; listings and plans read-only, view counts insert-only | ✅🔴 live (`20261113194218`), 8/8 | `4985974` |
| AUDIT-018 | ⚪ | Code quality | all | 34 `set-state-in-effect` lint warnings | lint | Fix when those screens are touched | 🕓 performance only, no bug | — |
| AUDIT-019 | ⚪ | Cleanup | backend | The retired `ai-generate-listing` stub is still deployed | function list | Delete it | 👤 | — |
| AUDIT-020 | ⚪ | Repo | Android | Stale local `android/` prebuild folder | `ls` | Delete before the first local Android build | 🕓 local only, gitignored | — |
| AUDIT-021 | ⚪ | Expo web | web | `Alert.alert` shows nothing on the Expo web build | grep | Parked with the Expo web build (decision W2) | 🕓 | — |
| AUDIT-022 | ⚪ | Auth | all | Leaked-password protection is off | advisor | Turn on with Supabase Pro | 👤 | — |
| AUDIT-023 | ⚪ | Auth | all | LinkedIn sign-in is on live but never tested | auth settings | Test it, or turn it off | 👤 | — |
| AUDIT-026 | ⚪ | Types | all | Hand-written types drifted from the database (`agent_id`) | `data/types.ts:3`; live schema | `agent_id: string \| null`; `tsc` clean. Wiring generated types across ~280 files is a refactor of its own. | ✅ (generated types deferred) | `8b2aa06` |
| AUDIT-027 | ⚪ | SEO | web | `/favicon.ico` and the manifest returned the HTML page | `curl` on the live site | Real `favicon.ico` (built from the brand icon) and a linked `site.webmanifest` | ✅ | `c2ab8c7` |
| AUDIT-028 | ⚪ | Favourites | all | On a slow connection a quick unsave reached the server before the save, so the favourite stayed saved | X105 (app) and F-N28 (website) with a 500 ms listing read: old code failed 6/6 and 10/10 | Hearts read from a ref; each listing's writes are queued in tap order | ✅ (12/12 and 10/10) | `dd93746` `3c35e58` `9457099` |
| AUDIT-029 | ⚪ | AI cost | backend | Search parsing uses Haiku 4.5 (still served); Haiku 5.5 costs about a tenth per input token | function source | Migrate after an eval | 👤 owner decides | — |
| AUDIT-030 | ⚪ | Monitoring | all | No third-party crash monitoring; in-house reporting runs only in store builds | `lib/report-error.ts:20` | Keep the in-house reporting, or add Sentry | 👤 owner decides | — |
| AUDIT-031 | ⚪ | iOS | iOS | Permission prompts (photos, location) only in English | `app.json` (before) | Expo locales `store-locales/sq.json` and `en.json` | ✅ | `7475703` |

Correction on record: `dd93746` first described AUDIT-028 as a double save. That was the test re-targeting another listing's heart. `9457099` documents the real cause, with proof on the old and the fixed code.

## Deferred, with reasons

- **AUDIT-018:** lint warnings about extra renders, not bugs. A bulk change across 30 screens is more risk than value. Fix each when its screen is next touched.
- **AUDIT-020:** a gitignored local folder. It affects only a local `expo run:android`.
- **AUDIT-021:** affects only the Expo web build, which is parked by owner decision W2.
- **Generated types (part of AUDIT-026):** they retype queries across about 280 files. This is a refactor to plan separately; the confirmed drift is fixed.

## Open risks and next steps

1. **Email:** until SMTP works and Confirm email is on (AUDIT-002), sign-up proves nothing about the address.
2. **Sign in with Apple:** must work before the App Store submission (Guideline 4.8).
3. **Free Supabase plan:** projects pause after a week of inactivity, and there are no daily backups or leaked-password protection. Upgrade to Pro before launch.
4. **No real device was used.** Native-only flows still need the device checklist on TestFlight and internal testing: Google and Apple sign-in, push, maps, the photo picker, offline.
5. **Waiting for an OK:**
   - AUDIT-025, wanted-home notifications;
   - AUDIT-009, offline banner;
   - AUDIT-016, upload size by type.
6. **Vercel deployments and runtime errors** were not auditable: the connector has no team access. Approve access to check them.

## Test coverage, before → after

| Suite | Before (13 Nov) | After | Added |
|---|---|---|---|
| Unit (`npm test`) | 531 | **570** | Apple gate, viewing errors, Tirana time, listing result, attachment purge, migration versions, `.env.example`, list paging, realtime catch-up, web icons, iOS permission texts |
| Website e2e | 269 passed | **(final run in progress)** | F-N28 (favourites order); F4-N12 now tests LinkedIn |
| Expo-app e2e | 314 passed | **(final run in progress)** | X103 (failed load), X104 (Tirana time in London), X105 (favourites order); X42 updated; start-screen spec from master |
| Live SQL checks | existing files | **+3 files** | `rls_full_matrix.sql` 51/51, `rls_viewing_schedule.sql` 12/12, `rls_anon_grants.sql` 8/8 |
| `expo-doctor` | 19/20 | **20/20** | |
| Lint | 0 errors, 34 warnings | 0 errors, 34 warnings | |
| `tsc` | clean | clean | |

## Final checks (14 Nov)

Lint 0 errors, `tsc` clean, 570 unit tests, website build, `expo-doctor` 20/20: all pass. The final Playwright run is in progress.
