-- No double booking of viewings (AUDIT-003).
--
-- Before: two clients (or one client twice) could book the same listing at
-- the same moment, and an agent could be booked at two listings at once.
-- Nothing compared a new viewing with the ones already open.
--
-- Now a viewing that is open (requested or confirmed) may not overlap another
-- open viewing of the same listing, or of the same agent at any listing.
-- A viewing lasts duration_minutes, 30 when unset (the apps' default).
-- Back-to-back is fine: the ranges are half-open, [start, end).
-- Declined, cancelled, completed and no-show viewings free their slot.
--
-- SECURITY DEFINER because a client cannot see other clients' viewings under
-- RLS, and the check has to. It is a trigger function, so it cannot be called
-- through the API. An advisory lock per listing and per agent stops two
-- requests sent at the same instant from both passing.
-- Error code 23P01 (exclusion_violation): the apps show "time taken".
-- Tests: supabase/tests/rls_viewing_schedule.sql (S1-S4, S10, S12).

create or replace function public.guard_viewing_overlap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_range tstzrange;
  agent_key uuid;
begin
  if new.status not in ('requested', 'confirmed') then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.scheduled_at is not distinct from old.scheduled_at
     and new.duration_minutes is not distinct from old.duration_minutes
     and old.status in ('requested', 'confirmed') then
    return new;
  end if;

  new_range := tstzrange(
    new.scheduled_at,
    new.scheduled_at + make_interval(mins => coalesce(new.duration_minutes, 30)),
    '[)'
  );
  select coalesce(new.agent_id, p.agent_id, p.owner_id) into agent_key
  from public.properties p where p.id = new.property_id;

  -- Same order every time (listing, then agent), so two locks cannot deadlock.
  perform pg_advisory_xact_lock(hashtextextended('viewing:' || new.property_id::text, 0));
  if agent_key is not null then
    perform pg_advisory_xact_lock(hashtextextended('viewing-agent:' || agent_key::text, 0));
  end if;

  if exists (
    select 1
    from public.viewings v
    left join public.properties vp on vp.id = v.property_id
    where v.id is distinct from new.id
      and v.status in ('requested', 'confirmed')
      and (
        v.property_id = new.property_id
        or (agent_key is not null and coalesce(v.agent_id, vp.agent_id, vp.owner_id) = agent_key)
      )
      and tstzrange(
            v.scheduled_at,
            v.scheduled_at + make_interval(mins => coalesce(v.duration_minutes, 30)),
            '[)'
          ) && new_range
  ) then
    raise exception 'viewing_slot_taken' using errcode = '23P01';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_viewing_overlap() from public, anon, authenticated;

drop trigger if exists viewings_guard_overlap on public.viewings;
create trigger viewings_guard_overlap
  before insert or update of scheduled_at, duration_minutes, status on public.viewings
  for each row execute function public.guard_viewing_overlap();

-- The overlap lookup reads open viewings by listing and by agent and time.
create index if not exists viewings_open_property_time_idx
  on public.viewings (property_id, scheduled_at) where status in ('requested', 'confirmed');
create index if not exists viewings_open_agent_time_idx
  on public.viewings (agent_id, scheduled_at) where status in ('requested', 'confirmed');
