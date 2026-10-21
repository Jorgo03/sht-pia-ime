# Launch task ledger — Shtëpia.ime

Started 2026-10-20 from `6a4422b`; rebuilt 2026-10-21 around the Launch
Tracker's finding IDs (completion prompt #2). Sources: the live Supabase
project `xzzzhlwmzotibrxdqmcm`, the repository, `AUDIT.md` passes 14–17. Kept
current as work lands. Branch: `claude/app-property-translation-kosqyj` (not
merged to `master`, so nothing here is on the live website yet).

**Scope.** Web (Vite + React 19, deployed by Vercel from `master`) and the
Expo SDK 57 phone app (iOS and Android), one Supabase backend. Two live roles:
Klient (`buyer`) and Agjent (`agent`), plus a database-managed moderator list
added in this pass.

**Status:** TODO · IN PROGRESS · IMPLEMENTED—UNVERIFIED · VERIFIED · BLOCKED ·
DEFERRED WITH REASON. VERIFIED always names the environment: *live* = the
production Supabase project (in rolled-back transactions unless stated);
*e2e* = Playwright against the website built with a simulated backend, phone
and desktop viewports; *unit* = `npm test`; *export* = the phone app's Expo
web export scanned with axe. Nothing below was run on a physical phone.

## Source material

- **Recovered.** The tracker export the owner attached had empty finding rows.
  The full list F1–F20 (what, why, level, who) was recovered from the data of
  the tracker page built in this project on 2026-10-15/16, which the export
  came from. That includes **F17 and F18** (the prompt warned they might be
  undescribed) and **F20**, which the work map did not list.
- **Missing.** The "Before publishing" checklist and its 20 phone checks are
  not in the export, the tracker page or the repository.
  `docs/DEVICE_CHECKLIST.md` is a **new replacement** derived from the app
  (22 checks), labelled as such.
- **Not reproduced.** The tracker's 58/100 is the 15 Oct audit score
  (`AUDIT.md` Pass 15). It was not re-scored; the readiness report uses
  blockers, not a number.

Tracker phases: 0 "Close the doors and open sign-up" (F1, F2, F3 db, F4, F5,
F6) · 1 "Release candidate" (F3 apps, F9, F10, F11, F12, F16) · 2 "Into the
stores" (F7, F8) · 3 "First money" (F15) · 4 "Bring people back" (F13, F14,
F19). F17, F18 and F20 were unphased tidy-ups.

**Execution order used:** security and data first (F1/F2, F20, F6, F3 db),
then the account-free features (F12, F11, F19, F13, F14, F15, F3 apps), then
configuration that only needs accounts later (F9, F8, F10, F7), accessibility
(F16), auth flows and emails (F4), then documents and full verification.

## Tracker findings

