# Launch plan: web, App Store, Google Play

Written 2026-11-13, after the full audit (`docs/audit/AUDIT_REPORT.md`). The
requirements below were checked that day against the official pages listed at
the end. They change, so recheck any date-bound one on the day you act.

- **✅** = done by Claude, in this repository or the live project.
- **👤** = Jorgo must do it: an account, a payment, a legal step, or a store console.

The Albanian step-by-step version with costs is `docs/PLANI_I_PUBLIKIMIT.md`.
Store texts, privacy answers and reviewer notes are drafted in
`docs/STORE_LISTING_DRAFTS.md`. This plan is the checked, ordered summary.

## Where things stand

- ✅ The app is feature-complete for v1.0, and every check is green:
  - type check;
  - lint: 0 errors;
  - unit tests;
  - website e2e and Expo-app e2e;
  - `expo-doctor` 20/20;
  - row-level security verified on all 29 tables on the live database.
- ✅ The website runs on Vercel at `real-estate-app-hazel-seven.vercel.app` (the Vite build). It has its title, description, Open Graph image, `robots.txt`, `sitemap.xml`, HSTS and frame protection. `favicon.ico` and the web manifest were added in this audit.
- **👤 Blockers only you can clear** (the critical path):
  1. A domain.
  2. SMTP email, so sign-up codes reach real people.
  3. Supabase Pro.
  4. The Apple Developer Program.
  5. A Google Play developer account.
  6. Turning on Sign in with Apple and Confirm email (in that order, after SMTP).

## A. Website (Vercel)

1. 👤 **Buy the domain** (for example `shtepia.al` or `shtepiaime.com`). Use a registrar that lets you edit DNS.
2. 👤 **Add it to the Vercel project** `real-estate-app`: Settings → Domains → Add Existing.
   - Point the root domain with an A record and `www` with a CNAME, using the exact values the dashboard shows.
   - Make one redirect to the other.
   - Vercel issues the HTTPS certificate itself.
   - Before moving nameservers, copy any existing DNS records, MX included, so email keeps working.
3. 👤 **Environment variables** in Vercel (Production):
   - `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for project `xzzzhlwmzotibrxdqmcm`;
   - optional switches, listed in `.env.example`.
   - Never `SUPABASE_SERVICE_ROLE_KEY`. ✅ The bundle was checked: only the public key is inside.
4. 👤 **Supabase → Authentication → URL Configuration:**
   - Site URL = `https://<domain>`.
   - Redirect URLs: add `https://<domain>/auth/callback` and `shtepia-ime://auth/callback`.
   - Keep the `exp://` development entries until the store apps are out.
   - Use exact paths for production; wildcards only for preview builds.
5. 👤 **Google Cloud → OAuth client (web):** add `https://<domain>` to the authorised origins. The Supabase callback `https://xzzzhlwmzotibrxdqmcm.supabase.co/auth/v1/callback` stays the redirect URI.
6. ✅/👤 **Update the app for the domain.**
   - ✅ I'll make the code change: set `EXPO_PUBLIC_SITE_URL` and `EXPO_PUBLIC_WEB_ORIGIN` to the domain, and add iOS associated domains and Android app links (AUDIT-008), once you tell me the domain.
   - 👤 You add the same values in EAS for the store builds.
7. **SEO basics:**
   - ✅ Done: title, meta description, Open Graph tags, `og-image.png`, `robots.txt`, `sitemap.xml`, favicon, manifest.
   - 👤 After the domain is live, add it in Google Search Console and submit `/sitemap.xml`.
8. ✅ The Expo web build (`deploy/expo-web/`) is ready but **parked** (decision W2). Production stays on the Vite build until you decide otherwise.

## B. iOS (App Store)

1. 👤 **Apple Developer Program**: paid yearly; see the price on developer.apple.com. Enrol as an individual or as an organisation. An organisation needs a D-U-N-S number and takes longer.
2. ✅ **App identity in `app.json`:**

   | Setting | Value |
   |---|---|
   | Name | Shtëpia.ime |
   | Bundle ID | `com.shtepiaime.app` |
   | Version | 1.0.0 |
   | Build numbers | set by EAS (`appVersionSource: remote`, `autoIncrement`) |
   | Icon | light, dark and tinted |
   | Splash | door, light and dark |
   | iPad | supported (`supportsTablet: true`), so iPad screenshots are required (step 7) |
   | Encryption | `ITSAppUsesNonExemptEncryption: false` |

