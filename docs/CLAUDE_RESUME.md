# Resume notes for the next Claude session

Last updated 2026-10-21 (end of completion prompt #2). Read this, then `docs/LAUNCH_TASKS.md` (the ledger is
the source of truth for status), then `docs/READINESS_REPORT.md`.

## Where things stand

- Work branch: `claude/app-property-translation-kosqyj`, **ahead of `master`**
  and pushed. `master` auto-deploys the live website on Vercel, so merging is
  the owner's call. Ask before merging, and say what changes for real users.
- Completion prompt #2 (`Claude_Code_App_Completion_Prompt_1.md`, F1–F19 work
  map) is **finished** as of 2026-10-21. Every tracker finding F1–F20 has its
  engineering done (F17/F18/F20 recovered from the tracker page data). See
  `docs/LAUNCH_TASKS.md`. Verdict in `docs/READINESS_REPORT.md`: READY FOR
  ACCOUNT SETUP AND REMAINING RELEASE VERIFICATION. Not ready for release.
- Working tree: clean after the last push. Last full run: lint 0 errors / 32
  warnings, tsc clean, unit 230/230, e2e 164 passed + 2 skipped by design,
  build OK, all 9 live checks in `supabase/tests/` pass.
- Waiting for the owner's confirmation in the Supabase prompt (the tool times
  out unattended on DROP/DELETE; retried 2026-10-21, still unchanged):
  `supabase/pending/plans_by_period_months.sql`, then
  `supabase/pending/prepaid_checkout.sql`; deleting the 2 synthetic accounts.
- Built but switched off: email alerts (`ALERTS_DISPATCH_ENABLED`), push
  (`PUSH_DISPATCH_ENABLED`), checkout (`VITE_CHECKOUT_ENABLED`,
  `CHECKOUT_ENABLED`; `checkout-start` and `paysera-callback` not deployed).
- Owner decisions open: white text on orange fills (F16), selling in-app vs
  website only (F15), individual vs company publisher, L29 listing.
- Blocked on accounts: see `docs/ACCOUNT_AND_RELEASE_HANDOFF.md` §1 and its
  order in §5.

## Next actions when the owner provides access

1. SMTP set → test sign-up/reset with a fresh address; enable F13 sending;
   schedule it (handoff §3).
2. Apple/Google/Expo → EAS builds (`eas.json` profiles exist); Maps key as an
   EAS env var; run `docs/DEVICE_CHECKLIST.md` with the owner.
3. Confirmations given → apply the pending SQL in order, re-run
   `supabase/tests_prepaid_checkout.test.mjs` logic live in a rolled-back
   block, deploy the two payment functions with test mode.
4. "merge" → merge to `master`, watch the Vercel deploy, smoke-test the
   live site.

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
- **`pkill -f` / `pgrep -f` with a pattern that appears in your own command
  line kills the Bash tool's shell** (exit 144). Select processes with
  `ps -eo pid,comm,args | awk '$2=="node" && /pattern/'` instead.
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
