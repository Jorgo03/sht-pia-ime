-- Moderation (migration "moderation", docs/LAUNCH_TASKS.md F3).
-- Re-runnable on production: one DO block that always raises at the end, so
-- the temporary moderator, report and every change are rolled back; no DELETE.
-- Expected: RESULTS passed=12/12.
do $$
declare
  owner_u uuid; mod_u uuid; reporter uuid; pid uuid; rid uuid; got text; n int;
  names text[] := '{}'; expected text[] := '{}'; actual text[] := '{}'; report text := ''; passed int := 0;
begin
  select owner_id, id into owner_u, pid from public.properties where status = 'active' and owner_id is not null order by created_at limit 1;
  select id into reporter from public.profiles where id <> owner_u order by created_at limit 1;
  select id into mod_u from public.profiles where id not in (owner_u, reporter) order by created_at limit 1;
  if pid is null or reporter is null or mod_u is null then raise exception 'RESULTS SKIP: needs an active listing and three accounts'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', reporter, 'role', 'authenticated')::text, true); set local role authenticated;
  -- No RETURNING: reporters cannot read reports (the apps insert the same way).
  insert into public.content_reports(property_id, reason, details) values (pid, 'scam', 'rls-test');
  begin select count(*)::text into got from public.content_reports; exception when others then got := sqlstate; end;
  names := names || 'M1 a reporter still cannot read reports'::text; expected := expected || '0'::text; actual := actual || got;
  reset role;
  select id into rid from public.content_reports where reporter_id = reporter and details = 'rls-test';
  perform set_config('request.jwt.claims', json_build_object('sub', reporter, 'role', 'authenticated')::text, true); set local role authenticated;
  begin perform public.resolve_report(rid, 'dismissed', null); got := 'ok'; exception when others then got := sqlstate; end;
  names := names || 'M2 a non-moderator cannot resolve'::text; expected := expected || '42501'::text; actual := actual || got;
  begin perform public.moderate_listing(pid, true); got := 'ok'; exception when others then got := sqlstate; end;
  names := names || 'M3 a non-moderator cannot hide a listing'::text; expected := expected || '42501'::text; actual := actual || got;
  begin insert into public.moderators values (reporter, now()); got := 'ok'; exception when others then got := sqlstate; end;
  names := names || 'M4 nobody can make themselves a moderator'::text; expected := expected || '42501'::text; actual := actual || got;
  reset role;

  insert into public.moderators(user_id) values (mod_u);
  perform set_config('request.jwt.claims', json_build_object('sub', mod_u, 'role', 'authenticated')::text, true); set local role authenticated;
  select count(*)::text into got from public.content_reports where id = rid;
  names := names || 'M5 a moderator sees the report'::text; expected := expected || '1'::text; actual := actual || got;
  begin perform public.moderate_listing(pid, true); got := 'ok'; exception when others then got := sqlstate; end;
  names := names || 'M6 a moderator hides the listing'::text; expected := expected || 'ok'::text; actual := actual || got;
  begin perform public.resolve_report(rid, 'actioned', 'hidden for review'); got := 'ok'; exception when others then got := sqlstate; end;
  names := names || 'M7 a moderator resolves the report'::text; expected := expected || 'ok'::text; actual := actual || got;
  begin perform public.resolve_report(rid, 'open', null); got := 'ok'; exception when others then got := sqlstate; end;
  names := names || 'M8 only actioned or dismissed'::text; expected := expected || '22023'::text; actual := actual || got;
  reset role;
  select (status = 'pending_review' and moderation_hold)::text into got from public.properties where id = pid;
  names := names || 'M9 hidden listing is under review'::text; expected := expected || 'true'::text; actual := actual || got;

  perform set_config('request.jwt.claims', json_build_object('sub', owner_u, 'role', 'authenticated')::text, true); set local role authenticated;
  begin update public.properties set status = 'active' where id = pid; got := 'ok'; exception when others then got := sqlstate; end;
  names := names || 'M10 the owner cannot put it back online'::text; expected := expected || '42501'::text; actual := actual || got;
  begin update public.properties set moderation_hold = false where id = pid; got := 'ok'; exception when others then got := sqlstate; end;
  names := names || 'M11 the owner cannot clear the hold'::text; expected := expected || '42501'::text; actual := actual || got;
  begin update public.properties set title = title where id = pid; get diagnostics n = row_count; got := 'rows=' || n; exception when others then got := sqlstate; end;
  names := names || 'M12 the owner can still edit it'::text; expected := expected || 'rows=1'::text; actual := actual || got;
  reset role;

  for i in 1 .. array_length(names, 1) loop
    if actual[i] = expected[i] then passed := passed + 1; report := report || ' | ' || names[i] || ' PASS';
    else report := report || ' | ' || names[i] || ' FAIL [expected ' || expected[i] || ', got ' || coalesce(actual[i], 'null') || ']'; end if;
  end loop;
  raise exception 'RESULTS passed=%/% %', passed, array_length(names, 1), report;
end $$;
