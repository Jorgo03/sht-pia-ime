# Account and release handoff — Shtëpia.ime

For the owner (Future Home Orange). Updated 2026-10-21. Every outside
dependency the launch has: why, when, what the official source says, what you
do, what I (Claude) do afterwards, and what still has to be checked.

**How requirements were checked.** From this sandbox, `developer.apple.com`
could be read directly and Supabase's documentation through its official docs
tool. `vercel.com`, `support.google.com`, `developers.google.com`, `expo.dev`
and `developers.paysera.com` are blocked here. For those, the official page's
content was read through web search on 2026-10-21 ("via search"), or the row
says **unverified**. Open the link yourself before paying. Prices appear only
where the official page stated one. The tracker's cost totals (≈ $181 up
front, ≈ $50–65 a month) were **not** re-verified and are not promised here.

## 1. Dependencies

| Dependency | Why needed | Needed now/later/conditional | Official source checked | What I must do (owner) | What you will do afterward (Claude) | Verification still required |
| --- | --- | --- | --- | --- | --- | --- |
| **Domain + DNS** | Real links and sitemap, the email sender's domain (F4), contact address, Apple organisation enrolment (work email and website on the company's domain) | **Now**, it unblocks 4 rows | developer.apple.com/programs/enroll (read 2026-10-21): organisation needs a domain email and website | Buy it; add it in Vercel → Settings → Domains and set the DNS records Vercel shows | Set `VITE_SITE_URL` / `EXPO_PUBLIC_SITE_URL`, update Supabase Auth redirect URLs and Google OAuth origins with you, regenerate the sitemap | Site on HTTPS at the domain; Google sign-in returns there |
| **Mailbox** on the domain | Contact line on Privacy/Terms, store support email | Now, after the domain | Apple guideline 1.2 "published contact information" (read 2026-10-21) | Create e.g. `kontakt@…` | Set `VITE_LEGAL_CONTACT_EMAIL`, re-run e2e | Address visible on /privacy and /terms |
| **SMTP email provider** (Resend, Brevo, Postmark, SES… listed by Supabase) | Sign-up codes and password reset for the public (F4); later the saved-search alerts (F13) | **Now**: public email sign-up is broken today | supabase.com/docs/guides/auth/auth-smtp (docs tool, 2026-10-21): the default sender only reaches the project's team and is not for production | Open an account, verify the domain (SPF/DKIM records), create SMTP credentials, paste them in Supabase → Authentication → SMTP. Paste the 4 files in `supabase/templates/` into Authentication → Emails → Templates (Confirm signup, Reset password, Magic Link, Change Email Address) with the subjects in `supabase/config.toml`. Keep the password out of chat | Raise the Auth email rate limit with you; sign up and reset with a fresh outside address; enable F13 sending (`RESEND_API_KEY`, `ALERT_EMAIL_FROM`, `ALERTS_DISPATCH_ENABLED=true` as function secrets) | A stranger receives the 6-digit code; reset works; an alert email arrives and its unsubscribe link works |
| **D-U-N-S number** | Company enrolment at Apple and Google Play | Conditional: only if FHO publishes as a company | Apple enrolment page (read); Google's 2023 announcement: organisation accounts need one, "can take up to 30 days" (via search) | Look up or request FHO's number; make the D&B name and address match the company papers | — | Number accepted by both consoles |
| **Apple Developer Program** | iOS builds, TestFlight, App Store, Sign in with Apple (F7, F8), push on iPhone (F14) | Now, if iOS is in the launch | developer.apple.com/programs/enroll (read 2026-10-21): 99 USD per membership year, prices may vary by region; organisation needs D-U-N-S | Enrol (individual or company); in Supabase → Auth → Providers turn on Apple with the bundle id `com.shtepiaime.app` | EAS iOS credentials (incl. the APNs key for push) with you, production build, TestFlight, run `docs/DEVICE_CHECKLIST.md` | Apple sign-in, push, safe areas on an iPhone |
| **Google Play Console** | Android release (F7) | Now, if Android is in the launch | answer/6112435 (via search): US$25 one-time; answer/14151465 (via search): **personal** accounts made after 13 Nov 2023 need a closed test with 12 testers for 14 days | Register (company account avoids the 12-tester rule but needs D-U-N-S) | Android release build, data-safety answers from `docs/STORE_LISTING_DRAFTS.md`, closed track, `store/google-play-icon-512.png` | Build installs from Play; device checklist passes |
| **Expo account** (free) | EAS Build/Submit; push service | Now, at build time | expo.dev/pricing (via search): Free plan includes a monthly build allowance | `npx expo login` (no card) | `eas init`, credentials, builds; FCM V1 key upload for Android push with you | Builds appear and install |
| **Firebase project (FCM)** for Android push | Expo push on Android needs FCM credentials | Later: when push is switched on | **Unverified** here (expo.dev and Firebase docs blocked); Expo's push setup guide is the source to follow | Create a Firebase project for `com.shtepiaime.app`; give me nothing secret, upload the service-account key in EAS yourself or with me watching | Set `PUSH_DISPATCH_ENABLED=true` and schedule `push-dispatch` (§3) | A message and a viewing request arrive as pushes on both platforms |
| **Google Cloud: Maps SDK for Android key** | Android map (F9) | Now, for Android | developers.google.com/maps/…/get-api-key (via search): project with billing and the Maps SDK for Android enabled. Free usage limits **unverified** | Create the key; restrict it: *Application restriction* Android apps → package `com.shtepiaime.app` + the SHA-1 of the EAS upload key **and** the Play app-signing key (Play Console → App integrity); *API restriction* Maps SDK for Android only. Save it as the EAS environment variable `GOOGLE_MAPS_ANDROID_API_KEY` (never in git or chat) | Rebuild; `app.config.js` writes it into the manifest | Map renders on an Android build; key shows the restrictions |
| **Google OAuth consent screen** | Google sign-in should say "Shtëpia.ime" (F9) | Now | **Unverified** here (console docs blocked) | Google Cloud → OAuth consent screen: app name Shtëpia.ime, logo, support email, privacy/terms links on the domain | Re-check sign-in on web and phone | The Google sheet shows Shtëpia.ime |
| **Supabase Pro** | Daily backups, no pausing, leaked-password protection (F5) | Before public launch | Supabase docs (docs tool, 2026-10-21): backups for Pro and above; Free projects pause after 7 quiet days; leaked-password protection on Pro and above. Price not checked | Upgrade the organisation that owns `xzzzhlwmzotibrxdqmcm` | Turn on leaked-password protection, confirm backups, update `docs/BACKUP_AND_ROLLBACK.md` | First daily backup visible |
| **Vercel Pro** | Commercial hosting (F5) | Before public launch | vercel.com/docs/plans/hobby (via search): Hobby is non-commercial only | Move the project to a Pro team | Re-check env vars, domain, deploys | Production deploys from `master` on Pro |
| **Anthropic** (already in use) | AI listing text, search, translation | Now (exists) | — | In the Anthropic console set a monthly spend limit you are comfortable with (I did not invent one) | `AI_DAILY_CALL_CAP` can be lowered to match; currently 2000 calls/day | Function logs show no billing errors |
| **Paysera merchant account** | Website checkout for prepaid plans and promotions (F15) | Later: when you sell | **Unverified**: developers.paysera.com is blocked here; the integration follows Paysera's WebToPay v1.6 as described in search results and the `paysera-webtopay` npm package. Merchant eligibility for FHO in Albania and any recurring card charging are **not confirmed**, so only prepaid is built | Open the account; ask Paysera (a) Albania/ALL support, (b) whether recurring charges exist for you; decide prices per plan and period | Approve the pending SQL (§2); deploy `checkout-start` and `paysera-callback` (`verify_jwt` off for the callback) with `PAYSERA_PROJECT_ID`, `PAYSERA_SIGN_PASSWORD`, `PAYSERA_TEST_MODE=true`, `SITE_URL`; insert your prices; sandbox test; then `VITE_CHECKOUT_ENABLED=true` | A sandbox payment activates the plan only after the signed callback; a duplicate callback changes nothing |
| **Store billing rules** | Selling plans that unlock features used in the apps | Decision before selling | Apple 3.1.1 (read 2026-10-21): in-app unlocks "must use in-app purchase"; Google's equivalent **unverified** | Decide: website-only selling (current build: the apps never link to pricing) or in-app purchase. Ask a lawyer for your countries if unsure | Nothing until you decide | Store review outcome |

