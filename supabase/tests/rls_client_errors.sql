-- Error reports (client_errors, docs/LAUNCH_TASKS.md F11).
-- Re-runnable on production: one DO block that always raises at the end, so
-- every inserted report is rolled back; no DELETE. Expected: passed=7/7.
do $$
declare got text; i int;
  names text[] := '{}'; expected text[] := '{}'; actual text[] := '{}'; report text := ''; passed int := 0;
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin insert into public.client_errors(platform, app_version, route, kind, message, stack, fingerprint)
    values ('web', '1.0.0', '/property/abc?token=secret#x', 'render',
      'Failed for ana@example.com +355 69 123 4567 Bearer abc.def eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig id 9c47f15e-3359-4716-910e-315d2a5e2518',
      'at x (main.js:1:2)', 'rlstest1'); got := 'ok';
  exception when others then got := sqlstate; end;
  names := names || 'E1 signed out can report'::text; expected := expected || 'ok'::text; actual := actual || got;
  begin select count(*)::text into got from public.client_errors; exception when others then got := sqlstate; end;
  names := names || 'E2 signed out cannot read'::text; expected := expected || '42501'::text; actual := actual || got;
  begin insert into public.client_errors(platform, kind, message, fingerprint, created_at) values ('web','render','x','rlstest1', now() - interval '1 year'); got := 'ok';
  exception when others then got := sqlstate; end;
  names := names || 'E3 cannot set other columns'::text; expected := expected || '42501'::text; actual := actual || got;
  begin insert into public.client_errors(platform, kind, message, fingerprint) values ('desktop','render','x','rlstest1'); got := 'ok';
  exception when others then got := sqlstate; end;
  names := names || 'E4 invalid platform'::text; expected := expected || '23514'::text; actual := actual || got;
  for i in 1..25 loop
    insert into public.client_errors(platform, kind, message, fingerprint) values ('ios','uncaught','boom','rlstest2');
  end loop;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles limit 1), 'role','authenticated')::text, true);
  set local role authenticated;
  begin select count(*)::text into got from public.client_errors; exception when others then got := sqlstate; end;
  names := names || 'E5 signed in cannot read'::text; expected := expected || '42501'::text; actual := actual || got;
  reset role;
  select count(*)::text into got from public.client_errors where fingerprint = 'rlstest2';
  names := names || 'E6 flood guard keeps 20 of 25'::text; expected := expected || '20'::text; actual := actual || got;
  select message || ' ROUTE ' || route into got from public.client_errors where fingerprint = 'rlstest1';
  names := names || 'E7 redacted on the server'::text;
  expected := expected || 'Failed for <redacted> <redacted> <redacted> <redacted> id <redacted> ROUTE /property/abc'::text; actual := actual || got;
  for i in 1 .. array_length(names, 1) loop
    if actual[i] = expected[i] then passed := passed + 1; report := report || ' | ' || names[i] || ' PASS';
    else report := report || ' | ' || names[i] || ' FAIL [expected ' || expected[i] || ', got ' || coalesce(actual[i], 'null') || ']'; end if;
  end loop;
  raise exception 'RESULTS passed=%/% %', passed, array_length(names, 1), report;
end $$;
