-- Full RLS write matrix: every public table, as a signed-out visitor (anon),
-- the row's owner, and another signed-in account (non-owner).
-- Written for AUDIT_REPORT.md (2026-11-13). One DO block that always ends in
-- `raise exception 'RESULTS …'`, so every write is rolled back. No DELETE of
-- real rows survives: deletes run inside the same rolled-back block.
--
-- Read isolation is covered by rls_isolation.sql; this file covers writes.
-- Checks marked [BUG?] record behaviour the audit questions (they PASS when the
-- database refuses, FAIL when it accepts). Expected after the audit fixes:
-- everything passes.
-- Result live 2026-11-13 (before fixes): passed=48/51, failing D1, D2, D3
-- (AUDIT_REPORT.md AUDIT-003 and AUDIT-004). All 27 anon inserts: 42501.
-- Result live 2026-11-13 after migrations 20261113194202/194212/194218 were
-- applied: passed=51/51.
do $$
declare
  a uuid; b uuid; agent uuid; prop uuid; prop_status text;
  n int; vid uuid; vid2 uuid; fav uuid; ss uuid; wh uuid; ld uuid;
  passed int := 0; total int := 0; log text := '';
  t text;
  anon_tables text[] := array['favorites','saved_searches','wanted_homes','leads','viewings',
    'conversations','messages','properties','content_reports','user_blocks','notifications',
    'push_tokens','notification_preferences','agent_performance_baselines','ai_usage',
    'payment_events','email_outbox','push_outbox','push_settings','plans','moderators',
    'listing_promotions','agency_subscriptions','property_status_events',
    'saved_search_alert_deliveries','property_views','profiles'];
