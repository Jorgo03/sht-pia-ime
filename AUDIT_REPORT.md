# Shtëpia.ime full audit, 2026-11-13

Branch `audit/full-sweep`. Read-only: no app code, schema or live setting was
changed. The one new file besides this report is the rolled-back test
`supabase/tests/rls_full_matrix.sql`.

## Executive summary

**Health score: 7/10.** The code is in good shape. Type-check, lint and 531
unit tests pass, both web builds succeed, and the 8 locales are fully in sync.
Row-level security held for every table in a live, rolled-back test
(48 of 51 checks; the 3 failures are all viewing rules, not data leaks). No
Critical issues were found, and no data leaks across accounts.

The risks are in two places. Two auth settings make the app unsafe or broken
at launch, and both need the owner. The viewing scheduler also has integrity
gaps.

**Top 5 risks**

1. **AUDIT-001 (High):** the "Continue with Apple" button is shown everywhere, but the Apple provider is switched off in Supabase. Pressing it always fails (on the website as a plain "provider unavailable" message; in the phone app as an error). This is an App Store rejection risk.
2. **AUDIT-002 (High, owner):** "Confirm email" is off. Anyone can create a confirmed account with someone else's email straight through the API, without the app's code check.
3. **AUDIT-003 / 004 (Medium):** viewings can be double-booked. A client can also move a viewing that is already confirmed, even into the past, and it stays "confirmed".
4. **AUDIT-005 (Medium):** viewing times use each phone's own time zone, and nothing is pinned to Europe/Tirane. A diaspora buyer in London asking for 10:00 shows up for the agent as 11:00.
5. **AUDIT-007 (Medium):** deleting an account leaves the person's chat photos and documents in storage (a GDPR erasure gap).

## Baseline (Phase 0)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean (exit 0) |
| `npm run lint` | 0 errors, 34 warnings, all `react-hooks/set-state-in-effect` (no missing-dependency warnings) |
| `npm test` | 531/531 passed |
| `npm run build` (Vite) | built in 9.8 s; main chunk 1,054.8 kB (322 kB gzip) |
| `npx expo export -p web` | exported; `__common` 2.0 MB + `entry` 1.1 MB (uncompressed) |
| `npx expo-doctor` | **1 check failed**: expo 58.0.24→58.0.25, expo-dev-client 58.0.19→.20, expo-location 58.0.21→.22 |
| `npx expo install --check` (offline) | "up to date" (offline mode: unreliable, doctor is authoritative) |
| `npm audit` | 10: 1 high (`zod`, dev-only through eslint-plugin-react-hooks), 9 moderate (`vite` dev server, `minimatch` via `@expo/fingerprint`, typescript-eslint). None ships in an app bundle |
| Playwright e2e | not re-run here (13 Nov: 269 web, 314 Expo web, all passing) |
| Supabase logs, last 24 h | no 4xx/5xx in API or Edge Function logs; no Postgres errors apart from this audit's own test result |
| `client_errors` table | empty. Reporting is on only in release builds, and none exist yet |

**Secrets in bundles.** Both builds were searched for `service_role`,
`sk-ant-`, `ANTHROPIC_API_KEY` and Resend keys, and every embedded JWT was
decoded. The only token is the public `anon` key.

**Old Next.js 14 "FHO Marketplace" scaffold: not found.** Nothing in the
workspace, the Desktop or this repository's git history is a Next.js project
that uses Supabase. The first commit is `create-expo-app`. The only Next.js
project is OmniRoute, which is unrelated. The name "fho-marketplace" is the
**production Supabase project itself**. The account has a second project,
`ronznvwqnamlygqghybu` ("@jorgo03/real-estate-app-ed500f91", INACTIVE). It was
created by an integration. Only `.env.local.backup` still points at it (see
AUDIT-013).

**Map.** The app has 36 route files under `app/`, about 95 components, hooks
and contexts, 11 Edge Function folders (9 deployed; `checkout-start` and
`paysera-callback` are local only, since payments are not switched on), 65
migration files, 18 SQL test files and 29 public tables.

## Supabase (Phase 3)

