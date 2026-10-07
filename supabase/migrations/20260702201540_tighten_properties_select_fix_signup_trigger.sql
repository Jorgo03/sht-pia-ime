-- 1. Hide drafts/paused listings (and their contact info) from the public;
--    owners and assigned agents still see their own.
drop policy "Properties are viewable by everyone" on public.properties;
create policy "Active properties viewable, owners see own" on public.properties
  for select using (
    status = 'active' or auth.uid() = owner_id or auth.uid() = agent_id
  );

-- 2. Signup trigger: persist role / agency_name / preferred_language from
--    auth metadata (previously only full_name/avatar_url, so agent signups
--    fell back to 'buyer' whenever email confirmation delayed the session).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, role, agency_name, preferred_language)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    case when new.raw_user_meta_data->>'role' in ('agent','client','buyer')
         then new.raw_user_meta_data->>'role' else 'buyer' end,
    case when new.raw_user_meta_data->>'role' = 'agent'
         then new.raw_user_meta_data->>'agency_name' else null end,
    coalesce(nullif(new.raw_user_meta_data->>'preferred_language',''), 'sq')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 3. Keep conversation unread counters + last_message_at correct server-side
create or replace function public.handle_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set last_message_at = now(),
      unread_for_client = unread_for_client + (case when new.sender_id = agent_id then 1 else 0 end),
      unread_for_agent  = unread_for_agent  + (case when new.sender_id = client_id then 1 else 0 end)
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists on_message_created on public.messages;
create trigger on_message_created
  after insert on public.messages
  for each row execute function public.handle_new_message();

-- 4. Realtime: publication was empty, so no postgres_changes ever fired
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.messages;
