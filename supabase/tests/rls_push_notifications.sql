-- Push notifications (migration 20261021051557, docs/LAUNCH_TASKS.md F14).
-- Re-runnable on production: one DO block that always raises at the end, so
-- every token, preference, message and queued push is rolled back; no DELETE.
-- Expected: RESULTS passed=11/11.
do $$
declare c record; v record; got text; n int; tok text := 'ExponentPushToken[rlsTestToken0001]'; tok2 text := 'ExponentPushToken[rlsTestToken0002]';
  names text[] := '{}'; expected text[] := '{}'; actual text[] := '{}'; report text := ''; passed int := 0;
begin
  select * into c from public.conversations order by created_at limit 1;
  select * into v from public.viewings where agent_id is not null order by created_at limit 1;
  if c.id is null or v.id is null then raise exception 'RESULTS SKIP: needs a conversation and a viewing'; end if;

  perform set_config('request.jwt.claims', '{"role":"anon"}', true); set local role anon;
  begin perform public.register_push_token(tok, 'ios'); got := 'ok'; exception when others then got := sqlstate; end;
  names := names || 'P1 signed out cannot register'::text; expected := expected || '42501'::text; actual := actual || got;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', c.client_id, 'role', 'authenticated')::text, true); set local role authenticated;
  begin perform public.register_push_token(tok, 'ios'); select count(*)::text into got from public.push_tokens; exception when others then got := sqlstate; end;
  names := names || 'P2 client registers a device and sees it'::text; expected := expected || '1'::text; actual := actual || got;
  begin perform public.register_push_token('not-a-token', 'ios'); got := 'ok'; exception when others then got := sqlstate; end;
  names := names || 'P3 malformed token refused'::text; expected := expected || '23514'::text; actual := actual || got;
  begin insert into public.push_tokens(token, user_id, platform) values (tok2, c.agent_id, 'ios'); got := 'ok'; exception when others then got := sqlstate; end;
  names := names || 'P4 no direct inserts (cannot register for someone else)'::text; expected := expected || '42501'::text; actual := actual || got;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', c.agent_id, 'role', 'authenticated')::text, true); set local role authenticated;
  perform public.register_push_token(tok2, 'android');
  select count(*)::text into got from public.push_tokens where token = tok;
  names := names || 'P5 agent cannot see the client''s device'::text; expected := expected || '0'::text; actual := actual || got;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', c.client_id, 'role', 'authenticated')::text, true); set local role authenticated;
  begin insert into public.messages(conversation_id, sender_id, body) values (c.id, c.client_id, 'secret text'); get diagnostics n = row_count; got := 'rows=' || n; exception when others then got := sqlstate; end;
  names := names || 'P6 message still saves'::text; expected := expected || 'rows=1'::text; actual := actual || got;
  begin select count(*)::text into got from public.push_outbox; exception when others then got := sqlstate; end;
  names := names || 'P7 apps cannot read the push queue'::text; expected := expected || '42501'::text; actual := actual || got;
  reset role;
  select (count(*) = 1 and bool_and(kind = 'message' and data::text not like '%secret%'))::text into got from public.push_outbox where user_id = c.agent_id;
  names := names || 'P8 agent gets one push, with no message text'::text; expected := expected || 'true'::text; actual := actual || got;

  perform set_config('request.jwt.claims', json_build_object('sub', c.agent_id, 'role', 'authenticated')::text, true); set local role authenticated;
  insert into public.notification_preferences(messages) values (false);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', c.client_id, 'role', 'authenticated')::text, true); set local role authenticated;
  insert into public.messages(conversation_id, sender_id, body) values (c.id, c.client_id, 'second');
  reset role;
  select count(*)::text into got from public.push_outbox where user_id = c.agent_id;
  names := names || 'P9 preference off stops new pushes'::text; expected := expected || '1'::text; actual := actual || got;

  perform set_config('request.jwt.claims', json_build_object('sub', c.agent_id, 'role', 'authenticated')::text, true); set local role authenticated;
  perform public.register_push_token(tok, 'ios');
  reset role;
  select (user_id = c.agent_id)::text into got from public.push_tokens where token = tok;
  names := names || 'P10 a device moves to the new signed-in user'::text; expected := expected || 'true'::text; actual := actual || got;

  perform set_config('request.jwt.claims', json_build_object('sub', v.agent_id, 'role', 'authenticated')::text, true); set local role authenticated;
  begin update public.viewings set status = case when v.status = 'declined' then 'confirmed' else 'declined' end where id = v.id; get diagnostics n = row_count; got := 'rows=' || n; exception when others then got := sqlstate; end;
  names := names || 'P11 viewing change still saves'::text; expected := expected || 'rows=1'::text; actual := actual || got;
  reset role;

  for i in 1 .. array_length(names, 1) loop
    if actual[i] = expected[i] then passed := passed + 1; report := report || ' | ' || names[i] || ' PASS';
    else report := report || ' | ' || names[i] || ' FAIL [expected ' || expected[i] || ', got ' || coalesce(actual[i], 'null') || ']'; end if;
  end loop;
  raise exception 'RESULTS passed=%/% %', passed, array_length(names, 1), report;
end $$;
