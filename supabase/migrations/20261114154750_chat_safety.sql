-- Chat safety (owner, 2026-11-14; app/messages/[id].tsx, components/safety).
--
-- 1. Reporting a person gets its own reasons: inappropriate behaviour, spam,
--    fake account, fraud, harassment, other. The listing reasons stay as they
--    were. A report made from a chat records the conversation, and only one
--    the reporter takes part in, naming the other participant: nobody can file
--    a report "from" someone else's chat or against a stranger through one.
-- 2. A block now stops messages both ways. Before, only the blocked person was
--    refused; the person who blocked could still write through the API (the
--    app hid the box, the database did not). Uploads follow the same rule.
-- 3. Two people with a block between them cannot start a new conversation,
--    about any listing, so a block cannot be stepped around that way.
-- Existing conversations and messages are untouched; unblocking restores all.
-- Applied live as migration 20261114154750. Check: supabase/tests/rls_chat_safety.sql (14/14).

-- 1. Reports --------------------------------------------------------------
alter table public.content_reports
  add column if not exists conversation_id uuid references public.conversations (id) on delete set null;

alter table public.content_reports drop constraint if exists content_reports_reason_check;
alter table public.content_reports
  add constraint content_reports_reason_check check (
    reason = any (array[
      'spam', 'scam', 'wrong_info', 'unavailable', 'offensive', 'other',
      'inappropriate', 'fake_account', 'fraud', 'harassment'
    ])
  );

grant insert (conversation_id) on public.content_reports to authenticated;

create index if not exists content_reports_conversation_id_idx on public.content_reports (conversation_id);

-- True when a report names no conversation, or one the caller is in, against
-- its other participant.
create or replace function public.report_conversation_ok(p_conversation uuid, p_reported uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_conversation is null or exists (
    select 1 from public.conversations c
    where c.id = p_conversation
      and (select auth.uid()) in (c.client_id, c.agent_id)
      and p_reported is not null
      and p_reported in (c.client_id, c.agent_id)
      and p_reported <> (select auth.uid())
  );
$$;

revoke all on function public.report_conversation_ok(uuid, uuid) from public, anon;
grant execute on function public.report_conversation_ok(uuid, uuid) to authenticated;

drop policy if exists "Chat reports name their own conversation" on public.content_reports;
create policy "Chat reports name their own conversation"
  on public.content_reports as restrictive for insert to authenticated
  with check (public.report_conversation_ok(conversation_id, reported_user_id));

-- 2. Blocks apply both ways ------------------------------------------------
-- True when either participant of the conversation has blocked the other.
create or replace function public.conversation_is_blocked(conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversations c
    join public.user_blocks b
      on (b.blocker_id = c.client_id and b.blocked_id = c.agent_id)
      or (b.blocker_id = c.agent_id and b.blocked_id = c.client_id)
    where c.id = conversation
      -- Only about the caller's own conversations.
      and (select auth.uid()) in (c.client_id, c.agent_id)
  );
$$;

revoke all on function public.conversation_is_blocked(uuid) from public, anon;
grant execute on function public.conversation_is_blocked(uuid) to authenticated;

drop policy if exists "Blocked senders cannot message" on public.messages;
create policy "Blocked senders cannot message"
  on public.messages as restrictive for insert to authenticated
  with check (not public.conversation_is_blocked(conversation_id));

create or replace function public.can_send_to_folder(p_folder text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_conversation_member(p_folder) then
    return false;
  end if;
  return not public.conversation_is_blocked(p_folder::uuid);
end;
$$;

-- 3. No new conversation across a block ------------------------------------
-- The guard runs as the caller, who can only see their own blocks (RLS), so
-- a block made by the other person is checked here, with definer rights.
create or replace function public.users_have_block(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- Only about the caller: nobody can ask whether two others blocked each other.
  select (select auth.uid()) in (a, b) and exists (
    select 1 from public.user_blocks ub
    where (ub.blocker_id = a and ub.blocked_id = b)
       or (ub.blocker_id = b and ub.blocked_id = a)
  );
$$;

revoke all on function public.users_have_block(uuid, uuid) from public, anon;
grant execute on function public.users_have_block(uuid, uuid) to authenticated;

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

  if public.users_have_block(new.client_id, new.agent_id) then
    raise exception 'there is a block between these people'
      using errcode = '42501';
  end if;

  new.unread_for_client := 0;
  new.unread_for_agent := 0;
  new.last_message_at := now();
  new.created_at := now();
  return new;
end;
$$;