3. ✅ **Permission texts** (photos, location when in use) in English and Albanian. The Albanian strings are added in the final commit of this audit.
4. 👤 **Sign in with Apple** (Guideline 4.8). The app offers Google sign-in, so it must also offer an equivalent login service that:
   - asks only for name and email;
   - lets people hide their email;
   - does not track them for advertising.

   Sign in with Apple meets all three; email and password alone do not count as a login service. Steps:
   - in the Apple Developer portal, create the Services ID and key;
   - in Supabase → Auth → Providers → Apple, enter them and turn it on;
   - test on a device;
   - tell me, and I set `APPLE_SIGN_IN_ENABLED = true` (`src/features/auth/lib/oauthOptions.js`).

   **Do not submit to review before this.**
5. ✅ **Account deletion inside the app** (Guideline 5.1.1(v)): Profile → Delete account. It removes the profile, listings, photos and chat files (`delete-account` version 2, deployed).
6. ✅ **Privacy policy** in the app and at `/privacy`, **terms** at `/terms`. 👤 Enter the privacy policy URL and a support URL in App Store Connect. The support page must have an easy way to contact you (Guideline 1.5). A mailbox on the new domain is enough.
7. 👤 **Screenshots**, checked against Apple's specifications page:
   - iPhone: the largest size, 1320 × 2868 (or 1290 × 2796) portrait, 1–10 images. App Store Connect scales them down for smaller iPhones.
   - iPad: 13-inch, 2064 × 2752 portrait.
   - No transparency.
   - ✅ I can produce them from the Expo web build at those sizes if you want.
8. 👤 **Store listing:** name, subtitle, description, keywords and promotional text, in Albanian and English. Drafts are in `STORE_LISTING_DRAFTS.md` §1.
9. 👤 **App Privacy answers** (privacy "nutrition label"), from `STORE_LISTING_DRAFTS.md` §2.
10. **Build and submit:**
    - `npx eas build -p ios --profile production`;
    - `npx eas submit -p ios`. The first run asks for your Apple ID. For automation, create an App Store Connect API key with `eas credentials -p ios`.
    - The build goes to **TestFlight**. Test on a phone with `docs/REAL_DEVICE_CHECKLIST.md`.
    - Then **Submit for Review**, with the reviewer login from `STORE_LISTING_DRAFTS.md` §5.
    - ✅ Build config is ready (`eas.json` production profile).
    - 👤 You run the build and submit (Claude never submits to a store).

## C. Android (Google Play)

1. 👤 **Play Console account**: a one-time fee; see the price in Play Console. Personal or organisation. ⚠️ A **personal** account created after 13 Nov 2023 must run a **closed test with at least 12 testers, opted in for 14 days in a row**, before it can apply for production. Google then usually answers within 7 days. Start this early. The message for testers is in `PLANI_I_PUBLIKIMIT.md` Appendix A.
2. ✅ **App identity:**

   | Setting | Value |
   |---|---|
   | Package | `com.shtepiaime.app` |
   | versionCode | set by EAS (remote, auto-increment) |
   | Icon | adaptive (foreground, background, monochrome) |
   | Target SDK | **36 (Android 16)**, the Expo SDK 58 / React Native 0.88 default. Play requires 36 for new apps and updates since 31 Aug 2026 (extension to 1 Nov 2026), so ✅ compliant. |

3. 👤 **Google Maps Android key**:
   - create it in Google Cloud and restrict it to `com.shtepiaime.app` and the upload and signing SHA-1s;
   - set it as the EAS secret `GOOGLE_MAPS_ANDROID_API_KEY`.

   Without it the Android map is blank in store builds.
4. 👤 **Google sign-in on Android**: add the Play app-signing SHA-1 to the Android OAuth client. Details in `docs/GOOGLE_SIGNIN_ANDROID_REPORT.md`.
5. **Build and upload:**
   - 👤 First create the app in Play Console. Then `npx eas build -p android --profile production` builds an AAB, and `npx eas submit -p android` uploads it to the **internal** track.
   - EAS Submit needs a Google service account JSON key, uploaded with `eas credentials -p android`.
   - The app stays in draft until the store listing is complete.
6. 👤 **Order of tracks:** internal (you) → closed test (12 testers, 14 days) → apply for production → production.
7. 👤 **Policy forms:**
   - **Data safety**, from `STORE_LISTING_DRAFTS.md` §3, including the data-deletion questions.
   - **Account deletion web link**: ✅ in-app deletion exists. 👤 Play also requires a web page where people can request deletion without the app. Point it at the `/privacy` deletion section, or ask me to add a `/delete-account` page that explains the steps and gives the contact address.
   - **Content rating** questionnaire.
   - **Target audience**: 18+, a property marketplace.
   - **Privacy policy URL**.
   - **App access**: the reviewer login.

