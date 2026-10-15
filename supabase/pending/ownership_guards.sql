-- Ownership guards, and the missing 'declined' viewing status
-- (AUDIT.md Pass 15: S-7, S-8, S-9, BUG-015).
--
-- NOT APPLIED YET: waiting for the owner's approval. When approved, apply it
-- with apply_migration, then move this file to supabase/migrations/ under the
-- version that apply_migration records.
--
-- What it fixes, each one reproduced live on 2026-10-15 in a transaction that
-- was rolled back:
--   S-7  Any signed-in user can insert a listing with agent_id set to a real
--        agent, so it appears under that agent's name and that agent can then
--        edit or delete it. The same user can later move owner_id to someone
--        else. The INSERT policy only checks owner_id.
--   S-8  Either side of a conversation can change its client_id or agent_id,
--        moving the whole message history (the other side's messages
--        included) to a third person.
--   S-9  A client can update their own viewing request to any status,
--        including 'confirmed' and 'completed', and can move it to another
--        agent or property.
--   BUG-015  Agents' "Decline" button sends status 'declined', which the
--        viewings_status_check constraint does not allow, so every decline
--        fails (both apps, web and phone, 4 buttons).
--
-- How: BEFORE triggers. They apply only to requests from the apps (roles anon
-- and authenticated). The service role, the dashboard, and SECURITY DEFINER
-- functions such as handle_new_message run as other roles and are unaffected.
-- No policy, column, row or grant is changed or dropped; the only constraint
-- change ADDS an allowed value, so no existing row can become invalid.

-- 1. Listings: who a listing belongs to is set once, by its creator ----------
create or replace function public.guard_property_ownership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- You may list as yourself, or with no agent. Never as another agent.
    if new.agent_id is not null and new.agent_id is distinct from auth.uid() then
      raise exception 'agent_id must be your own account'
        using errcode = '42501';
    end if;
  elsif new.owner_id is distinct from old.owner_id
     or new.agent_id is distinct from old.agent_id
     or new.owner_type is distinct from old.owner_type then
    raise exception 'a listing''s owner and agent cannot be changed'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger properties_guard_ownership
  before insert or update on public.properties
  for each row execute function public.guard_property_ownership();

-- 2. Conversations: the two people in a conversation never change ------------
create or replace function public.guard_conversation_parties()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated')
     and (new.client_id is distinct from old.client_id
       or new.agent_id is distinct from old.agent_id
       or new.property_id is distinct from old.property_id) then
    raise exception 'a conversation''s participants cannot be changed'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger conversations_guard_parties
  before update on public.conversations
  for each row execute function public.guard_conversation_parties();

-- 3. Viewings: who may move a viewing to which status ------------------------
alter table public.viewings drop constraint viewings_status_check;
alter table public.viewings add constraint viewings_status_check
  check (status in ('requested', 'confirmed', 'declined', 'cancelled', 'completed', 'no_show'));

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

  if new.status is distinct from old.status then
    -- The host is the agent on the viewing, or the listing's owner or agent
    -- (the same people the UPDATE policy lets in besides the client).
    is_host := me = old.agent_id or exists (
      select 1 from public.properties p
      where p.id = old.property_id and (p.owner_id = me or p.agent_id = me)
    );
    -- The client may only call it off. Everything else is the host's call.
    if not is_host and new.status <> 'cancelled' then
      raise exception 'only the agent can set a viewing to %', new.status
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger viewings_guard_update
  before update on public.viewings
  for each row execute function public.guard_viewing_update();

-- Trigger functions are not callable over the API, but keep them unexposed.
revoke execute on function public.guard_property_ownership() from public, anon, authenticated;
revoke execute on function public.guard_conversation_parties() from public, anon, authenticated;
revoke execute on function public.guard_viewing_update() from public, anon, authenticated;
