-- Moderator read access (migration "moderation_read_access", F3).
-- Re-runnable on production: one DO block that always raises at the end, so
-- the temporary moderator and every change are rolled back; no DELETE.
-- Expected: RESULTS passed=6/6.
do $$
declare
  owner_u uuid; mod_u uuid; other uuid; pid uuid; buyer uuid; got text;
  names text[] := '{}'; expected text[] := '{}'; actual text[] := '{}'; report text := ''; passed int := 0;
begin
  select owner_id, id into owner_u, pid from public.properties where status = 'active' and owner_id is not null order by created_at limit 1;
  select id into mod_u from public.profiles where id <> owner_u order by created_at limit 1;
  select id into other from public.profiles where id not in (owner_u, mod_u) order by created_at limit 1;
  select id into buyer from public.profiles where role <> 'agent' and id not in (mod_u, other) order by created_at limit 1;
  if pid is null or other is null or buyer is null then raise exception 'RESULTS SKIP: needs an active listing, a buyer and three accounts'; end if;

  update public.properties set status = 'pending_review', moderation_hold = true where id = pid;

  perform set_config('request.jwt.claims', json_build_object('sub', other, 'role', 'authenticated')::text, true); set local role authenticated;
  select count(*)::text into got from public.properties where id = pid;
  names := names || 'R1 others cannot see a listing under review'::text; expected := expected || '0'::text; actual := actual || got;
  select count(*)::text into got from public.profiles where id = buyer and buyer <> other;
  names := names || 'R2 a stranger cannot see a buyer profile'::text; expected := expected || '0'::text; actual := actual || got;
  reset role;

  insert into public.moderators(user_id) values (mod_u);
  perform set_config('request.jwt.claims', json_build_object('sub', mod_u, 'role', 'authenticated')::text, true); set local role authenticated;
  select count(*)::text into got from public.properties where id = pid;
  names := names || 'R3 a moderator sees the listing under review'::text; expected := expected || '1'::text; actual := actual || got;
  select count(*)::text into got from public.profiles where id = buyer;
  names := names || 'R4 a moderator sees the reported buyer'::text; expected := expected || '1'::text; actual := actual || got;
  begin update public.properties set title = 'x' where id = pid; get diagnostics passed = row_count; got := 'rows=' || passed; passed := 0; exception when others then got := sqlstate; end;
  names := names || 'R5 reading is not editing'::text; expected := expected || 'rows=0'::text; actual := actual || got;
  begin update public.profiles set full_name = 'x' where id = buyer; get diagnostics passed = row_count; got := 'rows=' || passed; passed := 0; exception when others then got := sqlstate; end;
  names := names || 'R6 nor editing a profile'::text; expected := expected || 'rows=0'::text; actual := actual || got;
  reset role;

  for i in 1 .. array_length(names, 1) loop
    if actual[i] = expected[i] then passed := passed + 1; report := report || ' | ' || names[i] || ' PASS';
    else report := report || ' | ' || names[i] || ' FAIL [expected ' || expected[i] || ', got ' || coalesce(actual[i], 'null') || ']'; end if;
  end loop;
  raise exception 'RESULTS passed=%/% %', passed, array_length(names, 1), report;
end $$;
