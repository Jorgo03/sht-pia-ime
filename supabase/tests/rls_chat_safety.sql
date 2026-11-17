-- Chat safety (migration 20261114154750_chat_safety): reports from a chat, blocks both ways,
-- no new conversation across a block. One DO block that always ends in
-- `raise exception 'RESULTS …'`, so every write is rolled back.
-- Expected: passed=14/14. c1 writes to c2 about c2's listing; a1 is an agent;
-- `stranger` is in no conversation with them.
do $$
declare
  a1 uuid; c1 uuid; c2 uuid; stranger uuid; p uuid; p2 uuid; pa uuid; conv1 uuid;
  n int; ok boolean; passed int := 0; total int := 0; log text := '';
begin
  select id into a1 from public.profiles where role='agent' order by created_at limit 1;
  select id into c1 from public.profiles where role='buyer' order by created_at limit 1;
  select id into c2 from public.profiles where role='buyer' and id<>c1 order by created_at limit 1;
  select id into stranger from public.profiles where role='buyer' and id not in (c1, c2) order by created_at limit 1;
  if a1 is null or c1 is null or c2 is null or stranger is null then raise exception 'RESULTS SKIP'; end if;
  delete from public.user_blocks where blocker_id in (c1, c2, a1, stranger) or blocked_id in (c1, c2, a1, stranger);
  delete from public.content_reports where reporter_id in (c1, c2, stranger);
  delete from public.conversations where c1 in (client_id, agent_id) or c2 in (client_id, agent_id);
  insert into public.properties(owner_id,agent_id,owner_type,title,address,price,sqft,beds,baths,city,listing_type,property_type,status) values
    (c2,null,'client','qa-cs','x',1,1,0,0,'Tiranë','sale','apartment','active') returning id into p;
  insert into public.properties(owner_id,agent_id,owner_type,title,address,price,sqft,beds,baths,city,listing_type,property_type,status) values
    (c2,null,'client','qa-cs2','x',1,1,0,0,'Tiranë','sale','apartment','active') returning id into p2;
  insert into public.properties(owner_id,agent_id,owner_type,title,address,price,sqft,beds,baths,city,listing_type,property_type,status) values
    (a1,a1,'agent','qa-cs3','x',1,1,0,0,'Tiranë','sale','apartment','active') returning id into pa;
  insert into public.conversations(client_id, agent_id, property_id) values (c1, c2, p) returning id into conv1;

  perform set_config('request.jwt.claims', json_build_object('sub', c1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  -- T1. A report from the chat, against the other participant, is filed.
  total:=total+1;
  begin
    insert into public.content_reports(reported_user_id, reason, details, conversation_id) values (c2, 'harassment', 'Fyerje', conv1);
    passed:=passed+1;
  exception when others then log:=log||'T1('||sqlerrm||') '; end;
  -- T2. The same person again while it is open: refused as a duplicate.
  total:=total+1;
  begin
    insert into public.content_reports(reported_user_id, reason, conversation_id) values (c2, 'spam', conv1);
    log:=log||'T2-duplicate ';
  exception when unique_violation then passed:=passed+1; when others then log:=log||'T2('||sqlerrm||') '; end;
  -- T3. Naming someone else through this chat: refused.
  total:=total+1;
  begin
    insert into public.content_reports(reported_user_id, reason, conversation_id) values (stranger, 'spam', conv1);
    log:=log||'T3-other-person ';
  exception when others then passed:=passed+1; end;
  -- T4. Every new reason is accepted; an unknown one is not.
  total:=total+1;
  begin
    insert into public.content_reports(reported_user_id, reason) values (a1, 'fake_account');
    insert into public.content_reports(property_id, reason) values (pa, 'fraud');
    passed:=passed+1;
  exception when others then log:=log||'T4-reasons('||sqlerrm||') '; end;
  total:=total+1;
  begin
    insert into public.content_reports(reported_user_id, reason) values (stranger, 'made_up');
    log:=log||'T4-unknown ';
  exception when others then passed:=passed+1; end;
  -- T5. Before any block, plain text still goes.
  total:=total+1;
  begin
    insert into public.messages(conversation_id, sender_id, body) values (conv1, c1, 'Përshëndetje');
    passed:=passed+1;
  exception when others then log:=log||'T5('||sqlerrm||') '; end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', stranger, 'role', 'authenticated')::text, true);
  set local role authenticated;
  -- T6. Someone outside the chat cannot report "from" it.
  total:=total+1;
  begin
    insert into public.content_reports(reported_user_id, reason, conversation_id) values (c2, 'spam', conv1);
    log:=log||'T6-outsider ';
  exception when others then passed:=passed+1; end;
  -- T7. Nobody can ask whether two others blocked each other.
  select public.users_have_block(c1, c2) into ok; total:=total+1;
  if not ok then passed:=passed+1; else log:=log||'T7-probe '; end if;
  reset role;

  -- c2 blocks c1.
  insert into public.user_blocks(blocker_id, blocked_id) values (c2, c1);

  perform set_config('request.jwt.claims', json_build_object('sub', c1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  -- T8. The blocked person cannot write in the old conversation…
  total:=total+1;
  begin
    insert into public.messages(conversation_id, sender_id, body) values (conv1, c1, 'a');
    log:=log||'T8-blocked-writes ';
  exception when others then passed:=passed+1; end;
  -- T9. …nor start a new one about another of the blocker's listings.
  total:=total+1;
  begin
    insert into public.conversations(client_id, agent_id, property_id) values (c1, c2, p2);
    log:=log||'T9-new-conversation ';
  exception when others then passed:=passed+1; end;
  -- T10. The history is still there to read.
  select count(*) into n from public.messages where conversation_id = conv1; total:=total+1;
  if n >= 1 then passed:=passed+1; else log:=log||'T10-history '; end if;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', c2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  -- T11. The person who blocked cannot write either: a block stops both ways.
  total:=total+1;
  begin
    insert into public.messages(conversation_id, sender_id, body) values (conv1, c2, 'b');
    log:=log||'T11-blocker-writes ';
  exception when others then passed:=passed+1; end;
  -- T12. Unblocking (their own block) restores messaging.
  delete from public.user_blocks where blocker_id = c2 and blocked_id = c1;
  total:=total+1;
  begin
    insert into public.messages(conversation_id, sender_id, body) values (conv1, c2, 'Përsëri');
    passed:=passed+1;
  exception when others then log:=log||'T12-unblocked('||sqlerrm||') '; end;
  reset role;

  -- T13. A block by the client works the same: c1 blocks a1, then cannot
  -- open a conversation about a1's listing.
  insert into public.user_blocks(blocker_id, blocked_id) values (c1, a1);
  perform set_config('request.jwt.claims', json_build_object('sub', c1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  total:=total+1;
  begin
    insert into public.conversations(client_id, agent_id, property_id) values (c1, a1, pa);
    log:=log||'T13-own-block ';
  exception when others then passed:=passed+1; end;
  reset role;
  raise exception 'RESULTS passed=%/% %', passed, total, log;
end $$;
