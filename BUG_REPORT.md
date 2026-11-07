# Bug report: QA audit, 2026-11-07

Branch `frontend/pass-28`, from `9ff0a72` (sign-up email verification just landed).
Scope: both apps (the Expo phone app with its own web build, and the Vite
website) and the shared Supabase project `xzzzhlwmzotibrxdqmcm`.

**How this was tested.** There is no phone, simulator or emulator on this
machine, and iOS cannot be built on Windows. "iOS" and "Android" below mean:
static analysis of the code and `app.json`, plus the Expo app's web build at
phone widths in Chromium. Nothing was run on a device. Backend findings were
reproduced on the live database inside blocks that always end in an
exception, so every write was rolled back (the `supabase/tests/` method);
afterwards no function, trigger, row or push was left behind (checked).

Priorities: **P0** data loss or security breach for everyone · **P1** a core
flow broken or a serious security hole · **P2** a feature misbehaves, or
data integrity or abuse with limited reach · **P3** minor, configuration or a
parked surface · **P4** cosmetic or accepted risk.

## Summary

| ID | P | Area | Platform | Status |
|---|---|---|---|---|
| QA-01 | P2 | Viewings: a new request can be created already confirmed, sent to any account, or dated in the past | Backend (all clients and direct API) | FIX READY, NOT APPLIED (owner approval needed) |
| QA-02 | P2 | Conversations: can be opened with any account, with no listing, or with preset unread counts | Backend (all clients and direct API) | FIX READY, NOT APPLIED (owner approval needed) |
| QA-03 | P2 | Phone listing screen: a refused chat message showed "sent" and erased the text | iOS, Android, Expo web build | FIXED, verified in Expo-web e2e (X63) |
| QA-04 | P3 | Sign-up code: the apps and the email say 10 minutes, the live server accepts it for 15 | Auth configuration | CONFIGURATION REQUIRED (owner) |
| QA-05 | P3 | The 5-wrong-codes cap and the 10-minute window are enforced in the apps only | Auth (direct API) | ACCEPTED RISK, documented |
| QA-06 | P3 | Expo web build: 20 messages shown only through `Alert.alert`, which draws nothing on the web | Expo web build only | DEFERRED (web build parked, DECISIONS.md W2) |
| QA-07 | P4 | A conversation participant can rewrite its unread counters and last-message time | Backend | DEFERRED (cosmetic, own conversation only) |
| QA-08 | P4 | Leaked-password protection is off | Auth configuration | KNOWN (needs a paid plan, AUDIT.md Pass 30) |
| QA-09 | P4 | White text on solid orange fails contrast (2.85–3.5:1) | Both apps | KNOWN (owner keeps the brand orange, DECISIONS.md C1) |

No P0 or P1 issue was found. Both P2 backend issues have a tested fix waiting
only for the owner to approve applying it (owner rule: no migration without
asking).

## Details

### QA-01 · P2 · A viewing can be created confirmed, for anyone, in the past

- **Platform:** backend; reachable from any signed-in account through the public API (the apps never send these values).
- **Steps:** sign in as any client, then `POST /rest/v1/viewings` with `status: 'confirmed'`, `agent_id` set to an account unrelated to the listing, or `scheduled_at` 30 days ago.
- **Expected:** a new viewing always starts as `requested`, goes to the listing's agent or owner, and is in the future.
- **Actual (live, rolled back):** all three accepted. The insert also queues a "viewing requested" push to whatever `agent_id` was given.
- **Root cause:** migration `20261015205024` (S-9) guards only UPDATEs (`viewings_guard_update`). The INSERT policy checks only `client_id = auth.uid()`.
- **Fix:** `supabase/pending/guard_conversation_viewing_insert.sql`: a BEFORE INSERT trigger, SECURITY INVOKER like the existing guards, checked only for roles `anon` and `authenticated`. It requires status `requested`, a visible listing, an agent that is the listing's agent or owner (or none), and a time no more than 10 minutes in the past. Both apps already send exactly this.
- **Verification:** `supabase/tests/rls_insert_guards.sql`. Before the fix: 2/9. With the fix created inside the same rolled-back block: **9/9**, including the apps' own request still being accepted. **Not applied:** to apply, approve it, run it as a migration, then re-run the test (expect 9/9).

### QA-02 · P2 · A conversation can be opened with anyone

- **Platform:** backend, through the public API.
- **Steps:** as any client, `POST /rest/v1/conversations` with `agent_id` set to any account and a listing that account has nothing to do with; or `property_id: null` twice; or `unread_for_agent: 999`.
- **Expected:** a conversation is about a listing and goes to its agent or owner. Counters start at 0.
- **Actual (live, rolled back):** all accepted, including two identical conversations with no listing. The unique key `(client_id, agent_id, property_id)` treats NULL as distinct. Each message sent into such a conversation queues a push to the chosen account, so it is an unsolicited-message channel to any account whose id is known. Blocks still apply.
- **Root cause:** `conversations_guard_parties` (S-8) is UPDATE-only. The INSERT policy checks only `client_id`.
- **Fix:** the same pending file: listing required and visible, agent = the listing's agent or owner, no conversation with yourself, counters and times set by the server.
- **Verification:** as QA-01 (checks 5–9 of `rls_insert_guards.sql`). **Not applied.**