## D. Backend and operations

1. 👤 **Supabase Pro**, from $25/month at the time of writing:
   - no pausing (free projects pause after a week without activity);
   - daily backups kept for 7 days;
   - leaked-password protection (AUDIT-022) and image transforms become available.
2. 👤 **SMTP** (for example Resend) on the domain: SPF, DKIM, DMARC.
   - Then Supabase → Auth → SMTP settings.
   - **Then** turn **Confirm email** back on (AUDIT-002; order in `DECISIONS.md`).
   - Check the auth rate limits for emails per hour.
3. 👤 **Vercel**: the free (Hobby) plan is for non-commercial use. A commercial launch needs **Pro**; check the price on vercel.com.
4. ✅ **EAS Update** for over-the-air JavaScript fixes. `eas.json` is ready. 👤 Run `npx eas update:configure` once, after the first store build, then publish fixes with `npx eas update --channel production`. Native changes still need a store build.
5. 👤 **Crash reporting** (AUDIT-030). The in-house `client_errors` reporting runs in release builds. Decide whether to also add Sentry (a new account and a new dependency).
6. 👤 **Before launch**:
   - remove the demo listings and demo accounts;
   - delete `.env.local.backup` and rotate the Clerk secret it holds (AUDIT-013);
   - decide what to do with the inactive second Supabase project.

## E. Legal (👤 review)

- ✅ Privacy policy and terms exist in the app and on the website, in **Albanian and English** (`src/features/legal/content/sq.js`, `en.js`). The other 6 app languages show the English text, which is enough for the stores.
- 👤 Have them reviewed by a lawyer for Albanian law and GDPR, since EU diaspora users are covered.
- 👤 Set `VITE_LEGAL_CONTACT_EMAIL` and `EXPO_PUBLIC_LEGAL_CONTACT_EMAIL` to a real, monitored mailbox.

## F. Launch day

**Checklist:**
1. CI green on `master`.
2. Supabase advisors show nothing new.
3. Run the `supabase/tests/*.sql` RLS checks: all pass.
4. On the production domain:
   - sign up with email (the code arrives);
   - sign in with Google and with Apple;
   - create a listing with photos;
   - message, book a viewing, delete a test account.
5. TestFlight and internal-track builds pass `REAL_DEVICE_CHECKLIST.md`.
6. Store listings are complete, and the reviewer login works.
7. Release the website first, then the apps, staged on Play (10% → 50% → 100%) and phased on the App Store.

**Rollback:**
- **Website:** Vercel → Deployments → promote the previous deployment (instant).
- **App JavaScript:** `npx eas update --channel production` with the previous commit, or roll back the update in the EAS dashboard.
- **Native:** halt the staged rollout on Play or pause the phased release on the App Store, then ship a fixed build.
- **Database:** every change is a migration file. Undo with a new migration, never by editing history. Pro gives daily backups, and `docs/BACKUP_AND_ROLLBACK.md` has the steps.

## Order and time

| Phase | What | Who | Time |
|---|---|---|---|
| Today | Buy the domain; enrol in Apple Developer and Play Console; upgrade Supabase to Pro | 👤 | 1–2 h of forms; Apple enrolment can take up to a few days |
| Week 1 | DNS plus Vercel domain; SMTP plus Confirm email; Supabase URLs; Google OAuth origins. I wire the domain into the app (associated domains, app links, site URL). | 👤 + ✅ | 2–3 days |
| Week 1–2 | Sign in with Apple configured and tested; Maps key; first EAS builds; TestFlight and internal testing; device checklist | 👤 + ✅ | 3–5 days |
| Week 2–4 | Play closed test with 12 testers for 14 days (personal account); App Store listing, screenshots, privacy answers; submit iOS for review | 👤 | 14+ days, set by Google |
| Week 4–5 | Play production access (≤ 7 days); public launch: website, then staged app rollout | 👤 | ~1 week |

## Sources checked on 2026-11-13

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/): 4.8, 5.1.1, 1.5.
- [Apple screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/).
- [Google Play testing requirements for new personal accounts](https://support.google.com/googleplay/android-developer/answer/14151465).
- [Target API level requirements](https://developer.android.com/google/play/requirements/target-sdk).
- [Google Play account deletion](https://support.google.com/googleplay/android-developer/answer/13327111).
- [Expo EAS Submit](https://docs.expo.dev/submit/introduction/).
- [Supabase pricing](https://supabase.com/pricing).
- [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).
- [Vercel: add a domain](https://vercel.com/docs/domains/working-with-domains/add-a-domain).