- **RLS:** turned on for all 29 tables. A new live test,
  `supabase/tests/rls_full_matrix.sql`, rolls itself back and ran
  **48/51**:
  - All 27 inserts by a signed-out visitor were refused (SQLSTATE 42501).
  - A signed-out visitor cannot change or delete listings.
  - The owner can create their own favourite, saved search, wanted home and viewing.
  - Another account could not: create rows in the owner's name (N1–N12); edit
    or delete the owner's rows (N13–N18); change its own role (N19); make
    itself a moderator, promote a listing for free, file a report that is
    already resolved, or block someone on another person's behalf.
  - The 3 failures are D1–D3 (AUDIT-003/004).
  - Reading other people's rows is covered by the existing
    `rls_isolation.sql`; the 13 Nov brief records the newest files
    (`rls_message_attachments` 14/14, `rls_public_profile`) passing.
- **Storage:**
  - `avatars`: public, 2 MB, images only.
  - `property-images`: public, 50 MB, images and video (AUDIT-016).
  - `message-attachments`: private, 10 MB, 9 file types; reading and uploading need membership of the conversation.
  - Every write policy is limited to the user's own folder.
- **Advisors (security):**
  - 6 tables have RLS on and no policies. These are internal queues, as expected.
  - 2 + 13 SECURITY DEFINER functions can be called; all of them check the caller (12 Nov audit). `public_profile` and `listing_publisher` are meant to be public.
  - Leaked-password protection is off (needs Pro).
- **Advisors (performance):** 26 unused indexes, which is expected with 3 listings, and 7 cases of several permissive policies on one table.
- **Migration drift:**
  - Local `20261104210000_server_form_checks.sql` is live as `20261104215248` (AUDIT-012).
  - Local `20260702000000_recreate_tables_missing_from_history.sql` exists on purpose (a recovery file) and is not in the live history.
  - Otherwise the live list (64) matches the local files.
- **Edge Functions:**
  - `push-dispatch`, `saved-search-alerts` and `saved-search-unsubscribe` run with `verify_jwt=false`. Each checks its caller: the service-role key, or `x-cron-secret` checked against the vault with a constant-time comparison, or a per-search unsubscribe token.
  - The rest require a JWT.
  - CORS `*` with bearer tokens is fine (12 Nov audit).
- **Live auth settings** (`GET /auth/v1/settings`):
  - Turned on: `email`, `google`, `linkedin_oidc` (LinkedIn has been switched on since AUDIT.md recorded it as off; not tested).
  - **`apple` is off.**
  - `mailer_autoconfirm: true`.

## Findings

