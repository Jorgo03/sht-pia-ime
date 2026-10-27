# Shtëpia.ime: to-do list

Updated 2026-10-27 (after Pass 27). Sources:
- `docs/PLANI_I_PUBLIKIMIT.md`, the step-by-step launch plan, in Albanian;
- `AUDIT.md` passes 18–27;
- `DECISIONS.md`;
- the live Supabase project, read on 2026-10-27.

**Who does what:** **You** (owner), **Me** (Claude), **Both** (together).

## Where the app is today

| Part | State |
|---|---|
| Phone app (Expo SDK 58) | Works in Expo Go on iPhone and Android. Not in the App Store or Google Play yet: no store accounts, no production build |
| Website | Live on Vercel from `master` (the Vite site; bug fixes only, decision W1) |
| Code checks | All green: 358 unit tests, type check, lint, both builds, e2e |
| Live data | 16 accounts (2 of them test accounts waiting to be deleted), 4 active listings, **0 moderators** |
| AI features | **All down**: the `ANTHROPIC_API_KEY` secret in Supabase is rejected by Anthropic (401). That covers the listing assistant, the new AI assistant, AI search and AI listing writing. Translations fall back to MyMemory |
| Email to the public | Does not arrive: no domain and no email service, so sign-up and reset codes reach only the project team |
| Plans | Supabase free, Vercel Hobby (non-commercial) |
| Payments | Built and switched off; waiting for prices, a merchant account and two migrations |

## Next three things

1. **You:** replace `ANTHROPIC_API_KEY` (below). It turns every AI feature back on at once.
2. **You:** open the Google Play Console account. The 14-day closed test starts the launch clock.
3. **You:** try on your phone the items in "Tests on your phones" below.

## Now: free, only you can do these

- [ ] **You:** Anthropic Console → create an API key → Supabase → Edge Functions → Secrets → replace `ANTHROPIC_API_KEY`. No redeploy is needed. Then set a monthly spending limit in the Anthropic Console.
- [ ] **You:** make yourself a moderator, otherwise nobody can review reported listings. In Supabase → SQL editor:
  `insert into public.moderators(user_id) select id from auth.users where email = '<your email>';`
- [ ] **You:** click the waiting Supabase confirmations:
  - delete the two test accounts (`claude-test@shtepia.dev`, `system@shtepia.ime`);
  - `supabase/pending/plans_by_period_months.sql`, needed before payments.

## Tests on your phones (free)

- [ ] **You:** the AI, once the key is set:
  - on a listing, "Pyet për këtë pronë": ask about the price and the area;
  - Home → "Pyet asistentin AI": "2+1 me qira në Tiranë", then "po me ashensor?", then ask it to compare two results.
- [ ] **You:** signed in as an agent, the CRM:
  - Profile → agent dashboard → "Klientë potencialë": add a lead, call or WhatsApp them, move them to "Kontaktuar";
  - "Sot" and the buyer-request matches on the dashboard.
- [ ] **You:** on the Samsung A23:
  - Google sign-in on the same Wi-Fi or the phone hotspot (an Expo tunnel is refused on purpose). The page should show "Hap aplikacionin" and bring you back signed in;
  - a listing with photos, a draft, the profile photo, "U krye";
  - swipe the filter sheet and the other sheets down to close them.
- [ ] **You:** on any phone (Pass 19, never tried on a phone):
  - signing out offline;
  - password recovery by code;
  - changing your password.
- [ ] **You:** on the website, request a viewing: the date and time field should now work (Pass 25).

## Needs your approval (database or deploys)

Each database change is written to `supabase/pending/` and tested in a rolled-back transaction before you approve it.

- [ ] **You approve, then me:** deploy four Edge Functions whose repo version is newer than the live one:
  - `ai-parse-search` (understands lekë and dollars);
  - `saved-search-alerts` (unsubscribe headers);
  - `saved-search-unsubscribe`;
  - `delete-account`.
- [ ] **You approve, then me, CRM phase 2:**
  - tasks with push reminders;
  - what each lead is looking for, so leads are matched to listings.

  The file is `supabase/pending/crm_phase2_tasks_and_lead_needs.sql`, already dry-run. It also needs pg_cron turned on (or a push-dispatch change) and a push-dispatch deploy. See `docs/BSP_CRM_ANALYSIS.md`.
