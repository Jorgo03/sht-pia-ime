-- Public profile (migration 20261111120000; app/user/[id].tsx).
-- One DO block that always ends in `raise exception 'RESULTS …'`, so every
-- write is rolled back. Expected: passed=16/16. Uses the oldest agent and three
-- clients: c1 writes to c2 about c2's listing; `stranger` has no conversation
-- with either.
do $$
declare
  a1 uuid; c1 uuid; c2 uuid; stranger uuid; p_c2 uuid; p_draft uuid; p_a1 uuid;
  r record; n int; passed int := 0; total int := 0; log text := '';
begin
  select id into a1 from public.profiles where role='agent' order by created_at limit 1;
  select id into c1 from public.profiles where role='buyer' order by created_at limit 1;
  select id into c2 from public.profiles where role='buyer' and id<>c1 order by created_at limit 1;
  select id into stranger from public.profiles b where b.role='buyer' and b.id not in (c1, c2)
    and not exists (select 1 from public.conversations c where b.id in (c.client_id, c.agent_id) and (c1 in (c.client_id, c.agent_id) or c2 in (c.client_id, c.agent_id)))
    order by created_at limit 1;
  if a1 is null or c1 is null or c2 is null or stranger is null then
    raise exception 'RESULTS SKIP: needs an agent and three clients';
  end if;
  -- c1 and c2 start with no listings and no conversation, so the test decides both.
  update public.properties set status='paused' where (owner_id in (c1, c2) or agent_id in (c1, c2)) and status='active';
  delete from public.conversations where c1 in (client_id, agent_id) or c2 in (client_id, agent_id);

  update public.profiles set full_name='Agent One', phone='+355690000011', agency_name='Office One', avatar_url='https://x/a1.jpg' where id=a1;
  update public.profiles set full_name='Client One', phone='+355690000033', agency_name='Should Not Show', avatar_url='https://x/c1.jpg' where id=c1;
  update public.profiles set full_name='Client Two', phone='+355690000044', agency_name='Nor This', avatar_url='https://x/c2.jpg' where id=c2;
  insert into public.properties(owner_id,agent_id,owner_type,title,address,price,sqft,beds,baths,city,listing_type,property_type,status,contact_phone) values
    (c2,null,'client','qa-c2','x',1,1,0,0,'Tiranë','sale','apartment','active','+355690000099') returning id into p_c2;
  insert into public.properties(owner_id,agent_id,owner_type,title,address,price,sqft,beds,baths,city,listing_type,property_type,status) values
    (c2,null,'client','qa-c2-draft','x',1,1,0,0,'Tiranë','sale','apartment','draft') returning id into p_draft;
  -- Sold stays off the profile, as it is off every other public list.
  insert into public.properties(owner_id,agent_id,owner_type,title,address,price,sqft,beds,baths,city,listing_type,property_type,status) values
    (c2,null,'client','qa-c2-sold','x',1,1,0,0,'Tiranë','sale','apartment','sold');
  insert into public.properties(owner_id,agent_id,owner_type,title,address,price,sqft,beds,baths,city,listing_type,property_type,status) values
    (a1,a1,'agent','qa-a1','x',1,1,0,0,'Tiranë','sale','apartment','active') returning id into p_a1;
  -- c1 writes to c2 about c2's listing: c2 is the conversation's agent_id.
  insert into public.conversations(client_id, agent_id, property_id) values (c1, c2, p_c2);

  perform set_config('request.jwt.claims', json_build_object('sub', c1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  -- T1. The client who wrote sees the client they write to (the profiles
  -- policy alone hides c2 from c1): name, photo, the account's phone, no office.
  select * into r from public.public_profile(c2); total:=total+1;
  if r.kind='client' and r.full_name='Client Two' and r.avatar_url='https://x/c2.jpg' and r.phone='+355690000044' and r.agency_name is null then passed:=passed+1; else log:=log||'T1 '; end if;
  -- T2. The count is active listings only: the draft is not counted.
  total:=total+1;
  if r.listing_count=1 then passed:=passed+1; else log:=log||'T2-count='||r.listing_count||' '; end if;
  -- T3. An agent: name, office, phone, photo.
  select * into r from public.public_profile(a1); total:=total+1;
  if r.kind='agent' and r.full_name='Agent One' and r.agency_name='Office One' and r.phone='+355690000011' and r.avatar_url='https://x/a1.jpg' and r.listing_count>=1 then passed:=passed+1; else log:=log||'T3 '; end if;
  -- T4. Yourself.
  select count(*) into n from public.public_profile(c1); total:=total+1;
  if n=1 then passed:=passed+1; else log:=log||'T4-self '; end if;
  -- T5. Through the table, c2 is still private to c1: nothing was opened.
  select count(*) into n from public.profiles where id=c2; total:=total+1;
  if n=0 then passed:=passed+1; else log:=log||'T5-table '; end if;
  -- T6. c2's draft is not among c2's listings for c1.
  select count(*) into n from public.properties where (owner_id=c2 or agent_id=c2) and status='active'; total:=total+1;
  if n=1 then passed:=passed+1; else log:=log||'T6-active='||n||' '; end if;
  select count(*) into n from public.properties where id=p_draft; total:=total+1;
  if n=0 then passed:=passed+1; else log:=log||'T6-draft '; end if;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', c2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  -- T7. The other way round: the publisher sees who wrote to them.
  select * into r from public.public_profile(c1); total:=total+1;
  if r.full_name='Client One' and r.phone='+355690000033' and r.agency_name is null and r.listing_count=0 then passed:=passed+1; else log:=log||'T7 '; end if;
  -- T8. The owner sees their own draft in the table, so the app must ask for
  -- active listings itself on someone's profile, its own included.
  select count(*) into n from public.properties where id=p_draft; total:=total+1;
  if n=1 then passed:=passed+1; else log:=log||'T8-owner-draft '; end if;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', stranger, 'role', 'authenticated')::text, true);
  set local role authenticated;
  -- T9. A stranger and a client with no listing and no conversation: nothing.
  select count(*) into n from public.public_profile(c1); total:=total+1;
  if n=0 then passed:=passed+1; else log:=log||'T9-private '; end if;
  -- T10. A stranger and a client who publishes: name and the listing's own
  -- number, as the listing shows them, but no photo.
  select * into r from public.public_profile(c2); total:=total+1;
  if r.full_name='Client Two' and r.phone='+355690000099' and r.avatar_url is null and r.agency_name is null then passed:=passed+1; else log:=log||'T10 '; end if;
  -- T11. Each profile its own listings: c2's are not a1's.
  select count(*) into n from public.properties where (owner_id=a1 or agent_id=a1) and status='active' and id=p_c2; total:=total+1;
  if n=0 then passed:=passed+1; else log:=log||'T11 '; end if;
  -- T12. An unknown id: nothing, not an error.
  select count(*) into n from public.public_profile(gen_random_uuid()); total:=total+1;
  if n=0 then passed:=passed+1; else log:=log||'T12 '; end if;
  reset role;

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  -- T13. Signed out: an agent yes, a private client no, a publishing client yes.
  select count(*) into n from public.public_profile(a1); total:=total+1;
  if n=1 then passed:=passed+1; else log:=log||'T13-agent '; end if;
  select count(*) into n from public.public_profile(c1); total:=total+1;
  if n=0 then passed:=passed+1; else log:=log||'T13-client '; end if;
  select count(*) into n from public.public_profile(c2); total:=total+1;
  if n=1 then passed:=passed+1; else log:=log||'T13-publisher '; end if;
  reset role;
  raise exception 'RESULTS passed=%/% %', passed, total, log;
end $$;
