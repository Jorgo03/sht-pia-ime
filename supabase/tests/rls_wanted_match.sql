-- Wanted-home match alerts (AUDIT-025, migration *_wanted_home_match_alerts).
-- One DO block that always ends in `raise exception 'RESULTS …'`, so every
-- fixture and notification is rolled back. Expected: passed=9/9.
-- Live 2026-11-14: 5/9 without the migration (M1, M5, M7, M9: nothing is
-- ever notified); 9/9 with the migration run inside the same rolled-back
-- block. Cities are canonical names (public.locations guard), e.g. Tiranë.
do $$
declare
  agent uuid; buyer uuid; buyer2 uuid;
  w_fit uuid; w_city uuid; w_type uuid; w_closed uuid; w_budget uuid; w_own uuid; w_any uuid;
  p1 uuid; p2 uuid; p3 uuid; n int;
  passed int := 0; total int := 0; log text := '';
begin
  select id into agent from public.profiles where role = 'agent' order by created_at limit 1;
  select id into buyer from public.profiles where id <> agent order by created_at limit 1;
  select id into buyer2 from public.profiles where id not in (agent, buyer) order by created_at limit 1;
  if agent is null or buyer is null or buyer2 is null then
    raise exception 'RESULTS SKIP: needs an agent and two other accounts';
  end if;

  insert into public.wanted_homes(client_id, city, listing_type, max_price, min_bedrooms, status)
    values (buyer, 'Tiranë', 'sale', 200000, 2, 'open') returning id into w_fit;
  insert into public.wanted_homes(client_id, city, listing_type, status)
    values (buyer, 'Durrës', 'sale', 'open') returning id into w_city;
  insert into public.wanted_homes(client_id, city, listing_type, status)
    values (buyer, 'Tiranë', 'rent', 'open') returning id into w_type;
  insert into public.wanted_homes(client_id, city, listing_type, status)
    values (buyer, 'Tiranë', 'sale', 'closed') returning id into w_closed;
  insert into public.wanted_homes(client_id, city, listing_type, max_price, status)
    values (buyer2, 'Tiranë', 'sale', 50000, 'open') returning id into w_budget;
  insert into public.wanted_homes(client_id, city, listing_type, status)
    values (agent, 'Tiranë', 'sale', 'open') returning id into w_own;
  insert into public.wanted_homes(client_id, city, listing_type, max_price, status)
    values (buyer2, 'Tiranë', 'sale', 1600000, 'open') returning id into w_any;

  -- A sale in Tiranë at 150,000 EUR with 3 bedrooms, published by the agent.
  insert into public.properties(owner_id, agent_id, owner_type, title, address, price, currency, sqft, beds, baths, city, listing_type, property_type, status)
    values (agent, agent, 'agent', 'qa-wanted', 'x', 150000, 'EUR', 90, 3, 1, 'Tiranë', 'sale', 'apartment', 'active') returning id into p1;

  -- M1. The fitting wanted home is notified, once, with the listing id.
  select count(*) into n from public.notifications
    where user_id = buyer and kind = 'wanted_match' and data->>'property_id' = p1::text and data->>'wanted_home_id' = w_fit::text;
  total := total + 1; if n = 1 then passed := passed + 1; else log := log || 'M1(' || n || ') '; end if;

  -- M2. Other city, other type, closed: nothing.
  select count(*) into n from public.notifications
    where kind = 'wanted_match' and data->>'wanted_home_id' in (w_city::text, w_type::text, w_closed::text);
  total := total + 1; if n = 0 then passed := passed + 1; else log := log || 'M2(' || n || ') '; end if;

  -- M3. Over the budget: nothing.
  select count(*) into n from public.notifications where kind = 'wanted_match' and data->>'wanted_home_id' = w_budget::text;
  total := total + 1; if n = 0 then passed := passed + 1; else log := log || 'M3(' || n || ') '; end if;

  -- M4. Never the publisher's own wanted home.
  select count(*) into n from public.notifications where kind = 'wanted_match' and user_id = agent;
  total := total + 1; if n = 0 then passed := passed + 1; else log := log || 'M4(' || n || ') '; end if;

  -- M5. Pausing and publishing again does not notify twice.
  update public.properties set status = 'paused' where id = p1;
  update public.properties set status = 'active' where id = p1;
  select count(*) into n from public.notifications where kind = 'wanted_match' and data->>'property_id' = p1::text and user_id = buyer;
  total := total + 1; if n = 1 then passed := passed + 1; else log := log || 'M5(' || n || ') '; end if;

  -- M6. A draft notifies nobody.
  insert into public.properties(owner_id, agent_id, owner_type, title, address, price, currency, sqft, beds, baths, city, listing_type, property_type, status)
    values (agent, agent, 'agent', 'qa-wanted-2', 'x', 14700000, 'ALL', 90, 2, 1, 'Tiranë', 'sale', 'apartment', 'draft') returning id into p2;
  select count(*) into n from public.notifications where kind = 'wanted_match' and data->>'property_id' = p2::text;
  total := total + 1; if n = 0 then passed := passed + 1; else log := log || 'M6(' || n || ') '; end if;

  -- M7. Publishing the draft notifies; 14,700,000 ALL is 150,000 EUR, within budget.
  update public.properties set status = 'active' where id = p2;
  select count(*) into n from public.notifications where kind = 'wanted_match' and data->>'property_id' = p2::text and user_id = buyer;
  total := total + 1; if n = 1 then passed := passed + 1; else log := log || 'M7(' || n || ') '; end if;

  -- M8. A listing on moderation hold notifies nobody.
  insert into public.properties(owner_id, agent_id, owner_type, title, address, price, currency, sqft, beds, baths, city, listing_type, property_type, status, moderation_hold)
    values (agent, agent, 'agent', 'qa-wanted-3', 'x', 100000, 'EUR', 90, 3, 1, 'Tiranë', 'sale', 'apartment', 'active', true) returning id into p3;
  select count(*) into n from public.notifications where kind = 'wanted_match' and data->>'property_id' = p3::text;
  total := total + 1; if n = 0 then passed := passed + 1; else log := log || 'M8(' || n || ') '; end if;

  -- M9. The buyer reads their own match (RLS), and the other buyer's match
  -- for the generous budget is theirs alone.
  perform set_config('request.jwt.claims', json_build_object('sub', buyer, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.notifications where kind = 'wanted_match';
  reset role;
  total := total + 1;
  if n = 2 and exists (select 1 from public.notifications where user_id = buyer2 and data->>'wanted_home_id' = w_any::text)
    then passed := passed + 1; else log := log || 'M9(' || n || ') '; end if;

  raise exception 'RESULTS passed=%/% %', passed, total, log;
end $$;
