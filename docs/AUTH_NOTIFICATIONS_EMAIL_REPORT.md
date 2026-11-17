# Google sign-in name, notification switches, email codes — 2026-10-21

Request: `Claude_Code_Auth_Notifications_Email_Fixes.md`. The two screenshots it
refers to were not attached; the work used the texts it quotes ("Njoftimet janë
të fikura në këtë telefon.", "Ndiz njoftimet", …), which identify the sheet
exactly (`components/profile/notifications-sheet.tsx`).

**VERIFIED** = observed in a test or live log. **IMPLEMENTED—UNVERIFIED** = built
and tested offline, not yet seen on a real device or mailbox. **BLOCKED** =
needs an owner action listed at the end.

| Request | Root cause | Changes made | Tests and observed result | Remaining external action |
| --- | --- | --- | --- | --- |
| Google name/domain display | Both apps sign in through Supabase's hosted OAuth (`signInWithOAuth`; the phone app opens it in an auth session). Google's account chooser therefore names the redirect host, `xzzzhlwmzotibrxdqmcm.supabase.co`. Supabase's Google guide: Google shows "a logo and name instead of the Supabase project ID" only after **Branding** is set **and brand verification** passes; a **custom domain** (paid add-on, paid plan) makes the host itself `auth.<your domain>`. Nothing in app code controls that text. | None in code, deliberately: no hostname, key or project change. | Flow traced in `contexts/auth-context.tsx` and `src/features/auth/AuthContext.jsx`. Google Cloud Console and the Supabase dashboard cannot be reached from this environment, so the current branding state was not read. | **BLOCKED** (owner): Google branding and verification; optionally a domain and the Supabase custom-domain add-on. Steps below. |
| Notification permission, button, switches | (1) The switches showed the account's saved choices (default on) in full colour with nothing saying this phone has notifications off: the "green while off" in the screenshot. (2) A failed read of the choices silently showed both as on, and the next tap then saved that default over the other real choice. (3) Two quick taps could overwrite each other: each save sent the whole row from a stale copy. (4) Permission was read once, never again after returning from Settings. (5) "Denied, may ask again" (Android 13+) and "denied for good" were treated alike; a granted permission whose token registration failed could look on. (6) The server sent a push queued before its kind was switched off. | `deviceState.js`: one state per real situation (web, unavailable in this build, off, blocked, registering, registration failed, on); only "on" means pushes can arrive. Sheet: re-reads permission when the app returns to the foreground; "Turn on" asks the OS, "Open settings" when it can no longer ask, with Albanian guidance. Switches are one tappable row each (the drawn switch takes no touches, so no double events), disabled until the saved choices load, with a retry on failure. Saves are serialised and always write the newest choice; a failure restores the last saved state and says so. Full orange only when this phone can receive; otherwise a muted "on" plus a note that the choices are saved to the account. Sheet keyed by account. `push-dispatch` v2 re-reads preferences at send time and marks opted-out pushes `failed`/`opted_out`. Notification text unchanged: sender's first name or event type, never the message text. | **VERIFIED:** unit `notificationDeviceState` (states, rapid taps, failed save, failed read, send-time opt-out); e2e X13–X16 phone and desktop (each switch saves only itself, survives reopen and reload, rapid taps end with the newest choice, failed save reverts with a message, failed read never saves defaults); light and dark screenshots at 390×844 (switch centred, no clipping). `push-dispatch` v2 deployed (sending is still off). **IMPLEMENTED—UNVERIFIED:** OS prompt, Settings return and token registration on a real iPhone and Android build; remote delivery and category suppression on a device. Expo Go is not evidence of production push. | Device check after a store or development build with push credentials (`docs/DEVICE_CHECKLIST.md`). |
| Email-code flow and delivery | **Delivery:** SMTP goes through Resend with no verified sending domain (recorded live earlier in `src/lib/authErrors.js`), and Resend then delivers only to the account's own address. Everyone else's sign-up and reset fails, and the sender is not a domain you control, which also hurts Inbox placement. **App:** the live auth log for tonight shows a code requested at 21:47:41 UTC, a second at 21:48:25, a 403 `otp_expired` at 21:48:52, then success at 21:49:04. Supabase invalidates an earlier code when it sends a new one, so the rejected code was most likely the first one, used after the resend. The message didn't explain that. Separately, when Supabase answered "wait N seconds", both apps showed a generic error and their own 30 s timer. | Both apps: on "wait N seconds" the resend timer uses the server's number, and code entry opens (the earlier code is still valid). After a resend: "A new code was sent. Earlier codes no longer work." The wrong-code text now says to use the most recent code (8 languages). Send and verify are guarded by a synchronous flag, as a safeguard against double taps. OTP stays Supabase's: no code is generated or checked in the app. | **VERIFIED:** unit `retryAfterSeconds`; template expiry ("1 hour") matches `otp_expiry = 3600`; e2e F4-N6 (website) and X18 (app): both fail on the old code and pass now; F4-H5 and X17 (one send per double click): these also pass on the old code, so a duplicate send was not reproducible and the guard is defensive only; existing F4 suite green. Live log read: 2 sends accepted (HTTP 200), 1 expired, 1 successful sign-in. **BLOCKED:** Inbox or Spam placement and SPF/DKIM/DMARC results; no sending domain exists, and no test mail was sent from here. | Domain, Resend domain verification, Supabase SMTP sender (below). Then I send to two authorised test addresses (Gmail and one other provider) and read the authentication results. |

## Changed files

- `components/profile/notifications-sheet.tsx`: device states, Settings return, controlled rows, newest-wins saving, load and save failure states, muted "on" when this phone cannot receive.
- `src/features/notifications/lib/deviceState.js` (+ `.d.ts`), new: pure state and saver logic.
- `src/features/notifications/lib/preferences.js` (+ `.d.ts`): `readPreferences` reports a failed read.
- `lib/push.ts`: `readPermission` (with `canAskAgain`, iOS provisional), `requestPermission`, `registerDevice`, `remotePushSupported` (off on the web and in Expo Go on Android); unused helpers removed.
- `app/(tabs)/profile.tsx`: sheet keyed by account; email-code send/resend/verify guards; server wait drives the resend timer.
- `src/features/auth/pages/Profile.jsx`: the same email-code changes on the website.
- `src/lib/authErrors.js` (+ new `.d.ts`): `retryAfterSeconds`.
- `supabase/functions/push-dispatch/{index.ts,logic.js}`: send-time preference check (`stillWanted`); **deployed as v2**, JWT verification unchanged, sending still off.
- `src/i18n/locales/*.json` (8 languages): new notification states, `errors.waitSeconds`, `auth.newCodeSent`, clearer `errors.invalidCode`.
- Tests: `tests/notificationDeviceState.test.mjs` (new), `tests/authErrors.test.mjs`, `tests/authEmailTemplates.test.mjs`, `e2e/auth.spec.ts` (F4-H5, F4-N6), `e2e-expo/flows.spec.ts` (X13–X18).

No schema, RLS, credential, hostname or project change. No secret, code or address is logged or committed.

## Sources

- Supabase, Sign in with Google: https://supabase.com/docs/guides/auth/social-login/auth-google (read through the Supabase docs tool on 2026-10-21: branding plus verification replace the project id with name and logo; custom domain recommended).
- Supabase, Custom Domains: https://supabase.com/docs/guides/platform/custom-domains (paid add-on; after activation OAuth advertises the custom-domain callback, which must be added in Google **in addition to** the existing one).
- Supabase SMTP, Google brand verification, Gmail sender guidelines and Expo notifications pages: not reachable from this environment (network blocked). The steps below that depend on them are marked to follow the console's own instructions, not values written here.

## What only you can do

**Google shows "Shtepia.ime"**
1. Google Cloud Console → Google Auth Platform → **Branding**, in the project that owns the OAuth client used by Supabase's Google provider: App name `Shtepia.ime`, app logo (square, from `assets/images/icon-light.png`), support email, home page, privacy policy and terms links, **Authorized domains**.
2. **Verification Center** → submit brand verification. Google checks that the home page and privacy links are on a domain you have verified in Search Console; on the `vercel.app` address alone this is uncertain, so a domain of your own is the reliable route. It can take several business days.
3. Optional, paid: a domain plus Supabase's custom-domain add-on (needs a paid plan), so the chooser shows `auth.<your domain>`. Before activating it, add `https://auth.<your domain>/auth/v1/callback` in the Google OAuth client **next to** the current callback; I then update the app URLs together, with the old host kept as rollback.
4. Tell me when it's done. I'll check a fresh sign-in (chooser, consent, cancel, returning user, session restore) on the web and the phone.

**Email codes reach the inbox**
1. A domain you control (also needed for 1–3 above).
2. Resend → Domains → add it (a subdomain such as `mail.<domain>` keeps it separate from other mail) and create **exactly** the DNS records Resend shows (SPF, DKIM and its bounce MX). If the domain already has an SPF record, merge into that one; never add a second. Add DMARC starting at `p=none`, and tighten it later once reports show only legitimate senders.
3. Supabase → Authentication → SMTP: Resend's host, port and username as shown in Resend's SMTP settings, a Resend API key as the password (keep it out of chat), sender address on the verified domain (for example `no-reply@mail.<domain>`), **sender name `Shtepia.ime`**.
4. If not done yet, paste the four files in `supabase/templates/` into Authentication → Emails → Templates, with the subjects in `supabase/config.toml`.
5. Tell me two test addresses you own (one Gmail, one other provider). I'll send one code to each, record arrival time, folder and the SPF/DKIM/DMARC results, and report them separately from the SMTP acceptance.

**Notifications on a phone**
1. A store or development build with push credentials (EAS: APNs key for iOS, FCM for Android), then run `docs/DEVICE_CHECKLIST.md`'s notification section: first prompt, deny, Settings return, both switches, delivery and suppression.
