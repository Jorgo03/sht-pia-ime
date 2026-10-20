# Launch task ledger — Shtëpia.ime

Started 2026-10-20 from the repository at `6a4422b`, the live Supabase project
`xzzzhlwmzotibrxdqmcm`, GitHub/Vercel deployment records and the audit
history in `AUDIT.md` (passes 14–15). Kept current as work lands.

**Scope.** Web (Vite + React 19, deployed by Vercel from `master`) and the
Expo SDK 57 phone app (iOS and Android), one Supabase backend. Two live roles:
Klient (`buyer`) and Agjent (`agent`). The planned roles in CLAUDE.md (agency
admin and others) are out of launch scope.

**Class:** A = can be finished before any purchase · B = needs an account,
purchase, credential, device or outside approval · C = optional, outside the
launch scope.

**Status:** TODO · IN PROGRESS · IMPLEMENTED—UNVERIFIED · VERIFIED · BLOCKED ·
DEFERRED WITH REASON.

| ID | Pri | Class | Area | Problem and evidence | Acceptance criteria | Dependencies | Status | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| L01 | P0 | A | Security | Anyone signed in could publish a listing under a real agent's name, move a chat to a third person, or confirm their own viewing (AUDIT S-7/8/9). | Guards refuse all three for app requests; admin still can. | — | VERIFIED | Migration `20261015205024_ownership_guards`; 15/15 live checks before and after applying (rolled back). |
| L02 | P0 | A | Security | Orphan Edge Function `translate-description` let anyone spend the AI credit (S-1); dead `clerk-link-profile` (S-2). | Neither deployed; the 5 used functions remain. | Owner (dashboard) | VERIFIED | `list_edge_functions`, 2026-10-16. |
| L03 | P1 | A | Store policy | No report or block (App Store 1.2, Google Play UGC policy). | Report a listing or user; block/unblock in chat; blocked sender refused by the database. | — | VERIFIED (web), IMPLEMENTED—UNVERIFIED (phone on a device) | Migration `20261016181934`; reports 8/8, blocks 11/11 live; e2e F10 ×2 viewports. Phone screens type-check and lint; not run on a phone. |
| L04 | P1 | A | Data | 12 seed listings with a placeholder phone, 2 diagnostic accounts. | Only real listings remain. | Owner "go" | VERIFIED | Guarded delete, counts 12 and 2; 3 listings remain. |
| L05 | P1 | A | Workflows | Agents could not edit a listing or mark it sold/rented. | Edit and close from My Listings, both apps; ownership unchanged on save. | — | VERIFIED (web), IMPLEMENTED—UNVERIFIED (phone on a device) | e2e F09 ×2; 7 unit tests (`listingForm`). |
| L06 | P1 | A | Honest UI | Saved searches show "Turn alerts on" but nothing ever sends an alert (no sender, no cron, no email). | No promise the app does not keep: a real in-app "N new" count per saved search, wording that says what happens. | — | VERIFIED (web), IMPLEMENTED—UNVERIFIED (phone on a device) | Shared `src/features/saved-searches/lib/matches.js`: in-app "N more than last time" from `last_match_count`, set at creation and when opened; wording in 8 languages says email alerts are not available yet. 6 unit tests (`savedSearchMatches`), e2e F11 ×2 viewports. |
| L07 | P2 | A | Data | Photos removed while editing a listing stay in storage forever (public bucket). | After a successful save, removed photos of your own folder are deleted; a failed save deletes nothing. | — | TODO | — |
| L08 | P2 | A | Workflows | Legacy phone form `app/listing/create.tsx` is still a route (deep link `/listing/create`), writes different columns from the wizard (sets `agent_id` for clients, no `owner_type`). | One listing form; the old route goes to the wizard. | — | TODO | — |
| L09 | P2 | A | Accessibility | BUG-006: listing cards are `role=button` with a button inside (axe `nested-interactive`). | No nested interactive controls; card still opens the listing; e2e KNOWN list shrinks. | — | TODO | — |
| L10 | P2 | A | Accessibility | BUG-008: light-mode muted text below 4.5:1 (axe `color-contrast`). | Muted text tokens meet 4.5:1 on their backgrounds, mirrored in `constants/theme.ts`. | — | TODO | — |
| L11 | P2 | A | Accessibility | BUG-009: phone images have no text alternative. | Listing images carry the title as accessibility label. | — | TODO | — |
| L12 | P2 | A | Workflows | Agents cannot change their own phone number or photo: `profiles` UPDATE is granted only on `full_name`, `agency_name`, `preferred_language`. | Owner of the row can set `phone`, `avatar_url`, `bio`; nobody can change `role`; UI in both apps. | Owner "go" for the grant | TODO | — |
| L13 | P2 | A | Security | `current_user_is_agent()` and `buyer_has_open_wanted_home()` are SECURITY DEFINER and callable while signed out (S-4). | Revoked from `anon` if no policy evaluated for `anon` needs them. | Owner "go" | TODO | — |
| L14 | P2 | A | Testing | RLS checks exist only as one-off SQL in chat history. | Re-runnable, self-rolling-back SQL checks in the repo for guards and report/block. | — | TODO | — |
| L15 | P1 | B | Auth | Email sign-up and password reset fail for real people: Supabase's built-in email only sends to the project's team. | A new address receives the code; reset works. | Owner: domain + free email provider (Resend/Brevo) + SMTP settings | BLOCKED | Last email sign-up 2026-09-07; no mail sent since. |
| L16 | P1 | B | Deploy | No custom domain; links, sitemap and Google sign-in use `real-estate-app-hazel-seven.vercel.app`. | Domain on Vercel; `VITE_SITE_URL`, `EXPO_PUBLIC_SITE_URL` set; OAuth redirect URLs updated. | Owner: buy domain | BLOCKED | — |
| L17 | P1 | B | Legal | No contact mailbox on the Privacy page (`VITE_LEGAL_CONTACT_EMAIL` empty). | Address shown on /privacy and /terms. | Owner: mailbox (L16) | BLOCKED | — |
| L18 | P1 | B | Mobile | No production iOS/Android build has been made. | Signed builds install and pass the device checklist. | Apple Developer (iOS); Expo account (free) for EAS; device | BLOCKED | Sandbox cannot reach expo.dev; no Android SDK here. |
| L19 | P1 | B | Mobile | Android map needs a Google Maps SDK key; none in `app.json`. | Map renders in an Android build. | Owner: Google Cloud project with billing details (free tier) | BLOCKED | — |
| L20 | P1 | B | Auth | Sign in with Apple never exercised. | Sign in, sign out, delete account on an iPhone build. | Apple Developer + device | BLOCKED | Code present (`expo-apple-authentication`). |
| L21 | P1 | B | Ops | Database on the free plan (pauses when idle, no downloadable backups, leaked-password check unavailable). | Plan decision made; backups and leaked-password protection on. | Owner: Supabase plan | BLOCKED | `get_organization`: plan `free`. |
| L22 | P1 | B | Ops | Website on Vercel Hobby; Vercel's terms limit Hobby to non-commercial use. | Commercial-use-compliant plan before launch. | Owner: Vercel plan | BLOCKED | Plan not visible from here; to confirm in the handoff. |
| L23 | P1 | B | Billing | Plans and payments: tables exist, no provider, no prices, `plans` empty. | Business decisions recorded; provider integration with signed webhooks; entitlements server-side only. | Owner: prices, provider account (Paysera or bank), legal entity | BLOCKED | Billing UI absent (checked: no purchase screen exists), so nothing misleading ships. |
| L24 | P1 | A | Store | No store listing texts, privacy-label or data-safety drafts, reviewer-account plan. | Drafts in `docs/`, matching the SDKs actually used. | — | TODO | — |
| L25 | P2 | A | Ops | No written backup, restore and rollback procedure. | Procedure that matches the current plan, without claiming an untested restore. | — | TODO | — |
| L26 | P2 | B | Ops | No crash reporting. | Crashes visible to the owner. | Owner OK for a service (e.g. Sentry free tier) | DEFERRED WITH REASON | Needs an account and a new dependency; the apps already have error boundaries. |
| L27 | P2 | B | Mobile | No push notifications. | Message/viewing push on a device. | EAS project + build + new dependency | DEFERRED WITH REASON | Out of launch scope until builds exist. |
| L28 | P3 | C | Search | Zone and reference-number filters (9 TODOs). | — | Schema + product decision | DEFERRED WITH REASON | No `zone` column; not required for launch. |
| L29 | P3 | B | Data | "Ali Demi" listing says "me qera" but is a sale at €150,000; owned by another user. | Type and price match the title. | Owner asks the listing's owner | DEFERRED WITH REASON | Owner moved it to later on 2026-10-16. |
| L30 | P3 | B | Data | Test account `claude-test@shtepia.dev` and the empty seed account `system@shtepia.ime` remain. | Owner decides keep or delete. | Owner | DEFERRED WITH REASON | — |
