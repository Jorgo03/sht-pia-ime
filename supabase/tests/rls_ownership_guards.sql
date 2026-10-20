-- Ownership guards (migration 20261015205024, AUDIT.md Pass 15: S-7, S-8, S-9,
-- BUG-015). Re-runnable against any database that has the migration.
--
-- SAFE ON PRODUCTION: everything runs in ONE DO block that always ends by
-- raising an exception, so every write it makes is rolled back. It never
-- deletes anything. The exception text is the result:
--   ERROR:  RESULTS passed=15/15 | P1 PASS ... | P2 PASS ...
-- Any FAIL, or a "SKIP" (missing test data), means the guards need a look.
--
-- Run: paste into the Supabase SQL editor, the MCP execute_sql tool, or
--   psql "$DATABASE_URL" -f supabase/tests/rls_ownership_guards.sql
-- It needs a role that can SET ROLE to anon/authenticated (postgres does).
do $$
declare
  c record; v record;
  agent_u uuid; client_u uuid; other_agent uuid; pid uuid;
  got text; n int;
  names text[] := '{}'; expected text[] := '{}'; actual text[] := '{}';
  report text := ''; passed int := 0;
begin
  -- Test data, read as the table owner. Nothing here is modified for good.
  select * into c from public.conversations order by created_at limit 1;
  select * into v from public.viewings where agent_id is not null order by created_at limit 1;
  select id into agent_u from public.profiles where role = 'agent' order by created_at limit 1;
  select id into client_u from public.profiles where role = 'buyer' order by created_at limit 1;
  select id into other_agent from public.profiles where role = 'agent' and id <> agent_u order by created_at limit 1;
  if c.id is null or v.id is null or agent_u is null or client_u is null or other_agent is null then
    raise exception 'RESULTS SKIP: needs a conversation, a viewing with an agent, a buyer and two agents';
  end if;

  -- As a client ---------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', client_u, 'role', 'authenticated')::text, true);
  set local role authenticated;

  begin
    insert into public.properties(owner_id, agent_id, owner_type, title, address, price, sqft, beds, baths, city, listing_type, property_type, status)
    values (client_u, other_agent, 'agent', 'rls-test', 'x', 1, 1, 0, 0, 'Tiranë', 'sale', 'apartment', 'active');
    got := 'ok';
  exception when others then got := sqlstate; end;
  names := names || 'P1 client lists under another agent''s name'::text; expected := expected || '42501'::text; actual := actual || got;

  begin
    insert into public.properties(owner_id, agent_id, owner_type, title, address, price, sqft, beds, baths, city, listing_type, property_type, status)
    values (client_u, null, 'client', 'rls-test', 'x', 1, 1, 0, 0, 'Tiranë', 'sale', 'apartment', 'active')
    returning id into pid;
    got := 'ok';
  exception when others then got := sqlstate; end;
  names := names || 'P2 client lists as themselves'::text; expected := expected || 'ok'::text; actual := actual || got;

  begin
    update public.properties set owner_id = other_agent where id = pid;
    got := 'ok';
  exception when others then got := sqlstate; end;
  names := names || 'P3 owner hands the listing to someone else'::text; expected := expected || '42501'::text; actual := actual || got;

  begin
    update public.properties set title = 'rls-test edited', price = 2, image_urls = array['u'] where id = pid;
    get diagnostics n = row_count; got := 'rows=' || n;
  exception when others then got := sqlstate; end;
  names := names || 'P4 owner edits their listing'::text; expected := expected || 'rows=1'::text; actual := actual || got;

  begin
    update public.properties set status = 'sold' where id = pid;
    get diagnostics n = row_count; got := 'rows=' || n;
  exception when others then got := sqlstate; end;
  names := names || 'P5 owner marks it sold'::text; expected := expected || 'rows=1'::text; actual := actual || got;
  reset role;

  -- As an agent ---------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', agent_u, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into public.properties(owner_id, agent_id, owner_type, title, address, price, sqft, beds, baths, city, listing_type, property_type, status)
    values (agent_u, agent_u, 'agent', 'rls-test', 'x', 1, 1, 0, 0, 'Tiranë', 'sale', 'apartment', 'active');
    got := 'ok';
  exception when others then got := sqlstate; end;
  names := names || 'P6 agent lists as themselves'::text; expected := expected || 'ok'::text; actual := actual || got;
  reset role;

  -- Conversations: the client side --------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', c.client_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    update public.conversations set agent_id = other_agent where id = c.id;
    got := 'ok';
  exception when others then got := sqlstate; end;
  names := names || 'P7 client moves the chat to another agent'::text; expected := expected || '42501'::text; actual := actual || got;

  begin
    update public.conversations set unread_for_client = 0 where id = c.id;
    get diagnostics n = row_count; got := 'rows=' || n;
  exception when others then got := sqlstate; end;
  names := names || 'P8 client marks the chat read'::text; expected := expected || 'rows=1'::text; actual := actual || got;
  reset role;

  -- Viewings: the host ----------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v.agent_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    update public.viewings set status = 'declined' where id = v.id;
    get diagnostics n = row_count; got := 'rows=' || n;
  exception when others then got := sqlstate; end;
  names := names || 'P9 agent declines a viewing (BUG-015)'::text; expected := expected || 'rows=1'::text; actual := actual || got;

  begin
    update public.viewings set status = 'completed' where id = v.id;
    update public.viewings set status = 'requested' where id = v.id;
    got := 'ok';
  exception when others then got := sqlstate; end;
  names := names || 'P10 agent moves it through other statuses'::text; expected := expected || 'ok'::text; actual := actual || got;
  reset role;

  -- Viewings: the client --------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v.client_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    update public.viewings set status = 'confirmed' where id = v.id;
    got := 'ok';
  exception when others then got := sqlstate; end;
  names := names || 'P11 client confirms their own viewing'::text; expected := expected || '42501'::text; actual := actual || got;

  begin
    update public.viewings set agent_id = other_agent where id = v.id;
    got := 'ok';
  exception when others then got := sqlstate; end;
  names := names || 'P12 client moves the viewing to another agent'::text; expected := expected || '42501'::text; actual := actual || got;

  begin
    update public.viewings set status = 'cancelled' where id = v.id;
    get diagnostics n = row_count; got := 'rows=' || n;
  exception when others then got := sqlstate; end;
  names := names || 'P13 client cancels'::text; expected := expected || 'rows=1'::text; actual := actual || got;
  reset role;

  -- Signed out ----------------------------------------------------------------
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin
    update public.properties set owner_id = agent_u where id = pid;
    get diagnostics n = row_count; got := case when n = 0 then 'refused' else 'rows=' || n end;
  exception when insufficient_privilege then got := 'refused';
            when others then got := sqlstate; end;
  names := names || 'P14 signed out cannot touch a listing'::text; expected := expected || 'refused'::text; actual := actual || got;
  reset role;

  -- Admin (table owner) is not limited by the guards --------------------------
  begin
    update public.properties set owner_id = agent_u where id = pid;
    get diagnostics n = row_count; got := 'rows=' || n;
  exception when others then got := sqlstate; end;
  names := names || 'P15 admin can still reassign a listing'::text; expected := expected || 'rows=1'::text; actual := actual || got;

  for i in 1 .. array_length(names, 1) loop
    if actual[i] = expected[i] then
      passed := passed + 1;
      report := report || ' | ' || names[i] || ' PASS';
    else
      report := report || ' | ' || names[i] || ' FAIL [expected ' || expected[i] || ', got ' || coalesce(actual[i], 'null') || ']';
    end if;
  end loop;
  raise exception 'RESULTS passed=%/% %', passed, array_length(names, 1), report;
end $$;