## 2. Confirmations waiting for you in the Supabase prompt

These are ready and tested. The Supabase tool asks for your confirmation
before any `DROP` or `DELETE`, and timed out when nobody answered.

| What | File / target | Tested |
| --- | --- | --- |
| Plans table by period (needed before payments) | `supabase/pending/plans_by_period_months.sql` (the table is empty) | Offline 23/23 |
| Prepaid checkout, listing caps (after the line above) | `supabase/pending/prepaid_checkout.sql` | Offline PGlite 31/31 |
| Delete the 2 synthetic test accounts | `claude-test@shtepia.dev`, `system@shtepia.ime` + 8 unreferenced test files in `property-images/9c47f15e-…/` | Dry run: only conversation is with each other |

## 3. After setup: schedules (Supabase Cron)

Supabase runs scheduled calls with `pg_cron` + `pg_net`, keeping keys in
Vault (supabase.com/docs/guides/functions/schedule-functions, docs tool
2026-10-21). Once sending is enabled, store the secrets in Vault yourself or
with me (never in chat), then:

```sql
-- every 15 minutes: saved-search alerts; every minute: push queue
select cron.schedule('saved-search-alerts', '*/15 * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/saved-search-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'alerts_cron_secret')),
    body := '{}'::jsonb);
$$);
select cron.schedule('push-dispatch', '* * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/push-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')),
    body := '{}'::jsonb);
$$);
```

The same cron secrets go in as function secrets `ALERTS_CRON_SECRET` and
`PUSH_CRON_SECRET`.

## 4. Moderation

Add each moderator once, in the SQL editor:
`insert into public.moderators(user_id) values ('<their account id>');`
They then see "Moderation" in their website profile.

## 5. Order to set things up

1. **Domain** → **mailbox** → **SMTP provider** + email templates. This fixes
   public sign-up.
2. Decide **individual vs company**. If company, request the **D-U-N-S**
   number now, since it can take weeks.
3. **Apple Developer**, **Google Play**, free **Expo** login.
4. **Google Cloud**: Maps key (restricted) and OAuth consent name. Then
   **Firebase** for Android push.
5. I build, you run `docs/DEVICE_CHECKLIST.md` on TestFlight and the Play
   test track.
6. **Supabase Pro** and **Vercel Pro** before announcing publicly; say
   "merge" to put the website changes live.
7. **Paysera** and prices when you are ready to sell; approve §2 first.

## 6. What I can't do for you

I cannot and should not buy anything, accept terms, enrol in programmes, see
passwords or cards, publish to the stores, or merge to `master` (the live
website) without you saying so.