| ID | Severity | Area | Platform | Description | Evidence | Proposed fix | Effort | Status |
|---|---|---|---|---|---|---|---|---|
| AUDIT-001 | High | Auth | iOS, Android, web | "Continue with Apple" is shown on every platform, but the Apple provider is off in Supabase. On iOS the native sheet succeeds, then `signInWithIdToken` is refused. On Android the browser redirect ends on Supabase's error page. The Vite website already checks first and shows "provider unavailable" (corrected while fixing; the profile.tsx comment was stale). The free sideload build also strips Apple sign-in (`app.config.js:46`) but keeps the button | `app/(tabs)/profile.tsx:1445-1455`; `/auth/v1/settings` has no `apple`; the comment at `profile.tsx:1425-1444` admits it | Hide the button unless a switch (`APPLE_SIGN_IN_ENABLED`) is on, and show it only on iOS when it is native. Owner: turn on the Apple provider before App Store submission (Guideline 4.8 requires it when Google is offered) | S | FIXED `d8f4bf0` (button hidden). Owner: turn on Apple before App Store review |
| AUDIT-002 | High (owner) | Auth | all | "Confirm email" is off, so `signUp` straight through the API returns a confirmed session for **any** address. The app's OTP step can be skipped, so someone can register under another person's email, for example to pose as an agent | `/auth/v1/settings` → `mailer_autoconfirm: true`; DECISIONS.md:932-975 | Owner: once SMTP and the domain are working, turn Confirm email back on (order in DECISIONS.md:975). No code change | S | OPEN (owner) |
| AUDIT-003 | Medium | Viewings | backend | **Double booking:** a second client can book the same listing at the same moment, and so can the same client again. Nothing stops overlapping requested or confirmed viewings | `rls_full_matrix.sql` D1 FAIL (live); `guard_viewing_insert` has no overlap check; no unique or exclusion constraint on `viewings` | Add a migration with a trigger that refuses a new or moved viewing overlapping a requested or confirmed one for the same listing or agent (scheduled time ± duration, default 30 min). Show a friendly "time taken" message in both apps | M | FIXED in code `8edec5c`; migration **not applied live** (needs OK). 12/12 in a rolled-back run |
| AUDIT-004 | Medium | Viewings | backend | After the agent confirms, the client can move `scheduled_at` and the viewing **stays confirmed**. It can even be moved 30 days into the past. The agent goes at the old time | `rls_full_matrix.sql` D2 and D3 FAIL (live); `guard_viewing_update` checks only `status` and the parties | In `guard_viewing_update`: a time change by anyone other than the agent sets the status back to `requested` and must be in the future. Nobody may move a viewing into the past | S | FIXED in code `4b4e74f`; migration **not applied live** (needs OK). 12/12 in a rolled-back run |
| AUDIT-005 | Medium | Viewings / i18n | all | Times are picked and shown in the device's own time zone, with no label. Nothing is pinned to Europe/Tirane, so diaspora users in another zone (UK, US) see and book different clock times than the agent | `app/viewings/index.tsx:62`, `app/agent-dashboard/index.tsx:260,298` (`Intl.DateTimeFormat` without `timeZone`); `components/viewings/viewing-time-picker.native.tsx` (device time) | Show viewing times with `timeZone: 'Europe/Tirane'` plus a short "Tirana time" label. Build the picked time as Tirana time. Add a unit test across zones | M | FIXED `83486c4` |
| AUDIT-006 | Medium | UX states | all | The listing page treats **any** load failure (offline, timeout, 5xx) as "this listing is no longer available". There is no retry and no error state | `data/properties.ts:219` (`if (error) return null`); `app/property/[id].tsx:290`. (First cited `shared/data/properties.js:19`, an identical copy nothing imports.) | Return a real error unless it is "not found" (PGRST116), and show `LoadError` with a retry. Keep "unavailable" for the real not-found case | S | FIXED `93f74b4` |
| AUDIT-007 | Medium | Privacy / account deletion | all | Deleting an account clears `avatars` and `property-images` but not `message-attachments`. The person's conversations disappear with the account, but their photos and documents stay in storage, which is a GDPR Art. 17 gap | `supabase/functions/delete-account/index.ts:57` (`BUCKETS = ['avatars','property-images']`); `conversations_*_fkey ON DELETE CASCADE` (live) | Before `deleteUser`, delete every object in `message-attachments/<conversation_id>/` for the user's conversations. This needs a redeploy of the function, which needs the owner's OK | S | FIXED in code `ef96e81`; function **not redeployed** (needs OK) |
| AUDIT-008 | Medium (owner) | Deep links | iOS, Android | No universal links or app links are set up, so a shared listing link (`<site>/property/<id>`) always opens the website, never the app | `app.json` has no `ios.associatedDomains` and no `android.intentFilters`; only the custom `shtepia-ime://` scheme | Once the domain exists: add `associatedDomains` and `intentFilters` with autoVerify, and host `apple-app-site-association` and `assetlinks.json` from `deploy/expo-web` | M | OPEN (owner: domain) |
| AUDIT-009 | Low | Offline | iOS, Android | SUSPECTED: nothing detects being offline. React Query's `onlineManager` is not connected to NetInfo, which is not installed, so the app sends requests while offline and shows only general error states | `lib/query-client.ts` (no onlineManager); no `@react-native-community/netinfo` in `package.json` | Add NetInfo, connect `onlineManager` and focus handling, and show an offline banner. Check on a device | M | NOT DONE: needs a new dependency (NetInfo); CLAUDE.md asks for an OK first |
| AUDIT-010 | Low | Dependencies | dev | `npm audit`: `zod` (high, dev lint only), `vite` (dev server `fs.deny` bypass), typescript-eslint/minimatch (moderate). Nothing at runtime | baseline `npm audit` | `npm audit fix` without major upgrades. Leave the `expo@52` "fix", which is a downgrade | S | FIXED `5efa93f` (high fixed; 8 moderate left, dev/build-time only, no non-breaking fix) |
| AUDIT-011 | Low | Dependencies | iOS, Android | expo-doctor fails 1 of 21 checks: 3 SDK 58 patch versions behind (released after the 12 Nov update) | baseline `expo-doctor` | Install the patch versions, then run `EXPO_OFFLINE=1 npx expo install --fix` (CLAUDE.md procedure) | S | FIXED `2d603df` (expo-doctor 20/20) |
| AUDIT-012 | Low | Migrations | backend | The local version of `server_form_checks` is `20261104210000`, but it is live as `20261104215248`. `supabase migration list` / `db push` will report drift | `list_migrations` vs `supabase/migrations/` | Rename the local file to the live version. The recovery file `20260702000000_*` stays and is documented | S | FIXED `97e2fd3` |
| AUDIT-013 | Low (owner) | Secrets hygiene | local | `.env.local.backup` (gitignored, never committed) still holds `CLERK_SECRET_KEY`, `VERCEL_OIDC_TOKEN` and the URL of the old project `ronznvwqnamlygqghybu` | `.env.local.backup` key names (values not printed) | Delete the file. Rotate the Clerk secret if that Clerk app still exists. Delete or keep paused the inactive Supabase project | S | OPEN (owner) |
| AUDIT-014 | Low | Config docs | all | 13 environment variables the code reads are missing from `.env.example`: `EXPO_PUBLIC_{CHECKOUT_ENABLED,EMAIL_ALERTS,ERROR_REPORTING,LEGAL_CONTACT_EMAIL,SUPABASE_IMAGE_TRANSFORMS,WEB_MAX_WIDTH,WEB_ORIGIN}`, `VITE_{CHECKOUT_ENABLED,EMAIL_ALERTS,ERROR_REPORTING,APP_VERSION}`, `GOOGLE_MAPS_ANDROID_API_KEY`, `SIDELOAD_FREE` | grep of `process.env.*` / `import.meta.env.*` vs `.env.example` | Document each one, with its default, in `.env.example` | S | FIXED `a3e472b` |
| AUDIT-015 | Low | Performance | all | Some lists load without a limit: My listings (`app/my-listings/index.tsx:64-68`), the conversation list (`app/(tabs)/messages.tsx:136-140`), and the import duplicate check (`limit(5000)`, `app/listing/import.tsx:79`). This breaks the 24-per-page rule; fine at today's volume | code | Page them with `.range()` and "Load more", as Explore already does | M | FIXED `a1f8f30` (import check stays capped at 5000) |
| AUDIT-016 | Low | Storage | backend | `property-images` accepts 50 MB for every type, so a direct API upload can store a 50 MB image. The apps cap images at 10 MB on the device | bucket row (live); `lib/upload.ts:35-36` | Split video into its own bucket, or check size by type in the storage policy | M | NOT DONE: whether storage policies see the file size at insert needs a live upload test; a separate video bucket needs the owner |
| AUDIT-017 | Low | Database grants | backend | `anon` holds table grants (SELECT/INSERT) on `ai_usage`, `payment_events`, `listing_promotions`, `agency_subscriptions`, `plans` and others. RLS blocks them (27/27 refused), but they rest on RLS alone | `has_table_privilege` query (live) | Add a migration that revokes table grants `anon` never needs | S | FIXED in code `4985974`; migration **not applied live** (needs OK). 8/8 in a rolled-back run |
| AUDIT-018 | Low | Code quality | all | 34 lint warnings, all `react-hooks/set-state-in-effect` (extra renders, not bugs). 18 are in the Vite site, which gets bug fixes only | baseline lint | Fix them as screens get touched. No bulk change | M | OPEN (deferred: fix when screens are touched) |
| AUDIT-019 | Low | Cleanup | backend | `ai-generate-listing` (a retired 410 stub) and `ai-assistant` (chat is off) are still deployed | `list_edge_functions` | Owner decides: delete the stub; keep `ai-assistant` for when chat returns | S | OPEN (owner) |
| AUDIT-020 | Low | Repo | Android | A local `android/` prebuild folder exists (gitignored), although CLAUDE.md says this is a CNG project with no native folders. `expo run:android` will reuse its stale settings | `ls android` | Delete it, or regenerate it before each local build | S | OPEN (deferred) |
| AUDIT-021 | Low | Expo web | web | 22 `Alert.alert` calls in 5 files do nothing on the Expo web build. `lib/confirm.ts` already covers confirmations | grep | Already deferred as QA-06 while the web build is parked | M | OPEN (deferred, QA-06) |
| AUDIT-022 | Low (owner) | Auth | all | Leaked-password protection is off | advisor `auth_leaked_password_protection` | Owner: turn it on with Supabase Pro | S | OPEN (owner) |
| AUDIT-023 | Low | Auth | all | LinkedIn sign-in is now on live, but it has never been tested on any platform (AUDIT.md last recorded it as off) | `/auth/v1/settings` | Test on web and on a phone, or turn it off until tested | S | OPEN (owner) |