| ID | Source phase | Problem and code evidence | Priority | Acceptance criteria | Dependencies | Status | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F1 | 0 | `translate-description` was deployed with no caller and spent AI credit for anyone with the public key (AUDIT S-1). | P0 | Not deployed; the AI functions that remain authorize, rate-limit and cap spend. | Owner: Anthropic console spend limit | VERIFIED (engineering); console cap BLOCKED | `list_edge_functions` 2026-10-16: absent. `ai-parse-search` v5, `ai-listing-assistant` v5, `translate-property` v9: JWT required, per-user limits fail closed, and a project-wide `AI_DAILY_CALL_CAP` (default 2000/day, index `ai_usage (feature, created_at)`); past the cap translation falls back to MyMemory. No paid call was made to test. |
| F2 | 0 | `clerk-link-profile` was deployed, dead (S-2). | P2 | Not deployed; no caller in either app. | — | VERIFIED | `list_edge_functions` 2026-10-16; `grep` finds no caller. |
| F3 | 0–1 | No report/block (Apple 1.2, Google Play UGC); then no way to act on a report. | P1 | Report a listing/user, block/unblock, blocked sender refused; reporters cannot read reports; moderators can review, hide/restore a listing and close reports; owners cannot undo a hold. | — | VERIFIED (database, website); phone UI IMPLEMENTED—UNVERIFIED on a device | Live: `rls_report_and_block.sql` 18/18, `rls_moderation.sql` 12/12, `rls_moderation_read.sql` 6/6, two users and a temporary moderator, rolled back. e2e: F10 (report, block) and F3 (moderation queue, refusals, retry, closed queue). Migrations `20261016181934`, `20261021052850`, `20261021053224`. Moderators are added by the owner with SQL (`insert into public.moderators(user_id) values (…)`). |
| F4 | 0 | Supabase's built-in email does not reach strangers, so email sign-up and reset fail for the public. Also found: the default templates have no code although both apps ask for one; and a reset's success message never showed (bug). | P1 | A stranger receives the code and can sign up and reset; templates carry the code; flows handle errors. | Owner: domain + SMTP provider (L15) | Engineering VERIFIED (e2e, simulated server); real delivery BLOCKED | e2e `auth.spec.ts` ×2 viewports: sign-up payload and code, wrong code, validation before sending, wrong password, PKCE recovery round trip, quota error. Templates `supabase/templates/*.html` (sq + en, `{{ .Token }}` and link), unit-checked. Recovery-success bug fixed. No real email was sent. |
| F5 | 0 | Free database plan (pauses, no backups, no leaked-password check); Vercel Hobby is non-commercial. | P1 | Upgrade path documented with the official limits; configuration checked. | Owner: Supabase Pro, Vercel Pro | BLOCKED (purchase); handoff VERIFIED | `get_organization` plan `free`; advisors: leaked-password protection is Pro-only. `docs/ACCOUNT_AND_RELEASE_HANDOFF.md`, `docs/BACKUP_AND_ROLLBACK.md`. Nothing bought. |
| F6 | 0 | 12 demo listings with a placeholder phone; 2 test accounts. | P1 | Only real listings remain; synthetic accounts removed after a dry run; real records untouched. | Owner: confirm the account deletion in the Supabase prompt | Listings VERIFIED; 2 accounts BLOCKED | Guarded delete of exactly 12 listings (3 real remain). Accounts `claude-test@shtepia.dev`, `system@shtepia.ime`: dry run shows their only conversation is with each other and 8 unreferenced files; the DELETE waits for the owner's confirmation and timed out unattended (L30). |
| F7 | 2 | No production iOS/Android build. | P1 | Signed builds install. | Apple Developer, Google Play, Expo login, a device | BLOCKED (accounts); available checks VERIFIED | `expo prebuild` (both platforms, scratch copy) succeeds; manifest/Info.plist/entitlements checked (Apple sign-in, push, no camera/mic). `expo export --clear` for android+ios+web succeeds with a fake backend; no production URL in the bundles. `expo-doctor` 19/21 (2 need `exp.host`, blocked here). No native compile: no Android SDK or Xcode here, and EAS needs the owner's login. |
| F8 | 2 | Sign in with Apple never exercised. | P1 | Works on an iPhone build: sign-in, name saved, cancel silent, sign-out, delete account. | Apple Developer, Supabase Apple provider, an iPhone | IMPLEMENTED—UNVERIFIED | Hardened: SHA-256 nonce (raw nonce to Supabase), first-sign-in name saved to metadata and an empty profile name, cancel returns no error (`lib/apple-auth.ts`, `appleName.js` 4 unit tests). Entitlement `com.apple.developer.applesignin` present after prebuild. Never run against Apple. |
| F9 | 1 | Android map blank without a Maps key; Google sign-in should say "Shtëpia.ime". | P1 | Key from the build environment only, restricted; map renders on Android. | Owner: Google Cloud project + restricted key; OAuth consent screen name | IMPLEMENTED—UNVERIFIED | `app.config.js` writes `GOOGLE_MAPS_ANDROID_API_KEY` to `android.config.googleMaps.apiKey` only when set; prebuild with a placeholder shows the manifest entry, without it none; `appConfig.test.mjs` 3/3 (also: no key in `app.json`). Restriction steps in the handoff. Consent-screen name is a console setting. |
| F10 | 1 | Store needs the final icon and assets. | P1 | Approved logo in every icon slot with the right sizes; store icon. | Owner: feature graphic and screenshots need a build | VERIFIED (icons); screenshots BLOCKED | App icons 1024×1024 RGB (no alpha, as the App Store requires), adaptive and monochrome Android icons, splash, favicon; Android notification icon from the monochrome mark. `store/google-play-icon-512.png` from `scripts/make-store-icons.cjs`. Play feature graphic and screenshots: not made (need a build). |
| F11 | 1 | No crash reporting. | P2 | Crashes visible to the owner, without personal data. | — | VERIFIED | First-party `client_errors` (insert-only; ids, emails, phones, tokens redacted before storage; flood guard; no user id): live `rls_client_errors.sql` 7/7; unit `errorReport`; e2e error-report. No third-party SDK, no account. |
| F12 | 1 | Agents could not change their phone or photo. | P1 | Own phone/photo only, validated, persisted. | — | VERIFIED (website, live); phone IMPLEMENTED—UNVERIFIED on a device | Live `rls_profile_phone.sql` 7/7, `rls_profile_avatar.sql` 9/9 (own folder of the avatars bucket only). e2e F12 (photo upload, wrong type refused, phone validation). |
| F13 | 4 | Saved-search alerts never sent. | P2 | Matching, de-duplication, preferences, unsubscribe; sending gated on a provider. | Owner: email provider key + a schedule | IMPLEMENTED—UNVERIFIED (delivery) | Migration `20261021051016`; Edge Functions `saved-search-alerts` v1 (off unless `ALERTS_DISPATCH_ENABLED=true` + `RESEND_API_KEY` + `ALERT_EMAIL_FROM`) and `saved-search-unsubscribe` v1. Live `rls_saved_search_alerts.sql` 7/7; unit `savedSearchAlerts`. No schedule configured, no email sent. |
| F14 | 4 | No push for messages and viewings. | P2 | Token ownership, logout cleanup, preferences, recipient checks; delivery on a build. | A build on a device | IMPLEMENTED—UNVERIFIED (delivery) | Migration `20261021051557`; `push-dispatch` v1 (off unless `PUSH_DISPATCH_ENABLED`). Live `rls_push_notifications.sql` 11/11; unit `pushDispatch`, `notificationPreferences`. Permission asked only from Profile → Notifications. Never delivered to a phone. |
| F15 | 3 | Payments not built. | P2 | Website-only pricing; server-confirmed activation; prepaid 1/3/6/12 months; limits enforced in the database; no activation from client state. | Owner: prices, Paysera merchant account, approve the two pending migrations | IMPLEMENTED—UNVERIFIED | `/pricing` (off until `VITE_CHECKOUT_ENABLED`), `checkout-start`, `paysera-callback` (signature, project, status and amount checks; idempotent), `supabase/pending/prepaid_checkout.sql`. Offline PGlite `tests_prepaid_checkout` 31/31 (duplicates, bad amount, expiry, refund, cap, stacking); unit `payseraLogic`, `billingPlans`; e2e F15. **Not deployed, no sandbox access, no payment made.** `plans_by_period_months.sql` timed out waiting for confirmation (re-tried 2026-10-21). |
| F16 | 1 | Contrast, labels, card and tab-bar semantics. | P2 | axe clean in both themes; controls named; tab bar valid. | Owner decision: white text on solid orange | VERIFIED (website e2e, phone export); device screen readers not tried | Text-only orange `--fho-orange-text` / `accentText`; dark muted/faint raised. e2e `a11y.spec.ts`: 8 pages × light and dark × 2 viewports, `color-contrast` no longer excused. Phone export: tab bar now four tabs + separate "+" (pixel-identical), labels on code boxes. Remaining: white on orange 2.4–3.4:1 (buttons, selected chips) — brand decision. |
| F17 | — | Photos removed in an edit stayed in storage (= L07). | P2 | Removed own photos deleted after a successful save only. | — | VERIFIED | e2e F09-H4; 3 unit tests. |
| F18 | — | Old second listing form in the phone app (= L08). | P2 | One form; old route redirects. | — | VERIFIED | `app/listing/create.tsx` redirects to the wizard. |
| F19 | 4 | No zone or reference-number filter. | P2 | Correct queries, combinations, empty state, pagination, state in the URL. | — | VERIFIED (website); phone IMPLEMENTED—UNVERIFIED on a device | Migration `20261021005208` (zone + generated `ref_code`, indexes); unit `searchFilters`; e2e F19 ×5. |
| F20 | — | Two SECURITY DEFINER helpers callable signed out (= L13). | P2 | Not callable by anon; visibility unchanged. | — | VERIFIED | Migration `20261021002739`; live: same visibility for anon and all 15 accounts; anon calls refused. |

