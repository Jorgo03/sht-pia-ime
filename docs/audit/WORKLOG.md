# Audit work log (`audit/full-sweep`)

A running log so the work can be picked up again if a session stops. Newest
entry last. The findings are in `FINDINGS.md`; the full report is
`docs/audit/AUDIT_REPORT.md` (first-pass detail in `FIRST_PASS_DETAIL.md`; moved from the repo root in the final
step).

## 2026-11-13: first pass (audit, approved fixes, live apply)

- **Branch:** `audit/full-sweep`, cut from `frontend/pass-28` at `17e7c18`. Every commit is pushed to the branch and fast-forwarded to `origin/master`. The local `master` branch is an old leftover; leave it.

### Baseline before any fix

| Check | Result |
|---|---|
| `tsc` | clean |
| Lint | 0 errors, 34 warnings |
| Unit tests | 531 passed |
| Website build | passes |
| Expo web export | passes |
| `expo-doctor` | 1 check failing (3 patch versions behind) |
| `npm audit` | 1 high, 9 moderate |
| Website e2e | 269 passed |
| Expo-app e2e | 314 passed |

### Audit

- 23 findings (`AUDIT_REPORT.md`): 0 Critical, 2 High, 6 Medium, 15 Low.
- New live RLS test `supabase/tests/rls_full_matrix.sql`: 48/51. The 3 failures were viewing bugs.

### Owner-approved fixes, one commit each

| Commit | Finding |
|---|---|
| `d8f4bf0` | AUDIT-001 |
| `4b4e74f` | AUDIT-004 |
| `8edec5c` | AUDIT-003 |
| `93f74b4` | AUDIT-006 |
| `83486c4` | AUDIT-005 |
| `ef96e81` | AUDIT-007 |
| `97e2fd3` | AUDIT-012 |
| `a3e472b` | AUDIT-014 |
| `5efa93f` | AUDIT-010 |
| `2d603df` | AUDIT-011 |
| `4985974` | AUDIT-017 |
| `a1f8f30` | AUDIT-015 |

### Applied live on the owner's OK

- Migrations `20261113194202`, `194212` and `194218`.
- `delete-account` version 2.
- Checked live afterwards:
  - `rls_viewing_schedule.sql`: 12/12.
  - `rls_full_matrix.sql`: 51/51.
  - `rls_anon_grants.sql`: 8/8.
  - Security advisors: unchanged.
- Commit `0e726cb`.

### After the last fix

| Check | Result |
|---|---|
| `tsc` | clean |
| Lint | 0 errors, the same 34 warnings |
| Unit tests | 557 passed |
| Website build | passes |
| `expo-doctor` | 20/20 |
| `npm audit` | 8 moderate (dev/build only) |
| Website e2e | 269 passed, 9 skipped |
| Expo-app e2e | 318 passed, 46 skipped |

## 2026-11-13: second pass (the owner's full mission)

- Analysed the areas the first pass had not covered:
  - favourites rollback;
  - wanted homes matching and notification;
  - chat reconnect;
  - AI timeouts, models, rate limits and injection;
  - generated types;
  - the live website's SEO and security headers;
  - Vercel. Not reachable: the Vercel connector has no access to the team, and the CLI is not installed.
- 7 new findings, AUDIT-024 to AUDIT-030 in `FINDINGS.md`.
- **Stopped at checkpoint 1** for the owner.

### How to resume

1. Read `FINDINGS.md`: its "Fix order" section is the queue.
2. For each fix: write a failing test first, fix, commit `fix(area): … [AUDIT-0xx]`, then push the branch and fast-forward master.
3. After every 5 fixes, rerun `npx tsc --noEmit`, `npm run lint`, `npm test` and `npx expo export -p web`.
4. Schema, RLS and auth-config changes need the owner's explicit OK before applying live.
5. Windows notes:
   - Set `MSYS_NO_PATHCONV=1` for Playwright.
   - Never run two Playwright runs at once.
   - Write scripts to files rather than `node -e`.

## 2026-11-13: second pass, fixes after checkpoint 1 (stopped at the usage limit)

### Done and pushed

| Commit | Change |
|---|---|
| `5752d09` | AUDIT-024: chat catch-up |
| `c5b8936` | merge of master (login-first) |
| `c2ab8c7` | AUDIT-027: favicon and manifest |
| `dd93746`, `3c35e58`, `9457099` | AUDIT-028: favourites save and unsave reach the server in tap order, app and website |
| `8b2aa06` | AUDIT-026: `agent_id` type |
| `b10b500` | `docs/LAUNCH_PLAN.md` |
| `7475703` | AUDIT-031: iOS permission prompts in Albanian and English |

`9457099` corrects the record for AUDIT-028. The real bug is ordering: the unsave overtook the save on a slow connection. The double POST reported in `dd93746` was a test artefact. Proof on the old code: X105 failed 6/6 and F-N28 failed 10/10. On the fixed code: 12/12 and 10/10.

### Checks at the stop

| Check | Result |
|---|---|
| Unit tests | 570 passed |
| `expo-doctor` | 20/20 |
| `tsc` | clean |
| Lint | 0 errors |
| Last full Playwright run | before the favourites test fix: website 269 passed, 2 failed (F-N28); Expo app 326 passed, 2 failed (X105). Both are since fixed and passed repeated runs. |

### Left to do

1. Rerun both full Playwright suites once (they never run in parallel).
2. Write `docs/audit/AUDIT_REPORT.md`:
   - consolidate the root `AUDIT_REPORT.md` and `docs/audit/FINDINGS.md`;
   - add a Commit column;
   - update AUDIT-028 to the corrected cause;
   - add AUDIT-031;
   - give health 7 → 8.5.
3. Open the PR from `audit/full-sweep`, with the report summary as its description.
4. Give the owner the summary in chat.
