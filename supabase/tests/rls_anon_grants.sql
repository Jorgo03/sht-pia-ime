-- Signed-out grants (AUDIT-017, migration 20261113194218).
-- Read-only catalog checks plus one rolled-back signed-out insert; the block
-- always ends in `raise exception 'RESULTS …'`. Expected: passed=8/8.
-- Before the migration (live 2026-11-13): A1 fails (anon holds table grants
-- on private tables).
do $$
declare
  t text; leaked text := ''; passed int := 0; total int := 0; log text := '';
  private text[] := array['agency_subscriptions','ai_usage','conversations','favorites','leads',
    'listing_promotions','messages','payment_events','property_views','saved_searches','viewings','wanted_homes'];
  prop uuid;
begin
  -- A1. No grant at all on the private tables.
  total := total + 1;
  foreach t in array private loop
    if has_table_privilege('anon', format('public.%I', t), 'SELECT,INSERT,UPDATE,DELETE') then leaked := leaked || t || ' '; end if;
  end loop;
  if leaked = '' then passed := passed + 1; else log := log || 'A1(' || trim(leaked) || ') '; end if;
  -- A2-A4. Listings and plans: read only.
  total := total + 1;
  if has_table_privilege('anon', 'public.properties', 'SELECT') then passed := passed + 1; else log := log || 'A2 '; end if;
  total := total + 1;
  if not has_table_privilege('anon', 'public.properties', 'INSERT,UPDATE,DELETE') then passed := passed + 1; else log := log || 'A3 '; end if;
  total := total + 1;
  if has_table_privilege('anon', 'public.plans', 'SELECT') and not has_table_privilege('anon', 'public.plans', 'INSERT,UPDATE,DELETE') then passed := passed + 1; else log := log || 'A4 '; end if;
  -- A5. View counts: insert only.
  total := total + 1;
  if has_table_privilege('anon', 'public.property_activity', 'INSERT') and not has_table_privilege('anon', 'public.property_activity', 'SELECT,UPDATE,DELETE') then passed := passed + 1; else log := log || 'A5 '; end if;
  -- A6. Signed-in users keep their grants.
  total := total + 1;
  if has_table_privilege('authenticated', 'public.messages', 'SELECT,INSERT') and has_table_privilege('authenticated', 'public.viewings', 'SELECT,INSERT,UPDATE') then passed := passed + 1; else log := log || 'A6 '; end if;

  -- A7-A8. As a signed-out visitor: listings still read, a view still counts.
  select id into prop from public.properties where status = 'active' limit 1;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  total := total + 1;
  begin
    perform 1 from public.properties where status = 'active' limit 1;
    if found then passed := passed + 1; else log := log || 'A7(no rows) '; end if;
  exception when others then log := log || 'A7(' || sqlerrm || ') '; end;
  total := total + 1;
  begin
    insert into public.property_activity(property_id, type) values (prop, 'view');
    passed := passed + 1;
  exception when others then log := log || 'A8(' || sqlerrm || ') '; end;
  reset role;

  raise exception 'RESULTS passed=%/% %', passed, total, log;
end $$;
