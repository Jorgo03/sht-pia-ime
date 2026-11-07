-- Insert guards for conversations and viewings
-- (supabase/pending/guard_conversation_viewing_insert.sql; BUG_REPORT.md QA-01, QA-02).
-- One DO block that always ends in `raise exception 'RESULTS …'`, so every
-- write is rolled back. Expected after the guards are applied: passed=9/9.
-- Before they are applied, checks 1, 2, 3, 5, 6, 7 and 9 fail (2/9): that is the bug.
do $$
declare
  prop uuid; owner uuid; agent uuid; buyer uuid; stranger uuid;
  cid uuid; unread int; st text;
  passed int := 0; total int := 9; log text := '';
begin
  select p.id, p.owner_id, coalesce(p.agent_id, p.owner_id) into prop, owner, agent
  from public.properties p where p.status = 'active' limit 1;
  select id into buyer from public.profiles where id not in (owner, agent) limit 1;
  select id into stranger from public.profiles where id not in (owner, agent, buyer) limit 1;
  if prop is null or buyer is null or stranger is null then
    raise exception 'RESULTS SKIP: needs an active listing and two other accounts';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', buyer, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 1. A new viewing cannot start confirmed.
  begin
    insert into public.viewings(property_id, client_id, agent_id, scheduled_at, status)
      values (prop, buyer, agent, now() + interval '1 day', 'confirmed');
    log := log || '1:FAIL ';
  exception when others then passed := passed + 1; end;

  -- 2. A viewing goes to the listing's agent or owner, not a stranger.
  begin
    insert into public.viewings(property_id, client_id, agent_id, scheduled_at)
      values (prop, buyer, stranger, now() + interval '1 day');
    log := log || '2:FAIL ';
  exception when others then passed := passed + 1; end;

  -- 3. Not in the past.
  begin
    insert into public.viewings(property_id, client_id, agent_id, scheduled_at)
      values (prop, buyer, agent, now() - interval '1 day');
    log := log || '3:FAIL ';
  exception when others then passed := passed + 1; end;

  -- 4. What the apps send is accepted and starts as requested.
  begin
    insert into public.viewings(property_id, client_id, agent_id, scheduled_at)
      values (prop, buyer, agent, now() + interval '1 day') returning status into st;
    if st = 'requested' then passed := passed + 1; else log := log || '4:FAIL(status) '; end if;
  exception when others then log := log || '4:FAIL(' || sqlerrm || ') '; end;

  -- 5. A conversation goes to the listing's agent or owner, not a stranger.
  begin
    insert into public.conversations(property_id, client_id, agent_id) values (prop, buyer, stranger);
    log := log || '5:FAIL ';
  exception when others then passed := passed + 1; end;

  -- 6. A conversation is about a listing.
  begin
    insert into public.conversations(property_id, client_id, agent_id) values (null, buyer, agent);
    log := log || '6:FAIL ';
  exception when others then passed := passed + 1; end;

  -- 8 and 9. What the apps send is accepted; preset counters are reset.
  begin
    insert into public.conversations(property_id, client_id, agent_id, unread_for_agent)
      values (prop, buyer, agent, 999) returning id, unread_for_agent into cid, unread;
    passed := passed + 1;
    if unread = 0 then passed := passed + 1; else log := log || '9:FAIL(unread=' || unread || ') '; end if;
  exception when others then log := log || '8:FAIL(' || sqlerrm || ') '; end;

  -- 7. Nobody starts a conversation with themselves (as the listing's agent).
  perform set_config('request.jwt.claims', json_build_object('sub', agent, 'role', 'authenticated')::text, true);
  begin
    insert into public.conversations(property_id, client_id, agent_id) values (prop, agent, agent);
    log := log || '7:FAIL ';
  exception when others then passed := passed + 1; end;

  reset role;
  raise exception 'RESULTS passed=%/% %', passed, total, log;
end $$;
