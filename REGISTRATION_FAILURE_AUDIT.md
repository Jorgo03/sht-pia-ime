# Registration failure audit — 2026-11-18

Owner report: "I cannot create a new account manually on the website or in the
mobile app." This file records what was found **before** any code change.
Every claim below names its evidence. No production data was written while
gathering it; account rows were read without addresses (ids shortened to 8
characters, email domain only).

## What actually happened (Supabase Auth logs, 2026-11-17)

| Time (UTC) | Request | Server answer | Evidence |
| --- | --- | --- | --- |
| 21:46:01 – 21:51:22 | 27 × `POST /auth/v1/signup` from the website | **422 `user_already_exists`** ("User already registered"), auth event `user_repeated_signup` | `auth_logs`, referer `https://real-estate-app-hazel-seven.vercel.app` |
| 21:48:07 | `POST /auth/v1/otp` (email code / reset) for one of the same addresses | **500 `unexpected_failure`**: `gomail: could not send email 1: 550 "You can only send testing emails to your own email address (…). To send emails to other recipients, please verify a domain at resend.com/domains…"` | `auth_logs` error field |
| 22:57:45 | 1 × `POST /auth/v1/signup` | 422 `user_already_exists` | `auth_logs` |

The 28 sign-ups used **5 addresses, and all 5 already have accounts**
(`auth_event.actor_id` of each attempt matched to `auth.users`):

| Account (id) | Created | How it was created | Attempts |
| --- | --- | --- | --- |
| `0868e255` | 2026-08-05 | Google sign-in | 17 in 46 seconds |
| `b9631a8a` | 2026-11-06 | email + password | 7 |
| `b77e8910` | 2026-08-04 | Google sign-in | 1 |
| `5f49e51b` | 2026-07-12 | Google sign-in | 1 |
| `fb44047f` | 2026-11-06 | email + password (agent, with office) | 1 |

No sign-up for a **new** address was attempted that day, so none failed. The
last new email+password account (`468deb23`, 2026-11-08) was created through
the app, signed in, and has its profile (role `buyer`).

## Root causes

### RC1 — The duplicate-address answer looks like a broken form (P1, UX, both apps)

The server is right to refuse a second account for an address. But the screen
gives the person nothing to do with that answer:

- Reproduced on the live website (Playwright, the server's exact 422 replayed in
  the browser, nothing sent to Supabase): the only feedback is one small line,
  13 px, pale pink on the orange gradient, under the password fields:
  "An account with this email already exists." No button to sign in, reset the
  password or use Google.
- Three of the five addresses were **Google accounts**. They have no password,
  so "sign in instead" with a password also fails, and nothing tells the person
  to use "Continue with Google".
- The logs show the result: 17 taps on one address in 46 seconds, then a
  password-reset attempt.

The same screen (`app/(tabs)/profile.tsx`) is the phone app's sign-up, so the
phone behaves the same way. The Vite site in `src/` is no longer deployed
(DECISIONS.md W6) and was not the site used.

### RC2 — Email cannot be delivered to anyone but the owner (P0, configuration, both apps)

Supabase's custom SMTP is still **Resend with no verified domain** (sender
`onboarding@resend.dev`). Resend accepts mail only for its account owner's own
address and refuses every other recipient with 550, so Supabase answers **500**
and nothing is sent. This breaks, for every other person:

- password reset (seen live at 21:48:07),
- sign-in with an emailed code,
- sign-up confirmation codes, the moment "Confirm email" is turned on.

The owner decided on 2026-11-08 to switch the sender to a dedicated Gmail
account (DECISIONS.md §19, steps in `docs/EMAIL_LOGIN_SETUP.md`). The logs show
Resend still sending on 2026-11-17, so that change has **not** been made in the
dashboard. Nothing in the repository can fix this: the SMTP sender is a
dashboard setting that needs credentials only the owner has.

### RC3 — "Confirm email" is off, so no sign-up code is ever sent (P1, configuration)

`GET /auth/v1/settings` on the live project returns `mailer_autoconfirm: true`.
Every recent email+password account was confirmed 20–80 ms after it was created
with `confirmation_sent_at` empty. So today:

- a new address **can** register and is signed in at once (both apps handle
  this: the code screen only opens when Supabase returns no session),
- but the 6-digit verification step never runs, and an address the person does
  not own can be registered.

It was turned off on purpose (DECISIONS.md §17): with RC2 unfixed, turning it on
would make every sign-up fail with the same 550/500. Order matters: RC2 first,
then Confirm email on.

### RC4 — An 81-character name or office aborts the sign-up (P2, latent, both apps)

Migration `20261104215248_server_form_checks.sql` added
`profiles_full_name_length` and `profiles_agency_name_length` (≤ 80). The
sign-up trigger `handle_new_user()` (live definition read 2026-11-18) copies
`full_name` and `agency_name` from the sign-up metadata unchanged. A longer
value violates the constraint inside the trigger, which rolls back the new
`auth.users` row: Supabase answers 500 "Database error saving new user" and no
account exists. The sign-up form has no length limit on either field. This is
exactly the class of failure `20260903213714_handle_new_user_cannot_abort_signup`
was written to rule out; the later constraint brought it back. Not seen in the
logs; found by reading the live function against the live constraints.

## Checked and not at fault

| Area | Finding |
| --- | --- |
| Profile trigger | `on_auth_user_created` enabled; every one of the 18 most recent accounts has a profile |
| Role | The trigger accepts only `agent`, otherwise `buyer`; `profiles_role_check` allows only those two; `claim_role()` limits a change to the first 5 minutes and to those two values. A client cannot make itself anything else |
| Office | Saved only for agents (`case when role = 'agent'`) |
| Language | Unknown values fall back to `sq` |
| Sign-ups disabled? | No: `disable_signup: false`, email provider on |
| Project | `ACTIVE_HEALTHY` |
| Client handling of a new address | `signUp` returns a session when confirmation is off and both apps go straight to the signed-in profile (e2e F4/X tests) |

## Fix plan (next file: REGISTRATION_FIX_REPORT.md)

1. RC1 in the Expo app (web + phone): a clear, Albanian-first message for an
   existing address with three ways forward — sign in with this address, reset
   the password, continue with Google — and an error line that can be read.
2. RC4: limit name and office to 80 characters in the form, and a migration
   that makes the trigger trim them, so metadata can never abort a sign-up
   (**not applied to production without the owner's OK**).
3. Owner's Albanian wording for the auth errors; confirmation subject
   "Konfirmo llogarinë tënde — Shtepia Ime".
4. RC2 and RC3 are owner steps in the Supabase dashboard; listed exactly in the
   fix report. Not worked around in code: Confirm email stays as it is until mail
   can be delivered.
