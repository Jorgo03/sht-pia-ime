-- Notification centre and live push dispatch (owner approved 2026-11-08;
-- docs/NOTIFICATIONS_REPORT.md). Builds on 20261021051557 (tokens, outbox,
-- preferences): adds the history people see in the app, more kinds of event,
-- atomic claiming so one event cannot be sent twice, and the trigger that
-- actually runs the sender. Check: supabase/tests/rls_notifications.sql.
--
-- Sending is controlled by push_settings.enabled:
--   update public.push_settings set enabled = false;   -- the off switch

-- History ------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in (
    'message', 'inquiry', 'viewing_requested', 'viewing_updated',
    'listing_hidden', 'listing_restored', 'welcome', 'announcement'
  )),
  data jsonb not null default '{}'::jsonb,
  dedupe_key text not null unique check (char_length(dedupe_key) <= 120),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;
alter table public.notifications enable row level security;
create policy "Users read their own notifications" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users mark their own notifications" on public.notifications
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
alter publication supabase_realtime add table public.notifications;

-- Outbox: more kinds, and a claimed state -----------------------------------
alter table public.push_outbox drop constraint push_outbox_kind_check;
alter table public.push_outbox add constraint push_outbox_kind_check check (kind in (
  'message', 'inquiry', 'viewing_requested', 'viewing_updated',
  'listing_hidden', 'listing_restored', 'welcome', 'announcement'
));
alter table public.push_outbox drop constraint push_outbox_status_check;
alter table public.push_outbox add constraint push_outbox_status_check check (status in ('pending', 'sending', 'sent', 'failed'));
alter table public.push_outbox add column claimed_at timestamptz;

-- Queued before anything could send them: dropped, not delivered late.
update public.push_outbox set status = 'failed', last_error = 'stale_before_launch' where status = 'pending';

-- Takes a batch for one sender. SKIP LOCKED means two runs at once get
-- different rows, so nothing goes out twice; a run that died is retried.
create function public.claim_push_outbox(p_limit integer)
returns setof public.push_outbox
language sql
security definer
set search_path = ''
as $$
  with stale as (
    update public.push_outbox set status = 'pending'
    where status = 'sending' and claimed_at < now() - interval '5 minutes'
  ), picked as (
    select id from public.push_outbox
    where status = 'pending' and attempts < 5
    order by created_at
    limit p_limit
    for update skip locked
  )
  update public.push_outbox o
    set status = 'sending', claimed_at = now()
    from picked
    where o.id = picked.id
    returning o.*;
$$;
revoke all on function public.claim_push_outbox(integer) from public, anon, authenticated;
grant execute on function public.claim_push_outbox(integer) to service_role;

