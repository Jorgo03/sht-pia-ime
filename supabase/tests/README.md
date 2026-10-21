# Live RLS checks

SQL checks for the access rules that protect real data. Each file is one
`DO` block that always ends with `raise exception 'RESULTS …'`, so **every
write it makes is rolled back** — safe to run against production. None of them
runs a `DELETE`.

| File | Covers | Expected |
| --- | --- | --- |
| `rls_ownership_guards.sql` | Listing, conversation and viewing ownership guards (migration `20261015205024`) | `passed=15/15` |
| `rls_report_and_block.sql` | Reports and blocks (migration `20261016181934`) | `passed=18/18` |
| `pending_profile_phone_update.sql` | The **not yet applied** `supabase/pending/profile_phone_update.sql`, applied and tested inside the rolled-back block | `passed=8/8` before applying |

Run one in the Supabase SQL editor, with the Supabase MCP `execute_sql` tool,
or with `psql "$DATABASE_URL" -f <file>`. The "error" you get back is the
result. `RESULTS SKIP: …` means the database lacks the test data the file
needs (for example no conversation yet); it is not a pass.

They pick existing accounts and rows as test subjects and change them only
inside the rolled-back transaction. Re-run them after any migration that
touches `properties`, `conversations`, `viewings`, `messages`,
`content_reports` or `user_blocks`.

Last run against `xzzzhlwmzotibrxdqmcm`: 2026-10-20, 15/15, 18/18 and 8/8,
with no rows, grants or constraints left behind (checked afterwards).

The payments migration has its own offline check that never touches a real
database: `supabase/tests_payments_foundation.test.mjs`.

`supabase/pending/anon_profile_helpers.sql` (L13) was checked the same way on
2026-10-21: signed-out and per-account profile visibility identical before and
after, signed-out helper calls refused. That check is recorded in the pending
file's header rather than here because it compares counts, not fixed
expectations.
