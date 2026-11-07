# Test coverage: QA audit, 2026-11-07

What each audit area was checked with, per platform. The status applies to
**this audit's runs** (2026-11-07); older evidence is named as such and is
not counted as tested today.

**Columns.** *Web*: the Vite website, Playwright `e2e/` against the
simulated backend (`e2e/support/backend.ts`), phone and desktop Chromium.
*Expo web*: the Expo app's web build, Playwright `e2e-expo/`, same simulated
backend. *iOS* and *Android*: the phone app. No device, simulator or
emulator exists here and iOS cannot be built on Windows, so a phone column
is either a static check of the code and `app.json` or BLOCKED. *Backend*:
the live Supabase project, read-only or in rolled-back blocks.

**Statuses.** PASS = TESTED AND PASSED · FAIL = TESTED AND FAILED (bug ID) ·
STATIC = code or config read, not run · NOT TESTED · BLOCKED = BLOCKED BY
MISSING DEVICE OR ENVIRONMENT.

## 1. Architecture and inventory

| Item | Web | Expo web | iOS | Android | Backend | Evidence |
|---|---|---|---|---|---|---|
| Docs read (CLAUDE.md, overview, AUDIT.md, DECISIONS.md, LAUNCH_TASKS.md) | — | — | — | — | — | Phase 1 |
| Tables, RLS, policies inventory | — | — | — | — | PASS | 25 tables, all RLS on, 44 policies; 5 server-only tables without policies |
| Edge Functions inventory | — | — | — | — | PASS | 9 deployed; `verify_jwt` true except `saved-search-unsubscribe` (secret token) |
| Native config (scheme, bundle id, plugins, permissions) | — | — | STATIC | STATIC | — | `app.json`: scheme `shtepia-ime`, Apple sign-in, no Android permission beyond defaults, SYSTEM_ALERT_WINDOW blocked |
| Env vars / secrets in client bundles | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | — | Not re-run today; guarded on every `npm test` by `noSecretsInClient.test.mjs` (PASS) |
| Payments foundation | PASS (F15-H1, F15-E1) | — | — | — | NOT TESTED | Checkout off; pending SQL not applied |

## 2. Functional (screens, bad input, feedback, states)

| Item | Web | Expo web | iOS | Android | Backend | Evidence |
|---|---|---|---|---|---|---|
| Browse / search / filters / zone / reference | PASS | PASS | BLOCKED | BLOCKED | — | F01-*, F19-*, X01, X02 |
| Listing detail, chat, call, WhatsApp | PASS | PASS | BLOCKED | BLOCKED | — | F02-*, X49 |
| Listing chat: refused message | n/a | **FAIL → FIXED** (QA-03) | STATIC (same code) | STATIC (same code) | — | X63 |
| Viewings request (signed out / past date / success) | PASS | PASS | BLOCKED | BLOCKED | **FAIL** (QA-01) | F02-N2, X42, X54; live repro |
| Messaging thread, send, load error + retry | PASS | PASS | BLOCKED | BLOCKED | **FAIL** (QA-02) | M-N1, X06; live repro |
| Favourites (signed in / out) | PASS | PASS | BLOCKED | BLOCKED | — | F03-*, X04, X29 |
| Listing wizard: create, edit, photos, retry, double save | PASS | PASS | BLOCKED | BLOCKED | — | F09-*, X20–X23, X53 |
| Profile photo / phone | PASS | PASS | BLOCKED | BLOCKED | — | F12-*, X25, X26 |
| Leads | — | PASS | BLOCKED | BLOCKED | — | X39, X40 |
| Report / block / moderation | PASS | PASS | BLOCKED | BLOCKED | — | F10-*, F3-*, X55 |
| Saved searches / alerts count | PASS | — | BLOCKED | BLOCKED | — | F11-H1 (alerts) |
| Notification switches (rapid taps, failed save) | — | PASS | BLOCKED | BLOCKED | — | X14–X16 |
| Empty, error and retry states | PASS | PASS | BLOCKED | BLOCKED | — | M-N1, F02-N1, F3-E1, X15, X46 |
| Double taps | PASS | PASS | BLOCKED | BLOCKED | — | F4-H5, X17, X14, X23 |
| Offline, app reopen, backgrounding | NOT TESTED | NOT TESTED | BLOCKED | BLOCKED | — | Needs a device; no network-loss e2e exists |
| `Alert.alert` feedback on the web build | — | **FAIL** (QA-06, deferred) | STATIC (works natively) | STATIC (works natively) | — | 20 calls in 4 files |

## 3. Auth and permissions

