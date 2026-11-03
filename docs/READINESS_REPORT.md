# Readiness report — Shtëpia.ime

Date: 2026-10-21. Branch `claude/app-property-translation-kosqyj`, not merged
to `master`, so none of this is on the live website yet. Database changes
listed below **are** live on the production Supabase project (they are
additive and were each tested in a rolled-back transaction first). Ledger:
`docs/LAUNCH_TASKS.md`. Accounts: `docs/ACCOUNT_AND_RELEASE_HANDOFF.md`.
Device checks: `docs/DEVICE_CHECKLIST.md`.

## Verdict

**READY FOR ACCOUNT SETUP AND REMAINING RELEASE VERIFICATION**

- Every tracker finding (F1–F20) has its engineering done. What remains needs
  an account, a purchase, a device, a credential, or your confirmation.
- No P0/P1 engineering defect is open.
- Lint, type checks, 230 unit tests, the production build, 164 end-to-end
  tests and all 9 live database checks pass.

It is **not ready for release**:
- No iOS or Android build has been made or run on a phone.
- Email sign-up and reset still do not reach the public. That needs SMTP, L15.
- Payments, email alerts and push notifications are built but switched off.
- Nothing was verified with a real provider: Apple, Google Maps, Paysera, an
  email sender or Expo push.

## What changed in this pass

| Finding | Change | Where |
| --- | --- | --- |
| F1 | Project-wide daily ceiling on paid AI calls, fail-closed rate limits | `supabase/functions/ai-*`, `translate-property` (deployed) |
| F3 | Moderation: moderators table, review queue, hide/restore listing (owner cannot undo), close reports; web `/moderation` page | migrations `20261021052850`, `20261021053224`; `src/features/moderation/` |
| F4 | Bilingual auth emails with the 6-digit code; recovery success message bug fixed; code boxes labelled | `supabase/templates/`, `supabase/config.toml`, `Profile.jsx`, `otp-input.tsx` |
| F8 | Apple sign-in: nonce, first-sign-in name saved, silent cancel | `lib/apple-auth.ts`, `src/features/auth/lib/appleName.js` |
| F9 | Android Maps key from `GOOGLE_MAPS_ANDROID_API_KEY` at build time only | `app.config.js` |
| F10 | Android notification icon; Play Store 512 px icon | `app.json`, `store/`, `scripts/make-store-icons.cjs` |
| F11 | First-party crash reports, redacted, no user id | migrations `20261021004522`–`004604`; `src/lib/reportError.js`, `lib/report-error.ts` |
| F12 | Own phone and profile photo, both apps | migrations `20261021002731`, `20261021003934` |
| F13 | Saved-search email alerts with unsubscribe; sending off | migration `20261021051016`; functions `saved-search-alerts`, `saved-search-unsubscribe` |
| F14 | Push for messages and viewings, opt-in, preferences; sending off | migration `20261021051557`; function `push-dispatch`; `lib/push.ts` |
| F15 | Website pricing page, Paysera checkout and verified callback, prepaid 1/3/6/12-month plans, listing caps in the database; all off | `src/features/billing/`, `supabase/functions/checkout-start`, `paysera-callback` (not deployed), `supabase/pending/` |
| F16 | Readable orange text both themes and apps; valid phone tab bar | `src/styles/theme.css`, `constants/theme.ts`, `components/liquid-tab-bar.tsx` |
| F19 | Zone and reference-number search, both apps | migration `20261021005208` |
| F20 | Signed-out helper calls closed | migration `20261021002739` |

## Checks (run 2026-10-21 on this branch)

| Check | Result |
| --- | --- |
| `npm run lint` | 0 errors, 32 warnings (all pre-existing) |
| `npx tsc --noEmit` | clean |
| `npm test` | 230/230 |
| `npm run build` | succeeds; no service-role or Anthropic key strings in `dist/` |
| `npm run test:e2e` | 164 passed, 2 skipped by design (one phone-only, one desktop-only test) |
| Live database checks (`supabase/tests/`, rolled back) | ownership 15/15, report/block 18/18, phone 7/7, avatar 9/9, crash reports 7/7, alerts 7/7, push 11/11, moderation 12/12, moderator reads 6/6 |
| Offline payments SQL (PGlite) | prepaid checkout 31/31, payments foundation 23/23 |
| `npx expo export --clear` (android, ios, web; fake backend) | succeeds; no production URL in the bundles |
| `npx expo prebuild` (scratch copy) | succeeds; Maps key only when the variable is set; Apple sign-in and push entitlements present; no camera/microphone |
| `npx expo-doctor` | 19/21; the 2 failures need `exp.host`, blocked from this sandbox |
| axe on the phone app's web export | only white-on-orange contrast remains (brand decision) |

**Not verified:** any physical phone or store build; Sign in with Apple
against Apple; the Android map; real email delivery; push delivery; Paysera
sandbox or live payments; screen readers on a device; a restore from backup;
the two `expo-doctor` network checks.

## Blockers and the smallest owner action

| Blocker | Smallest action |
| --- | --- |
| Public email sign-up/reset (F4, L15) | Domain → SMTP provider → paste SMTP settings and the 4 templates in Supabase |
| Store builds, Apple sign-in, push on a phone (F7, F8, F14) | Apple Developer + Google Play + free Expo login |
| Android map (F9) | Google Cloud project, restricted Maps SDK key, set it as an EAS variable |
| Plans (F5) | Supabase Pro and Vercel Pro before public launch |
| Prepaid plans schema (F15) | Approve `plans_by_period_months` then `prepaid_checkout` when the Supabase prompt asks |
| Test accounts (F6) | Approve the two account deletions when the Supabase prompt asks |
| Contrast on orange buttons (F16) | Choose: darker orange fill, or dark text on orange |
| Live website | Say "merge" (`master` deploys production) |

## Open production risks

1. **Email:** until SMTP is set, new email users never get their code.
2. **No backups** on the Free plan, and storage is never in database backups.
3. **Commercial use** on Vercel Hobby breaks its terms.
4. **Native behaviour is untested:** maps, Apple sign-in, push, uploads,
   deep links, safe areas.
5. **Payments:** Paysera's support for this merchant and any recurring
   charging is unverified (its developer site is blocked here). Only prepaid
   is built. App Store and Google Play billing rules for selling plans used
   inside the apps are a product decision; the apps never link to pricing.
6. **White text on orange** buttons and chips is 2.4–3.4:1.
7. **Stale Metro cache** can inline an old backend URL; build with `--clear`.
8. **Moderation needs people:** reports pile up unless someone is added to
   `public.moderators` and checks `/moderation`.

## Score

Not re-scored. The tracker's 58/100 was the 15 October audit (`AUDIT.md`
Pass 15) and is not reproduced here; the blockers above are what matters.
