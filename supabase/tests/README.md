# Live RLS checks

SQL checks for the access rules that protect real data. Each file is one
`DO` block that always ends with `raise exception 'RESULTS …'`, so **every
write it makes is rolled back** — safe to run against production. None of them
runs a `DELETE`.

| File | Covers | Expected |
| --- | --- | --- |
| `rls_ownership_guards.sql` | Listing, conversation and viewing ownership guards (migration `20261015205024`) | `passed=15/15` |
| `rls_report_and_block.sql` | Reports and blocks (migration `20261016181934`) | `passed=18/18` |
| `rls_profile_phone.sql` | Own-phone editing (migration `20261021002731`) | `passed=7/7` |
| `rls_profile_avatar.sql` | Own-photo editing, limited to the avatars bucket (migration `20261021003934`) | `passed=9/9` |
| `rls_client_errors.sql` | Crash reports: insert-only, redaction, flood guard (migrations `20261021004522`–`20261021004604`) | `passed=7/7` |
| `rls_saved_search_alerts.sql` | Saved-search email alerts and unsubscribe tokens (migration `20261021051016`) | `passed=7/7` |
| `rls_push_notifications.sql` | Push tokens, notification preferences, outbox (migration `20261021051557`) | `passed=11/11` |
| `rls_moderation.sql` | Moderators, the review queue, listing holds (migration `20261021052850`) | `passed=12/12` |
| `rls_moderation_read.sql` | Moderators read reported listings and accounts, read-only (migration `20261021053224`) | `passed=6/6` |
| `rls_notifications.sql` | Notification centre: own rows only, no forging, tokens and the send queue private, one row per event, chats collapse, inquiries, no message text (migration `20261108210219`) | `passed=16/16` |
| `rls_listing_publisher.sql` | "Published by": agent and client details, no client office, drafts hidden, profiles stay private, publisher cannot change (migration `20261108203236`) | `passed=13/13` |
| `rls_insert_guards.sql` | New viewings and conversations: listing's agent or owner only, viewings start requested and in the future, server-set counters (migration `20261107225617`) | `passed=9/9` |
| `rls_full_matrix.sql` | Writes on every table as a signed-out visitor, the owner and another account; viewing D1–D3 (docs/audit/AUDIT_REPORT.md) | `passed=51/51` live after migrations `20261113194202`/`194212`/`194218` (48/51 before) |
| `rls_viewing_schedule.sql` | No double booking per listing or agent, no moving a viewing into the past, a client's move sends a confirmed viewing back to requested (AUDIT-003/004) | `passed=12/12` with the migrations (5/12 before) |
| `rls_anon_grants.sql` | Signed-out visitors hold no grants on private tables; listings and plans read-only; view counts insert-only (AUDIT-017) | `passed=8/8` with migration `20261113194218` (4/8 before) |
| `rls_performance_report.sql` | Raporti im: each agent sees only their own report and baseline, clients and signed-out visitors get none, the status history cannot be written directly, viewings complete only by their agent after their time, and the counting rules (corrections, duplicates, periods) (migration `20261108005947`) | `passed=22/22` |

Run one in the Supabase SQL editor, with the Supabase MCP `execute_sql` tool,
or with `psql "$DATABASE_URL" -f <file>`. The "error" you get back is the
result. `RESULTS SKIP: …` means the database lacks the test data the file
needs (for example no conversation yet); it is not a pass.

They pick existing accounts and rows as test subjects and change them only
inside the rolled-back transaction. Re-run them after any migration that
touches `properties`, `conversations`, `viewings`, `messages`,
`content_reports` or `user_blocks`.

2026-11-08, after migration `20261108005947`: `rls_performance_report.sql`
22/22, with no fixture rows left behind (checked afterwards).

2026-11-07, after migration `20261107225617`: `rls_insert_guards.sql` 9/9 and
`rls_ownership_guards.sql` 15/15. P4 of the latter now saves an https photo
link: since `server_form_checks` the database refuses the old `'u'`.

Earlier run against `xzzzhlwmzotibrxdqmcm`: 2026-10-20, 15/15, 18/18 and 8/8,
with no rows, grants or constraints left behind (checked afterwards). On
2026-10-21 every file in the table passed with the counts shown, each right
after its migration; `rls_ownership_guards.sql` and `rls_moderation.sql` were
re-run after the last migration of the day (15/15, 12/12).

The payments migration has its own offline check that never touches a real
database: `supabase/tests_payments_foundation.test.mjs`. The pending prepaid
checkout SQL is checked the same way in `supabase/tests_prepaid_checkout.test.mjs`
(PGlite; `npm install --no-save @electric-sql/pglite@0.2.17` first).

`supabase/pending/anon_profile_helpers.sql` (L13) was checked the same way on
2026-10-21: signed-out and per-account profile visibility identical before and
after, signed-out helper calls refused. That check is recorded in the pending
file's header rather than here because it compares counts, not fixed
expectations.
