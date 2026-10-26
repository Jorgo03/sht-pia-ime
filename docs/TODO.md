# Shtëpia.ime: to-do list

Updated 2026-10-26 (Pass 21). Sources:
- `docs/PLANI_I_PUBLIKIMIT.md`, the step-by-step launch plan, in Albanian;
- `AUDIT.md` passes 18–21;
- `DECISIONS.md`.

**Who does what:** **You** (owner), **Me** (Claude), **Both** (together).

## Now: tests on your phones (free)

- [ ] **You:** On the Samsung A23, sign in with Google.
  - The page should show "Hap aplikacionin". Tap it and you should come back
    signed in.
  - Fix `4e551eb` is live.
- [ ] **You:** On the Samsung A23, try the four Phase 1 tests:
  - a listing with photos;
  - a draft;
  - the profile photo;
  - "U krye".
- [ ] **You:** On the Samsung A23, also try Pass 21:
  - swipe the filter sheet and the other sheets down to close them;
  - Google sign-in on the same Wi-Fi (an Expo tunnel is now refused on
    purpose, so use LAN or the phone hotspot).
- [ ] **You:** On a phone, try what the other session fixed (Pass 19), which
  no phone has tested yet:
  - signing out offline;
  - password recovery by code;
  - changing your password.

## Engineering I can do now (no purchase, no approval)

- [ ] **Me (optional):** at 320 px the step dots in the listing wizard nearly
  touch the right edge.

## Needs your approval (database or deploys)

Each change is written to `supabase/pending/` and tested in a rolled-back
transaction before you approve it.

- [ ] **You approve, then me, P2:** `viewings` accepts any status and agent,
  ignores blocks, and its update guard fails open when there is no agent.
- [ ] **You approve, then me, P2:** sorting by price across EUR, ALL and USD
  needs a `price_eur` column.
- [ ] **You approve, then me, P3:**
  - `ai_usage` keeps IPs and user ids forever: add a prune job;
  - there are no server-side length limits on names, messages and viewing
    notes;
  - the map's county totals come from a 200-row sample: add an aggregate.
- [ ] **You approve, then me:** deploy five Edge Functions:
  - `saved-search-alerts` (now with the unsubscribe headers);
  - `ai-parse-search` (now understands lekë and dollars);
  - `ai-listing-assistant`;
  - `delete-account`;
  - `saved-search-unsubscribe`.
- [ ] **You:** click the waiting Supabase confirmations:
  - delete the two test accounts;
  - `plans_by_period_months.sql`, needed before payments.

## Launch: accounts and builds (weeks 1–4)

- [ ] **You:** open Google Play Console (25 USD, one time). **Do this first**:
  the 14-day test sets the launch date.
- [ ] **You:** open an Expo account (free), then run `npx expo login`.
- [ ] **You:** gather 12–15 Android testers. The invitation text is in
  Appendix A of the plan.
- [ ] **Me:** first Android build. **You:** upload it once by hand and start the
  closed test (12 testers × 14 days).
- [ ] **You:** join the Apple Developer Program (99 USD a year).
  - **Me:** iPhone build to TestFlight.
- [ ] **You:** buy the domain and create a `kontakt@` mailbox.
- [ ] **You:** open an email service (Resend, Brevo or Postmark).
  - **Me:** settings and test, so sign-up codes reach the public.
- [ ] **Both:**
  - Google sign-in screen named "Shtëpia.ime";
  - Android Maps key;
  - Firebase for push;
  - Sign in with Apple.
- [ ] **Both:** go through `docs/DEVICE_CHECKLIST.md` on both phones.
- [ ] **Both:** store listing: text, screenshots, privacy labels, a reviewer
  account.
- [ ] **You:** Supabase Pro and Vercel Pro before going public, plus an
  Anthropic spending limit.
- [ ] **Me:** production builds and submission. **You:** press "Submit for
  review".
  - **Version 1.0, free.**

## Payments (version 1.1, after launch)

- [ ] **You decide:** **A** website + in-app purchase (recommended), **B** website
  only (Apple may reject), or **C** in-app purchase only.
- [ ] **You:** set prices for promotions and agency plans, and open a merchant
  account (Paysera or raiAccept).
- [ ] **Both:**
  1. approve the two pending payment migrations;
  2. make a sandbox payment;
  3. turn payments on;
  4. release 1.1.

## Optional

- [ ] **Both:** promotion video with Pexo.
  - Allow `pexo.ai` in this environment and set `PEXO_API_KEY`, or use the
    skill on your own computer.
- [ ] **Both:** new logo or a refresh of the splash and sign-in screens, if you
  want one. The current mark is the orange arched door.
- [ ] **You:** design the new website later (decision W2). The current site
  stays until then.

## Recently done

- [x] Pass 21, the no-cost list (2026-10-26):
  - the sign-in relay accepts only the app's own callback on a private
    network;
  - publishing reports translations that failed;
  - the photo step is translated;
  - Favorites and the map have error states with Retry;
  - the push token is kept until its row is deleted;
  - alert emails have one-click unsubscribe;
  - AI search understands lekë and dollars;
  - the sheets use `usePanGesture`;
  - Google sign-in uses SHA-256 PKCE on the phone.
- [x] Launch animation: the logo's door opens onto a warm room, then fades into the app (`components/brand/door-splash.tsx`). Seen and approved by the owner on the phone (2026-10-26).

- [x] SDK 58 upgrade; the app opens in Expo Go on iPhone and Android.
- [x] Android crash on start (`ExpoTopicSubscriptionModule`) fixed; confirmed
  on the Samsung A23.
- [x] Tested on iPhone: listing with photos, draft, profile photo, "U krye".
- [x] Google sign-in on Android:
  - Expo Go detection;
  - a secure random source;
  - no blank relay page (still needs a phone test).
- [x] Pass 19, the other session's audit: 18 fixes, including password
  recovery, a one-draft-per-account limit, price filters in euros, and
  sign-out working offline.
- [x] Launch plan, roadmap and Figma rules (`design-system/FIGMA_RULES.md`).
