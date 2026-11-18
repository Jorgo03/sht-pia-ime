# Registration fix report — 2026-11-18

Root causes and evidence: `REGISTRATION_FAILURE_AUDIT.md`. Test evidence:
`AUTHENTICATION_TEST_RESULTS.md`.

## Summary

| # | Root cause | Kind | Status |
| --- | --- | --- | --- |
| RC1 | A sign-up for an address that already has an account showed one faint line and no way forward; the owner retried the same address 17 times | App (web + phone) | **Fixed in code**, e2e-verified |
| RC2 | Supabase SMTP is Resend with no verified domain: every email to anyone but the owner fails (550 → 500) | Dashboard configuration | **Owner step** (below). Not fixable from the repo |
| RC3 | "Confirm email" is off (`mailer_autoconfirm: true`): no sign-up code is ever sent | Dashboard configuration | **Owner step, after RC2**. Left off on purpose until mail works |
| RC4 | An 81+ character name or office aborts the sign-up inside the profile trigger (500, no account) | Database function + form | **Fixed**: form limits, and the trigger migration **applied to production on the owner's OK** (2026-11-18, version 20261118001327) |

**Sign-in (reported later the same evening).** The logs at 23:28 UTC show
three password sign-ins refused as `invalid_credentials` (wrong password for
an existing account), then a Google sign-in for the same person that
**succeeded**. Password sign-in works with the right password (a successful one
at 16:15 UTC). The person was stuck because the password could not be reset:
reset emails fail on the server (RC2). The wrong-password answer now gets the
same panel: a hint plus **Forgot your password?** and **Continue with Google**
(X112).

A brand-new address **can** register today on the website and in the app: the
server creates the account and signs the person in at once (last real example:
account `468deb23`, 2026-11-08). Every attempt the owner made on 2026-11-17
used an address that already had an account.

## Code changes (branch `fix/registration`)

| File | Change |
| --- | --- |
| `app/(tabs)/profile.tsx` | The form's error is now a solid, readable panel (white on a dark panel, icon, 14 px, `role=alert`) instead of 13 px pale text on the gradient. For an existing address it adds a hint and three buttons: **Sign in with this email** (switches to the sign-in form, address kept, password cleared), **Forgot your password?** (opens the reset step for that address), **Continue with Google** (for accounts made with Google, which have no password). Name and office are limited to 80 characters, the database limit. Same screen on the website and the phone apps |
| `src/i18n/locales/*.json` (10) | `auth.existingAccountHint`, `auth.signInThisEmail`, `auth.continueWithGoogleFull` in every language. Albanian wording from the owner: `errors.invalidEmail` "Email-i është i pavlefshëm.", `errors.userExists` "Ky email është regjistruar më parë.", `errors.invalidCode` "Kodi i konfirmimit është i pasaktë ose ka skaduar.", `errors.emailSendFailed` "Email-i nuk mund të dërgohej. Provo përsëri.", `errors.passwordWeak` "Fjalëkalimi duhet të plotësojë kërkesat: …" |
| `supabase/config.toml`, `supabase/templates/confirmation.html` | Confirmation subject **"Konfirmo llogarinë tënde — Shtepia Ime"** (the template already carries the logo mark, the 6-digit code, 10-minute expiry and do-not-share line) |
| `supabase/migrations/20261118001327_handle_new_user_trims_lengths.sql` | `handle_new_user()` trims name and office to 80 characters and blanks to NULL; role/office/language rules unchanged. **Applied live on the owner's OK** |
| `supabase/tests_handle_new_user.test.mjs` | PGlite test: the current live function aborts an 81-character office; the new one creates the account; role stays `buyer` unless `agent` is asked for (an `admin` request becomes `buyer`); a buyer never keeps an office; an existing profile is left alone |
| `e2e-expo/flows.spec.ts` | X109 (production's 422 answer → hint + three buttons; sign-in keeps the address), X110 (Confirm email off: a new agent is signed in at once with role and office sent), X111 (80-character limits) |

What was deliberately **not** changed:

- The 6-digit code flow itself (Supabase email OTP, type `signup`, already one
  method: codes only, the email's link goes to the same verification).
- "Confirm email": turning it on now would break every sign-up (RC2).
- No second code system, no service-role key anywhere, no RLS change, no
  change to who may become an agent (the trigger already accepts only
  `agent`/`buyer`).
- The Vite site in `src/` (not deployed since DECISIONS.md W6).

## Database

Applied on the owner's OK (2026-11-18). Checked afterwards on the live database: the function trims, `anon` and `authenticated` cannot execute it, the trigger is enabled.
It replaces one function; no row changes, so no backup is needed; rollback is
re-running the previous definition (named in the file).

## Owner steps (Supabase dashboard; only you can do these)

1. **Email sender (RC2).** Do what DECISIONS.md §19 decided, following
   `docs/EMAIL_LOGIN_SETUP.md`: Authentication → Emails → SMTP Settings →
   host `smtp.gmail.com`, port `587`, username and sender = the dedicated Gmail
   address, password = its 16-letter app password (typed only into Supabase),
   sender name `Shtëpia.ime`. Or verify a domain at Resend and use an address on
   it. I need nothing from you here except to say it is done.
2. **Templates.** Authentication → Emails → Templates → *Confirm signup*:
   subject `Konfirmo llogarinë tënde — Shtepia Ime`, body = all of
   `supabase/templates/confirmation.html`.
3. **Test delivery together** (needs step 1): one sign-up to an address you own
   that has no account yet. I read the Supabase logs and you confirm the email
   arrived.
4. **Then Confirm email on** (Authentication → Sign In / Providers → Email),
   Email OTP expiration `600`, length `6`. From then on every new account gets
   the 6-digit code and cannot open anything until it is verified (the apps
   already refuse unverified sessions).

## Still open / not verified

- No real email was sent or received (RC2 blocks it for any address but yours).
- No physical phone was used: the phone screen is the same code as the web
  build, tested in Chromium at iPhone 13 size (390×844).
- The new-account path was proven against the fake backend (X110) and by the
  live account history, not by creating a new production account.
- Greek and Turkish are UI languages, but `profiles.preferred_language` accepts
  only the other eight; a Greek or Turkish sign-up gets `sq` stored. Separate
  follow-up.
