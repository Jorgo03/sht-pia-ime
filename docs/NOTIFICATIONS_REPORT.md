# Notifications: technical report, 2026-11-08

## Status in one paragraph

The backend is live and sending is on. Notification history, the bell and its
count, the in-app banner and tap navigation are built and tested against a
simulated backend, and the database rules are tested on the live database.
**A push has not yet been seen arriving on any phone.** Android cannot receive
remote pushes in Expo Go at all, so Android needs a real build. The acceptance
criteria for "closed app" pushes are not met until the device tests below pass.

## 1. What was implemented

Already in the project (October) and kept: `push_tokens`, `push_outbox` with a
unique key per event, triggers on messages and viewings, notification
preferences, Profile → Notifications, `register_push_token()`, tap handling,
sign-out forgetting the device.

Added:

| Part | What |
|---|---|
| History | `notifications` table: user, kind, ids, read/unread, time. Each person reads and marks only their own |
| Sending | Runs the moment something is queued (database trigger + `pg_net`) and retries every 2 minutes (`pg_cron`). Before this nothing ever sent |
| No duplicates | Rows are claimed atomically (`claim_push_outbox`, `SKIP LOCKED`); one unique key per event; unread messages in a chat collapse into one row |
| New kinds | Property inquiry (a client's first message about a listing), listing hidden or restored by a moderator, welcome, announcements (moderators only: `send_announcement`) |
| In the app | Bell with live count in the header, Notifications screen (All, Unread, Read, mark one, mark all, load more, loading, empty, error), a banner when something arrives, reading a chat clears its notifications |
| On the phone | Tap opens the right screen, including from a closed app; app icon badge; a one-time explanation before the system prompt, never asked again after an answer |

Lock screens never show message text or addresses, only who and what kind.

## 2. Services and technologies

Expo Notifications and the Expo Push Service (remote push, relaying to FCM and
APNs); Supabase Postgres, Realtime, Edge Functions (`push-dispatch` v3), Vault,
`pg_net`, `pg_cron`. No new app dependency.

## 3. Environment variables and credentials

**No new variable is needed for what is live.** The dispatch secret lives in
Supabase Vault, generated in the database; it is not in the repository or app.

- Off switch: `update public.push_settings set enabled = false;`
- `EXPO_ACCESS_TOKEN` (optional Edge Function secret): only if "enhanced push
  security" is turned on in Expo.
- The EAS project id is already in `app.json`.

## 4. Configuration still required

Only the owner can do these, because they need the owner's accounts.

**Android (required for any Android push)**
1. Create a Firebase project and add the Android app `com.shtepiaime.app`.
2. Download `google-services.json`, put it in the repo root and set
   `android.googleServicesFile` in `app.json`.
3. Create an FCM V1 service-account key and upload it with `eas credentials`
   (Android → Push Notifications: FCM V1).
4. Build: `eas build -p android --profile development`, and install it.

**iOS (for a real or store build)**
1. A paid Apple Developer account (still an open decision in `CLAUDE.md`).
2. `eas credentials` creates the APNs key.
3. `eas build -p ios`.

Expo Go on an iPhone may receive pushes for testing without this; that has not
been confirmed. One iPhone is registered already.

## 5. Tested

| Test | Where | Result |
|---|---|---|
| Your Test 7 (privacy): another user cannot read or mark notifications, read tokens, read the queue or call the secret check; non-moderators cannot announce | Live database, rolled back | Pass |
| Your Test 8 (duplicates): same event twice gives one row; follow-ups collapse | Live database, rolled back | Pass |
| A client's first message is an inquiry; the sender is not notified; no message text is stored | Live database, rolled back | Pass |
| `supabase/tests/rls_notifications.sql` overall | Live database | 16/16 |
| The function refuses a missing or wrong secret | Live | 401 |
| The database reaches the function with its vault secret | Live | `dispatch: on` |
| Your Test 1 (app open) with a simulated live connection: banner, tap opens the chat (X84) | App web build | Pass |
| Bell count and opening the centre (X81); mark one, mark all, tap to chat (X82); empty and failed states (X83) | App web build | Pass |
| Routes, wording, banner rules, sender logic (`tests/notificationsFeed.test.mjs`) | Unit | Pass |

## 6. Still requires a physical device or production test

**None of these has been run.**

| Your test | Needs |
|---|---|
| Test 1, App open, on a phone with a real second account | Two accounts, any phone |
| Test 2, App in background | iPhone in Expo Go (if it receives), or a build |
| Test 3, App completely closed | A real build on each platform |
| Test 4, Tap opens the right screen, on a phone | As above |
| Test 5, Two devices on one account | Two devices |
| Test 6, Permission denied | A phone |
| Android at all | Section 4 first |
| Sound, app icon, icon badge | A real build |

Known limits:

- Expo reports some dead tokens later, in "receipts". Only the immediate answer
  is read today, so a dead token is removed the next time it is refused.
- A phone force-closed by the user, or put to sleep by an aggressive battery
  manager, can delay or lose a push. That is the operating system's decision.
- Announcements have a server function but no screen to write one yet.
- The Vite website has no bell; it is bug-fixes-only and its replacement is the
  Expo web build, which has it.
