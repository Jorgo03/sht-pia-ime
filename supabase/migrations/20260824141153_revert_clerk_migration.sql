-- Recovered from production's supabase_migrations.schema_migrations on
-- 2026-10-07; it was applied there but never committed. Undoes
-- 20260823213904, 20260823215036 and 20260824120008, which are kept in this
-- folder because production ran them: a database rebuilt from these files
-- passes through the same states production did.

-- Reverts the Clerk migration at the owner's request. Restores the schema to
-- exactly what it was before 20260823213904, so nothing Clerk-shaped is left
-- in a codebase that no longer has Clerk.
--
-- Order is load-bearing: the policies must stop referencing
-- current_profile_id() before that function can be dropped.

-- 1. Helper back to auth.uid() ---------------------------------------------
create or replace function public.current_user_is_agent()
returns boolean
language plpgsql
security definer
stable
set search_path = 'public'
as $$
begin
  return exists (
    select 1 from public.profiles where id = auth.uid() and role = 'agent'
  );
end;
$$;

-- 2. All 24 policies back to (select auth.uid()) ----------------------------
drop policy if exists "Clients start conversations" on public.conversations;
create policy "Clients start conversations" on public.conversations
  for insert with check ((select auth.uid()) = client_id);

drop policy if exists "Participants view conversations" on public.conversations;
create policy "Participants view conversations" on public.conversations
  for select using ((select auth.uid()) = client_id or (select auth.uid()) = agent_id);

drop policy if exists "Participants update conversations" on public.conversations;
create policy "Participants update conversations" on public.conversations
  for update using ((select auth.uid()) = client_id or (select auth.uid()) = agent_id);

drop policy if exists "Users can remove own favorites" on public.favorites;
create policy "Users can remove own favorites" on public.favorites
  for delete using ((select auth.uid()) = user_id);

drop policy if exists "Users can add own favorites" on public.favorites;
create policy "Users can add own favorites" on public.favorites
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "Users can view own favorites" on public.favorites;
create policy "Users can view own favorites" on public.favorites
  for select using ((select auth.uid()) = user_id);

drop policy if exists "Agents manage own leads" on public.leads;
create policy "Agents manage own leads" on public.leads
  for all using ((select auth.uid()) = agent_id)
  with check ((select auth.uid()) = agent_id);

drop policy if exists "Participants send messages" on public.messages;
create policy "Participants send messages" on public.messages
  for insert with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.client_id = (select auth.uid()) or c.agent_id = (select auth.uid()))
    )
  );

drop policy if exists "Participants view messages" on public.messages;
create policy "Participants view messages" on public.messages
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.client_id = (select auth.uid()) or c.agent_id = (select auth.uid()))
    )
  );

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles
  for insert with check ((select auth.uid()) = id);

drop policy if exists "Profiles visible to self, agents publicly, or an existing relat" on public.profiles;
create policy "Profiles visible to self, agents publicly, or an existing relat" on public.profiles
  for select using (
    role = 'agent'
    or (select auth.uid()) = id
    or exists (
      select 1 from public.viewings v
      where v.client_id = profiles.id and v.agent_id = (select auth.uid())
    )
    or exists (
      select 1 from public.conversations c
      where c.client_id = profiles.id and c.agent_id = (select auth.uid())
    )
    or (public.current_user_is_agent() and public.buyer_has_open_wanted_home(id))
  );

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update using ((select auth.uid()) = id);

drop policy if exists "Owners can delete own properties" on public.properties;
create policy "Owners can delete own properties" on public.properties
  for delete using ((select auth.uid()) = owner_id or (select auth.uid()) = agent_id);

drop policy if exists "Authenticated users can create properties" on public.properties;
create policy "Authenticated users can create properties" on public.properties
  for insert with check ((select auth.uid()) = owner_id);

drop policy if exists "Active properties viewable, owners see own" on public.properties;
create policy "Active properties viewable, owners see own" on public.properties
  for select using (
    status = 'active'
    or (select auth.uid()) = owner_id
    or (select auth.uid()) = agent_id
  );

drop policy if exists "Owners can update own properties" on public.properties;
create policy "Owners can update own properties" on public.properties
  for update using ((select auth.uid()) = owner_id or (select auth.uid()) = agent_id)
  with check ((select auth.uid()) = owner_id or (select auth.uid()) = agent_id);

drop policy if exists "Owners view their property activity" on public.property_activity;
create policy "Owners view their property activity" on public.property_activity
  for select using (
    exists (
      select 1 from public.properties p
      where p.id = property_activity.property_id
        and (p.owner_id = (select auth.uid()) or p.agent_id = (select auth.uid()))
    )
  );

drop policy if exists "Owners view property views" on public.property_views;
create policy "Owners view property views" on public.property_views
  for select using (
    exists (
      select 1 from public.properties p
      where p.id = property_views.property_id
        and (p.owner_id = (select auth.uid()) or p.agent_id = (select auth.uid()))
    )
  );

drop policy if exists "Users manage own saved searches" on public.saved_searches;
create policy "Users manage own saved searches" on public.saved_searches
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Clients request viewings" on public.viewings;
create policy "Clients request viewings" on public.viewings
  for insert with check ((select auth.uid()) = client_id);

drop policy if exists "Participants view viewings" on public.viewings;
create policy "Participants view viewings" on public.viewings
  for select using (
    (select auth.uid()) = client_id
    or (select auth.uid()) = agent_id
    or exists (
      select 1 from public.properties p
      where p.id = viewings.property_id
        and (p.owner_id = (select auth.uid()) or p.agent_id = (select auth.uid()))
    )
  );

drop policy if exists "Participants update viewings" on public.viewings;
create policy "Participants update viewings" on public.viewings
  for update using (
    (select auth.uid()) = client_id
    or (select auth.uid()) = agent_id
    or exists (
      select 1 from public.properties p
      where p.id = viewings.property_id
        and (p.owner_id = (select auth.uid()) or p.agent_id = (select auth.uid()))
    )
  );

drop policy if exists "Clients manage own wanted homes" on public.wanted_homes;
create policy "Clients manage own wanted homes" on public.wanted_homes
  for all using ((select auth.uid()) = client_id)
  with check ((select auth.uid()) = client_id);

drop policy if exists "Agents can view open wanted homes" on public.wanted_homes;
create policy "Agents can view open wanted homes" on public.wanted_homes
  for select using (
    status = 'open'
    and exists (
      select 1 from public.profiles pr
      where pr.id = (select auth.uid()) and pr.role = 'agent'
    )
  );

-- 3. Drop the Clerk-only surface -------------------------------------------
drop function if exists public.link_clerk_profile(text, text, text, text);
drop function if exists public.current_profile_id();
drop index if exists public.profiles_clerk_user_id_key;
alter table public.profiles drop column if exists clerk_user_id;

-- 4. Restore the auth.users link, including ON DELETE CASCADE ---------------
--    Safe: every profile still has a matching auth.users row (15/15, no
--    orphans either direction), so the constraint validates against existing
--    data rather than failing.
alter table public.profiles
  add constraint profiles_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;
