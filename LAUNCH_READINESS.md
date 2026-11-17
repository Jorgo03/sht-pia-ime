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

## Release execution pass — 2026-08-31

The production build surfaced a blocker that no amount of static checking could
have found, and which invalidated the earlier "GO WITH WARNINGS".

### 🔴 Production builds shipped without Supabase credentials — FIXED

**Evidence:** the first EAS build printed *"No environment variables with
visibility Plain text and Sensitive found for the production environment"*.
Confirmed three ways:

1. `eas env:list --environment production` → **"No variables found."**
2. `eas.json`'s production profile is `{"autoIncrement": true}` — **no `env` block**.
3. `.env` is gitignored (`.env`, `.env.local`, `.env*`), so it is **not** in the
   archive EAS builds from.

`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` were therefore
`undefined` at bundle time — and `lib/supabase.ts` **throws at module load**
when either is missing. The build would have *succeeded* and produced an app
that crashes on first launch, before any screen renders.

Invisible to every other check, because Expo Go and `npm run dev` read `.env`
from the developer's machine. **The pre-existing build `103f0fd0` (16 Aug,
versionCode 2) has the same defect and must not be submitted.**

**Fix:** both variables set on the EAS `production` environment (scope:
project, visibility: plaintext — correct, since the anon key is public by
design and already ships in every client bundle; its JWT payload is
`"role":"anon"`, never service_role).

**Build history this pass:**

| Build | versionCode | Outcome |
|---|---|---|
| `0357feed` | 3 | started before the fix — **cancelled**, would have crashed |
| `581f1498` | 4 | started after the fix; **no env warning emitted** — the first evidence the fix took. Outcome not yet observed at time of writing; check `eas build:view 581f1498` |

**Verify before trusting the artefact:** a successful build is not proof the fix
worked, because the failure is at runtime. Confirm the Supabase URL string is
actually present in the bundle, or simply launch it — a crash on the splash
screen is the symptom of this exact defect returning.

### ⚠️ Anon key format has diverged between the two apps

Not fixed — flagged, because changing it while fixing the blocker above would
have confounded two variables:

| File | Variable | Format |
|---|---|---|
| `.env` (Expo) | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | **legacy JWT** (`eyJhbGci…`) |
| `.env.local` (Vite) | `VITE_SUPABASE_ANON_KEY` | **new** (`sb_publishable_…`) |

Both are valid and both work. The EAS variable was set to the **legacy JWT**,
matching what the mobile app is currently verified working with. Worth
unifying on the `sb_publishable_` format later as a deliberate, separately
tested change.

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

## Real-device test plan

Run against the **production artefact**, not Expo Go. Expo Go and a signed
release build differ in exactly the places most likely to fail: OAuth
redirects, deep links, native modules, and the release manifest's permissions.

### Android

```
[ ] Fresh install of the .aab/.apk (uninstall any previous build first)
[ ] First launch — no crash, splash is cream #f1ede6 (not white), no flash
[ ] Sign up (email/password)
[ ] Log out, log back in
[ ] Google sign-in — including: cancel mid-flow, back button, repeat login
[ ] Apple / LinkedIn if enabled for Android
[ ] Search · filters · reset filters · no-results state
[ ] Open a property · images load · share
[ ] Favourite, then force-close and reopen — favourite persists
[ ] Agent profile opens (this is the path the RPC guard could have broken)
[ ] Create/edit a listing, upload a photo
[ ] Privacy Policy + Terms links open (once URLs are configured)
[ ] Delete account → app returns to signed-out state
[ ] Verify in Supabase: profile row, listings, and the storage folder are gone
[ ] Airplane mode: error states appear, no infinite spinners
[ ] Restart app — session restored correctly
```

### iOS

Same list, plus: safe areas around the notch and home indicator, keyboard
avoidance on the auth form, Sign in with Apple, and deep-link return from OAuth.

### The one that matters most

**Account deletion**, because it is irreversible and a reviewer will try it.
Check the Supabase Storage browser afterwards, not just the app — storage has
no FK cascade, so it is the part most likely to silently half-work.

## Store submission checklist — OWNER

Nothing below can be produced from the codebase; none of it is invented here.

### Google Play
```
[ ] App name · short description · full description
[ ] Icon · feature graphic · phone + tablet screenshots
[ ] Category · content rating questionnaire
[ ] Data Safety form  (use the data table in SECURITY_AUDIT.md)
[ ] Privacy Policy URL · Terms URL
[ ] Support contact · app access instructions
[ ] Reviewer/demo account with AGENT role
```

### Apple App Store
```
[ ] App name · subtitle · description · keywords
[ ] Screenshots per device class · app icon
[ ] Category · age rating
[ ] App Privacy answers  (same data table)
[ ] Privacy Policy URL · Terms URL
[ ] Review notes · demo account
```

### Data declarations — factual basis

The app collects: email, full name, phone, agency name, avatar, bio, role,
language preference, listings, listing photos/video, favourites, saved
searches, messages, viewings, wanted homes, and property-view analytics.

**No advertising, attribution, or third-party analytics SDK is present** —
verified. iOS App Tracking Transparency does **not** apply. Do not declare
tracking on either form.

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