| Item | Web | Expo web | iOS | Android | Backend | Evidence |
|---|---|---|---|---|---|---|
| Register (client and agent, office name) | PASS | PASS | BLOCKED | BLOCKED | — | F4-H1, F4-V1, X56 |
| 6-digit code: wrong, pasted, five-wrong cap, expired, resend | PASS | PASS | BLOCKED | BLOCKED | STATIC (QA-04, QA-05) | F4-V2–V4, F4-N1, X57–X59, X18 |
| Unverified address refused (form, stored session) | PASS | PASS | BLOCKED | BLOCKED | PASS (0 accounts affected) | F4-V6, F4-V7, X62; live count |
| Login, wrong password, throttle | PASS | PASS | BLOCKED | BLOCKED | — | F4-N3, F04-N2, X03; unit `loginThrottle` |
| Logout | PASS | PASS | BLOCKED | BLOCKED | — | X05 |
| Recovery (link, code, other browser) | PASS | PASS | BLOCKED | BLOCKED | — | F4-H2, F4-H6, F4-H7, F4-N7, X27 |
| Password change (checks current, signs out other devices) | PASS | PASS | BLOCKED | BLOCKED | — | F4-H9, F4-N13, X30, X31 |
| Session expiry message | PASS | — | BLOCKED | BLOCKED | — | F4-N14 |
| Session persistence across restarts, multiple devices | NOT TESTED | NOT TESTED | BLOCKED | BLOCKED | — | Needs real devices and real Auth |
| Google / Apple sign-in | NOT TESTED | NOT TESTED | BLOCKED | BLOCKED | — | Provider consoles and devices |
| RLS ownership: messages, conversations, viewings, leads, favourites, dashboard data (Klient and Agjent) | — | — | — | — | PASS (policies read) | Policies read live today. The full role-by-role isolation run is AUDIT.md Pass 32 (2026-11-04, not re-run) |
| INSERT ownership (direct API) | — | — | — | — | **FAIL** (QA-01, QA-02) | `supabase/tests/rls_insert_guards.sql`: 2/9 now, 9/9 with the fix (rolled back) |
| SECURITY DEFINER functions callable by users | — | — | — | — | PASS | Bodies read: `claim_role`, `register_push_token`; anon can execute none |

## 4–5. iOS and Android compatibility

| Item | iOS | Android | Evidence |
|---|---|---|---|
| Safe areas | STATIC PASS | STATIC PASS | 26 `SafeAreaView` uses, all from `react-native-safe-area-context` |
| Android back in modals | — | STATIC PASS | 13/13 `Modal`s have `onRequestClose` |
| Keyboard avoidance | STATIC | STATIC | `KeyboardAvoidingView` in 13 files; not run on a device |
| Small (SE / 280–320 px) and large widths | Expo web PASS (R02, R03; AUDIT.md Pass 29 rendered sweep) | same | Browser rendering, not a device |
| Permissions (photos, notifications) | STATIC | STATIC | Plugins `expo-image-picker`, `expo-notifications`; permission asked only from Profile → Notifications |
| Deep links (`shtepia-ime://`, Expo Go `exp(s)://`) | STATIC | STATIC | Scheme in `app.json`; earlier passes fixed the Expo Go paths |
| Backgrounding, app reopen, push delivery, maps, picker | BLOCKED | BLOCKED | No device |
| Native build | BLOCKED (no macOS/Xcode) | BLOCKED (no Android SDK; EAS needs the owner's login) | — |

## 6. UI/UX

| Item | Web | Expo web | Evidence |
|---|---|---|---|
| Accessibility (axe), light and dark | PASS | PASS except KNOWN white-on-orange (QA-09) | `e2e/a11y.spec.ts`, `e2e-expo/a11y.spec.ts` |
| Design consistency | NOT TESTED today | NOT TESTED today | AUDIT.md Pass 29 (2026-11-03) |

## 7. Database and backend integrity

| Item | Status | Evidence |
|---|---|---|
| CHECK constraints on forms' data | PASS (constraints read) | Viewings duration/notes/status checks present; Pass 33 added 34 rules |
| Duplicates | **FAIL** (QA-02): NULL-listing conversations can duplicate | Live repro, rolled back |
| Races: double send / double save | PASS (client) | F4-H5, X17, X23; QA-03 fix also covers a lost conversation-creation race |
| Timezones | STATIC PASS | Viewing times sent as ISO UTC (`toISOString()`); `scheduled_at` is timestamptz |
| Failed requests surface an error | PASS, except QA-03 (fixed) and QA-06 (web build) | e2e error tests above |

## 8. Defensive security

| Item | Status | Evidence |
|---|---|---|
| Secrets in client code | PASS | `noSecretsInClient.test.mjs` in `npm test` |
| XSS / query injection | PASS | `xssAndQueries.test.mjs` in `npm test` |
| Uploads (type, size, names) | PASS | `uploads.test.mjs`; F12-N3, X22 |
| Logs (no debug output in production) | PASS | `productionMode.test.mjs` |
| Rate limits (sign-in, AI) | PASS (client) / STATIC (server) | `loginThrottle.test.mjs`; server limits are dashboard settings |
| Verification bypass | PASS in the apps; QA-05 (cap client-side) | F4-V6/V7, X62 |
| Supabase security advisor | 2 WARN types, both explained | Leaked-password off (QA-08); 8 user-callable DEFINER functions, each checks its caller |

## 9. Performance

| Item | Status | Evidence |
|---|---|---|
| Pagination 24 + Load more | NOT TESTED today | Earlier passes |
| Bundle size, LCP | NOT TESTED today | AUDIT.md Pass 29 (794 KB gzip, LCP 1224 ms throttled) |
| Device performance | BLOCKED | No device |

## 10. Automated suites run today

See `TEST_RESULTS.md`.
