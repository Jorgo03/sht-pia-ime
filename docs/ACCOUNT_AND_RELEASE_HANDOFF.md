# Account and release handoff — Shtëpia.ime

For the owner (Future Home Orange). Written 2026-10-21. It lists every outside
account the launch depends on: what it is for, whether it is needed now, what
the provider's official page says, what you do, and what I (Claude) do after.

**How requirements were checked.** From this sandbox, `developer.apple.com`
could be read directly and Supabase's documentation through its official docs
tool. `vercel.com`, `support.google.com`, `developers.google.com` and
`expo.dev` are blocked here, so for those I read the official page's content
through web search on 2026-10-21. Those rows are marked "(via search)". Open
the link yourself before paying. Prices are given only where the official
page stated one; where it did not, the row says to check, and no price is
assumed.

**Kind of need:** _Policy_ = the provider's rules or the stores' rules require
it · _Capacity_ = needed for reliability or limits, not by any rule · _Optional_.

## 1. Accounts

| Account/service | Needed for what | Required now, later, or conditional | Official requirement checked | What I must do (owner) | What you will do afterward (Claude) | Final verification |
| --- | --- | --- | --- | --- | --- | --- |
| **Domain name** (any registrar) | Real links and sitemap (L16), email sender domain (L15), contact mailbox (L17); Apple organisation enrolment needs a work email on the organisation's domain and a public website on it | **Now**: it blocks 4 other rows | Apple enrolment page, organisation requirements ("Work email… associated with the organization's domain name"; "Website… tied to the organization's domain"), developer.apple.com/programs/enroll, 2026-10-21. Kind: _Policy_ (for Apple org) + _Capacity_ | Choose and buy the domain; add it to the Vercel project (Settings → Domains) and set the DNS records Vercel shows | Set `VITE_SITE_URL` (Vercel) and `EXPO_PUBLIC_SITE_URL` (EAS) with you, update Supabase Auth redirect URLs and Google OAuth origins (with you, since those are dashboard settings), regenerate sitemap | Site loads on the domain over HTTPS; Google sign-in returns to the domain; sitemap URLs use it |
| **Mailbox on the domain** (e.g. `kontakt@…`) | Contact line on Privacy/Terms (L17), store support email, Apple's work-email rule | Now (after the domain) | Apple 1.2 requires "Published contact information so users can easily reach you", developer.apple.com/app-store/review/guidelines, 2026-10-21. Kind: _Policy_ | Create the mailbox with your registrar or mail host | Set `VITE_LEGAL_CONTACT_EMAIL`, show it on /privacy and /terms, re-run e2e | Address visible on both legal pages, both languages |
| **SMTP email provider** (Supabase lists Resend, AWS SES, Postmark, SendGrid, ZeptoMail, Brevo) | Email sign-up codes and password reset for real users (L15). Without it Supabase "will refuse to deliver messages to addresses that are not part of the project's team" | **Now**: email sign-up is broken for the public today | supabase.com/docs/guides/auth/auth-smtp (Supabase docs tool), 2026-10-21. Kind: _Policy_ (Supabase's default sender is "not meant for production use") | Open an account with one provider, verify the domain (SPF/DKIM records it gives you), create SMTP credentials, paste them in Supabase → Auth → SMTP. **Keep the password out of chat** | Raise the Auth email rate limit to a sensible value with you, test sign-up and reset with a fresh address, update L15 | A new outside address receives the code; reset works |
| **Apple Developer Program** | Any iOS build outside Expo Go, TestFlight, App Store, Sign in with Apple (L18, L20) | Now, if iOS is in the launch | developer.apple.com/programs/enroll, 2026-10-21: "99 USD per membership year. Prices may vary by region"; Individual = legal name shown as seller; Organisation = legal entity, binding authority, **D-U-N-S number**, domain email, public website. Kind: _Policy_ | Decide individual vs organisation (the seller name the App Store shows). For FHO as seller: get the D-U-N-S number first, then enrol with the company | Create the app record values (bundle `com.shtepiaime.app` is set), configure EAS iOS credentials with you, build, TestFlight, run the device checklist | TestFlight build installs; sign in (email, Google, Apple), sign out, delete account all work on an iPhone |
| **D-U-N-S number** (Dun & Bradstreet) | Organisation enrolment at Apple and Google Play | Conditional: only if publishing as the company | Apple enrolment page (above); Google's 2023 Play Console announcement says new organisation accounts must provide one and that getting one "can take up to 30 days" (android-developers.googleblog.com/2023/07/boosting-trust-and-transparency-in-google-play.html, via search). Kind: _Policy_ | Look up or request FHO's number; make sure the D&B record's name and address match the company documents | — | Number accepted by both consoles |
| **Google Play Console** | Android release (L18) | Now, if Android is in the launch | support.google.com/googleplay/android-developer/answer/6112435 (via search): US$25 one-time fee, ID may be requested. answer/14151465 (via search): **personal** accounts created after 13 Nov 2023 must run a closed test with at least 12 testers opted in for 14 continuous days before production. Kind: _Policy_ | Register (organisation account avoids the 12-tester rule but needs the D-U-N-S number). If personal: line up 12 real testers | Build the Android release with EAS, prepare the data-safety answers (`docs/STORE_LISTING_DRAFTS.md`), set up the closed test track with you | Closed test live; production access granted; build installs from Play |
| **Expo account** (free) | EAS Build and Submit for both stores | Now, at build time | expo.dev/pricing (via search): Free plan lists 15 Android + 15 iOS builds per month, no overage charges on Free. Kind: _Capacity_ (local Android builds are possible without it; iOS needs a Mac or EAS) | Create the account (`npx expo login`) — free, no card | `eas init`, link the project, run `development` and `production` builds | Builds appear in the Expo dashboard and install |
| **Google Cloud project + Maps SDK for Android key** | The map on Android (`react-native-maps` uses Google Maps there); `app.json` has no key today (L19) | Now, for Android | developers.google.com/maps/documentation/android-sdk/get-api-key (via search): a project with a **billing account** and the Maps SDK for Android enabled is a prerequisite. Free-usage limits not confirmed here. Kind: _Policy_ | Create the project and billing account, enable "Maps SDK for Android", create a key **restricted** to package `com.shtepiaime.app` + the app's signing SHA-1 | Put the key in the Android build config through an EAS secret (never in git), rebuild | Map renders on an Android build; key restricted in the console |
| **Supabase Pro** | Daily backups (7 days kept), no inactivity pausing, leaked-password protection (L21) | Before public launch | supabase.com/docs/guides/platform/backups ("We automatically back up all Pro, Team, and Enterprise Plan projects"); …/free-project-pausing (Free projects paused after low activity over 7 days); …/auth/password-security ("Leaked password protection is available on the Pro Plan and above"). Docs tool, 2026-10-21. Price not checked (pricing page blocked here). Kind: _Capacity_ | Check the current price at supabase.com/pricing; upgrade the organisation that owns `xzzzhlwmzotibrxdqmcm` | Turn on leaked-password protection with you, confirm backups appear, update `docs/BACKUP_AND_ROLLBACK.md` | Dashboard shows Pro and a first daily backup |
| **Vercel Pro** | Hosting the website commercially (L22) | Before public launch (it is a company marketplace) | vercel.com/docs/plans/hobby and …/limits/fair-use-guidelines (via search): Hobby is for "non-commercial, personal use"; "all commercial usage of the platform requires either a Pro or Enterprise plan". Price not checked. Kind: _Policy_ | Check the price on vercel.com/pricing; move the project to a Pro team | Re-check deployments, env vars and the domain after the move | Production deploys from `master` on the Pro team |
| **Anthropic API** (already in use) | AI listing text, search parsing, translation via Edge Functions | Now (exists) | — Kind: _Capacity_ | Check the account's spending limit and billing contact | Nothing in code; rate limits per user already exist | Edge Function logs show no billing errors |
| **Payment provider** (e.g. Paysera or a bank) | Listing promotion and agency plans (DECISIONS.md M1, L23) | **Later**: no purchase UI exists, so not a launch blocker | Apple 3.1.1: features unlocked in the app "must use in-app purchase" (developer.apple.com/app-store/review/guidelines, 2026-10-21). Kind: _Policy_ | Decide prices, provider and where people pay (website only vs in-app) | Integrate with signed webhooks; grant entitlements only server-side, never from a redirect | Test-mode payment produces the entitlement only after the verified webhook |
| **Crash reporting** (e.g. Sentry) | Seeing crashes (L26) | Optional | — Kind: _Optional_ | Say yes or no | Add the SDK and update the privacy answers | A test crash appears in the dashboard |

## 2. Order to set things up

1. **Domain** → 2. **mailbox** → 3. **SMTP provider** (fixes sign-up for real
   people; nothing else depends on money after that).
4. Decide **individual vs organisation**. If organisation: request the
   **D-U-N-S number** now, since it can take weeks.
5. **Apple Developer Program**, 6. **Google Play Console** (after the D-U-N-S
   number if organisation).
7. **Expo account** (free) and **Google Cloud Maps key**.
8. **Supabase Pro** and **Vercel Pro**, before announcing the app publicly.
9. **Payment provider**, only when you are ready to sell promotion.

## 3. Database changes waiting for your "go"

| File | What it does | Tested |
| --- | --- | --- |
| `supabase/pending/profile_phone_update.sql` | Lets people change their own phone number (Edit profile), with a phone-format check | Rolled-back live test 8/8 |
| `supabase/pending/anon_profile_helpers.sql` | Stops signed-out visitors from calling two internal helper functions, without changing what anyone can see | Rolled-back live test: identical visibility for anon and all 15 accounts |
| `supabase/pending/plans_by_period_months.sql` | Billing plans by period (from the payments foundation) | Offline test (`supabase/tests_payments_foundation.test.mjs`) |

## 4. What I can't do for you

I have no authority, and should have none, to buy anything, accept any terms,
enrol in the developer programmes, see your passwords or card, publish to the
stores, or merge to `master` (which deploys the live website) without you
saying so.
