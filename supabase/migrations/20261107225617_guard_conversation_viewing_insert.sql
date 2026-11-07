-- Insert guards for conversations and viewings (QA audit 2026-11-07, BUG_REPORT.md
-- QA-01 and QA-02). Applied 2026-11-07 on the owner's approval ("Yes, apply
-- them") as migration 20261107225617. Live after applying:
-- supabase/tests/rls_insert_guards.sql 9/9, rls_ownership_guards.sql 15/15.
--
-- Migration 20261015205024 (S-8, S-9) guards UPDATEs only. On INSERT the RLS
-- policies check just `client_id = auth.uid()`, so a signed-in user could
-- (reproduced live 2026-11-07, rolled back):
--   * create a viewing already 'confirmed' (S-9 again, at insert time);
--   * address a viewing or a conversation to any account, not the listing's
--     owner or agent, which also queues a push notification to that account;
--   * date a viewing in the past;
--   * open a conversation with no listing (duplicates possible: the unique
--     key treats NULL property_id as distinct) or with preset unread counts.
--
-- Both apps already send exactly what these guards allow (app/property/[id].tsx,
-- src/features/properties/pages/PropertyDetail.jsx,
-- src/features/viewings/components/ViewingRequestSheet.jsx): property_id set,
-- agent_id = the listing's agent or owner (viewings: null when that is the
-- requester), no status, a future time. Same shape as the 20261015205024
-- guards: SECURITY INVOKER, so the listing is read under the caller's RLS
-- (a listing they cannot see cannot be contacted); only roles anon and
-- authenticated are checked, so the service role and the dashboard are
-- unaffected. No policy, column, row or grant changes; existing rows untouched.

create or replace function public.guard_conversation_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  p_owner uuid;
  p_agent uuid;
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if new.property_id is null then
    raise exception 'a conversation must be about a listing'
      using errcode = '42501';
  end if;

  select p.owner_id, p.agent_id into p_owner, p_agent
  from public.properties p where p.id = new.property_id;
  if not found then
    raise exception 'listing not found' using errcode = '42501';
  end if;

  if new.agent_id is distinct from p_owner and new.agent_id is distinct from p_agent then
    raise exception 'a conversation must be with the listing''s agent or owner'
      using errcode = '42501';
  end if;

  if new.agent_id = new.client_id then
    raise exception 'you cannot start a conversation with yourself'
      using errcode = '42501';
  end if;

  -- Counters and times belong to the server (handle_new_message keeps them).
  new.unread_for_client := 0;
  new.unread_for_agent := 0;
  new.last_message_at := now();
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists conversations_guard_insert on public.conversations;
create trigger conversations_guard_insert
  before insert on public.conversations
  for each row execute function public.guard_conversation_insert();

create or replace function public.guard_viewing_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  p_owner uuid;
  p_agent uuid;
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if new.status is distinct from 'requested' then
    raise exception 'a new viewing starts as requested' using errcode = '42501';
  end if;

  select p.owner_id, p.agent_id into p_owner, p_agent
  from public.properties p where p.id = new.property_id;
  if not found then
    raise exception 'listing not found' using errcode = '42501';
  end if;

  if new.agent_id is not null
     and new.agent_id is distinct from p_owner
     and new.agent_id is distinct from p_agent then
    raise exception 'a viewing must be with the listing''s agent or owner'
      using errcode = '42501';
  end if;

  -- Ten minutes of slack for a phone whose clock runs slow.
  if new.scheduled_at < now() - interval '10 minutes' then
    raise exception 'a viewing cannot be in the past' using errcode = '23514';
  end if;

  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists viewings_guard_insert on public.viewings;
create trigger viewings_guard_insert
  before insert on public.viewings
  for each row execute function public.guard_viewing_insert();
