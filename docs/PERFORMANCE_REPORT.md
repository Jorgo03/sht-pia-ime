# Raporti im — private agent performance report

Status: built 2026-11-08 (Expo app only; the Vite site gets bug fixes only).
Route: `/performance`, opened from the agent dashboard. Agents only.

## 1. What the database can and cannot tell us (inspected 2026-11-08)

| Source | What it holds | Reliable for |
| --- | --- | --- |
| `properties` | `status` (`active`, `pending`, `pending_review`, `sold`, `rented`, `paused`, `draft`), `created_at`, `agent_id`/`owner_id` | listings created; listings active / paused **now** |
| `viewings` | `status` (`requested`, `confirmed`, `declined`, `cancelled`, `completed`, `no_show`), `scheduled_at` | viewings scheduled / cancelled; completed **once agents can record it** (below) |
| `conversations` | one row per client + listing + agent, `created_at` | new client inquiries |
| `messages` | `sender_id`, `created_at` | messages sent, clients answered |
| `leads` | agent's own CRM rows, `status` (`new` … `won`, `lost`), `created_at` only | leads added; leads won (by the period they were added in) |
| transactions | **no table exists** | — |

Gaps found, and what this feature does about them:

1. **No transaction record.** "Sold"/"rented" was one tap in My listings, with
   no confirmation and no date (`updated_at` moves on every edit). Counting
   `status = 'sold'` would count accidental taps and give no month.
   → A server-written status history, `property_status_events` (a trigger on
   `properties`; nobody can write it directly), plus a confirmation dialog
   before marking a listing sold or rented.
2. **No way to complete a viewing.** The status existed but no screen set it.
   → On Viewings, a confirmed viewing whose time has passed gets "Completed" /
   "No-show". The database refuses `completed`/`no_show` from anyone but the
   agent, before the viewing's time, or from anything but `confirmed`.
3. **Deleted listings leave no trace** (hard delete). "Removed or archived" is
   shown as listings paused now; deleted ones cannot be counted.
4. **Transaction value is not shown**: the only price stored is the asking
   price, not what the home sold or rented for.
5. **No history before this release.** On 2026-11-08 there were 0 sold and 0
   rented listings and 0 completed viewings, so nothing earlier is lost.

## 2. Counting rules

All counts are for the signed-in agent only (`auth.uid()`), over the period
`[from, to)`; "all time" has no bounds. Monthly buckets use the device's time
zone (validated against `pg_timezone_names`, falling back to Europe/Tirane).

- **Listings published**: own listings created in the period, excluding ones
  that are still drafts or awaiting review.
- **Active / paused now**: a snapshot, not affected by the period.
- **Completed sale**: a status change to `sold`, counted once per listing.
- **Completed rental**: a status change to `rented`, at most once per listing
  per calendar month.
- **Correction window**: a sale or rental undone within 7 days (the listing
  leaves `sold`/`rented` again) is treated as a mistake and not counted.
- **Viewings scheduled**: viewings with their time in the period, except
  declined requests. **Completed**: status `completed` only. **Cancelled**:
  status `cancelled`. A viewing is never a transaction.
- **New inquiries**: conversations clients started with the agent.
  **Clients answered**: distinct clients the agent sent at least one message
  to. **Messages sent**: the agent's own messages in their conversations.
- **Leads added / won**: leads added in the period; of those, the ones now
  marked won.

## 3. Before and after (self-reported)

`agent_performance_baselines`: one row per agent, the agent's own estimate of
monthly rentals, sales, inquiries and completed viewings before Shtëpia.ime.
Every value is optional; a missing one shows "not entered", never zero.

Current monthly average = all-time count ÷ months since the agent registered
(at least 1). Shown: previous, current, difference, and percentage difference
(no percentage when the previous value is 0). The screen labels the "before"
figures as the agent's own estimate and says the comparison is not proof that
the app caused a change.

## 4. Privacy and security

- `my_performance_report(p_from, p_to, p_tz)`: **no agent id parameter**, so
  there is nothing to change in a request to reach another agent. It reads
  `auth.uid()`, refuses anyone who is not an agent (42501), runs as the caller
  (`security invoker`) so every table's RLS still applies, and returns counts
  only: no names, phone numbers, messages or listing ids. Not executable by
  `anon`.
- `property_status_events`: RLS, agent reads own rows only; no insert, update
  or delete for any client role (rows come only from the trigger).
- `agent_performance_baselines`: RLS, own row only for every operation;
  writing needs the agent role.
- Live checks: `supabase/tests/rls_performance_report.sql`.

## 5. Achievements

Computed on the device from the agent's own all-time counts: first listing,
first completed transaction, 10 listings, 10 completed viewings, 10 completed
transactions. Never stored, never shown to anyone else, no rankings.

## 6. Not built (and why)

- Transaction value: no sale/rent price is recorded.
- Removed listings: hard-deleted rows cannot be counted.
- Vite website: bug fixes only (DECISIONS.md W1).