begin
  select p.id, coalesce(p.agent_id, p.owner_id), p.status into prop, agent, prop_status
  from public.properties p where p.status = 'active' order by p.created_at limit 1;
  select id into a from public.profiles where id <> agent
    and not exists (select 1 from public.moderators m where m.user_id = profiles.id)
    order by created_at limit 1;
  select id into b from public.profiles where id not in (agent, a)
    and not exists (select 1 from public.moderators m where m.user_id = profiles.id)
    order by created_at limit 1;
  if prop is null or a is null or b is null then
    raise exception 'RESULTS SKIP: needs an active listing and two other accounts';
  end if;

  ------------------------------------------------------------------ anon
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  -- A1..A27: a signed-out visitor cannot insert into any table (except the
  -- deliberately open client_errors / property_activity, tested separately).
  foreach t in array anon_tables loop
    total := total + 1;
    begin
      execute format('insert into public.%I default values', t);
      log := log || 'anon-insert:' || t || ':FAIL ';
    exception
      -- 42501 = permission denied or row-level security refused it.
      when insufficient_privilege then passed := passed + 1;
      when others then log := log || 'anon-insert:' || t || ':INCONCLUSIVE(' || sqlstate || ') ';
    end;
  end loop;
  -- A28: anon cannot update or delete listings.
  -- Since migration 20261113194218 the attempt is refused outright (42501);
  -- before it, RLS made it touch 0 rows. Both pass.
  total := total + 1;
  begin
    update public.properties set title = 'x' where id = prop;
    get diagnostics n = row_count;
    delete from public.properties where id = prop;
    if n = 0 and exists (select 1 from public.properties where id = prop) then passed := passed + 1;
    else log := log || 'anon-update-listing:FAIL '; end if;
  exception when insufficient_privilege then passed := passed + 1; end;
  reset role;

  ------------------------------------------------------------------ owner A creates own rows
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  total := total + 1;
  begin
    delete from public.favorites where user_id = a and property_id = prop;
    insert into public.favorites(user_id, property_id) values (a, prop) returning id into fav;
    insert into public.saved_searches(user_id, name, filters) values (a, 'audit', '{}'::jsonb) returning id into ss;
    insert into public.wanted_homes(client_id, city, listing_type) values (a, 'Tirane', 'sale') returning id into wh;
    insert into public.viewings(property_id, client_id, agent_id, scheduled_at)
      values (prop, a, agent, date_trunc('hour', now()) + interval '3 days') returning id into vid;
    passed := passed + 1;  -- O1: owner can create own rows
  exception when others then log := log || 'O1:FAIL(' || sqlerrm || ') '; end;
  reset role;

  ------------------------------------------------------------------ non-owner B
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- N1: B cannot create rows owned by A.
  total := total + 1;
  begin insert into public.favorites(user_id, property_id) values (a, prop);
    log := log || 'N1:FAIL '; exception when others then passed := passed + 1; end;
  total := total + 1;
  begin insert into public.saved_searches(user_id, name, filters) values (a, 'x', '{}');
    log := log || 'N2:FAIL '; exception when others then passed := passed + 1; end;
  total := total + 1;
  begin insert into public.wanted_homes(client_id, city, listing_type) values (a, 'Tirane', 'sale');
    log := log || 'N3:FAIL '; exception when others then passed := passed + 1; end;
  total := total + 1;
  begin insert into public.leads(agent_id, name) values (a, 'x');
    log := log || 'N4:FAIL '; exception when others then passed := passed + 1; end;
  total := total + 1;
  begin insert into public.viewings(property_id, client_id, agent_id, scheduled_at)
      values (prop, a, agent, now() + interval '2 days');
    log := log || 'N5:FAIL '; exception when others then passed := passed + 1; end;
  total := total + 1;
  begin insert into public.notifications(user_id, kind, dedupe_key) values (a, 'x', 'audit');
    log := log || 'N6:FAIL '; exception when others then passed := passed + 1; end;
  total := total + 1;
  begin insert into public.push_tokens(token, user_id, platform) values ('ExponentPushToken[audit]', b, 'ios');
    log := log || 'N7:FAIL(direct push_tokens insert) '; exception when others then passed := passed + 1; end;
  total := total + 1;
  begin insert into public.moderators(user_id) values (b);
    log := log || 'N8:FAIL(self-made moderator) '; exception when others then passed := passed + 1; end;
  total := total + 1;
  begin insert into public.plans(id, kind, price_cents) values ('audit', 'listing', 0);
    log := log || 'N9:FAIL '; exception when others then passed := passed + 1; end;
  total := total + 1;
  begin insert into public.listing_promotions(property_id, buyer_id, plan_id, starts_at, ends_at, provider, provider_ref)
      values (prop, b, (select id from public.plans limit 1), now(), now() + interval '30 days', 'x', 'x');
    log := log || 'N10:FAIL(free promotion) '; exception when others then passed := passed + 1; end;
  total := total + 1;
  begin insert into public.content_reports(reporter_id, property_id, reason, status) values (b, prop, 'spam', 'resolved');
    log := log || 'N11:FAIL(report pre-resolved) '; exception when others then passed := passed + 1; end;
  total := total + 1;
  begin insert into public.user_blocks(blocker_id, blocked_id) values (a, b);
    log := log || 'N12:FAIL(block on behalf) '; exception when others then passed := passed + 1; end;

  -- N13..N19: B cannot change or remove A's rows (RLS hides them: 0 rows).
  total := total + 1;
  update public.favorites set property_id = prop where id = fav; get diagnostics n = row_count;
  if n = 0 then passed := passed + 1; else log := log || 'N13:FAIL '; end if;
  total := total + 1;
  delete from public.saved_searches where id = ss; get diagnostics n = row_count;
  if n = 0 then passed := passed + 1; else log := log || 'N14:FAIL '; end if;
  total := total + 1;
  update public.wanted_homes set notes = 'x' where id = wh; get diagnostics n = row_count;
  if n = 0 then passed := passed + 1; else log := log || 'N15:FAIL '; end if;
  total := total + 1;
  update public.viewings set status = 'cancelled' where id = vid; get diagnostics n = row_count;
  if n = 0 then passed := passed + 1; else log := log || 'N16:FAIL '; end if;
  total := total + 1;
  update public.properties set title = 'x' where id = prop; get diagnostics n = row_count;
  if n = 0 then passed := passed + 1; else log := log || 'N17:FAIL '; end if;
  total := total + 1;
  update public.profiles set full_name = 'x' where id = a; get diagnostics n = row_count;
  if n = 0 then passed := passed + 1; else log := log || 'N18:FAIL '; end if;
  total := total + 1;
  begin
    update public.profiles set role = 'agent' where id = b; get diagnostics n = row_count;
    if n = 0 then passed := passed + 1; else log := log || 'N19:FAIL(self role change) '; end if;
  exception when others then passed := passed + 1; end;

  -- D1 [BUG?]: a second client books the same listing at the same moment as A.
  total := total + 1;
  begin
    insert into public.viewings(property_id, client_id, agent_id, scheduled_at)
      values (prop, b, agent, date_trunc('hour', now()) + interval '3 days') returning id into vid2;
    log := log || 'D1:FAIL(double booking accepted) ';
  exception when others then passed := passed + 1; end;
  reset role;

  -- D2 [BUG?]: once the agent confirms A's viewing, A moves it to another time
  -- without the agent seeing a new request.
  perform set_config('request.jwt.claims', json_build_object('sub', agent, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.viewings set status = 'confirmed' where id = vid;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  total := total + 1;
  begin
    update public.viewings set scheduled_at = scheduled_at + interval '5 hours' where id = vid and status = 'confirmed';
    get diagnostics n = row_count;
    -- Fixed behaviour: the move is accepted but the viewing is back to requested.
    if n = 0 or not exists (select 1 from public.viewings where id = vid and status = 'confirmed') then passed := passed + 1;
    else log := log || 'D2:FAIL(confirmed viewing re-timed by client, stays confirmed) '; end if;
  exception when others then passed := passed + 1; end;
  -- D3 [BUG?]: A moves the viewing into the past.
  total := total + 1;
  begin
    update public.viewings set scheduled_at = now() - interval '30 days' where id = vid;
    get diagnostics n = row_count;
    if n = 0 then passed := passed + 1; else log := log || 'D3:FAIL(viewing moved into the past) '; end if;
  exception when others then passed := passed + 1; end;
  reset role;

  raise exception 'RESULTS passed=%/% %', passed, total, log;
end $$;
