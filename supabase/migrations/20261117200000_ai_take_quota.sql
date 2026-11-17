-- One atomic step for the AI rate limits (codebase audit 2026-11-17).
-- The Edge Functions used to count usage and then insert a row in two calls,
-- so requests sent at the same moment all read the same count and all passed.
-- This takes a transaction-scoped advisory lock per (key, feature), counts the
-- window and records the call together. Only the service role (the Edge
-- Functions) may call it.
create or replace function public.ai_take_quota(
  p_key text,
  p_feature text,
  p_max integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  used integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_key || '|' || p_feature, 0));
  select count(*) into used
    from public.ai_usage
   where key = p_key
     and feature = p_feature
     and created_at >= now() - make_interval(secs => p_window_seconds);
  if used >= p_max then
    return false;
  end if;
  insert into public.ai_usage (key, feature) values (p_key, p_feature);
  return true;
end;
$$;

revoke all on function public.ai_take_quota(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.ai_take_quota(text, text, integer, integer) to service_role;
