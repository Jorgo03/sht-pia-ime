-- Photos and documents in chats (migration message_attachments).
-- One DO block that always ends in `raise exception 'RESULTS …'`, so every
-- write is rolled back. Expected: passed=14/14. Deleting a file
-- cannot be tested here: storage refuses SQL deletes (storage.protect_delete).
-- The delete policy is one comparison, owner_id = the caller, and only the
-- Storage API can exercise it. c1 and c2 talk in conv1; a1
-- and c1 in conv2; `stranger` is in neither.
do $$
declare
  a1 uuid; c1 uuid; c2 uuid; stranger uuid; p uuid; conv1 uuid; conv2 uuid;
  f1 text; f2 text; n int; passed int := 0; total int := 0; log text := '';
  att jsonb;
begin
  select id into a1 from public.profiles where role='agent' order by created_at limit 1;
  select id into c1 from public.profiles where role='buyer' order by created_at limit 1;
  select id into c2 from public.profiles where role='buyer' and id<>c1 order by created_at limit 1;
  select id into stranger from public.profiles where role='buyer' and id not in (c1, c2) order by created_at limit 1;
  if a1 is null or c1 is null or c2 is null or stranger is null then
    raise exception 'RESULTS SKIP: needs an agent and three clients';
  end if;
  delete from public.user_blocks where blocker_id in (c1, c2) or blocked_id in (c1, c2);
  insert into public.properties(owner_id,agent_id,owner_type,title,address,price,sqft,beds,baths,city,listing_type,property_type,status) values
    (c2,null,'client','qa-att','x',1,1,0,0,'Tiranë','sale','apartment','active') returning id into p;
  insert into public.conversations(client_id, agent_id, property_id) values (c1, c2, p) returning id into conv1;
  insert into public.conversations(client_id, agent_id, property_id) values (c1, a1, p) returning id into conv2;
  f1 := conv1::text || '/1731400000000-abc123.jpg';
  f2 := conv2::text || '/1731400000000-def456.pdf';

  perform set_config('request.jwt.claims', json_build_object('sub', c1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  -- T1. A participant uploads into the conversation's folder.
  total:=total+1;
  begin
    insert into storage.objects(bucket_id, name, owner_id) values ('message-attachments', f1, c1::text);
    passed:=passed+1;
  exception when others then log:=log||'T1-upload('||sqlerrm||') '; end;
  -- T2. A message with only a photo (no text) is accepted.
  att := jsonb_build_object('path', f1, 'name', 'foto.jpg', 'mime', 'image/jpeg', 'size', 120000, 'kind', 'image');
  total:=total+1;
  begin
    insert into public.messages(conversation_id, sender_id, body, attachment) values (conv1, c1, '', att);
    passed:=passed+1;
  exception when others then log:=log||'T2-photo-only('||sqlerrm||') '; end;
  -- T3. A message pointing at another conversation's folder is refused.
  total:=total+1;
  begin
    insert into public.messages(conversation_id, sender_id, body, attachment)
      values (conv1, c1, '', jsonb_set(att, '{path}', to_jsonb(f2)));
    log:=log||'T3-other-folder ';
  exception when others then passed:=passed+1; end;
  -- T4. No text and no file is still refused.
  total:=total+1;
  begin
    insert into public.messages(conversation_id, sender_id, body) values (conv1, c1, '   ');
    log:=log||'T4-empty ';
  exception when others then passed:=passed+1; end;
  -- T5. A type the bucket does not take, or a file over 10 MB, is refused.
  total:=total+1;
  begin
    insert into public.messages(conversation_id, sender_id, body, attachment)
      values (conv1, c1, '', jsonb_set(att, '{mime}', '"text/html"'));
    log:=log||'T5-mime ';
  exception when others then passed:=passed+1; end;
  total:=total+1;
  begin
    insert into public.messages(conversation_id, sender_id, body, attachment)
      values (conv1, c1, '', jsonb_set(att, '{size}', '20000000'));
    log:=log||'T5-size ';
  exception when others then passed:=passed+1; end;
  -- T6. Text plus a file is fine, and plain text still works as before.
  total:=total+1;
  begin
    insert into public.messages(conversation_id, sender_id, body, attachment) values (conv1, c1, 'Ja dokumenti', att);
    insert into public.messages(conversation_id, sender_id, body) values (conv1, c1, 'Përshëndetje');
    passed:=passed+1;
  exception when others then log:=log||'T6-text('||sqlerrm||') '; end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', c2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  -- T7. The other participant can read the file.
  select count(*) into n from storage.objects where bucket_id='message-attachments' and name=f1; total:=total+1;
  if n=1 then passed:=passed+1; else log:=log||'T7-other-reads '; end if;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', stranger, 'role', 'authenticated')::text, true);
  set local role authenticated;
  -- T9. Someone outside the conversation can neither read nor upload there.
  select count(*) into n from storage.objects where bucket_id='message-attachments' and name=f1; total:=total+1;
  if n=0 then passed:=passed+1; else log:=log||'T9-stranger-reads '; end if;
  total:=total+1;
  begin
    insert into storage.objects(bucket_id, name, owner_id) values ('message-attachments', conv1::text || '/1-x.jpg', stranger::text);
    log:=log||'T9-stranger-uploads ';
  exception when others then passed:=passed+1; end;
  -- T10. A folder that is not a conversation id, or a made-up one, is refused.
  total:=total+1;
  begin
    insert into storage.objects(bucket_id, name, owner_id) values ('message-attachments', 'not-a-uuid/1-x.jpg', stranger::text);
    log:=log||'T10-bad-folder ';
  exception when others then passed:=passed+1; end;
  reset role;

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  -- T11. Signed out: nothing.
  select count(*) into n from storage.objects where bucket_id='message-attachments'; total:=total+1;
  if n=0 then passed:=passed+1; else log:=log||'T11-anon '; end if;
  reset role;

  -- T12. Blocked: when c2 blocks c1, c1 can no longer upload into conv1.
  insert into public.user_blocks(blocker_id, blocked_id) values (c2, c1);
  perform set_config('request.jwt.claims', json_build_object('sub', c1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  total:=total+1;
  begin
    insert into storage.objects(bucket_id, name, owner_id) values ('message-attachments', conv1::text || '/2-blocked.jpg', c1::text);
    log:=log||'T12-blocked-uploads ';
  exception when others then passed:=passed+1; end;
  reset role;

  -- T14. The bucket is private.
  select count(*) into n from storage.buckets where id='message-attachments' and public=false and file_size_limit=10485760; total:=total+1;
  if n=1 then passed:=passed+1; else log:=log||'T14-bucket '; end if;
  raise exception 'RESULTS passed=%/% %', passed, total, log;
end $$;
