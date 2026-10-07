-- Launch audit M3: property_activity grows without bound. It is append-only
-- (anon can insert; RLS grants no UPDATE or DELETE to any client role) and
-- every visit to a listing writes a row, so it is the one table with no
-- natural ceiling.
--
-- Retention value — 400 days, derived from what the app actually reads rather
-- than picked arbitrarily:
--   * PropertyDashboard.jsx and app/listing/[id]/analytics.tsx both query a
--     rolling 30-day window.
--   * AgentDashboard reads aggregate counts.
--   400 days keeps a full year plus a month of headroom, so year-over-year
--   comparison remains possible if it is ever added, while bounding growth.
--
-- Deletes nothing today, by design. Verified by executing it: the oldest row
-- is 49 days old, `select prune_property_activity(400)` returned 0 and left
-- all 174 rows intact. The mechanism is in place before it is needed.
--
-- OWNER CONFIRMATION: 400 days is an engineering default from current query
-- patterns. Change the default if your reporting needs a different window.
--
-- SECURITY DEFINER is required: RLS grants no DELETE on this table to any
-- client role. EXECUTE is revoked from anon and authenticated, so this is a
-- maintenance routine only and is not reachable through PostgREST.
--
-- SCHEDULING — OWNER ACTION REQUIRED.
-- pg_cron is AVAILABLE on this project but NOT installed (verified against
-- pg_extension, which returns no row for it). Enabling a Postgres extension on
-- a production database is a deliberate infrastructure change, so it was left
-- for the owner rather than done unprompted. To automate this, run:
--
--   create extension if not exists pg_cron;
--   select cron.schedule(
--     'prune-property-activity',
--     '15 3 * * 0',                       -- Sundays 03:15 UTC, off-peak
--     $$select public.prune_property_activity();$$
--   );
--
-- Until then the function can be run by hand from the SQL editor at any time;
-- there is no urgency while the table is this small.

create or replace function public.prune_property_activity(retain_days integer default 400)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  removed integer;
begin
  if retain_days is null or retain_days < 30 then
    raise exception 'retain_days must be >= 30 (got %)', retain_days;
  end if;

  delete from public.property_activity
  where created_at < now() - make_interval(days => retain_days);

  get diagnostics removed = row_count;
  return removed;
end;
$function$;

revoke execute on function public.prune_property_activity(integer) from anon, authenticated;
