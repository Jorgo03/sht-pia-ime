# Payment plan: publishing Shtëpia.ime

The interactive version, with tick boxes for every step and test, is at
https://claude.ai/artifact/2iwP9xo9hG7x3vkAt8khbr. The full step list is in
`launch-checklist.md`. Prices were checked on 2026-10-15, in US dollars before
tax; sources are at the bottom.

## Totals

| | Amount | Made up of |
| --- | ---: | --- |
| Pay once to get published | ≈ $181 | Apple $99 + Google $25 + domain ≈ $12 + first month of Supabase $25 and Vercel $20 |
| Every month after launch | ≈ $50–65 | Supabase $25 + Vercel $20 + AI usage ≈ $5–20 (estimate) |
| First year, all in | ≈ $740–920 | One-time and yearly fees + 12 months of running costs |

## Every payment

| Service | What it is for | How you pay | Cost |
| --- | --- | --- | ---: |
| Apple Developer Program | App Store, TestFlight, Sign in with Apple | Yearly; the app is removed if you stop | $99 / year |
| Google Play Console | Google Play | Once, by card in your legal name | $25 once |
| D-U-N-S number | Company accounts with Apple and Google; skips Google's 12-tester, 14-day rule | Free; request it first, it can take days to weeks | $0 |
| Supabase Pro | Database never paused, backups, leaked-password protection | Monthly; includes $10 of server credit | $25 / month |
| Vercel Pro | Website hosting. Hobby is non-commercial only | Monthly, per member who deploys | $20 / month |
| Domain | Own address, email sender, Google sign-in brand check | Yearly. A .com is ≈ $10–15. A .al is ≈ €300+ at international registrars, so ask an Albanian registrar | ≈ $12 / year |
| Email service (Resend or similar) | Sign-up codes and password resets reaching real users | Free up to 3,000 a month (100 a day), then $20/month | $0 to start |
| Expo EAS | Store builds | Free: 15 iOS + 15 Android builds a month. Starter $19/month | $0 to start |
| Google Cloud (Maps) | Map in the Android app | Card on file; 10,000 map loads a month free, then $7 per 1,000 | $0 to start |
| Anthropic API (already working) | AI writer, AI search, assistant, translations | Pay as you go; set a monthly limit | ≈ $5–20 / month (estimate) |
| Error monitoring (optional, Sentry) | Crash reports | Free tier | $0 |

No store commission at launch: Apple's and Google's 15–30% only applies when
the apps themselves sell something. Posting is free, and promotions will be
sold on the website.

## Order

1. **Today:** request the D-U-N-S number (free, slowest step).
2. **This week:** Supabase Pro and Vercel Pro.
3. **This week:** buy the domain, open a free Resend account, and connect both
   (Vercel, Resend, Supabase SMTP).
4. **When the D-U-N-S arrives:** Apple ($99) and Google Play ($25), both as an
   organization.
5. **Then:** Google Cloud billing for the Android Maps key, and the Google
   sign-in name.
6. **Builds and review:** Expo's free plan; TestFlight and internal testing,
   then submit.

## Sources

- Google Play $25 fee: https://support.google.com/googleplay/android-developer/answer/6112435
- Google Play testing rule: https://support.google.com/googleplay/android-developer/answer/14151465
- Apple $99/year: https://studio.adalo.com/blog/apple-developer-program-guide
- Supabase pricing: https://supabase.com/pricing.md
- Supabase default email limits: https://supabase.com/docs/guides/auth/auth-smtp
- Vercel Hobby and Pro: https://makerkit.dev/blog/saas/vercel-cost
- Expo pricing: https://expo.dev/pricing.md
- Resend pricing: https://resend.com/pricing.md
- Maps SDK for Android billing: https://developers.google.com/maps/documentation/android-sdk/usage-and-billing
- .al prices: https://www.gandi.net/en/domain/tld/al
