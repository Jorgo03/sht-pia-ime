# Resume notes for the next Claude session

Last updated 2026-10-21. Read this, then `docs/LAUNCH_TASKS.md` (the ledger is
the source of truth for status), then `docs/READINESS_REPORT.md`.

## Where things stand

- Work branch: `claude/app-property-translation-kosqyj`. It is **ahead of
  `master`**. `master` auto-deploys the live website on Vercel, so merging is
  the owner's call. Ask before merging, and say what changes for real users.
- Verdict: READY FOR ACCOUNT SETUP AND REMAINING RELEASE VERIFICATION.
- Not applied, waiting for the owner's "go" (each has a rolled-back live test):
  - `supabase/pending/profile_phone_update.sql` (L12);
  - `supabase/pending/anon_profile_helpers.sql` (L13);
  - `supabase/pending/plans_by_period_months.sql`.
- Waiting for owner decisions:
  - L10 orange text shade (`#b34700` proposed);
  - L29 "Ali Demi" listing (postponed by the owner);
  - L30 test accounts;
  - L31 tab-bar grouping;
  - payments (L23: prices, provider, web-only vs in-app).
- Blocked on accounts: L15–L22 (see the handoff).

## How to check the app

```bash
npm run lint && npx tsc --noEmit && npm test && npm run build
PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test   # in this sandbox
```

Live RLS checks: run each file in `supabase/tests/` with the Supabase MCP
`execute_sql`. Each file always rolls back. Expected results are listed in
`supabase/tests/README.md`.

## Things that bit earlier sessions

- **`execute_sql` with DELETE or DROP waits for the user's confirmation** and
  times out after 60 s when nobody answers. Design live tests without them:
  use `ALTER POLICY`, or check `pg_policies` instead of deleting a row.
- **Metro cache inlines old `EXPO_PUBLIC_*` values.** Pass `--clear` to
  `expo export` or `expo start` when the backend URL matters. An export without
  it carried the production Supabase URL although fake env vars were set.
  Before serving anything, run `grep -rl xzzzhlwmzotibrxdqmcm <export dir>`.
- **expo-image on web ignores `alt`.** Use `accessibilityLabel`, which works on
  web and native.
- **Sandbox network.** vercel.com, expo.dev, exp.host, support.google.com and
  developers.google.com are blocked, and so is the production website.
  developer.apple.com and the Supabase docs tool work. Never claim a page was
  read when only a search summary was.
- **Phone-app web scans.** Run `npx expo export --clear --platform web` with the
  fake env (`EXPO_PUBLIC_SUPABASE_URL=https://e2e.supabase.co`). Then serve it
  with a static server that maps `/property/<id>` to `property/[id].html`,
  load `e2e/support/backend.ts`'s `mockBackend`, and also abort any request
  to the production host.
- **Prebuild only in a scratch copy.** This is a CNG project with no
  `android/` or `ios/` folders in git. Never commit the generated ones.
- LibreOffice does not work here. Verify `.docx` files with python-docx and
  mammoth.

## Owner preferences

- The owner is not a developer. Explain in plain words, one step at a time,
  and check their work from live sources rather than asking them to run
  technical checks.
- Every push goes to the feature branch. Until this pass the owner also had
  every change pushed to `master`. During the completion pass only the
  feature branch is pushed, because the completion prompt forbids merging to
  production without approval.
- Never buy, enrol, accept terms, or put secrets in the repo, chat or reports.
