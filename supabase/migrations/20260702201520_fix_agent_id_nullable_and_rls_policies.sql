-- 1. Buyers must be able to publish listings (owner_id is canonical; agent_id optional)
alter table public.properties alter column agent_id drop not null;

-- 2. RLS policies for the 7 locked tables (RLS was enabled with no policies)

-- saved_searches: private to the owner
create policy "Users manage own saved searches" on public.saved_searches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- leads: private to the agent who created them
create policy "Agents manage own leads" on public.leads
  for all using (auth.uid() = agent_id) with check (auth.uid() = agent_id);

-- wanted_homes: owners manage their own; agents can browse open requests
create policy "Clients manage own wanted homes" on public.wanted_homes
  for all using (auth.uid() = client_id) with check (auth.uid() = client_id);
create policy "Agents can view open wanted homes" on public.wanted_homes
  for select using (
    status = 'open'
    and exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'agent')
  );

-- viewings: visible to the client, the assigned agent, and the property owner/agent
create policy "Participants view viewings" on public.viewings
  for select using (
    auth.uid() = client_id or auth.uid() = agent_id
    or exists (select 1 from public.properties p where p.id = property_id
               and (p.owner_id = auth.uid() or p.agent_id = auth.uid()))
  );
create policy "Clients request viewings" on public.viewings
  for insert with check (auth.uid() = client_id);
create policy "Participants update viewings" on public.viewings
  for update using (
    auth.uid() = client_id or auth.uid() = agent_id
    or exists (select 1 from public.properties p where p.id = property_id
               and (p.owner_id = auth.uid() or p.agent_id = auth.uid()))
  );

-- conversations: participants only
create policy "Participants view conversations" on public.conversations
  for select using (auth.uid() = client_id or auth.uid() = agent_id);
create policy "Clients start conversations" on public.conversations
  for insert with check (auth.uid() = client_id);
create policy "Participants update conversations" on public.conversations
  for update using (auth.uid() = client_id or auth.uid() = agent_id);

-- messages: participants of the parent conversation
create policy "Participants view messages" on public.messages
  for select using (
    exists (select 1 from public.conversations c where c.id = conversation_id
            and (c.client_id = auth.uid() or c.agent_id = auth.uid()))
  );
create policy "Participants send messages" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and exists (select 1 from public.conversations c where c.id = conversation_id
                and (c.client_id = auth.uid() or c.agent_id = auth.uid()))
  );
create policy "Participants update messages" on public.messages
  for update using (
    exists (select 1 from public.conversations c where c.id = conversation_id
            and (c.client_id = auth.uid() or c.agent_id = auth.uid()))
  );

-- property_views: unused by the app; keep locked for writes but allow owner reads for parity
create policy "Owners view property views" on public.property_views
  for select using (
    exists (select 1 from public.properties p where p.id = property_id
            and (p.owner_id = auth.uid() or p.agent_id = auth.uid()))
  );
