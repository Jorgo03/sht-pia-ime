-- Retention for client_errors (docs/LAUNCH_TASKS.md F11): same pattern as
-- prune_property_activity. Not reachable through the API. Applied 2026-10-21.
-- Schedule it with pg_cron once the owner enables the extension:
--   select cron.schedule('prune-client-errors', '30 3 * * 0',
--     $$select public.prune_client_errors();$$);

create or replace function public.prune_client_errors(keep_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  delete from public.client_errors where created_at < now() - make_interval(days => keep_days);
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke execute on function public.prune_client_errors(integer) from public, anon, authenticated;
