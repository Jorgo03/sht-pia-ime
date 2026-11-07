# QA audit report, 2026-11-07

The audit found **no P0 or P1 issues**. It found three P2 issues, and all
three are fixed and verified. The two database fixes were applied to the
live database on the owner's approval (migration `20261107225617`).

Nothing ran on a real phone. No device or simulator is available here, and
iOS can't be built on Windows, so the iOS and Android columns come from
reading the code and settings, plus the app's web build in a phone-sized
browser.

Details: [BUG_REPORT.md](BUG_REPORT.md) · per-platform coverage:
[TEST_COVERAGE.md](TEST_COVERAGE.md)

## Bugs found

| ID | Priority | Problem | Web | Expo web build | iOS | Android | Status |
|---|---|---|---|---|---|---|---|
| QA-01 | P2 | Anyone signed in can bypass the app and create a viewing that is already "confirmed", addressed to any account, or dated in the past. Doing so also sends that account a notification. | backend | backend | backend | backend | **FIXED, applied, verified live** |
| QA-02 | P2 | A conversation can be opened with any account, with no listing attached (duplicates possible), or with fake unread counts. | backend | backend | backend | backend | **FIXED, applied, verified live** |
| QA-03 | P2 | Phone listing screen: a message the server refused still showed "sent ✓" and erased what you typed. | not affected | FIXED, verified (X63) | fixed in code, not run on a device | fixed in code, not run on a device | **FIXED** |
| QA-04 | P3 | The apps and the email say the code lasts 10 minutes. AUDIT.md Pass 36 says the dashboard was set to 900 s, so the server accepts it for 15. | config | config | config | config | Owner setting |
| QA-05 | P3 | The 5-wrong-codes limit only exists in the apps. Supabase itself limits attempts per IP. | backend | backend | backend | backend | Accepted risk |
| QA-06 | P3 | 20 messages use `Alert.alert`, which shows nothing on the Expo web build. Phones are fine. | — | affected | works | works | Deferred (web build parked) |
| QA-07 | P4 | Either side of a conversation can change its unread counts (badges only, their own conversation). | backend | backend | backend | backend | Deferred |
| QA-08 | P4 | Leaked-password protection is off. | config | config | config | config | Known, needs a paid plan |
| QA-09 | P4 | White text on solid orange fails contrast. | known | known | known | known | Owner's brand decision |

## How QA-01 and QA-02 were checked

Both were reproduced on the live database inside blocks that always end by
undoing every change. Afterwards nothing was left behind: no functions,
triggers, rows or notifications (checked).

The new check, `supabase/tests/rls_insert_guards.sql`, passed **2/9** before
the fix (that is the bug). With the fix added inside the same undone block it
passed **9/9**, and the requests the apps actually send were still accepted.

On the owner's approval the fix was applied as migration `20261107225617`
(`supabase/migrations/20261107225617_guard_conversation_viewing_insert.sql`).
Live afterwards:

- `rls_insert_guards.sql`: **9/9**.
- The existing `rls_ownership_guards.sql`: **15/15**. Its check P4 had gone
  stale: since the 2026-11-04 server form checks, listings accept only
  `https` photo links, and the test saved the link `'u'`. The test now uses
  an `https` link. This was not caused by the new guards.

## What held up

- All 25 tables have row-level security turned on.
- No other user's messages, viewings or leads can be read.
- The new "unconfirmed email" check locks out none of the 20 existing accounts.
- In code, every phone popup handles Android's back button, and every screen
  uses the correct safe-area handling.

## Test results

| Suite | Result |
|---|---|
| Unit (`npm test`) | 433/433 passed |
| Type-check (`tsc`) | clean |
| Lint | 0 errors (34 warnings) |
| Expo web e2e | **186 passed**, 36 skipped, 0 failed (was 184; plus X63 on both screen sizes) |
| Vite website e2e | **259 passed**, 9 skipped, 0 failed (same as before) |

Full run details: [TEST_RESULTS.md](TEST_RESULTS.md)

## Not tested here

- Anything that needs a real phone: offline mode, backgrounding, push
  delivery, maps, the photo picker, Google and Apple sign-in, staying signed
  in across restarts, and multiple devices.
- X63 was not run against the old code to watch it fail first.

## Commits

Everything is pushed to `frontend/pass-28` and `master`: the app fix and
reports (`c1ffda2`), this report, the test results, and the applied
migration.

## Owner decisions

1. ~~Approve applying the QA-01/QA-02 fix to the live database.~~ Done
   2026-11-07.
2. Set Email OTP Expiration to 600 in the Supabase dashboard (QA-04).
