-- Can anyone see someone else's data? Read-only: run it in the Supabase SQL
-- editor (or the MCP execute_sql tool) and every number must be 0.
-- Each block acts as one real account, or as a signed-out visitor, inside a
-- transaction that is rolled back, so nothing is changed.
-- Result 2026-11-04: all 0 (AUDIT.md Pass 32).

-- 1. One buyer: rows belonging to other people that they can see.
begin;
select set_config('request.jwt.claims', json_build_object('sub', (select p.id from public.profiles p
  where p.role = 'buyer' and not exists (select 1 from public.moderators m where m.user_id = p.id)
  order by p.created_at limit 1)::text, 'role', 'authenticated')::text, true);
set local role authenticated;
select 'buyer' as who, json_build_object(
  'favorites', (select count(*) from public.favorites where user_id <> auth.uid()),
  'saved_searches', (select count(*) from public.saved_searches where user_id <> auth.uid()),
  'conversations', (select count(*) from public.conversations where auth.uid() not in (client_id, agent_id)),
  'messages', (select count(*) from public.messages m where not exists (select 1 from public.conversations c
    where c.id = m.conversation_id and auth.uid() in (c.client_id, c.agent_id))),
  'viewings', (select count(*) from public.viewings v where auth.uid() not in (v.client_id, v.agent_id)
    and not exists (select 1 from public.properties p where p.id = v.property_id and auth.uid() in (p.owner_id, coalesce(p.agent_id, p.owner_id)))),
  'leads', (select count(*) from public.leads where agent_id <> auth.uid()),
  'push_tokens', (select count(*) from public.push_tokens where user_id <> auth.uid()),
  'notification_preferences', (select count(*) from public.notification_preferences where user_id <> auth.uid()),
  'user_blocks', (select count(*) from public.user_blocks where blocker_id <> auth.uid()),
  'wanted_homes', (select count(*) from public.wanted_homes where client_id <> auth.uid()),
  'listing_promotions', (select count(*) from public.listing_promotions where buyer_id <> auth.uid()),
  'agency_subscriptions', (select count(*) from public.agency_subscriptions where agent_id <> auth.uid()),
  'content_reports', (select count(*) from public.content_reports),
  'activity_on_others_listings', (select count(*) from public.property_activity a where not exists (select 1 from public.properties p
    where p.id = a.property_id and auth.uid() in (p.owner_id, coalesce(p.agent_id, p.owner_id)))),
  'unlinked_buyer_profiles', (select count(*) from public.profiles pr where pr.role = 'buyer' and pr.id <> auth.uid()
    and not exists (select 1 from public.conversations c where c.client_id = pr.id and c.agent_id = auth.uid())
    and not exists (select 1 from public.viewings v where v.client_id = pr.id and v.agent_id = auth.uid())),
  'unpublished_listings_of_others', (select count(*) from public.properties where status <> 'active'
    and auth.uid() not in (owner_id, coalesce(agent_id, owner_id))),
  'ai_usage', (select count(*) from public.ai_usage),
  'payment_events', (select count(*) from public.payment_events)
) as rows_of_others_visible;
rollback;

-- 2. One agent: other agents' and buyers' private rows.
begin;
select set_config('request.jwt.claims', json_build_object('sub', (select p.id from public.profiles p
  where p.role = 'agent' and not exists (select 1 from public.moderators m where m.user_id = p.id)
  order by p.created_at limit 1)::text, 'role', 'authenticated')::text, true);
set local role authenticated;
select 'agent' as who, json_build_object(
  'leads_of_other_agents', (select count(*) from public.leads where agent_id <> auth.uid()),
  'conversations', (select count(*) from public.conversations where auth.uid() not in (client_id, agent_id)),
  'favorites', (select count(*) from public.favorites where user_id <> auth.uid()),
  'saved_searches', (select count(*) from public.saved_searches where user_id <> auth.uid()),
  'unpublished_listings_of_others', (select count(*) from public.properties where status <> 'active'
    and auth.uid() not in (owner_id, coalesce(agent_id, owner_id))),
  'closed_wanted_homes_of_others', (select count(*) from public.wanted_homes where status <> 'open' and client_id <> auth.uid())
) as rows_of_others_visible;
rollback;

-- 3. Signed-out visitor: only active listings (and active plans) may show.
begin;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select 'visitor' as who, json_build_object(
  'favorites', (select count(*) from public.favorites), 'saved_searches', (select count(*) from public.saved_searches),
  'conversations', (select count(*) from public.conversations), 'messages', (select count(*) from public.messages),
  'viewings', (select count(*) from public.viewings), 'leads', (select count(*) from public.leads),
  'property_activity', (select count(*) from public.property_activity), 'property_views', (select count(*) from public.property_views),
  'listing_promotions', (select count(*) from public.listing_promotions), 'agency_subscriptions', (select count(*) from public.agency_subscriptions),
  'ai_usage', (select count(*) from public.ai_usage), 'payment_events', (select count(*) from public.payment_events),
  'unpublished_listings', (select count(*) from public.properties where status <> 'active')
) as private_rows_visible;
rollback;