-- Every event lands in the history; a push is queued only if they want it ---
create or replace function public.queue_push(p_user uuid, p_kind text, p_data jsonb, p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  wants boolean := true;
  note_id uuid;
  conv text := p_data->>'conversation_id';
begin
  if p_user is null then return; end if;

  -- One row per conversation while unread, so a chat is not a page of rows.
  if p_kind = 'message' and conv is not null then
    update public.notifications
      set data = data || p_data || jsonb_build_object('count', coalesce((data->>'count')::int, 1) + 1),
          created_at = now()
      where user_id = p_user and kind = 'message' and read_at is null and data->>'conversation_id' = conv
      returning id into note_id;
  end if;
  if note_id is null then
    insert into public.notifications (user_id, kind, data, dedupe_key)
    values (p_user, p_kind, p_data, p_key)
    on conflict (dedupe_key) do nothing
    returning id into note_id;
  end if;
  -- Already recorded: the same event twice.
  if note_id is null then return; end if;

  if p_kind in ('message', 'inquiry', 'viewing_requested', 'viewing_updated') then
    select case when p_kind in ('message', 'inquiry') then np.messages else np.viewings end
      into wants from public.notification_preferences np where np.user_id = p_user;
  end if;
  if coalesce(wants, true) is false then return; end if;
  if not exists (select 1 from public.push_tokens t where t.user_id = p_user) then return; end if;

  insert into public.push_outbox (user_id, kind, data, dedupe_key)
  values (p_user, p_kind, p_data || jsonb_build_object('notification_id', note_id), p_key)
  on conflict (dedupe_key) do nothing;
end;
$$;
revoke all on function public.queue_push(uuid, text, jsonb, text) from public, anon, authenticated;

-- A client's first message about a listing is an inquiry.
create or replace function public.push_on_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  sender text;
  is_first boolean;
begin
  select client_id, agent_id, property_id into c from public.conversations where id = new.conversation_id;
  select split_part(trim(coalesce(full_name, '')), ' ', 1) into sender from public.profiles where id = new.sender_id;
  select count(*) = 1 into is_first from public.messages where conversation_id = new.conversation_id;
  perform public.queue_push(
    case when new.sender_id = c.client_id then c.agent_id else c.client_id end,
    case when is_first and new.sender_id = c.client_id and c.property_id is not null then 'inquiry' else 'message' end,
    jsonb_strip_nulls(jsonb_build_object(
      'conversation_id', new.conversation_id,
      'sender_id', new.sender_id,
      'sender_name', nullif(sender, ''),
      'property_id', c.property_id
    )),
    'msg:' || new.id::text
  );
  return new;
exception when others then
  return new;  -- a notification must never stop a message
end;
$$;
revoke all on function public.push_on_message() from public, anon, authenticated;

-- A moderator hiding or restoring a listing tells its owner.
create function public.push_on_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.moderation_hold is distinct from old.moderation_hold then
    perform public.queue_push(
      new.owner_id,
      case when new.moderation_hold then 'listing_hidden' else 'listing_restored' end,
      jsonb_build_object('property_id', new.id),
      'mod:' || new.id::text || ':' || new.moderation_hold::text || ':' || extract(epoch from now())::bigint::text
    );
  end if;
  return new;
exception when others then
  return new;
end;
$$;
revoke all on function public.push_on_moderation() from public, anon, authenticated;
create trigger properties_queue_moderation_push
  after update of moderation_hold on public.properties
  for each row execute function public.push_on_moderation();

-- A first welcome. Never blocks sign-up.
create function public.push_on_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.queue_push(new.id, 'welcome', '{}'::jsonb, 'welcome:' || new.id::text);
  return new;
exception when others then
  return new;
end;
$$;
revoke all on function public.push_on_profile() from public, anon, authenticated;
create trigger profiles_queue_welcome
  after insert on public.profiles
  for each row execute function public.push_on_profile();

-- Announcements to everyone: moderators only.
create function public.send_announcement(p_title text, p_body text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  batch text := gen_random_uuid()::text;
  person record;
  n integer := 0;
begin
  if not public.is_moderator() then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_title, ''))) not between 1 and 80
     or char_length(trim(coalesce(p_body, ''))) not between 1 and 500 then
    raise exception 'title 1-80 characters, body 1-500' using errcode = '22023';
  end if;
  for person in select id from public.profiles loop
    perform public.queue_push(
      person.id, 'announcement',
      jsonb_build_object('title', trim(p_title), 'body', trim(p_body)),
      'ann:' || batch || ':' || person.id::text
    );
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function public.send_announcement(text, text) from public, anon;
grant execute on function public.send_announcement(text, text) to authenticated;

-- Running the sender --------------------------------------------------------
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create table public.push_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default false
);
insert into public.push_settings (enabled) values (false);
alter table public.push_settings enable row level security;
revoke all on public.push_settings from anon, authenticated;

select vault.create_secret(
  replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  'push_dispatch_secret',
  'Sent by the database to the push-dispatch Edge Function'
);

-- The Edge Function checks the caller against the vault, so the secret is in
-- one place and never in the repository or the app.
create function public.push_dispatch_secret_ok(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'push_dispatch_secret' and decrypted_secret = p_secret
  );
$$;
revoke all on function public.push_dispatch_secret_ok(text) from public, anon, authenticated;
grant execute on function public.push_dispatch_secret_ok(text) to service_role;

create function public.request_push_dispatch()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  secret text;
begin
  if not coalesce((select enabled from public.push_settings), false) then return; end if;
  if not exists (select 1 from public.push_outbox where status = 'pending' and attempts < 5) then return; end if;
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'push_dispatch_secret';
  perform net.http_post(
    url := 'https://xzzzhlwmzotibrxdqmcm.supabase.co/functions/v1/push-dispatch',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
exception when others then
  null;  -- the retry below picks it up; a failed call must never stop an event
end;
$$;
revoke all on function public.request_push_dispatch() from public, anon, authenticated;

create function public.push_outbox_inserted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.request_push_dispatch();
  return null;
end;
$$;
revoke all on function public.push_outbox_inserted() from public, anon, authenticated;
create trigger push_outbox_send_now
  after insert on public.push_outbox
  for each statement execute function public.push_outbox_inserted();

-- Retries what failed or was missed.
select cron.schedule('push-dispatch-retry', '*/2 * * * *', 'select public.request_push_dispatch()');
