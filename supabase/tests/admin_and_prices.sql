-- Can an ordinary signed-in user do admin things or set their own price?
-- Read-only in effect: everything runs in one transaction that ends with an
-- error carrying the results, so nothing is kept. Every line must say BLOCKED.
-- Result 2026-11-04: all BLOCKED (AUDIT.md Pass 38).
begin;
create temp table r(attempt text, blocked boolean, detail text);
grant all on r to authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select p.id from public.profiles p
  where p.role = 'buyer' and not exists (select 1 from public.moderators m where m.user_id = p.id)
    and p.created_at < now() - interval '1 day'
  order by p.created_at limit 1)::text, 'role', 'authenticated')::text, true);
set local role authenticated;
do $t$
declare
  some_listing uuid := (select id from public.properties where status = 'active' and owner_id is distinct from auth.uid() limit 1);
  my_listing uuid := (select id from public.properties where auth.uid() in (owner_id, coalesce(agent_id, owner_id)) limit 1);
  n int;
begin
  begin perform public.moderate_listing(some_listing, true); insert into r values ('hide a listing', false, ''); exception when others then insert into r values ('hide a listing', true, sqlerrm); end;
  begin perform public.resolve_report(gen_random_uuid(), 'dismissed', null); insert into r values ('resolve a report', false, ''); exception when others then insert into r values ('resolve a report', true, sqlerrm); end;
  begin insert into public.moderators(user_id) values (auth.uid()); insert into r values ('become a moderator', false, ''); exception when others then insert into r values ('become a moderator', true, sqlerrm); end;
  begin update public.plans set price_cents = 1; get diagnostics n = row_count; insert into r values ('change a price', n = 0, n || ' rows'); exception when others then insert into r values ('change a price', true, sqlerrm); end;
  begin insert into public.listing_promotions(buyer_id, property_id) values (auth.uid(), my_listing); insert into r values ('free promotion', false, ''); exception when others then insert into r values ('free promotion', true, sqlerrm); end;
  begin insert into public.agency_subscriptions(agent_id) values (auth.uid()); insert into r values ('free agency plan', false, ''); exception when others then insert into r values ('free agency plan', true, sqlerrm); end;
  begin update public.properties set promoted_until = now() + interval '1 year' where id = my_listing; get diagnostics n = row_count; insert into r values ('self-promote a listing', n = 0, n || ' rows'); exception when others then insert into r values ('self-promote a listing', true, sqlerrm); end;
  begin update public.profiles set role = 'agent' where id = auth.uid(); insert into r values ('change own role', false, ''); exception when others then insert into r values ('change own role', true, sqlerrm); end;
  begin perform public.claim_role('agent'); insert into r values ('claim a role late', false, ''); exception when others then insert into r values ('claim a role late', true, sqlerrm); end;
  begin insert into public.payment_events(provider, event_id, event_type, payload) values ('paysera', 'fake', 'payment.succeeded', '{}'); insert into r values ('record a payment', false, ''); exception when others then insert into r values ('record a payment', true, sqlerrm); end;
  raise exception 'RESULT %', (select string_agg(attempt || '=' || case when blocked then 'BLOCKED' else 'ALLOWED' end, ' | ') from r);
end $t$;
