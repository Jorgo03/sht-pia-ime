# Test results: QA audit, 2026-11-07

Run on the owner's Windows laptop, branch `frontend/pass-28`, one suite at a
time (never two Playwright runs at once). Both e2e suites use the simulated
backend (`e2e/support/backend.ts`) and never reach production. No device,
simulator or emulator was used.

## Automated suites

| Suite | Command | Before the fixes (`9ff0a72`) | After the fixes (`c1ffda2`) |
|---|---|---|---|
| Unit | `npm test` | 433/433 passed | 433/433 passed |
| Type-check | `npx tsc --noEmit` | clean | clean |
| Lint | `npm run lint` | 0 errors, 34 warnings | 0 errors, 34 warnings |
| Expo web e2e | `npm run test:e2e:expo` | 184 passed, 36 skipped (session baseline) | **186 passed, 36 skipped, 0 failed** (+X63 on phone and desktop) |
| Vite website e2e | `npm run test:e2e` | 259 passed, 9 skipped (session baseline) | **259 passed, 9 skipped, 0 failed** |

Skipped tests are parked features (AI chat and similar) that skip by design.

## Live database checks (`xzzzhlwmzotibrxdqmcm`)

Read-only queries, or blocks that always end in an exception so every write
is rolled back. Afterwards: 0 new functions, 0 new triggers, 0 new viewings,
conversations or push rows (checked).

| Check | Result |
|---|---|
| RLS on every public table | 25/25 on; 44 policies; 5 server-only tables without policies (intended) |
| SECURITY DEFINER functions executable by `anon` | none |
| Security advisor | leaked-password protection off (QA-08); 8 user-callable DEFINER functions, each checks its caller |
| Email accounts without a confirmed address (would be locked out by the new guard) | 0 of 20 accounts |
| Reproduction of QA-01 / QA-02 (viewing pre-confirmed, to a stranger, in the past; conversation with a stranger; duplicate no-listing conversations) | all 4 accepted: bugs confirmed |
| `supabase/tests/rls_insert_guards.sql`, guards not applied | 2/9 (expected: shows the bug) |
| Same file with the pending guards created in the same rolled-back block | **9/9** |
| After applying migration `20261107225617` (owner approved): `rls_insert_guards.sql` | **9/9** |
| After applying: `rls_ownership_guards.sql` | 14/15 at first. P4 used the photo link `'u'`, which the 2026-11-04 `properties_images_check` refuses (stale test data, confirmed by changing only that value). With an https link: **15/15** |

## New regression tests

| Test | Covers | Result |
|---|---|---|
| e2e-expo X63 | QA-03: a refused listing-chat message shows "Message not sent", keeps the text, no tick | passed (phone and desktop). Not run against the old code. |
| `supabase/tests/rls_insert_guards.sql` | QA-01, QA-02 | 9/9 live after the migration was applied |

## Not run

- Anything on a real iPhone or Android phone (BLOCKED: no device; iOS
  needs macOS).
- Native builds (BLOCKED: no Xcode or Android SDK; EAS needs the owner's
  login).
- The full role-by-role isolation script `supabase/tests/rls_isolation.sql`
  (last run in AUDIT.md Pass 32, 2026-11-04). Today's RLS check read the
  policies; it did not re-run that script.
