-- The whole listing lifecycle between a real agent and a real client, with the
-- live database's own security rules (RLS, triggers, constraints) deciding.
-- Everything runs in one transaction that ends with an error carrying the
-- results, so nothing is kept: no listing, favourite, message or viewing.
-- Each line reads <step>=OK or <step>=FAIL (detail). Every line must be OK.
-- First run 2026-11-06 (docs/PRE_PURCHASE_QA.md).
begin;
create temp table r(n serial, step text, ok boolean, detail text);
grant all on r to authenticated;
grant usage on sequence r_n_seq to authenticated;
create temp table ids(k text primary key, v uuid);
grant all on ids to authenticated;
insert into ids values
  ('agent', (select p.id from public.profiles p where p.role = 'agent'
              and not exists (select 1 from public.moderators m where m.user_id = p.id) order by p.created_at limit 1)),
  ('client', (select p.id from public.profiles p where p.role = 'buyer'
              and not exists (select 1 from public.moderators m where m.user_id = p.id) order by p.created_at limit 1)),
  ('other_client', (select p.id from public.profiles p where p.role = 'buyer'
              and not exists (select 1 from public.moderators m where m.user_id = p.id) order by p.created_at offset 1 limit 1));
insert into ids values ('foreign_listing', (select id from public.properties
  where owner_id is distinct from (select v from ids where k = 'agent')
    and agent_id is distinct from (select v from ids where k = 'agent') limit 1));
-- A favourite of another client, so "can I read other people's favourites" has something to find.
insert into public.favorites(user_id, property_id)
  select (select v from ids where k = 'other_client'), (select v from ids where k = 'foreign_listing')
  on conflict do nothing;
