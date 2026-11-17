-- Saved-search email alerts (migration 20261021051016, docs/LAUNCH_TASKS.md F13).
-- Re-runnable on production: one DO block that always raises at the end, so
-- every change is rolled back; no DELETE. Expected: RESULTS passed=7/7.
do $$
declare s record; other uuid; got text; pid uuid;
  names text[] := '{}'; expected text[] := '{}'; actual text[] := '{}'; report text := ''; passed int := 0;
begin
  select * into s from public.saved_searches limit 1;
  select id into other from public.profiles where id <> s.user_id limit 1;
  select id into pid from public.properties where status = 'active' limit 1;
  if s.id is null or other is null or pid is null then raise exception 'RESULTS SKIP: needs a saved search, a second user and an active listing'; end if;
  got := (select count(distinct unsubscribe_token) = count(*) from public.saved_searches)::text;
  names := names || 'S1 every search has its own unsubscribe token'::text; expected := expected || 'true'::text; actual := actual || got;

  perform set_config('request.jwt.claims', json_build_object('sub', s.user_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin update public.saved_searches set email_alerts = true where id = s.id; got := 'ok'; exception when others then got := sqlstate; end;
  names := names || 'S2 owner opts in'::text; expected := expected || 'ok'::text; actual := actual || got;
  begin select count(*)::text into got from public.email_outbox; exception when others then got := sqlstate; end;
  names := names || 'S3 apps cannot read the outbox'::text; expected := expected || '42501'::text; actual := actual || got;
  begin insert into public.saved_search_alert_deliveries values (s.id, pid, now()); got := 'ok'; exception when others then got := sqlstate; end;
  names := names || 'S4 apps cannot write deliveries'::text; expected := expected || '42501'::text; actual := actual || got;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', other, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin select count(*)::text into got from public.saved_searches where unsubscribe_token = s.unsubscribe_token; exception when others then got := sqlstate; end;
  names := names || 'S5 another user cannot see the token'::text; expected := expected || '0'::text; actual := actual || got;
  reset role;
  insert into public.saved_search_alert_deliveries values (s.id, pid, now()) on conflict do nothing;
  begin insert into public.saved_search_alert_deliveries values (s.id, pid, now()); got := 'ok'; exception when others then got := sqlstate; end;
  names := names || 'S6 same listing twice for a search is refused'::text; expected := expected || '23505'::text; actual := actual || got;
  insert into public.email_outbox(kind, user_id, subject, body_text, body_html, dedupe_key) values ('saved_search_alert', s.user_id, 's', 't', 'h', 'rls-test-k1');
  begin insert into public.email_outbox(kind, user_id, subject, body_text, body_html, dedupe_key) values ('saved_search_alert', s.user_id, 's', 't', 'h', 'rls-test-k1'); got := 'ok'; exception when others then got := sqlstate; end;
  names := names || 'S7 same email twice is refused'::text; expected := expected || '23505'::text; actual := actual || got;

  for i in 1 .. array_length(names, 1) loop
    if actual[i] = expected[i] then passed := passed + 1; report := report || ' | ' || names[i] || ' PASS';
    else report := report || ' | ' || names[i] || ' FAIL [expected ' || expected[i] || ', got ' || coalesce(actual[i], 'null') || ']'; end if;
  end loop;
  raise exception 'RESULTS passed=%/% %', passed, array_length(names, 1), report;
end $$;
