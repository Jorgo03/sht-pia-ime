-- Real locations (supabase/pending/locations.sql, locations audit).
-- One DO block that always ends in `raise exception 'RESULTS …'`, so every
-- write is rolled back. Expected: passed=14/14.
do $$
declare
  prop uuid; owner uuid; n int; lid text;
  passed int := 0; total int := 14; log text := '';
begin
  select p.id, p.owner_id into prop, owner from public.properties p where p.city = 'Tiranë' limit 1;
  if prop is null then raise exception 'RESULTS SKIP: needs a listing in Tiranë'; end if;

  -- 1-4. The list itself.
  select count(*) into n from public.locations where type = 'bashki' and app_city is not null;
  if n = 61 then passed := passed + 1; else log := log || '1:FAIL(' || n || ' cities) '; end if;
  select count(*) into n from public.locations where type = 'njesi';
  if n = 373 then passed := passed + 1; else log := log || '2:FAIL(' || n || ' units) '; end if;
  select count(*) into n from public.locations where type = 'qark';
  if n = 12 then passed := passed + 1; else log := log || '3:FAIL(' || n || ' qarqe) '; end if;
  select count(*) into n from public.properties where city is not null and location_id is null;
  if n = 0 then passed := passed + 1; else log := log || '4:FAIL(' || n || ' listings without a location) '; end if;

  -- 5. A signed-out visitor reads the list.
  set local role anon;
  select count(*) into n from public.locations;
  if n > 1000 then passed := passed + 1; else log := log || '5:FAIL(anon reads ' || n || ') '; end if;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', owner, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 6. Nobody but a moderator adds a place.
  begin
    insert into public.locations(id, type, slug, name) values ('zone/fake', 'zone', 'fake', 'Fake');
    log := log || '6:FAIL ';
  exception when others then passed := passed + 1; end;

  -- 7. A city the apps do not offer is refused.
  begin
    update public.properties set city = 'Atlantis' where id = prop;
    log := log || '7:FAIL ';
  exception when check_violation then passed := passed + 1; end;

  -- 8. A zone removed by the audit is refused.
  begin
    update public.properties set zone = 'Plazh' where id = prop;
    log := log || '8:FAIL ';
  exception when check_violation then passed := passed + 1; end;

  -- 9. A zone of another city is refused.
  begin
    update public.properties set zone = 'Ksamil' where id = prop;
    log := log || '9:FAIL ';
  exception when check_violation then passed := passed + 1; end;

  -- 10. A pin outside Albania is refused.
  begin
    update public.properties set latitude = 45.0, longitude = 12.0 where id = prop;
    log := log || '10:FAIL ';
  exception when check_violation then passed := passed + 1; end;

  -- 11. A pin in Sarandë on a listing in Tiranë is refused.
  begin
    update public.properties set latitude = 39.8752, longitude = 20.0065 where id = prop;
    log := log || '11:FAIL ';
  exception when check_violation then passed := passed + 1; end;

  -- 12. A real zone of the city is accepted and becomes the location.
  begin
    update public.properties set zone = 'Blloku' where id = prop returning location_id into lid;
    if lid like 'lagje/tirane/%blloku%' then passed := passed + 1; else log := log || '12:FAIL(' || coalesce(lid, 'null') || ') '; end if;
  exception when others then log := log || '12:FAIL(' || sqlerrm || ') '; end;

  -- 13. A client cannot point a listing at another place directly.
  begin
    update public.properties set location_id = 'bashki/vlore/vlore' where id = prop returning location_id into lid;
    if lid not like 'bashki/vlore/%' then passed := passed + 1; else log := log || '13:FAIL(kept ' || lid || ') '; end if;
  exception when others then log := log || '13:FAIL(' || sqlerrm || ') '; end;

  -- 14. A wanted home in an unknown city is refused.
  begin
    insert into public.wanted_homes(client_id, city, listing_type) values (owner, 'Atlantis', 'sale');
    log := log || '14:FAIL ';
  exception when check_violation then passed := passed + 1;
            when others then log := log || '14:FAIL(' || sqlerrm || ') '; end;

  reset role;
  raise exception 'RESULTS passed=%/% %', passed, total, log;
end $$;
