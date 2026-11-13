-- A viewing's time can no longer be moved behind the agent's back (AUDIT-004).
--
-- Before: guard_viewing_update checked only status changes and the parties,
-- so after the agent confirmed, the client could move scheduled_at (even 30
-- days into the past) and the viewing stayed "confirmed"; the agent went at
-- the old time. Neither app moves a viewing's time today, so this only closes
-- the direct-API path.
--
-- Now:
--   * nobody moves a viewing into the past (same 10-minute grace as inserts);
--   * only open viewings (requested, confirmed) can be moved;
--   * when anyone other than the listing's agent or owner moves a confirmed
--     viewing, it goes back to "requested" so the agent confirms the new time.
-- Tests: supabase/tests/rls_viewing_schedule.sql (S6-S9).

create or replace function public.guard_viewing_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  is_host boolean;
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if new.client_id is distinct from old.client_id
     or new.agent_id is distinct from old.agent_id
     or new.property_id is distinct from old.property_id then
    raise exception 'a viewing''s client, agent and property cannot be changed'
      using errcode = '42501';
  end if;

  is_host := me = old.agent_id or exists (
    select 1 from public.properties p
    where p.id = old.property_id and (p.owner_id = me or p.agent_id = me)
  );

  if new.status is distinct from old.status then
    if not is_host and new.status <> 'cancelled' then
      raise exception 'only the agent can set a viewing to %', new.status
        using errcode = '42501';
    end if;
    if new.status in ('completed', 'no_show') then
      if old.status <> 'confirmed' then
        raise exception 'only a confirmed viewing can become %', new.status
          using errcode = '42501';
      end if;
      if old.scheduled_at > now() then
        raise exception 'a viewing cannot be % before its time', new.status
          using errcode = '42501';
      end if;
    end if;
  end if;

  if new.scheduled_at is distinct from old.scheduled_at then
    if old.status not in ('requested', 'confirmed') then
      raise exception 'a % viewing cannot be moved', old.status
        using errcode = '42501';
    end if;
    if new.scheduled_at < now() - interval '10 minutes' then
      raise exception 'a viewing cannot be in the past' using errcode = '23514';
    end if;
    if not is_host and new.status = 'confirmed' then
      new.status := 'requested';
    end if;
  end if;

  return new;
end;
$$;
