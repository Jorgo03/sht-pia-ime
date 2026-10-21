-- Profile photo editing (migration 20261021003934, docs/LAUNCH_TASKS.md F12).
-- Re-runnable on production: one DO block that always raises at the end, so
-- every change is rolled back; no DELETE. Expected: RESULTS passed=9/9.
do $$
declare
  me uuid; other uuid; got text; n int;
  base text := 'https://xzzzhlwmzotibrxdqmcm.supabase.co/storage/v1/object/public/avatars/';
  names text[] := '{}'; expected text[] := '{}'; actual text[] := '{}';
  report text := ''; passed int := 0;
begin
  select id into me from public.profiles where role = 'agent' order by created_at limit 1;
  select id into other from public.profiles where role = 'agent' and id <> me order by created_at limit 1;
  if me is null or other is null then raise exception 'RESULTS SKIP: needs two agents'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', me, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin update public.profiles set avatar_url = base || me || '/avatar-1.jpg' where id = me; get diagnostics n = row_count; got := 'rows=' || n; exception when others then got := sqlstate; end;
  names := names || 'A1 own avatars file'::text; expected := expected || 'rows=1'::text; actual := actual || got;
  begin update public.profiles set avatar_url = null where id = me; get diagnostics n = row_count; got := 'rows=' || n; exception when others then got := sqlstate; end;
  names := names || 'A2 remove photo'::text; expected := expected || 'rows=1'::text; actual := actual || got;
  begin update public.profiles set avatar_url = 'https://evil.example/pixel.gif' where id = me; got := 'ok'; exception when others then got := sqlstate; end;
  names := names || 'A3 third-party URL'::text; expected := expected || '42501'::text; actual := actual || got;
  begin update public.profiles set avatar_url = base || other || '/avatar-1.jpg' where id = me; got := 'ok'; exception when others then got := sqlstate; end;
  names := names || 'A4 someone else''s folder'::text; expected := expected || '42501'::text; actual := actual || got;
  begin update public.profiles set avatar_url = base || me || '/../' || other || '/x.jpg' where id = me; got := 'ok'; exception when others then got := sqlstate; end;
  names := names || 'A5 path traversal'::text; expected := expected || '42501'::text; actual := actual || got;
  begin update public.profiles set avatar_url = replace(base, 'avatars', 'property-images') || me || '/a.jpg' where id = me; got := 'ok'; exception when others then got := sqlstate; end;
  names := names || 'A6 wrong bucket'::text; expected := expected || '42501'::text; actual := actual || got;
  begin update public.profiles set avatar_url = base || me || '/a.jpg' where id = other; get diagnostics n = row_count; got := 'rows=' || n; exception when others then got := sqlstate; end;
  names := names || 'A7 another user''s profile'::text; expected := expected || 'rows=0'::text; actual := actual || got;
  begin update public.profiles set full_name = full_name where id = me; get diagnostics n = row_count; got := 'rows=' || n; exception when others then got := sqlstate; end;
  names := names || 'A8 untouched avatar does not block other edits'::text; expected := expected || 'rows=1'::text; actual := actual || got;
  reset role;
  begin update public.profiles set avatar_url = 'https://lh3.googleusercontent.com/x' where id = me; get diagnostics n = row_count; got := 'rows=' || n; exception when others then got := sqlstate; end;
  names := names || 'A9 server side (sign-up copy) unaffected'::text; expected := expected || 'rows=1'::text; actual := actual || got;

  for i in 1 .. array_length(names, 1) loop
    if actual[i] = expected[i] then passed := passed + 1; report := report || ' | ' || names[i] || ' PASS';
    else report := report || ' | ' || names[i] || ' FAIL [expected ' || expected[i] || ', got ' || coalesce(actual[i], 'null') || ']'; end if;
  end loop;
  raise exception 'RESULTS passed=%/% %', passed, array_length(names, 1), report;
end $$;