**Checked and found sound (no finding):**

- Message and notification realtime channels are all removed on unmount, and every `setInterval` is cleared.
- Map markers escape what they insert, in both apps (unit-tested).
- No HTML rendering of user text anywhere.
- The OAuth relay accepts only the app's own callback addresses (`src/lib/oauthRelay.js`), and both clients use PKCE, so a relayed code is useless without the device's verifier.
- Chat history is capped (`loadThreadMessages`).
- Explore pages 24 at a time.
- The map is capped at `MAP_MARKER_LIMIT`.
- Every literal `t('…')` key in 284 files exists, all 8 locales have the same keys with matching placeholders, and no hard-coded UI text was found.
- A root `ErrorBoundary` is exported from `app/_layout.tsx`.
- The public profile phone fallback is intentional (documented in migration `20261111230117`).

**Parity (Phase 8):** the Vite site gets bug fixes only (DECISIONS.md W1/W2).
It reads chat attachments but cannot send them, and it has no compare, agents
directory or public profile page. These are known, decided gaps, not defects.

## Not covered

- No real phone or simulator was used. Native flows (Google and Apple
  sign-in, push, photo picker, maps, offline) were checked by reading code and
  settings.
- Playwright was not re-run; the numbers are the 13 Nov ones.
- Performance was judged from bundle sizes, not profiled. Startup and
  re-render costs were not measured.

