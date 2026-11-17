-- Report and block (migration 20261016181934, docs/LAUNCH_TASKS.md L03).
-- Re-runnable against any database that has the migration.
--
-- SAFE ON PRODUCTION: one DO block that always ends by raising an exception,
-- so every report, block and message it writes is rolled back. It runs no
-- DELETE (unblocking is checked from the policy definition instead), so the
-- Supabase MCP tool runs it without a confirmation prompt. The exception text
-- is the result:
--   ERROR:  RESULTS passed=18/18 | R1 PASS ... | B1 PASS ...
--
-- Run: Supabase SQL editor, MCP execute_sql, or
--   psql "$DATABASE_URL" -f supabase/tests/rls_report_and_block.sql
do $$
declare
  c record; p uuid; outsider uuid;
  got text; n int; b boolean;
  names text[] := '{}'; expected text[] := '{}'; actual text[] := '{}';
  report text := ''; passed int := 0;
begin
  -- A conversation with no block either way, and a listing its client has not
  -- already reported (a real open report would turn R1 into a duplicate).
  select cv.* into c from public.conversations cv
  where not exists (
    select 1 from public.user_blocks ub
    where (ub.blocker_id = cv.client_id and ub.blocked_id = cv.agent_id)
       or (ub.blocker_id = cv.agent_id and ub.blocked_id = cv.client_id))
  order by cv.created_at limit 1;
  select pr.id into p from public.properties pr
  where pr.status = 'active'
    and not exists (select 1 from public.content_reports r
                    where r.reporter_id = c.client_id and r.property_id = pr.id and r.status = 'open')
  order by pr.created_at limit 1;
  select id into outsider from auth.users where id not in (c.client_id, c.agent_id) order by created_at limit 1;
  if c.id is null or p is null or outsider is null then
    raise exception 'RESULTS SKIP: needs an unblocked conversation, an active listing and a third account';
  end if;

  -- Reports -------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', c.client_id, 'role', 'authenticated')::text, true);
  set local role authenticated;

  begin insert into public.content_reports(property_id, reason, details) values (p, 'scam', 'rls-test'); got := 'ok';
  exception when others then got := sqlstate; end;
  names := names || 'R1 client reports a listing'::text; expected := expected || 'ok'::text; actual := actual || got;

  begin insert into public.content_reports(property_id, reason) values (p, 'spam'); got := 'ok';
  exception when others then got := sqlstate; end;
  names := names || 'R2 second open report of the same listing'::text; expected := expected || '23505'::text; actual := actual || got;

  begin select count(*)::text into got from public.content_reports;
  exception when others then got := sqlstate; end;
  names := names || 'R3 reporter cannot read reports'::text; expected := expected || '42501'::text; actual := actual || got;

  begin insert into public.content_reports(reported_user_id, reason, status) values (c.agent_id, 'offensive', 'dismissed'); got := 'ok';
  exception when others then got := sqlstate; end;
  names := names || 'R4 client sets the report status'::text; expected := expected || '42501'::text; actual := actual || got;

  begin insert into public.content_reports(reporter_id, reported_user_id, reason) values (outsider, c.agent_id, 'offensive'); got := 'ok';
  exception when others then got := sqlstate; end;
  names := names || 'R5 client files a report as someone else'::text; expected := expected || '42501'::text; actual := actual || got;

  begin insert into public.content_reports(reported_user_id, reason) values (c.agent_id, 'offensive'); got := 'ok';
  exception when others then got := sqlstate; end;
  names := names || 'R6 client reports a user'::text; expected := expected || 'ok'::text; actual := actual || got;
  reset role;

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin insert into public.content_reports(property_id, reason) values (p, 'spam'); got := 'ok';
  exception when others then got := sqlstate; end;
  names := names || 'R7 signed out cannot report'::text; expected := expected || '42501'::text; actual := actual || got;

  begin select count(*)::text into got from public.user_blocks;
  exception when others then got := sqlstate; end;
  names := names || 'B1 signed out cannot read blocks'::text; expected := expected || '42501'::text; actual := actual || got;

  begin perform public.sender_is_blocked(c.id); got := 'ok';
  exception when others then got := sqlstate; end;
  names := names || 'B2 signed out cannot call sender_is_blocked'::text; expected := expected || '42501'::text; actual := actual || got;
  reset role;

  -- Blocks: the client blocks the agent ---------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', c.agent_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin insert into public.messages(conversation_id, sender_id, body) values (c.id, c.agent_id, 'rls-test'); got := 'ok';
  exception when others then got := sqlstate; end;
  names := names || 'B3 agent messages before any block'::text; expected := expected || 'ok'::text; actual := actual || got;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', c.client_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin insert into public.user_blocks(blocked_id) values (c.agent_id); got := 'ok';
  exception when others then got := sqlstate; end;
  names := names || 'B4 client blocks the agent'::text; expected := expected || 'ok'::text; actual := actual || got;

  begin insert into public.messages(conversation_id, sender_id, body) values (c.id, c.client_id, 'rls-test'); got := 'ok';
  exception when others then got := sqlstate; end;
  names := names || 'B5 the blocker can still write'::text; expected := expected || 'ok'::text; actual := actual || got;

  begin select count(*)::text into got from public.user_blocks;
  exception when others then got := sqlstate; end;
  names := names || 'B6 the blocker sees their block'::text; expected := expected || '1'::text; actual := actual || got;

  begin insert into public.user_blocks(blocked_id) values (c.client_id); got := 'ok';
  exception when others then got := sqlstate; end;
  names := names || 'B7 nobody can block themselves'::text; expected := expected || '23514'::text; actual := actual || got;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', c.agent_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin b := public.sender_is_blocked(c.id); got := b::text;
  exception when others then got := sqlstate; end;
  names := names || 'B8 the blocked agent is told they are blocked'::text; expected := expected || 'true'::text; actual := actual || got;

  begin insert into public.messages(conversation_id, sender_id, body) values (c.id, c.agent_id, 'rls-test'); got := 'ok';
  exception when others then got := sqlstate; end;
  names := names || 'B9 the blocked agent cannot message'::text; expected := expected || '42501'::text; actual := actual || got;

  begin select count(*)::text into got from public.user_blocks where blocked_id = c.agent_id;
  exception when others then got := sqlstate; end;
  names := names || 'B10 the blocked agent cannot see who blocked them'::text; expected := expected || '0'::text; actual := actual || got;
  reset role;

  -- Unblocking: only your own rows (checked from the policy, no DELETE run) ---
  select count(*)::text into got from pg_policies
  where schemaname = 'public' and tablename = 'user_blocks' and cmd = 'DELETE'
    and qual like '%blocker_id = ( SELECT auth.uid()%';
  names := names || 'B11 unblock policy is limited to your own blocks'::text; expected := expected || '1'::text; actual := actual || got;

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
