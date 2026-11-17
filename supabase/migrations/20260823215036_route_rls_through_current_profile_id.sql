-- Recovered from production's supabase_migrations.schema_migrations on
-- 2026-10-07; it was applied there but never committed. Part of the Clerk
-- migration that 20260824141153_revert_clerk_migration later undoes.

-- Routes every RLS policy through public.current_profile_id() instead of
-- auth.uid(), so authorization works for a Clerk-issued token as well as a
-- Supabase Auth one.
--
-- This is a NO-OP for existing users: current_profile_id() returns the JWT
-- sub verbatim when it is already a UUID, which is exactly what auth.uid()
-- returned. Verified live before writing this.
--
-- It is also the only safe way to do it. auth.uid() casts sub to uuid, and a
-- Clerk sub ('user_2abc...') makes that cast raise 22P02 — so any policy
-- still calling auth.uid() would ERROR OUT under Clerk rather than fail
-- closed, taking the whole query with it.
--
-- All 24 policies were {public} (no TO clause); that is preserved.

-- Helper first: it is referenced by the profiles SELECT policy below.
create or replace function public.current_user_is_agent()
returns boolean
language plpgsql
security definer
stable
set search_path = 'public'
as $$
begin
  return exists (
    select 1 from public.profiles
    where id = public.current_profile_id() and role = 'agent'
  );
end;
$$;

-- conversations ------------------------------------------------------------
drop policy if exists "Clients start conversations" on public.conversations;
create policy "Clients start conversations" on public.conversations
  for insert with check ((select public.current_profile_id()) = client_id);

drop policy if exists "Participants view conversations" on public.conversations;
create policy "Participants view conversations" on public.conversations
  for select using (
    (select public.current_profile_id()) = client_id
    or (select public.current_profile_id()) = agent_id
  );

drop policy if exists "Participants update conversations" on public.conversations;
create policy "Participants update conversations" on public.conversations
  for update using (
    (select public.current_profile_id()) = client_id
    or (select public.current_profile_id()) = agent_id
  );

-- favorites -----------------------------------------------------------------
drop policy if exists "Users can remove own favorites" on public.favorites;
create policy "Users can remove own favorites" on public.favorites
  for delete using ((select public.current_profile_id()) = user_id);

drop policy if exists "Users can add own favorites" on public.favorites;
create policy "Users can add own favorites" on public.favorites
  for insert with check ((select public.current_profile_id()) = user_id);

drop policy if exists "Users can view own favorites" on public.favorites;
create policy "Users can view own favorites" on public.favorites
  for select using ((select public.current_profile_id()) = user_id);

-- leads ---------------------------------------------------------------------
drop policy if exists "Agents manage own leads" on public.leads;
create policy "Agents manage own leads" on public.leads
  for all using ((select public.current_profile_id()) = agent_id)
  with check ((select public.current_profile_id()) = agent_id);

-- messages ------------------------------------------------------------------
drop policy if exists "Participants send messages" on public.messages;
create policy "Participants send messages" on public.messages
  for insert with check (
    sender_id = (select public.current_profile_id())
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.client_id = (select public.current_profile_id())
             or c.agent_id = (select public.current_profile_id()))
    )
  );

drop policy if exists "Participants view messages" on public.messages;
create policy "Participants view messages" on public.messages
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.client_id = (select public.current_profile_id())
             or c.agent_id = (select public.current_profile_id()))
    )
  );

-- profiles ------------------------------------------------------------------
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles
  for insert with check ((select public.current_profile_id()) = id);

-- Name is the 63-byte truncation Postgres stored for the original
-- "...or an existing relationship"; kept byte-identical.
drop policy if exists "Profiles visible to self, agents publicly, or an existing relat" on public.profiles;
create policy "Profiles visible to self, agents publicly, or an existing relat" on public.profiles
  for select using (
    role = 'agent'
    or (select public.current_profile_id()) = id
    or exists (
      select 1 from public.viewings v
      where v.client_id = profiles.id
        and v.agent_id = (select public.current_profile_id())
    )
    or exists (
      select 1 from public.conversations c
      where c.client_id = profiles.id
        and c.agent_id = (select public.current_profile_id())
    )
    or (public.current_user_is_agent() and public.buyer_has_open_wanted_home(id))
  );

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update using ((select public.current_profile_id()) = id);

