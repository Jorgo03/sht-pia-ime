# Readiness report — Shtëpia.ime

Date: 2026-10-21. Branch `claude/app-property-translation-kosqyj` (not merged to
`master`, so none of this is on the live website yet). Task ledger:
`docs/LAUNCH_TASKS.md`. Accounts: `docs/ACCOUNT_AND_RELEASE_HANDOFF.md`.

## Verdict

**READY FOR ACCOUNT SETUP AND REMAINING RELEASE VERIFICATION**

All code work that can be done before buying anything is done or waiting
on an owner decision. What stands between this and a release needs your
accounts, a device or your yes:
- real-user email (SMTP);
- a domain and mailbox;
- store accounts and signed builds;
- the Android map key;
- the hosting and database plans;
- three pending database changes;
- a brand-colour decision.

It is **not** ready for release. No production iOS or Android build exists or
has been tried on a phone. Email sign-up and password reset do not work for
the public today (L15).

## Fixes in this pass (since `6a4422b`)

| ID | Fix | Evidence |
| --- | --- | --- |
| L06 | Saved-search "alerts" no longer promise emails nobody sends; the app shows "N more than last time" instead | 6 unit tests; e2e F11 ×2 viewports |
| L07 | Photos removed while editing a listing are deleted from storage (own folder only) | 3 unit tests; e2e F09-H4 checks the exact storage DELETE |
| L08 | The legacy phone listing form is retired; old link redirects to the wizard (−1,172 lines) | tsc, lint |
| L09 | Web cards no longer nest a button inside `role=button` | axe passes; `nested-interactive` removed from the KNOWN list; also absent on the phone export |
| L10 | Light-mode grey text meets 4.5:1 (web and phone) | axe contrast report: only brand-orange text remains |
| L11 | Phone listing images have text alternatives | axe on the Expo web export: 0 unlabeled of 7/7/13 (was 7/7) |
| L12 | Edit profile (name, agency, phone) in both apps | 6 unit tests; e2e F12 ×2; phone grant tested live 8/8, rolled back |
| L13 | Safe fix for S-4 (signed-out helper calls) designed | Rolled-back live test: same visibility for every role |
| L14 | Re-runnable live RLS checks in the repo | 15/15 and 18/18 against production, nothing left behind |
| L24 | Store texts, privacy label, data safety, reviewer plan | `docs/STORE_LISTING_DRAFTS.md` |
| L25 | Backup / restore / rollback procedure | `docs/BACKUP_AND_ROLLBACK.md` |
| L32 | iOS no longer ships an unused, vague camera purpose string | prebuild: no `NSCameraUsageDescription`; Android CAMERA removed |
| BUG-016 | Phone theme switch announces on/off | axe `aria-required-attr` gone |

## Checks

**Passed (run 2026-10-21 on this branch):**

| Check | Result |
| --- | --- |
| `npm run lint` | 0 errors, 32 warnings (same 32 as before this pass) |
| `npx tsc --noEmit` | clean |
| `npm test` | 160/160 |
| `npm run test:e2e` | 103 passed, 1 skipped (a phone-layout-only test, skipped on desktop by design) |
| `npm run build` | succeeds; bundle has no service-role or Anthropic key strings |
| `npx expo export --platform web` | succeeds (with `--clear`, see risks) |
| `npx expo prebuild` on a scratch copy | succeeds; manifest and Info.plist checked |
| `npx expo-doctor` | 19/21; the 2 failures need `exp.host`, unreachable from this sandbox |
| Live RLS checks | guards 15/15, report/block 18/18 |

**Not verified:**
- Anything on a real iPhone or Android phone.
- Sign in with Apple.
- Android map (no key).
- Real email delivery.
- Any store-console step.
- A restore from backup.
- Screen reader use on a device.
- The two `expo-doctor` network checks.

## Blockers and the smallest owner action

| Blocker | Smallest action |
| --- | --- |
| Public sign-up/reset email fails (L15) | Buy the domain, open an SMTP provider account, paste its SMTP settings into Supabase |
| No domain / contact address (L16, L17) | Buy the domain; create one mailbox |
| No store builds (L18, L20) | Enrol in Apple Developer and Google Play; create a free Expo account |
| Android map (L19) | Google Cloud project with billing + restricted Maps SDK key |
| Plans (L21, L22) | Supabase Pro and Vercel Pro before public launch |
| Pending DB changes (L12, L13) | Say "go" for `profile_phone_update.sql` and `anon_profile_helpers.sql` |
| Orange text contrast (L10) | Yes/no to a text-only orange `#b34700` |
| Live website | Say "merge" — `master` deploys to production |

Order of purchase/setup: see `docs/ACCOUNT_AND_RELEASE_HANDOFF.md` §2
(domain → mailbox → SMTP → individual vs organisation and D-U-N-S → Apple →
Google Play → Expo + Maps key → Supabase Pro + Vercel Pro → payments later).

## Open production risks

1. **Email:** new users who sign up with email never get their code (L15).
2. **No backups:** the Free plan has no automatic database backups, and storage is never backed up (L21, L25).
3. **Commercial use:** Vercel Hobby is non-commercial only (L22).
4. **Phone change refused:** until `profile_phone_update.sql` is applied, saving a new phone shows "not saved". The name and agency fields save normally.
5. **Stale Metro cache:** a stale Metro cache inlined the production Supabase URL into an export built with other env values. Use `--clear` for any build whose backend matters.
6. **Contrast:** brand-orange text fails WCAG contrast on cream backgrounds (L10).
7. **Phone tab bar** semantics are incomplete for screen readers (L31).
8. **No crash reporting** (L26) and no push notifications (L27).

## Before / after

Rubric, per area:
- **0** = broken or missing;
- **1** = partly works or has a known serious gap;
- **2** = works with known, documented gaps;
- **3** = verified ready for release.

"Before" is `6a4422b` (2026-10-20, start of this pass); "after" is this branch.

| Area | Before | After | Why |
| --- | --- | --- | --- |
| Functionality | 1 | 2 | Profile editing added; listing photo cleanup; old form gone; alerts honest. Email sign-up still blocked by SMTP |
| Security | 2 | 2 | Re-runnable RLS checks now in the repo. S-4 and the phone grant are designed and tested but wait for your go |
| Reliability | 1 | 1 | Procedures written, but still no backups (Free plan), no crash reporting, no restore drill |
| Mobile UX | 1 | 2 | Accessibility fixes verified on the export; still never run as a store build on a device |
| Deployment | 1 | 1 | Prebuild passes and permissions are cleaned, but no signed build, domain or paid plans |
| Billing | 0 | 0 | No provider and no prices; correctly nothing for sale in the apps (L23) |
