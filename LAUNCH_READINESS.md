# Final Launch Readiness — Shtëpia.ime

**Date:** 2026-08-30 · **Branch:** `fix/silent-failures-and-raw-i18n-keys`
**Companions:** `PRE_LAUNCH_FIXES.md` (per-item tracking), `SECURITY_AUDIT.md`,
`AUDIT.md` (passes 1–12)

## Decision

# 🟡 GO WITH WARNINGS

Every code-fixable blocker is fixed and verified. What remains is external:
legal documents, dashboard toggles, an Apple enrolment, and a production build
on real hardware. No critical or high security issue remains.

This is **not** 🟢 GO: a production release build has not been run or installed
on a device, and the Privacy Policy does not exist yet. Both stores reject
without it.

---

## Fixed

- **Account deletion** — Edge Function (`ACTIVE`, `verify_jwt: true`) plus UI on
  web and mobile, localized into 8 languages. Handles what a bare
  `deleteUser()` would miss: `properties.owner_id` is `ON DELETE SET NULL`, so a
  self-listed home would otherwise survive as a publicly visible, un-deletable
  orphan still carrying the user's photos and phone number. Storage folders
  purged too (no FK cascade there).
- **`SYSTEM_ALERT_WINDOW` removed from the release manifest** — traced to
  Expo's default template (annotated *"OPTIONAL PERMISSIONS, REMOVE WHATEVER YOU
  DO NOT NEED"*), not to any dependency.
- **Splash flash fixed** — was `#ffffff`/`#000000` against app backgrounds of
  `#f1ede6`/`#0e0b09`. Now matched; confirmed in the generated native
  `colors.xml` and `values-night/colors.xml`.
- **Anon information oracle closed** — `buyer_has_open_wanted_home` now returns
  a constant `false` to non-agents. The obvious fix (revoking EXECUTE) was tried
  first, **broke every public agent page**, and was rolled back; details in
  `PRE_LAUNCH_FIXES.md`.
- **`property_activity` retention** — pruning function shipped and executed
  (0 rows deleted, 174 intact). Scheduling needs `pg_cron` enabled.
- **`property_activity` forgery closed** (security pass) — the only permissive
  policy in the schema; anyone could attribute analytics to any other user.
- **Lint 12 → 0** — dead code removed, two dependency expressions extracted to
  named variables, five effects given documented suppressions with reasons.
- **Privacy/Terms link infrastructure** — config module per app, links in both
  Profiles, hidden unless a real `https://` URL is configured.

## Owner Actions Required

**Blocking submission:**

1. **Publish a Privacy Policy** and set `EXPO_PUBLIC_PRIVACY_POLICY_URL` +
   `VITE_PRIVACY_POLICY_URL`. Both stores refuse an app collecting personal data
   without one. The factual basis (every data type, why, where stored, who can
   read it) is tabulated in `SECURITY_AUDIT.md` — I did not write the legal text.
2. **Publish Terms of Service**, set the matching two variables.
3. **Complete Resend domain verification** — until then password reset and
   email-code login fail for real users, including a reviewer who taps
   "Forgot password".
4. **Apple Developer Program enrolment** — blocks any iOS build entirely.

**Strongly recommended before submitting:**

5. **Run account deletion once** with a disposable account. It is irreversible,
   a reviewer will try it, and only its auth boundary has been proven.
6. **Run the Android production build** and install it on a real device:
   `eas build --profile production --platform android`. Not run here — it
   consumes build credits and needs signing credentials.
7. **Reviewer demo account** — without agent credentials a reviewer sees only
   the buyer surface and may reject for incomplete functionality.
8. Store metadata: descriptions, screenshots, category, content rating, Data
   Safety / App Privacy declarations, support contact.

**Optional hardening:**

9. Enable leaked-password protection (Supabase Auth dashboard toggle).
10. `create extension pg_cron` + schedule the pruning job (SQL in the migration).
11. Confirm Supabase Auth's built-in rate limits; consider an edge rule for
    anonymous `property_activity` writes.

## Not Tested Because

- **No Android release build** — `eas build` uploads to Expo's cloud, consumes
  credits, and needs signing credentials. That is your decision, not mine to
  spend unprompted.
- **No physical device or emulator** on this machine (verified in an earlier
  pass). Nothing here was run on real hardware.
- **iOS cannot be built at all** without the paid Apple account.
- **Account deletion happy path** — executing it destroys real data permanently,
  and no disposable account exists in this project.
- **Signed-in flows** (agent dashboard, my-listings, new-listing) — verified by
  type-check, build and RLS probes, not by clicking through as a signed-in user.
- **OAuth round-trips** (Google/Apple/LinkedIn) — require real provider
  credentials and a device.

## Security

```
Critical: 0
High:     0
Medium:   1  (rate limiting — partly infrastructure)
Low:      2  (leaked-password toggle; build-toolchain CVEs)
```

Two Medium and one Low from the security audit were closed in this pass
(`property_activity` forgery, retention, the anon oracle). All 21 anon boundary
probes re-run and passing after every database change.

## Verification

```
TypeScript (tsc --noEmit): PASS
Lint (npm run lint):       PASS — 0 problems (was 12 warnings)
Tests (npm test):          PASS — 93/93
Web build (npm run build): PASS
Expo Doctor:               PASS — 18/18
Android prebuild:          PASS — permissions + splash verified post-prebuild
i18n parity:               PASS — 0 missing/empty across all 8 locales
Secrets in bundle:         PASS — only sb_publishable_; no service-role
Security regression:       PASS — 21/21 anon probes
Android release build:     NOT RUN     (owner action 6)
iOS release build:         NOT POSSIBLE (owner action 4)
npm audit:                 WARN — build toolchain only, not shipped
```

## Remaining Risks

1. **Nothing has run on real hardware.** Every check above is static analysis,
   a web build, or a live API probe. Device-specific failures — native module
   crashes, keyboard/safe-area issues, OAuth redirects — would not have been
   caught. This is the single largest gap.
2. **Password reset is broken** pending Resend verification, and it is on the
   path a reviewer is most likely to test.
3. **Account deletion is unexercised.** The code is careful and the auth
   boundary is proven, but the teardown itself has never run.
4. **`npm audit` reports 1 critical / 15 high**, all Expo CLI / Metro / PostCSS.
   Not shipped to users, but they are real on a developer machine and in CI.
   Do **not** run `npm audit fix --force`.

## Exact Next Steps

1. Publish Privacy Policy + Terms; set the four env vars; confirm the links
   appear in Profile.
2. Complete Resend domain verification; test password reset end-to-end.
3. Create a disposable account; run account deletion; confirm the profile,
   listings and storage folder are gone.
4. `eas build --profile production --platform android`; install the artefact;
   walk the core flows on a real phone.
5. Enrol in the Apple Developer Program; then build and test iOS.
6. Prepare store metadata and a reviewer demo account.
7. Submit.
