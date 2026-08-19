-- Supabase's documented RLS perf pattern: auth.uid() re-evaluates per row;
-- (select auth.uid()) lets Postgres treat it as an InitPlan, evaluated once
-- per statement. This migration changes ONLY that — every USING/WITH CHECK
-- clause below is byte-for-byte the same boolean logic as the current
-- policy (verified via pg_policies before writing this), just with auth.*()
-- calls wrapped. No role, command, or authorization semantics change.
-- Uses ALTER POLICY specifically because it cannot touch cmd/roles/table —
-- only USING/WITH CHECK — which is what makes this safe to apply broadly.

ALTER POLICY "Active properties viewable, owners see own" ON public.properties
USING ((status = 'active'::text) OR ((select auth.uid()) = owner_id) OR ((select auth.uid()) = agent_id));

ALTER POLICY "Authenticated users can create properties" ON public.properties
WITH CHECK ((select auth.uid()) = owner_id);

ALTER POLICY "Owners can delete own properties" ON public.properties
USING (((select auth.uid()) = owner_id) OR ((select auth.uid()) = agent_id));

ALTER POLICY "Owners can update own properties" ON public.properties
USING (((select auth.uid()) = owner_id) OR ((select auth.uid()) = agent_id))
WITH CHECK (((select auth.uid()) = owner_id) OR ((select auth.uid()) = agent_id));

ALTER POLICY "Owners view their property activity" ON public.property_activity
USING (EXISTS (
  SELECT 1 FROM properties p
  WHERE p.id = property_activity.property_id
  AND (p.owner_id = (select auth.uid()) OR p.agent_id = (select auth.uid()))
));

ALTER POLICY "Owners view property views" ON public.property_views
USING (EXISTS (
  SELECT 1 FROM properties p
  WHERE p.id = property_views.property_id
  AND (p.owner_id = (select auth.uid()) OR p.agent_id = (select auth.uid()))
));

ALTER POLICY "Users manage own saved searches" ON public.saved_searches
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users can add own favorites" ON public.favorites
WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users can remove own favorites" ON public.favorites
USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can view own favorites" ON public.favorites
USING ((select auth.uid()) = user_id);

ALTER POLICY "Clients request viewings" ON public.viewings
WITH CHECK ((select auth.uid()) = client_id);

ALTER POLICY "Participants update viewings" ON public.viewings
USING (
  ((select auth.uid()) = client_id) OR ((select auth.uid()) = agent_id) OR
  EXISTS (SELECT 1 FROM properties p WHERE p.id = viewings.property_id AND (p.owner_id = (select auth.uid()) OR p.agent_id = (select auth.uid())))
);

ALTER POLICY "Participants view viewings" ON public.viewings
USING (
  ((select auth.uid()) = client_id) OR ((select auth.uid()) = agent_id) OR
  EXISTS (SELECT 1 FROM properties p WHERE p.id = viewings.property_id AND (p.owner_id = (select auth.uid()) OR p.agent_id = (select auth.uid())))
);

ALTER POLICY "Clients start conversations" ON public.conversations
WITH CHECK ((select auth.uid()) = client_id);

ALTER POLICY "Participants update conversations" ON public.conversations
USING (((select auth.uid()) = client_id) OR ((select auth.uid()) = agent_id));

ALTER POLICY "Participants view conversations" ON public.conversations
USING (((select auth.uid()) = client_id) OR ((select auth.uid()) = agent_id));

ALTER POLICY "Participants send messages" ON public.messages
WITH CHECK (
  (sender_id = (select auth.uid())) AND
  EXISTS (SELECT 1 FROM conversations c WHERE c.id = messages.conversation_id AND (c.client_id = (select auth.uid()) OR c.agent_id = (select auth.uid())))
);

ALTER POLICY "Participants view messages" ON public.messages
USING (
  EXISTS (SELECT 1 FROM conversations c WHERE c.id = messages.conversation_id AND (c.client_id = (select auth.uid()) OR c.agent_id = (select auth.uid())))
);

ALTER POLICY "Agents can view open wanted homes" ON public.wanted_homes
USING (
  (status = 'open'::text) AND
  EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = (select auth.uid()) AND pr.role = 'agent'::text)
);

ALTER POLICY "Clients manage own wanted homes" ON public.wanted_homes
USING ((select auth.uid()) = client_id)
WITH CHECK ((select auth.uid()) = client_id);

ALTER POLICY "Agents manage own leads" ON public.leads
USING ((select auth.uid()) = agent_id)
WITH CHECK ((select auth.uid()) = agent_id);

-- current_user_is_agent() / buyer_has_open_wanted_home(id) are left as-is:
-- user-defined function calls, not raw auth.*() calls — not what the linter
-- flagged, and already STABLE SECURITY DEFINER (auth.uid() evaluated once
-- inside them per invocation regardless).
ALTER POLICY "Profiles visible to self, agents publicly, or an existing relat" ON public.profiles
USING (
  (role = 'agent'::text) OR
  ((select auth.uid()) = id) OR
  (EXISTS (SELECT 1 FROM viewings v WHERE v.client_id = profiles.id AND v.agent_id = (select auth.uid()))) OR
  (EXISTS (SELECT 1 FROM conversations c WHERE c.client_id = profiles.id AND c.agent_id = (select auth.uid()))) OR
  (current_user_is_agent() AND buyer_has_open_wanted_home(id))
);

ALTER POLICY "Users can insert own profile" ON public.profiles
WITH CHECK ((select auth.uid()) = id);

ALTER POLICY "Users can update own profile" ON public.profiles
USING ((select auth.uid()) = id);
