-- Raporti im: privacy and counting rules of the agent performance report
-- (docs/PERFORMANCE_REPORT.md; migration agent_performance_report).
-- One DO block that always ends in `raise exception 'RESULTS …'`, so every
-- write is rolled back. Expected: passed=22/22.
do $$
declare
  a uuid; b uuid; client uuid;
  sale_a uuid; sale_b uuid; rent_a uuid; resale_a uuid;
  v_past uuid; v_cancel uuid; v_future uuid;
  r jsonb; r2 jsonb; n int; st text;
  passed int := 0; total int := 22; log text := '';
begin
  select id into a from public.profiles where role = 'agent' order by created_at limit 1;
  select id into b from public.profiles where role = 'agent' and id <> a order by created_at limit 1;
  select id into client from public.profiles where role = 'buyer' order by created_at limit 1;
  if a is null or b is null or client is null then
    raise exception 'RESULTS SKIP: needs two agents and one client';
  end if;

  -- Fixtures, written as the table owner (the guards only police app roles).
  insert into public.properties(owner_id, agent_id, title, price, address, city, property_type, listing_type, status)
    values (a, a, 'T sale A', 100000, 'Rr. Test', 'Tiranë', 'apartment', 'sale', 'active') returning id into sale_a;
  insert into public.properties(owner_id, agent_id, title, price, address, city, property_type, listing_type, status)
    values (a, a, 'T rent A', 500, 'Rr. Test', 'Tiranë', 'apartment', 'rent', 'active') returning id into rent_a;
  insert into public.properties(owner_id, agent_id, title, price, address, city, property_type, listing_type, status)
    values (a, a, 'T resale A', 90000, 'Rr. Test', 'Tiranë', 'apartment', 'sale', 'active') returning id into resale_a;
  insert into public.properties(owner_id, agent_id, title, price, address, city, property_type, listing_type, status)
    values (b, b, 'T sale B', 120000, 'Rr. Test', 'Durrës', 'apartment', 'sale', 'active') returning id into sale_b;
  insert into public.viewings(property_id, client_id, agent_id, scheduled_at, status)
    values (sale_a, client, a, now() - interval '2 days', 'confirmed') returning id into v_past;
  insert into public.viewings(property_id, client_id, agent_id, scheduled_at, status)
    values (sale_a, client, a, now() - interval '1 day', 'cancelled') returning id into v_cancel;
  insert into public.viewings(property_id, client_id, agent_id, scheduled_at, status)
    values (sale_a, client, a, now() + interval '2 days', 'confirmed') returning id into v_future;
  insert into public.agent_performance_baselines(agent_id, monthly_sales) values (b, 4)
    on conflict (agent_id) do update set monthly_sales = 4;

  set local role authenticated;

  -- As agent A ------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);

  -- 1. A gets their own report.
  begin
    r := public.my_performance_report();
    if r ? 'deals' and r ? 'monthly' then passed := passed + 1; else log := log || '1:FAIL(shape) '; end if;
  exception when others then log := log || '1:FAIL(' || sqlerrm || ') '; end;

  -- 2. A cannot read B's baseline.
  select count(*) into n from public.agent_performance_baselines where agent_id = b;
  if n = 0 then passed := passed + 1; else log := log || '2:FAIL '; end if;

  -- 3. A cannot write a baseline for B.
  begin
    insert into public.agent_performance_baselines(agent_id, monthly_sales) values (b, 99)
      on conflict (agent_id) do update set monthly_sales = 99;
    log := log || '3:FAIL ';
  exception when others then passed := passed + 1; end;

  -- 4. A's update aimed at B's baseline touches nothing.
  update public.agent_performance_baselines set monthly_sales = 77 where agent_id = b;
  get diagnostics n = row_count;
  if n = 0 then passed := passed + 1; else log := log || '4:FAIL '; end if;

  -- 5. A cannot write the status history directly.
  begin
    insert into public.property_status_events(property_id, agent_id, listing_type, from_status, to_status)
      values (sale_a, a, 'sale', 'active', 'sold');
    log := log || '5:FAIL ';
  exception when others then passed := passed + 1; end;

  -- 6. A saves their own baseline (missing values stay empty).
  begin
    insert into public.agent_performance_baselines(agent_id, monthly_sales) values (a, 3)
      on conflict (agent_id) do update set monthly_sales = 3, monthly_rentals = null;
    r := public.my_performance_report();
    if (r->'baseline'->>'monthly_sales')::numeric = 3 and r->'baseline'->'monthly_rentals' = 'null'::jsonb
      then passed := passed + 1; else log := log || '6:FAIL(' || coalesce(r->>'baseline', 'none') || ') '; end if;
  exception when others then log := log || '6:FAIL(' || sqlerrm || ') '; end;

  -- 7. Marking a sale counts one completed sale.
  r := public.my_performance_report();
  update public.properties set status = 'sold' where id = sale_a;
  r2 := public.my_performance_report();
  if (r2->'deals'->>'sales_total')::int = (r->'deals'->>'sales_total')::int + 1
     and (r2->'deals'->>'sales')::int = (r->'deals'->>'sales')::int + 1
    then passed := passed + 1; else log := log || '7:FAIL ';
  end if;

  -- 8. A rental undone within 7 days is a correction, not a transaction.
  r := r2;
  update public.properties set status = 'rented' where id = rent_a;
  update public.properties set status = 'active' where id = rent_a;
  r2 := public.my_performance_report();
  if (r2->'deals'->>'rentals_total')::int = (r->'deals'->>'rentals_total')::int
    then passed := passed + 1; else log := log || '8:FAIL ';
  end if;

  -- 9. Sold, undone, sold again: one sale, not two.
  update public.properties set status = 'sold' where id = resale_a;
  update public.properties set status = 'active' where id = resale_a;
  update public.properties set status = 'sold' where id = resale_a;
  r := public.my_performance_report();
  if (r->'deals'->>'sales_total')::int = (r2->'deals'->>'sales_total')::int + 1
    then passed := passed + 1; else log := log || '9:FAIL ';
  end if;

  -- 10. A period that starts tomorrow holds none of today's sales.
  r2 := public.my_performance_report(now() + interval '1 day', null);
  if (r2->'deals'->>'sales')::int = 0 and (r2->'deals'->>'sales_total')::int = (r->'deals'->>'sales_total')::int
    then passed := passed + 1; else log := log || '10:FAIL ';
  end if;

  -- 11. A period that ends before it starts is refused.
  begin
    r2 := public.my_performance_report(now(), now() - interval '1 day');
    log := log || '11:FAIL ';
  exception when others then
    if sqlstate = '22023' then passed := passed + 1; else log := log || '11:FAIL(' || sqlstate || ') '; end if;
  end;

  -- 12. A past confirmed viewing can be completed, and is counted.
  update public.viewings set status = 'completed' where id = v_past;
  r2 := public.my_performance_report();
  if (r2->'viewings'->>'completed_total')::int = (r->'viewings'->>'completed_total')::int + 1
    then passed := passed + 1; else log := log || '12:FAIL ';
  end if;

  -- 13. A cancelled viewing cannot be turned into a completed one.
  begin
    update public.viewings set status = 'completed' where id = v_cancel;
    log := log || '13:FAIL ';
  exception when others then passed := passed + 1; end;

  -- 14. Nor can a viewing whose time has not come.
  begin
    update public.viewings set status = 'completed' where id = v_future;
    log := log || '14:FAIL ';
  exception when others then passed := passed + 1; end;

  -- 15. The cancelled viewing is counted as cancelled, never as completed.
  if (r2->'viewings'->>'cancelled')::int >= 1
     and (r2->'viewings'->>'completed')::int = (r->'viewings'->>'completed')::int + 1
    then passed := passed + 1; else log := log || '15:FAIL ';
  end if;

  -- 16. The report holds counts only: no names, phones, ids or messages.
  if r2::text !~* '(phone|full_name|client_id|property_id|body|T sale A)'
    then passed := passed + 1; else log := log || '16:FAIL ';
  end if;

  -- As agent B ------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);

  -- 17. B gets their own report, with their own baseline and not A's.
  begin
    r := public.my_performance_report();
    if (r->'baseline'->>'monthly_sales')::numeric = 4 then passed := passed + 1; else log := log || '17:FAIL ';end if;
  exception when others then log := log || '17:FAIL(' || sqlerrm || ') '; end;

  -- 18. A's sales are not in B's report; B's own sale is.
  update public.properties set status = 'sold' where id = sale_b;
  r2 := public.my_performance_report();
  if (r2->'deals'->>'sales_total')::int = (r->'deals'->>'sales_total')::int + 1
    then passed := passed + 1; else log := log || '18:FAIL ';
  end if;

  -- 19. B cannot read A's status history.
  select count(*) into n from public.property_status_events where agent_id = a;
  if n = 0 then passed := passed + 1; else log := log || '19:FAIL '; end if;

  -- As a client -----------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', client, 'role', 'authenticated')::text, true);

  -- 20. A client gets no report.
  begin
    r := public.my_performance_report();
    log := log || '20:FAIL ';
  exception when others then
    if sqlstate = '42501' then passed := passed + 1; else log := log || '20:FAIL(' || sqlstate || ') '; end if;
  end;

  -- 21. A client cannot complete a viewing either.
  begin
    update public.viewings set status = 'no_show' where id = v_future;
    log := log || '21:FAIL ';
  exception when others then passed := passed + 1; end;

  -- Signed out ------------------------------------------------------------
  -- 22. anon cannot call the report at all.
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
  begin
    r := public.my_performance_report();
    log := log || '22:FAIL ';
  exception when others then passed := passed + 1; end;

  raise exception 'RESULTS passed=%/% %', passed, total, log;
end
$$;