-- Switches which account the following statements act as (created before the
-- role change: only the owner may create functions).
create or replace function pg_temp.act_as(who text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', (select v from ids where k = who)::text, 'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.act_as(text) to authenticated;
set local role authenticated;

do $t$
declare
  listing uuid; conv uuid; viewing uuid; n int; c int;
  agent uuid := (select v from ids where k = 'agent');
  client uuid := (select v from ids where k = 'client');
  foreign_listing uuid := (select v from ids where k = 'foreign_listing');
begin
  -- AGENT: create, edit, publish.
  perform pg_temp.act_as('agent');
  begin
    insert into public.properties(title, description, price, currency, address, city, listing_type, property_type, status, owner_id, agent_id, owner_type, image_urls, sqft, beds, baths, latitude, longitude)
    values ('QA test listing', 'Created and removed by the pre-purchase test.', 150000, 'EUR', 'Rruga e Durrësit', 'Tiranë', 'sale', 'apartment', 'draft', agent, agent, 'agent',
            array['https://xzzzhlwmzotibrxdqmcm.supabase.co/storage/v1/object/public/property-images/qa/a.jpg'], 90, 2, 1, 41.33, 19.82)
    returning id into listing;
    insert into r(step, ok, detail) values ('agent creates a draft listing', true, '');
  exception when others then insert into r(step, ok, detail) values ('agent creates a draft listing', false, sqlerrm); end;

  begin
    update public.properties set price = 145000, property_type = 'house', city = 'Durrës', latitude = 41.32, longitude = 19.45,
      image_urls = image_urls || array['https://xzzzhlwmzotibrxdqmcm.supabase.co/storage/v1/object/public/property-images/qa/b.jpg'],
      status = 'active' where id = listing;
    get diagnostics n = row_count;
    insert into r(step, ok, detail) values ('agent edits price, type, place, photos and publishes', n = 1, n || ' rows');
  exception when others then insert into r(step, ok, detail) values ('agent edits price, type, place, photos and publishes', false, sqlerrm); end;

  begin
    update public.properties set price = 1 where id = foreign_listing; get diagnostics n = row_count;
    insert into r(step, ok, detail) values ('agent cannot edit another agent''s listing', n = 0, n || ' rows');
  exception when others then insert into r(step, ok, detail) values ('agent cannot edit another agent''s listing', true, sqlerrm); end;
  begin
    delete from public.properties where id = foreign_listing; get diagnostics n = row_count;
    insert into r(step, ok, detail) values ('agent cannot delete another agent''s listing', n = 0, n || ' rows');
  exception when others then insert into r(step, ok, detail) values ('agent cannot delete another agent''s listing', true, sqlerrm); end;
  begin
    insert into public.properties(title, price, address, listing_type, image_urls, status, owner_id) values ('Bad', -5, 'x', 'sale', '{}', 'active', agent);
    insert into r(step, ok, detail) values ('a negative price is refused', false, 'saved');
  exception when others then insert into r(step, ok, detail) values ('a negative price is refused', true, left(sqlerrm, 50)); end;

  -- CLIENT: find it, save it, ask about it, book a viewing.
  perform pg_temp.act_as('client');
  select count(*) into c from public.properties where id = listing and price = 145000 and city = 'Durrës' and status = 'active';
  insert into r(step, ok, detail) values ('client sees the agent''s published listing with the new price', c = 1, c || ' found');
  begin
    insert into public.favorites(user_id, property_id) values (client, listing);
    select count(*) into c from public.favorites where user_id = client and property_id = listing;
    insert into r(step, ok, detail) values ('client saves it to favourites', c = 1, '');
  exception when others then insert into r(step, ok, detail) values ('client saves it to favourites', false, sqlerrm); end;
  begin
    insert into public.conversations(property_id, client_id, agent_id) values (listing, client, agent) returning id into conv;
    insert into public.messages(conversation_id, sender_id, body) values (conv, client, 'Is it still available?');
    insert into r(step, ok, detail) values ('client messages the agent about it', true, '');
  exception when others then insert into r(step, ok, detail) values ('client messages the agent about it', false, sqlerrm); end;
  begin
    insert into public.viewings(property_id, client_id, agent_id, scheduled_at, duration_minutes, notes)
    values (listing, client, agent, now() + interval '2 days', 30, 'Morning if possible') returning id into viewing;
    insert into r(step, ok, detail) values ('client requests a viewing', true, '');
  exception when others then insert into r(step, ok, detail) values ('client requests a viewing', false, sqlerrm); end;
  begin
    update public.properties set price = 1 where id = listing; get diagnostics n = row_count;
    insert into r(step, ok, detail) values ('client cannot edit the agent''s listing', n = 0, n || ' rows');
  exception when others then insert into r(step, ok, detail) values ('client cannot edit the agent''s listing', true, sqlerrm); end;
  select count(*) into c from public.favorites where user_id <> client;
  insert into r(step, ok, detail) values ('client cannot read other people''s favourites', c = 0, c || ' visible');
  begin
    update public.viewings set status = 'confirmed' where id = viewing; get diagnostics n = row_count;
    insert into r(step, ok, detail) values ('client cannot confirm their own viewing', n = 0, n || ' rows');
  exception when others then insert into r(step, ok, detail) values ('client cannot confirm their own viewing', true, left(sqlerrm, 50)); end;

  -- AGENT: sees the message and the viewing, confirms, then removes the listing.
  perform pg_temp.act_as('agent');
  select count(*) into c from public.messages m join public.conversations cv on cv.id = m.conversation_id where cv.property_id = listing;
  insert into r(step, ok, detail) values ('agent receives the client''s message', c = 1, c || ' messages');
  begin
    update public.viewings set status = 'confirmed' where id = viewing; get diagnostics n = row_count;
    insert into r(step, ok, detail) values ('agent confirms the viewing', n = 1, n || ' rows');
  exception when others then insert into r(step, ok, detail) values ('agent confirms the viewing', false, sqlerrm); end;
  select count(*) into c from public.property_activity where property_id = listing;
  begin
    delete from public.properties where id = listing; get diagnostics n = row_count;
    insert into r(step, ok, detail) values ('agent deletes the listing', n = 1, n || ' rows');
  exception when others then insert into r(step, ok, detail) values ('agent deletes the listing', false, sqlerrm); end;

  -- CLIENT: the listing is gone everywhere.
  perform pg_temp.act_as('client');
  select count(*) into c from public.properties where id = listing;
  insert into r(step, ok, detail) values ('client no longer sees the deleted listing', c = 0, c || ' found');
  select count(*) into c from public.favorites where property_id = listing;
  insert into r(step, ok, detail) values ('the deleted listing leaves the client''s favourites', c = 0, c || ' left');

  raise exception 'LIFECYCLE %', (select string_agg(step || '=' || case when ok then 'OK' else 'FAIL (' || left(detail, 90) || ')' end, ' | ' order by r.n) from r);
end $t$;