## Subtasks (L ledger)

Earlier IDs, kept for history. Status updated 2026-10-21.

| ID | Maps to | Problem | Status | Evidence / next step |
| --- | --- | --- | --- | --- |
| L01 | security | Listing/chat/viewing ownership guards (S-7/8/9) | VERIFIED | Live 15/15, re-run 2026-10-21 after the moderation triggers. |
| L02 | F1, F2 | Orphan functions | VERIFIED | As F1/F2. |
| L03 | F3 | Report and block | VERIFIED (web), phone on device unverified | As F3. |
| L04 | F6 | Demo listings | VERIFIED | 12 removed, 3 real remain. |
| L05 | workflows | Edit / mark sold | VERIFIED (web) | e2e F09. |
| L06 | F13 | Alerts promised but never sent | VERIFIED | In-app "N new" count; email alerts now built (F13), off until configured. |
| L07 | F17 | Removed photos kept | VERIFIED | As F17. |
| L08 | F18 | Legacy phone form | VERIFIED | As F18. |
| L09 | F16 | Nested interactive cards | VERIFIED | axe. |
| L10 | F16 | Contrast | VERIFIED except white-on-orange (owner) | As F16. |
| L11 | F16 | Phone image labels | VERIFIED (export) | — |
| L12 | F12 | Phone editing grant | VERIFIED | Applied `20261021002731`. |
| L13 | F20 | Anon helpers | VERIFIED | Applied `20261021002739`. |
| L14 | testing | Live RLS checks in repo | VERIFIED | `supabase/tests/` (9 files). |
| L15 | F4 | Public email delivery | BLOCKED | Owner: domain + SMTP. |
| L16 | F4, F9 | No domain | BLOCKED | Owner: buy the domain. |
| L17 | legal | No contact mailbox | BLOCKED | Owner: mailbox. |
| L18 | F7 | No store builds | BLOCKED | Owner: store accounts, Expo login. |
| L19 | F9 | Android Maps key | IMPLEMENTED—UNVERIFIED | Wiring done; owner creates the key. |
| L20 | F8 | Apple sign-in | IMPLEMENTED—UNVERIFIED | Needs an iPhone build. |
| L21 | F5 | Supabase plan | BLOCKED | Owner. |
| L22 | F5 | Vercel plan | BLOCKED | Owner. |
| L23 | F15 | Payments | IMPLEMENTED—UNVERIFIED | As F15. |
| L24 | store | Store texts, privacy answers | IMPLEMENTED—UNVERIFIED (owner review) | `docs/STORE_LISTING_DRAFTS.md`, updated for photos, crash reports, push tokens. |
| L25 | ops | Backup/rollback procedure | VERIFIED (document) | No restore drill. |
| L26 | F11 | Crash reporting | VERIFIED | First-party, as F11. |
| L27 | F14 | Push | IMPLEMENTED—UNVERIFIED | As F14. |
| L28 | F19 | Zone/reference filters | VERIFIED | As F19. |
| L29 | data | "Ali Demi" listing type/price mismatch | DEFERRED WITH REASON | Owner postponed (2026-10-16); name typo in `locations.js` fixed. |
| L30 | F6 | Two test accounts | BLOCKED | Owner confirms the DELETE. |
| L31 | F16 | Phone tab-bar semantics | VERIFIED (export) | As F16. |
| L32 | store | Unused camera purpose string | VERIFIED | Prebuild. |

