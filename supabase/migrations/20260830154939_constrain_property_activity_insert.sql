-- Security audit (Pass 13): property_activity's INSERT policy was the only
-- permissive policy in the schema — `WITH CHECK (true)` — and anon holds the
-- INSERT grant, as it must: 108 of the 160 existing view rows are anonymous,
-- so analytics genuinely depends on unauthenticated writes.
--
-- `true` allowed considerably more than anonymous view counting:
--
--   1. user_id is client-supplied, so an attacker could attribute activity to
--      ANY other user's uuid — poisoning an agent's dashboard with fabricated
--      engagement, or planting another user's id against listings they never
--      opened.
--   2. `type` was unconstrained free text, so arbitrary strings could be
--      written into a column the dashboards group by.
--   3. property_id was unconstrained, so rows could reference properties that
--      do not exist.
--
-- This replaces `true` with the narrowest check that still admits every real
-- write path, verified against live data before applying:
--   * user_id null (anonymous) or the caller's own uid — never a third party
--   * type restricted to the five kinds the dashboards actually read
--     (src/features/listings/pages/PropertyDashboard.jsx TYPES)
--   * property_id must reference a real property
--
-- Verified against production rows first: types in use are view/message/
-- meeting (call/favourite are declared but unused), and there are zero null
-- and zero orphan property_id values — so no legitimate existing pattern is
-- rejected. WITH CHECK applies only to new inserts; existing rows are
-- untouched.
--
-- NOT fixed here: request volume. Nothing stops a script inserting a large
-- number of well-formed rows. That needs rate limiting at the edge, which is
-- flagged in SECURITY_AUDIT.md rather than bodged into a policy.
--
-- Rollback:
--   drop policy "Anyone can insert activity" on public.property_activity;
--   create policy "Anyone can insert activity" on public.property_activity
--     for insert with check (true);

drop policy if exists "Anyone can insert activity" on public.property_activity;

create policy "Anyone can insert activity"
  on public.property_activity
  for insert
  with check (
    (user_id is null or user_id = (select auth.uid()))
    and type in ('view', 'call', 'message', 'meeting', 'favourite')
    and exists (select 1 from public.properties p where p.id = property_id)
  );
