-- Viewing schedule integrity (AUDIT-003 double booking, AUDIT-004 re-timing).
-- One DO block that always ends in `raise exception 'RESULTS …'`, so every
-- write (including its fixture listing) is rolled back. Expected: passed=12/12.
-- Before the fix (live 2026-11-13): S1, S2, S4, S6, S7, S9 and S10 fail.
do $$
declare
  p uuid; p2 uuid; agent uuid; c1 uuid; c2 uuid;
  t0 timestamptz := date_trunc('hour', now()) + interval '41 days' + interval '9 hours';
  v1 uuid; v3 uuid; st text; n int;
  passed int := 0; total int := 0; log text := '';
begin
  select pr.id, coalesce(pr.agent_id, pr.owner_id) into p, agent
  from public.properties pr where pr.status = 'active' order by pr.created_at limit 1;
  select id into c1 from public.profiles where id <> agent order by created_at limit 1;
  select id into c2 from public.profiles where id not in (agent, c1) order by created_at limit 1;
  if p is null or c1 is null or c2 is null then
    raise exception 'RESULTS SKIP: needs an active listing and two other accounts';
  end if;
  -- A second listing with the same agent, so the agent's own calendar is tested.
  insert into public.properties(owner_id, agent_id, owner_type, title, address, price, sqft, beds, baths, city, listing_type, property_type, status)
    values (agent, null, 'agent', 'qa-viewing', 'x', 1, 1, 0, 0, 'Tiranë', 'sale', 'apartment', 'active') returning id into p2;

  -- c1 books t0.
  perform set_config('request.jwt.claims', json_build_object('sub', c1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  total := total + 1;
  begin
    insert into public.viewings(property_id, client_id, agent_id, scheduled_at) values (p, c1, agent, t0) returning id into v1;
    passed := passed + 1;  -- S0
  exception when others then raise exception 'RESULTS SKIP: base viewing refused (%)', sqlerrm; end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', c2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  -- S1. Same listing, same moment: refused.
  total := total + 1;
  begin insert into public.viewings(property_id, client_id, agent_id, scheduled_at) values (p, c2, agent, t0);
    log := log || 'S1 '; exception when others then passed := passed + 1; end;
  -- S2. Same listing, inside the first one's 30 minutes: refused.
  total := total + 1;
  begin insert into public.viewings(property_id, client_id, agent_id, scheduled_at) values (p, c2, agent, t0 + interval '15 minutes');
    log := log || 'S2 '; exception when others then passed := passed + 1; end;
  -- S3. Back to back (starts when the first ends): accepted.
  total := total + 1;
  begin insert into public.viewings(property_id, client_id, agent_id, scheduled_at) values (p, c2, agent, t0 + interval '30 minutes') returning id into v3;
    passed := passed + 1; exception when others then log := log || 'S3(' || sqlerrm || ') '; end;
  -- S4. Same agent, another listing, same moment: refused.
  total := total + 1;
  begin insert into public.viewings(property_id, client_id, agent_id, scheduled_at) values (p2, c2, agent, t0);
    log := log || 'S4 '; exception when others then passed := passed + 1; end;
  reset role;

  -- The agent confirms c1's viewing.
  perform set_config('request.jwt.claims', json_build_object('sub', agent, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.viewings set status = 'confirmed' where id = v1;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', c1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  -- S6. The client moves a confirmed viewing: accepted, but back to requested.
  total := total + 1;
  begin
    update public.viewings set scheduled_at = t0 + interval '2 hours' where id = v1 returning status into st;
    if st = 'requested' then passed := passed + 1; else log := log || 'S6(status=' || st || ') '; end if;
  exception when others then log := log || 'S6(' || sqlerrm || ') '; end;
  -- S7. The client moves it into the past: refused.
  total := total + 1;
  begin update public.viewings set scheduled_at = now() - interval '30 days' where id = v1;
    log := log || 'S7 '; exception when others then passed := passed + 1; end;
  -- S10. The client moves it onto c2's slot: refused.
  total := total + 1;
  begin update public.viewings set scheduled_at = t0 + interval '30 minutes' where id = v1;
    log := log || 'S10 '; exception when others then passed := passed + 1; end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', agent, 'role', 'authenticated')::text, true);
  set local role authenticated;
  -- S8. The agent confirms, then moves it to a free future time: stays confirmed.
  total := total + 1;
  begin
    update public.viewings set status = 'confirmed' where id = v1;
    update public.viewings set scheduled_at = t0 + interval '3 hours' where id = v1 returning status into st;
    if st = 'confirmed' then passed := passed + 1; else log := log || 'S8(status=' || st || ') '; end if;
  exception when others then log := log || 'S8(' || sqlerrm || ') '; end;
  -- S9. Not even the agent moves it into the past.
  total := total + 1;
  begin update public.viewings set scheduled_at = now() - interval '1 day' where id = v1;
    log := log || 'S9 '; exception when others then passed := passed + 1; end;
  -- S11. Status-only changes still work (decline).
  total := total + 1;
  begin update public.viewings set status = 'declined' where id = v3; get diagnostics n = row_count;
    if n = 1 then passed := passed + 1; else log := log || 'S11 '; end if;
  exception when others then log := log || 'S11(' || sqlerrm || ') '; end;
  reset role;

  -- S12. A declined viewing frees its slot.
  perform set_config('request.jwt.claims', json_build_object('sub', c2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  total := total + 1;
  begin insert into public.viewings(property_id, client_id, agent_id, scheduled_at) values (p, c2, agent, t0 + interval '30 minutes');
    passed := passed + 1; exception when others then log := log || 'S12(' || sqlerrm || ') '; end;
  reset role;

  raise exception 'RESULTS passed=%/% %', passed, total, log;
end $$;