## Quick wins (each S, no owner dependency)

AUDIT-004, AUDIT-006, AUDIT-001 (hiding the button), AUDIT-012, AUDIT-014,
AUDIT-010, AUDIT-011, AUDIT-017.

## Recommended fix order

1. **AUDIT-001**: hide Apple until it works (app code, both apps).
2. **AUDIT-004, then AUDIT-003**: one viewing-guard migration, with SQL tests first (`rls_full_matrix.sql` D1–D3 must pass). Applying it live needs the owner's OK.
3. **AUDIT-006**: listing page error state.
4. **AUDIT-005**: Tirana time for viewings.
5. **AUDIT-007**: attachments on account deletion. The function redeploy needs the owner's OK.
6. Low items, in order: 012, 014, 010, 011, 017, 015, 016, 009.
7. Owner-only items, flagged once: AUDIT-002, 008, 013, 019, 022, 023.

---

## Fix pass (approved 2026-11-13)

The owner approved the recommended order. Each fix has its own commit, and
each had a test that failed first. The SQL fixes were checked inside blocks
that roll themselves back.

**Fixed in code and pushed:**
- AUDIT-001: Apple sign-in button hidden.
- AUDIT-005: viewing times are Tirana time.
- AUDIT-006: a failed load shows a retry.
- AUDIT-010: npm audit fix (no major upgrades).
- AUDIT-011: Expo patch versions.
- AUDIT-012: the migration file carries its live version.
- AUDIT-014: `.env.example` documents every variable.
- AUDIT-015: My listings and Messages load 24 at a time.

**Written, verified, and waiting for the owner's OK to go live:**
- Migrations `20261113180000` (AUDIT-004) and `20261113180100` (AUDIT-003): `rls_viewing_schedule.sql` went from 5/12 to 12/12.
- Migration `20261113180200` (AUDIT-017): `rls_anon_grants.sql` went from 4/8 to 8/8.
- The `delete-account` Edge Function redeploy (AUDIT-007).

Until those are applied, the live database behaves as before.

**Not done:**
- AUDIT-009 needs a new dependency (NetInfo), which needs an OK.
- AUDIT-016 needs a live upload test first.
- The owner-only items (002, 008, 013, 019, 022, 023) and the deferred Low items (018, 020, 021) stay open.

**Checks after the last fix:**

| Check | Result |
|---|---|
| Lint | 0 errors, 34 warnings (the same 34 as before) |
| `tsc` | clean |
| Unit tests | 557/557 passed (was 531) |
| Web build | passes |
| `expo-doctor` | 20/20 |
| `npm run test:e2e` | 269 passed, 9 skipped |
| `npm run test:e2e:expo` | 318 passed, 46 skipped (new: X103, X104) |
| iOS export | builds |

**What "done" in the task still needs:**
- Zero open High: AUDIT-002 (Confirm email) is the owner's step.
- RLS checked on the live database, not only in rolled-back blocks: it holds for every table today (`rls_full_matrix.sql` 48/51). It reaches 51/51 once the viewing migrations are applied.
- No native device was used. The Expo web build in phone and desktop sizes is the platform these fixes were tested on.