- [ ] **You approve, then me, P2:** `viewings` accepts any status and agent, ignores blocks, and its update guard fails open when there is no agent.
- [ ] **You approve, then me, P2:** sorting by price across EUR, ALL and USD needs a `price_eur` column.
- [ ] **You approve, then me, P3:**
  - `ai_usage` keeps IPs and user ids forever: add a prune job;
  - no server-side length limits on names, messages and viewing notes;
  - the map's county totals come from a 200-row sample: add an aggregate.

## Launch: accounts and builds (weeks 1–4)

- [ ] **You:** open Google Play Console (25 USD, one time). **Do this first**: the 14-day test sets the launch date.
- [ ] **You:** open an Expo account (free), then run `npx expo login`.
- [ ] **You:** gather 12–15 Android testers. The invitation text is in Appendix A of the plan.
- [ ] **Me:** first Android build. **You:** upload it once by hand and start the closed test (12 testers × 14 days).
- [ ] **You:** join the Apple Developer Program (99 USD a year). **Me:** iPhone build to TestFlight.
- [ ] **You:** buy the domain and create a `kontakt@` mailbox.
- [ ] **You:** open an email service (Resend, Brevo or Postmark). **Me:** settings and a test, so sign-up codes reach the public.
- [ ] **Both:**
  - Google sign-in screen named "Shtëpia.ime";
  - Android Maps key;
  - Firebase for push;
  - Sign in with Apple.
- [ ] **Both:** go through `docs/DEVICE_CHECKLIST.md` on both phones.
- [ ] **Both:** store listing: text, screenshots, privacy labels, a reviewer account (`docs/STORE_LISTING_DRAFTS.md`).
- [ ] **You:** Supabase Pro and Vercel Pro before going public.
- [ ] **Me:** production builds and submission. **You:** press "Submit for review". **Version 1.0, free.**

## Payments (version 1.1, after launch)

- [ ] **You decide:** **A** website + in-app purchase (recommended), **B** website only (Apple may reject), or **C** in-app purchase only.
- [ ] **You:** set prices for promotions and agency plans, and open a merchant account (Paysera or raiAccept).
- [ ] **Both:**
  1. approve the two pending payment migrations;
  2. make a sandbox payment;
  3. turn payments on;
  4. release 1.1.

## Small open items

- [ ] **You decide:** white text on solid orange is below the contrast guideline (2.4–3.4:1) on buttons and selected chips: keep the brand look or darken the orange.
- [ ] **You decide:** the "Ali Demi" listing's type and price do not match (postponed since 2026-10-16).
- [ ] **Me:** Chrome has no Albanian relative times, so chat times on the website say "yesterday" in English.

## Optional

- [ ] **Both:** promotion video with Pexo (allow `pexo.ai` here and set `PEXO_API_KEY`, or use the skill on your own computer).
- [ ] **Both:** a new logo or a refresh of the splash and sign-in screens, if you want one.
- [ ] **You:** design the new website later (decision W2). The current site stays until then.

## Recently done

- [x] Shtëpia.ime AI assistant (Pass 27): a chat screen that searches the real listings, compares them and explains the app; deployed, waiting for the Anthropic key. See `docs/AI_ASSISTANT.md`.
- [x] Listing assistant on every property redeployed as v6 with the history fix (Pass 26); waiting for the same key.
- [x] Website viewing time picker (Pass 25).
- [x] CRM phase 1 (Pass 24): lead manager, today's agenda, buyer requests matched to your listings. Not tried on a phone yet.
- [x] Responsive pass for foldables, narrow and wide screens, both apps (Passes 22–23), including the wizard step dots at 280–320 px.
- [x] Feature video of the app.
- [x] Pass 21: sign-in relay locked to the app's own callback, translated photo step, error states with Retry, one-click unsubscribe, AI search in lekë and dollars, SHA-256 PKCE.
- [x] Launch animation, approved on the phone (2026-10-26).
- [x] SDK 58 upgrade; Android start crash fixed; iPhone tests of photos, drafts, profile photo and "U krye".