## Follow-up 2026-10-21: Google sign-in name, notification switches, email codes

See `docs/AUTH_NOTIFICATIONS_EMAIL_REPORT.md`. F14's sheet now keeps device
permission, registration and the account's switches apart (tests X13–X16,
`notificationDeviceState`), and `push-dispatch` v2 drops pushes switched off
after queueing. F4's code flow follows Supabase's own wait time (F4-N6, X18).
Still BLOCKED: Google branding/verification, a sending domain for Resend, and
device delivery checks.

## What is left, by kind

1. **Engineering that can be done now:** none open. Two finished pieces wait
   only for the owner's click in the Supabase confirmation prompt
   (`plans_by_period_months.sql` then `prepaid_checkout.sql`; the two
   test-account deletions).
2. **Needs an account, payment, credential, device or approval:** F4 delivery
   (domain, SMTP), F5 (plans), F7/F8 (Apple, Google Play, Expo login, a
   device), F9 (Maps key, OAuth consent name), F10 screenshots and feature
   graphic (a build), F13 delivery (email key + schedule), F14 delivery (a
   build), F15 (prices, Paysera merchant account, sandbox), merging to
   `master`.
3. **Owner product decisions:** white text on orange (F16); whether to sell
   inside the apps (F15, store billing rules); individual vs company
   publisher (D-U-N-S); "Ali Demi" listing (L29).