### QA-03 · P2 · A refused listing-chat message showed "sent"

- **Platform:** phone app (iOS and Android) and its web build; `app/property/[id].tsx`. The Vite website opens the thread instead and was not affected. The thread screens of both apps already checked the result.
- **Steps:** on a listing, type a message and tap "Chat" while the insert is refused (offline, the agent blocked you, the server's length check).
- **Expected:** "Message not sent — try again", with the typed text kept.
- **Actual:** the result of `messages.insert` was never read. The text was cleared and "Message ✓" shown. Also, a second tap that lost the race on the unique key showed a generic error even though the conversation existed.
- **Root cause:** `handleSendMessage` awaited the insert without reading `error`, and had no `finally`.
- **Fix:** read the error and show the existing `messages.sendFailed` text inline (Alert is empty on the web build); keep the text; look the conversation up again after a lost race; always clear the loading state.
- **Verification:** e2e-expo **X63** (refused with a 403: error shown, no tick, text kept, button usable again). X49 (a successful send) still passes. Not run on a device.

### QA-04 · P3 · Code lifetime: 10 minutes in the apps, 15 on the server

- **Evidence:** `CODE_TTL_S = 600` (`src/features/auth/lib/signupCode.js`), `otp_expiry = 600` in `supabase/config.toml` (local development only), and the email says 10 minutes. AUDIT.md Pass 36 records the owner setting the live **Email OTP Expiration to 900 s** on 2026-11-04. The live Auth settings cannot be read with the tools here, so this comes from that record, not a live read.
- **Effect:** the apps stop accepting a code after 10 minutes, so what a person sees is consistent. A direct API call can still use it until minute 15.
- **Fix (owner):** Supabase dashboard → Authentication → Email → Email OTP Expiration = **600**.

### QA-05 · P3 · The wrong-code cap is client-side

The 5-attempt cap and the countdown (`blockedCodeKey`) stop the apps from sending a code. Supabase itself limits verification attempts only per IP. A script can skip the apps, though a 6-digit code against Supabase's per-IP limit and the expiry makes guessing impractical from one address. A per-code server cap would need an Auth hook. Recorded, not changed.

### QA-06 · P3 · `Alert.alert` is silent on the Expo web build

20 calls in 4 files (`app/(tabs)/profile.tsx`, `app/listing/new.tsx`, `app/messages/[id].tsx`, `app/property/[id].tsx`). Among them: the viewing request's success and failure, and the "date in the past" refusal. On phones they work. On the web build react-native-web draws nothing. The sign-in form was already moved to inline text (commit `8111fc3`). Deferred: the web build is parked (W2). Convert these before it ships as the website.

### QA-07 · P4 · Unread counters writable by participants

`Participants update conversations` has no column limit, so either side can set `unread_for_*` and `last_message_at` on their own conversation (they need it to mark a thread read). The only effect is a wrong badge or ordering in a conversation they are part of. Deferred; a fix is a "mark read" RPC.

### QA-08 · P4 · Leaked-password protection

Supabase advisor `auth_leaked_password_protection`. Owner toggle, may need Pro.

### QA-09 · P4 · White on orange

The only axe failure left (`e2e-expo/a11y.spec.ts` KNOWN). Owner decision C1.

## Checked and found sound (no bug)

- RLS on for all 25 public tables (44 policies). The 5 server-only tables (`ai_usage`, `email_outbox`, `payment_events`, `push_outbox`, `saved_search_alert_deliveries`) have no policy, so no user can read them. No SECURITY DEFINER function is executable by `anon`.
- The 8 SECURITY DEFINER functions callable by signed-in users (advisor WARN) each check the caller: `is_moderator()` gates moderation, `claim_role` allows only buyer/agent within 5 minutes of sign-up (row-locked), `register_push_token` binds the token to `auth.uid()` (a device token moves to whoever signs in on that device last; tokens are readable only by their owner). Function bodies read live 2026-11-07.
- The new unconfirmed-email guard (`isUnverifiedEmailUser`) locks out no existing account: 0 of 20 live accounts are email accounts without a confirmed address.
- Sign-up verification code flow (both apps): email trimmed before sending and verifying; a synchronous guard against double taps on Send and Verify; expired and over-cap codes are not sent to the server; a resend resets the countdown and the attempt count.
- Android back: all 13 `Modal`s have `onRequestClose`. Safe areas: all 26 `SafeAreaView` uses come from `react-native-safe-area-context`.
- Other unchecked writes are deliberate fire-and-forget calls (language preference, analytics, Apple name backfill).
- Edge Functions: 9 deployed, all `verify_jwt: true` except `saved-search-unsubscribe`, which checks a secret link token (AUDIT.md Pass 35). `ai-generate-listing` is still deployed (v6); its repo source is a 410 "retired" stub (deployed code not re-read). Checkout functions are not deployed (payments off).
