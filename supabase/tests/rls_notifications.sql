-- Notification centre (docs/NOTIFICATIONS_REPORT.md). One DO block that always
-- ends in `raise exception 'RESULTS …'`, so every write is rolled back; the
-- send request the database queues is rolled back with it. Expected: passed=16/16.
do $$
declare
  prop uuid; owner_u uuid; client_u uuid; other uuid; conv uuid; note uuid;
  n int; k text; passed int := 0; total int := 0; log text := '';
  ok boolean;
begin
  select p.id, p.owner_id into prop, owner_u from public.properties p where p.status='active' order by created_at limit 1;
  select id into client_u from public.profiles where id<>owner_u and role='buyer' order by created_at limit 1;
  select id into other from public.profiles where id not in (owner_u, client_u) order by created_at limit 1;
  if prop is null or client_u is null or other is null then raise exception 'RESULTS SKIP: needs a listing and two other accounts'; end if;
  delete from public.notification_preferences where user_id=owner_u;
  delete from public.conversations where client_id=client_u and agent_id=owner_u and property_id=prop;

  -- A client's first message about a listing.
  perform set_config('request.jwt.claims', json_build_object('sub', client_u, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.conversations(property_id, client_id, agent_id) values (prop, client_u, owner_u) returning id into conv;
  insert into public.messages(conversation_id, sender_id, body) values (conv, client_u, 'qa first');
  reset role;

  -- T1 the recipient gets an inquiry, the sender gets nothing, no message text.
  select id, kind into note, k from public.notifications where user_id=owner_u and data->>'conversation_id'=conv::text;
  total:=total+1; if k='inquiry' then passed:=passed+1; else log:=log||'first-is-inquiry('||coalesce(k,'none')||') '; end if;
  select count(*) into n from public.notifications where user_id=client_u and data->>'conversation_id'=conv::text;
  total:=total+1; if n=0 then passed:=passed+1; else log:=log||'sender-not-notified '; end if;
  select count(*) into n from public.notifications where id=note and data::text like '%qa first%';
  total:=total+1; if n=0 then passed:=passed+1; else log:=log||'no-message-text '; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', client_u, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.messages(conversation_id, sender_id, body) values (conv, client_u, 'qa second');
  insert into public.messages(conversation_id, sender_id, body) values (conv, client_u, 'qa third');
  reset role;
  -- T4 follow-up messages collapse into one row per unread conversation.
  select count(*) into n from public.notifications where user_id=owner_u and kind='message' and data->>'conversation_id'=conv::text;
  total:=total+1; if n=1 then passed:=passed+1; else log:=log||'collapse('||n||') '; end if;
  select (data->>'count')::int into n from public.notifications where user_id=owner_u and kind='message' and data->>'conversation_id'=conv::text;
  total:=total+1; if n=2 then passed:=passed+1; else log:=log||'count('||coalesce(n,0)||') '; end if;

  -- T6 the same event twice makes one row.
  perform public.queue_push(owner_u, 'viewing_requested', '{}'::jsonb, 'qa:dup');
  perform public.queue_push(owner_u, 'viewing_requested', '{}'::jsonb, 'qa:dup');
  select count(*) into n from public.notifications where dedupe_key='qa:dup';
  total:=total+1; if n=1 then passed:=passed+1; else log:=log||'duplicate('||n||') '; end if;

  -- Privacy, as someone unrelated.
  perform set_config('request.jwt.claims', json_build_object('sub', other, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.notifications where user_id=owner_u;
  total:=total+1; if n=0 then passed:=passed+1; else log:=log||'read-others '; end if;
  update public.notifications set read_at=now() where id=note; get diagnostics n=row_count;
  total:=total+1; if n=0 then passed:=passed+1; else log:=log||'mark-others '; end if;
  total:=total+1;
  begin insert into public.notifications(user_id,kind,dedupe_key) values (other,'welcome','qa:forge'); log:=log||'forge '; exception when others then passed:=passed+1; end;
  select count(*) into n from public.push_tokens where user_id<>other;
  total:=total+1; if n=0 then passed:=passed+1; else log:=log||'tokens-private '; end if;
  total:=total+1;
  begin perform 1 from public.push_outbox; log:=log||'outbox-readable '; exception when others then passed:=passed+1; end;
  total:=total+1;
  begin perform 1 from public.push_settings; log:=log||'settings-readable '; exception when others then passed:=passed+1; end;
  total:=total+1;
  begin perform public.push_dispatch_secret_ok('x'); log:=log||'secret-callable '; exception when others then passed:=passed+1; end;
  total:=total+1;
  begin perform public.send_announcement('x','y'); log:=log||'announce-not-moderator '; exception when others then passed:=passed+1; end;
  reset role;

  -- Owner: may only change read_at, and only on their own.
  perform set_config('request.jwt.claims', json_build_object('sub', owner_u, 'role', 'authenticated')::text, true);
  set local role authenticated;
  total:=total+1;
  begin update public.notifications set kind='welcome' where id=note; log:=log||'edit-kind '; exception when others then passed:=passed+1; end;
  update public.notifications set read_at=now() where id=note; get diagnostics n=row_count;
  total:=total+1; if n=1 then passed:=passed+1; else log:=log||'mark-own '; end if;
  reset role;

  raise exception 'RESULTS passed=%/% %', passed, total, log;
end $$;
