-- "Published by" (migration 20261108203236; docs/PUBLISHED_BY_REPORT.md).
-- One DO block that always ends in `raise exception 'RESULTS …'`, so every
-- write is rolled back. Expected: passed=13/13. Uses the two oldest agents, the
-- oldest client and a client with no conversation or viewing with them (the
-- rules rightly show someone who contacted you).
do $$
declare
  a1 uuid; a2 uuid; c1 uuid; stranger uuid; p_a1 uuid; p_a2 uuid; p_c uuid; p_d uuid; p_e uuid;
  r record; n int; passed int := 0; total int := 0; log text := '';
begin
  select id into a1 from public.profiles where role='agent' order by created_at limit 1;
  select id into a2 from public.profiles where role='agent' and id<>a1 order by created_at limit 1;
  select id into c1 from public.profiles where role='buyer' order by created_at limit 1;
  select id into stranger from public.profiles b where b.role='buyer' and b.id<>c1
    and not exists (select 1 from public.conversations c where (c.client_id=c1 and c.agent_id=b.id) or (c.client_id=b.id and c.agent_id=c1))
    and not exists (select 1 from public.viewings v where (v.client_id=c1 and v.agent_id=b.id) or (v.client_id=b.id and v.agent_id=c1))
    order by created_at limit 1;
  if a1 is null or a2 is null or c1 is null or stranger is null then
    raise exception 'RESULTS SKIP: needs two agents, a client and an unrelated client';
  end if;
  update public.profiles set full_name='Agent One', phone='+355690000011', agency_name='Office One' where id=a1;
  update public.profiles set full_name='Agent Two', phone='+355690000022', agency_name='Office Two' where id=a2;
  update public.profiles set full_name='Client One', phone='+355690000033', agency_name='Should Not Show' where id=c1;
  insert into public.properties(owner_id,agent_id,owner_type,title,address,price,sqft,beds,baths,city,listing_type,property_type,status) values
    (a1,a1,'agent','qa-a1','x',1,1,0,0,'Tiranë','sale','apartment','active') returning id into p_a1;
  insert into public.properties(owner_id,agent_id,owner_type,title,address,price,sqft,beds,baths,city,listing_type,property_type,status) values
    (a2,a2,'agent','qa-a2','x',1,1,0,0,'Tiranë','sale','apartment','active') returning id into p_a2;
  insert into public.properties(owner_id,agent_id,owner_type,title,address,price,sqft,beds,baths,city,listing_type,property_type,status) values
    (c1,null,'client','qa-c','x',1,1,0,0,'Tiranë','sale','apartment','active') returning id into p_c;
  insert into public.properties(owner_id,agent_id,owner_type,title,address,price,sqft,beds,baths,city,listing_type,property_type,status) values
    (c1,null,'client','qa-d','x',1,1,0,0,'Tiranë','sale','apartment','draft') returning id into p_d;
  insert into public.properties(owner_id,agent_id,owner_type,title,address,price,sqft,beds,baths,city,listing_type,property_type,status,contact_phone) values
    (c1,null,'client','qa-e','x',1,1,0,0,'Tiranë','sale','apartment','active','+355690000099') returning id into p_e;

  perform set_config('request.jwt.claims', json_build_object('sub', stranger, 'role', 'authenticated')::text, true);
  set local role authenticated;
  -- 1. Agent: name, phone, office, seen by someone else.
  select * into r from public.listing_publisher(p_a1); total:=total+1;
  if r.kind='agent' and r.full_name='Agent One' and r.phone='+355690000011' and r.agency_name='Office One' then passed:=passed+1; else log:=log||'T1 '; end if;
  -- 2. Client: name and phone, no office even if the profile holds one.
  select * into r from public.listing_publisher(p_c); total:=total+1;
  if r.kind='client' and r.full_name='Client One' and r.phone='+355690000033' and r.agency_name is null then passed:=passed+1; else log:=log||'T2 '; end if;
  -- 3. A second agent, a different office.
  select * into r from public.listing_publisher(p_a2); total:=total+1;
  if r.full_name='Agent Two' and r.agency_name='Office Two' then passed:=passed+1; else log:=log||'T3 '; end if;
  -- The number typed on the listing wins over the account's.
  select * into r from public.listing_publisher(p_e); total:=total+1;
  if r.phone='+355690000099' then passed:=passed+1; else log:=log||'T-listing-phone '; end if;
  -- 6. An unpublished listing shows nothing to someone else.
  select count(*) into n from public.listing_publisher(p_d); total:=total+1;
  if n=0 then passed:=passed+1; else log:=log||'T6-draft '; end if;
  -- 6. The function opens no profile: an unrelated user still cannot read it.
  select count(*) into n from public.profiles where id=c1; total:=total+1;
  if n=0 then passed:=passed+1; else log:=log||'T6-profile-private '; end if;
  -- 4. Nobody else can take the listing over.
  total:=total+1;
  begin
    update public.properties set owner_id=stranger where id=p_c;
    get diagnostics n=row_count;
    if n=0 then passed:=passed+1; else log:=log||'T4-stranger '; end if;
  exception when others then passed:=passed+1; end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', c1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  -- 4. The owner cannot hand it over either, and editing changes no publisher.
  total:=total+1;
  begin
    update public.properties set owner_id=a1 where id=p_c;
    log:=log||'T4-owner-move ';
  exception when others then passed:=passed+1; end;
  update public.properties set title='qa-c edited' where id=p_c;
  select * into r from public.listing_publisher(p_c); total:=total+1;
  if r.full_name='Client One' then passed:=passed+1; else log:=log||'T4-edit '; end if;
  -- The owner still sees their own draft.
  select count(*) into n from public.listing_publisher(p_d); total:=total+1;
  if n=1 then passed:=passed+1; else log:=log||'T-owner-draft '; end if;
  reset role;

  update public.profiles set full_name='   ', phone=null, agency_name='' where id=a2;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  -- 5. Missing details come back empty, not as blanks.
  select * into r from public.listing_publisher(p_a2); total:=total+1;
  if r.kind='agent' and r.full_name is null and r.phone is null and r.agency_name is null then passed:=passed+1; else log:=log||'T5-missing '; end if;
  -- 6. Signed out: no draft, but a public listing shows its publisher.
  select count(*) into n from public.listing_publisher(p_d); total:=total+1;
  if n=0 then passed:=passed+1; else log:=log||'T6-anon-draft '; end if;
  select * into r from public.listing_publisher(p_c); total:=total+1;
  if r.full_name='Client One' then passed:=passed+1; else log:=log||'T-anon-active '; end if;
  reset role;
  raise exception 'RESULTS passed=%/% %', passed, total, log;
end $$;