-- properties ----------------------------------------------------------------
drop policy if exists "Owners can delete own properties" on public.properties;
create policy "Owners can delete own properties" on public.properties
  for delete using (
    (select public.current_profile_id()) = owner_id
    or (select public.current_profile_id()) = agent_id
  );

drop policy if exists "Authenticated users can create properties" on public.properties;
create policy "Authenticated users can create properties" on public.properties
  for insert with check ((select public.current_profile_id()) = owner_id);

drop policy if exists "Active properties viewable, owners see own" on public.properties;
create policy "Active properties viewable, owners see own" on public.properties
  for select using (
    status = 'active'
    or (select public.current_profile_id()) = owner_id
    or (select public.current_profile_id()) = agent_id
  );

drop policy if exists "Owners can update own properties" on public.properties;
create policy "Owners can update own properties" on public.properties
  for update using (
    (select public.current_profile_id()) = owner_id
    or (select public.current_profile_id()) = agent_id
  )
  with check (
    (select public.current_profile_id()) = owner_id
    or (select public.current_profile_id()) = agent_id
  );

-- property_activity ---------------------------------------------------------
drop policy if exists "Owners view their property activity" on public.property_activity;
create policy "Owners view their property activity" on public.property_activity
  for select using (
    exists (
      select 1 from public.properties p
      where p.id = property_activity.property_id
        and (p.owner_id = (select public.current_profile_id())
             or p.agent_id = (select public.current_profile_id()))
    )
  );

-- property_views ------------------------------------------------------------
drop policy if exists "Owners view property views" on public.property_views;
create policy "Owners view property views" on public.property_views
  for select using (
    exists (
      select 1 from public.properties p
      where p.id = property_views.property_id
        and (p.owner_id = (select public.current_profile_id())
             or p.agent_id = (select public.current_profile_id()))
    )
  );

-- saved_searches ------------------------------------------------------------
drop policy if exists "Users manage own saved searches" on public.saved_searches;
create policy "Users manage own saved searches" on public.saved_searches
  for all using ((select public.current_profile_id()) = user_id)
  with check ((select public.current_profile_id()) = user_id);

-- viewings ------------------------------------------------------------------
drop policy if exists "Clients request viewings" on public.viewings;
create policy "Clients request viewings" on public.viewings
  for insert with check ((select public.current_profile_id()) = client_id);

drop policy if exists "Participants view viewings" on public.viewings;
create policy "Participants view viewings" on public.viewings
  for select using (
    (select public.current_profile_id()) = client_id
    or (select public.current_profile_id()) = agent_id
    or exists (
      select 1 from public.properties p
      where p.id = viewings.property_id
        and (p.owner_id = (select public.current_profile_id())
             or p.agent_id = (select public.current_profile_id()))
    )
  );

drop policy if exists "Participants update viewings" on public.viewings;
create policy "Participants update viewings" on public.viewings
  for update using (
    (select public.current_profile_id()) = client_id
    or (select public.current_profile_id()) = agent_id
    or exists (
      select 1 from public.properties p
      where p.id = viewings.property_id
        and (p.owner_id = (select public.current_profile_id())
             or p.agent_id = (select public.current_profile_id()))
    )
  );

-- wanted_homes --------------------------------------------------------------
drop policy if exists "Clients manage own wanted homes" on public.wanted_homes;
create policy "Clients manage own wanted homes" on public.wanted_homes
  for all using ((select public.current_profile_id()) = client_id)
  with check ((select public.current_profile_id()) = client_id);

drop policy if exists "Agents can view open wanted homes" on public.wanted_homes;
create policy "Agents can view open wanted homes" on public.wanted_homes
  for select using (
    status = 'open'
    and exists (
      select 1 from public.profiles pr
      where pr.id = (select public.current_profile_id()) and pr.role = 'agent'
    )
  );
