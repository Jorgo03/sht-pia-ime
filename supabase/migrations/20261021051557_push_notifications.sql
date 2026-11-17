-- Push notifications for messages and viewings (docs/LAUNCH_TASKS.md F14).
-- Sending stays OFF until the owner enables it (Edge Function push-dispatch,
-- PUSH_DISPATCH_ENABLED=true) and real builds with push credentials exist.
-- Applied 2026-10-21; live check supabase/tests/rls_push_notifications.sql 11/11.
--
-- push_tokens        one row per device token. A device belongs to whoever is
--                    signed in on it now: register_push_token() moves an
--                    existing token to the caller. Users see and delete only
--                    their own; nobody can insert or update directly.
-- notification_preferences  per user, on by default (no row = on).
-- push_outbox        queued pushes, service role only. Filled by triggers on
--                    messages and viewings; a trigger failure never blocks the
--                    message or viewing itself. Only queued when the recipient
--                    has a device and has not turned that kind off.
-- No message text is ever queued: a push says who and what kind, not what.

create table public.push_tokens (
  token text primary key check (token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,100}\]$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;
create policy "Users see their own devices" on public.push_tokens
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users remove their own devices" on public.push_tokens
  for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.push_tokens from anon, authenticated;
grant select, delete on public.push_tokens to authenticated;

create table public.notification_preferences (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  messages boolean not null default true,
  viewings boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;
create policy "Users read their own preferences" on public.notification_preferences
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users create their own preferences" on public.notification_preferences
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users change their own preferences" on public.notification_preferences
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.notification_preferences from anon, authenticated;
grant select on public.notification_preferences to authenticated;
grant insert (messages, viewings), update (messages, viewings) on public.notification_preferences to authenticated;

create table public.push_outbox (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('message', 'viewing_requested', 'viewing_updated')),
  data jsonb not null default '{}'::jsonb,
  dedupe_key text not null unique check (char_length(dedupe_key) <= 120),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts integer not null default 0,
  last_error text check (char_length(last_error) <= 500),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index push_outbox_pending_idx on public.push_outbox (created_at) where status = 'pending';
create index push_outbox_user_idx on public.push_outbox (user_id);
alter table public.push_outbox enable row level security;
revoke all on public.push_outbox from anon, authenticated;

-- Register this device for the signed-in user (moves it from a previous user).
create or replace function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  insert into public.push_tokens (token, user_id, platform)
  values (p_token, auth.uid(), p_platform)
  on conflict (token) do update
    set user_id = auth.uid(), platform = excluded.platform, last_seen_at = now();
end;
$$;
revoke all on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;

-- Queue a push if the recipient wants this kind and has a device.
create or replace function public.queue_push(p_user uuid, p_kind text, p_data jsonb, p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  wants boolean;
begin
  if p_user is null then return; end if;
  select case when p_kind = 'message' then np.messages else np.viewings end
    into wants from public.notification_preferences np where np.user_id = p_user;
  if coalesce(wants, true) is false then return; end if;
  if not exists (select 1 from public.push_tokens t where t.user_id = p_user) then return; end if;
  insert into public.push_outbox (user_id, kind, data, dedupe_key)
  values (p_user, p_kind, p_data, p_key)
  on conflict (dedupe_key) do nothing;
end;
$$;
revoke all on function public.queue_push(uuid, text, jsonb, text) from public, anon, authenticated;

create or replace function public.push_on_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
begin
  select client_id, agent_id into c from public.conversations where id = new.conversation_id;
  perform public.queue_push(
    case when new.sender_id = c.client_id then c.agent_id else c.client_id end,
    'message',
    jsonb_build_object('conversation_id', new.conversation_id, 'sender_id', new.sender_id),
    'msg:' || new.id::text
  );
  return new;
exception when others then
  return new;  -- a push must never stop a message
end;
$$;
revoke all on function public.push_on_message() from public, anon, authenticated;

create trigger messages_queue_push
  after insert on public.messages
  for each row execute function public.push_on_message();

create or replace function public.push_on_viewing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.queue_push(new.agent_id, 'viewing_requested',
      jsonb_build_object('viewing_id', new.id, 'property_id', new.property_id),
      'vw:' || new.id::text || ':requested');
  elsif new.status is distinct from old.status then
    -- Tell the other side: the client when the agent acts, the agent when the
    -- client cancels.
    perform public.queue_push(
      case when auth.uid() = new.client_id then new.agent_id else new.client_id end,
      'viewing_updated',
      jsonb_build_object('viewing_id', new.id, 'property_id', new.property_id, 'status', new.status),
      'vw:' || new.id::text || ':' || new.status);
  end if;
  return new;
exception when others then
  return new;  -- a push must never stop a viewing change
end;
$$;
revoke all on function public.push_on_viewing() from public, anon, authenticated;

create trigger viewings_queue_push
  after insert or update on public.viewings
  for each row execute function public.push_on_viewing();
