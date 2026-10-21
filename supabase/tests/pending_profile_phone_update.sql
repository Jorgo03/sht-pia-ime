-- Pre-apply check for supabase/pending/profile_phone_update.sql (L12).
-- Applies the pending grant and CHECK inside one DO block, tests them, then
-- raises an exception so ALL of it is rolled back: the database is left
-- exactly as it was. Expected: RESULTS passed=8/8. Run before applying; after
-- applying, G0 fails by design (the grant then exists).
-- Note: ALTER TABLE briefly locks `profiles` for the length of the block.
do $$
declare
  me uuid; other uuid; got text; n int;
  names text[] := '{}'; expected text[] := '{}'; actual text[] := '{}';
  report text := ''; passed int := 0;
begin
  select id into me from public.profiles where role = 'agent' order by created_at limit 1;
  select id into other from public.profiles where role = 'agent' and id <> me order by created_at limit 1;
  if me is null or other is null then raise exception 'RESULTS SKIP: needs two agents'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', me, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin update public.profiles set phone = '+355 69 123 4567' where id = me; got := 'ok';
  exception when others then got := sqlstate; end;
  names := names || 'G0 before the grant, phone is not writable'::text; expected := expected || '42501'::text; actual := actual || got;
  reset role;

  -- The pending migration, verbatim.
  alter table public.profiles
    add constraint profiles_phone_format
    check (phone is null or (phone ~ '^\+?[0-9 ()-]{6,32}$' and length(regexp_replace(phone, '\D', '', 'g')) >= 6))
    not valid;
  alter table public.profiles validate constraint profiles_phone_format;
  grant update (phone) on public.profiles to authenticated;

  perform set_config('request.jwt.claims', json_build_object('sub', me, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin update public.profiles set phone = '+355 69 123 4567' where id = me; get diagnostics n = row_count; got := 'rows=' || n;
  exception when others then got := sqlstate; end;
  names := names || 'G1 owner sets own phone'::text; expected := expected || 'rows=1'::text; actual := actual || got;
  begin update public.profiles set phone = null where id = me; get diagnostics n = row_count; got := 'rows=' || n;
  exception when others then got := sqlstate; end;
  names := names || 'G2 owner clears own phone'::text; expected := expected || 'rows=1'::text; actual := actual || got;
  begin update public.profiles set phone = 'call me maybe' where id = me; got := 'ok';
  exception when others then got := sqlstate; end;
  names := names || 'G3 not a phone number'::text; expected := expected || '23514'::text; actual := actual || got;
  begin update public.profiles set phone = '+355 69 000 0000' where id = other; get diagnostics n = row_count; got := 'rows=' || n;
  exception when others then got := sqlstate; end;
  names := names || 'G4 someone else''s phone'::text; expected := expected || 'rows=0'::text; actual := actual || got;
  begin update public.profiles set role = 'buyer' where id = me; got := 'ok';
  exception when others then got := sqlstate; end;
  names := names || 'G5 role still not writable'::text; expected := expected || '42501'::text; actual := actual || got;
  begin update public.profiles set full_name = full_name where id = me; get diagnostics n = row_count; got := 'rows=' || n;
  exception when others then got := sqlstate; end;
  names := names || 'G6 name still writable'::text; expected := expected || 'rows=1'::text; actual := actual || got;
  reset role;

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin update public.profiles set phone = '+355 69 000 0000' where id = me; get diagnostics n = row_count; got := case when n = 0 then 'refused' else 'rows=' || n end;
  exception when insufficient_privilege then got := 'refused'; when others then got := sqlstate; end;
  names := names || 'G7 signed out cannot write'::text; expected := expected || 'refused'::text; actual := actual || got;
  reset role;

  for i in 1 .. array_length(names, 1) loop
    if actual[i] = expected[i] then passed := passed + 1; report := report || ' | ' || names[i] || ' PASS';
    else report := report || ' | ' || names[i] || ' FAIL [expected ' || expected[i] || ', got ' || coalesce(actual[i], 'null') || ']'; end if;
  end loop;
  raise exception 'RESULTS passed=%/% %', passed, array_length(names, 1), report;
end $$;
