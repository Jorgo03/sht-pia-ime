-- Raporti im: private agent performance report (docs/PERFORMANCE_REPORT.md).

-- 1. Listing status history, written only by the database. property_id has
--    no foreign key on purpose: deleting a sold listing must not erase the
--    sale from its agent's history.
create table public.property_status_events (
  id bigint generated always as identity primary key,
  property_id uuid not null,
  agent_id uuid not null references public.profiles(id) on delete cascade,
  listing_type text not null,
  from_status text,
  to_status text not null,
  changed_at timestamptz not null default clock_timestamp()
);
create index property_status_events_agent_idx on public.property_status_events (agent_id, changed_at);
create index property_status_events_property_idx on public.property_status_events (property_id, changed_at);

alter table public.property_status_events enable row level security;
create policy "Agents read own status history" on public.property_status_events
  for select to authenticated using (agent_id = (select auth.uid()));
revoke all on public.property_status_events from anon;
revoke insert, update, delete, truncate on public.property_status_events from authenticated;

create or replace function public.log_property_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  who uuid := coalesce(new.agent_id, new.owner_id);
begin
  -- owner_id points at auth.users, not profiles: a listing whose owner has no
  -- profile is skipped rather than failing the listing's own update.
  if new.status is distinct from old.status
     and who is not null
     and exists (select 1 from public.profiles where id = who) then
    insert into public.property_status_events (property_id, agent_id, listing_type, from_status, to_status)
    values (new.id, who, new.listing_type, old.status, new.status);
  end if;
  return new;
end;
$$;
revoke execute on function public.log_property_status_change() from public, anon, authenticated;

create trigger properties_log_status_change
  after update of status on public.properties
  for each row execute function public.log_property_status_change();

-- 2. A viewing is completed or a no-show only by its agent, only after its
--    time, and only from confirmed. Everything else is unchanged.
create or replace function public.guard_viewing_update()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  me uuid := auth.uid();
  is_host boolean;
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if new.client_id is distinct from old.client_id
     or new.agent_id is distinct from old.agent_id
     or new.property_id is distinct from old.property_id then
    raise exception 'a viewing''s client, agent and property cannot be changed'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    is_host := me = old.agent_id or exists (
      select 1 from public.properties p
      where p.id = old.property_id and (p.owner_id = me or p.agent_id = me)
    );
    if not is_host and new.status <> 'cancelled' then
      raise exception 'only the agent can set a viewing to %', new.status
        using errcode = '42501';
    end if;
    if new.status in ('completed', 'no_show') then
      if old.status <> 'confirmed' then
        raise exception 'only a confirmed viewing can become %', new.status
          using errcode = '42501';
      end if;
      if old.scheduled_at > now() then
        raise exception 'a viewing cannot be % before its time', new.status
          using errcode = '42501';
      end if;
    end if;
  end if;

  return new;
end;
$function$;

-- 3. The agent's own estimate of their results before Shtëpia.ime.
create table public.agent_performance_baselines (
  agent_id uuid primary key references public.profiles(id) on delete cascade,
  monthly_rentals numeric(7,2) check (monthly_rentals is null or monthly_rentals between 0 and 1000),
  monthly_sales numeric(7,2) check (monthly_sales is null or monthly_sales between 0 and 1000),
  monthly_inquiries numeric(7,2) check (monthly_inquiries is null or monthly_inquiries between 0 and 1000),
  monthly_viewings numeric(7,2) check (monthly_viewings is null or monthly_viewings between 0 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.agent_performance_baselines enable row level security;
create policy "Agents read own baseline" on public.agent_performance_baselines
  for select to authenticated using (agent_id = (select auth.uid()));
create policy "Agents add own baseline" on public.agent_performance_baselines
  for insert to authenticated
  with check (agent_id = (select auth.uid()) and (select public.current_user_is_agent()));
create policy "Agents change own baseline" on public.agent_performance_baselines
  for update to authenticated
  using (agent_id = (select auth.uid()))
  with check (agent_id = (select auth.uid()) and (select public.current_user_is_agent()));
create policy "Agents remove own baseline" on public.agent_performance_baselines
  for delete to authenticated using (agent_id = (select auth.uid()));
revoke all on public.agent_performance_baselines from anon;

create trigger agent_performance_baselines_updated_at
  before update on public.agent_performance_baselines
  for each row execute function public.handle_updated_at();

-- 4. The report: counts only, for the caller only. No agent id parameter.
create or replace function public.my_performance_report(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_tz text default 'Europe/Tirane'
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  tz text;
  since timestamptz;
  f timestamptz := coalesce(p_from, '-infinity'::timestamptz);
  t timestamptz := coalesce(p_to, 'infinity'::timestamptz);
  listings jsonb; deals jsonb; viewings jsonb; contact jsonb; leads jsonb;
  monthly jsonb; baseline jsonb;
begin
  if me is null or not exists (select 1 from public.profiles where id = me and role = 'agent') then
    raise exception 'performance reports are for agents only' using errcode = '42501';
  end if;
  if f >= t then
    raise exception 'the period must end after it starts' using errcode = '22023';
  end if;
  tz := case when exists (select 1 from pg_catalog.pg_timezone_names where name = p_tz)
             then p_tz else 'Europe/Tirane' end;
  select created_at into since from public.profiles where id = me;

  -- Listings: created in the period (published = not a draft, not awaiting
  -- review), plus what is active or paused right now.
  select jsonb_build_object(
    'published', count(*) filter (where status not in ('draft', 'pending_review') and created_at >= f and created_at < t),
    'published_total', count(*) filter (where status not in ('draft', 'pending_review')),
    'active_now', count(*) filter (where status = 'active'),
    'paused_now', count(*) filter (where status = 'paused')
  ) into listings
  from public.properties
  where coalesce(agent_id, owner_id) = me;

  -- Completed transactions from the status history (rules in the doc).
  with ev as (
    select id, property_id, from_status, to_status, changed_at
    from public.property_status_events where agent_id = me
  ), done as (
    select e.id, e.property_id, e.to_status, e.changed_at from ev e
    where e.to_status in ('sold', 'rented')
      and not exists (
        select 1 from ev r
        where r.property_id = e.property_id and r.from_status = e.to_status
          and r.id > e.id and r.changed_at < e.changed_at + interval '7 days'
      )
  ), sales as (
    select distinct on (property_id) changed_at from done
    where to_status = 'sold' order by property_id, changed_at desc, id desc
  ), rentals as (
    select distinct on (property_id, date_trunc('month', changed_at at time zone tz)) changed_at from done
    where to_status = 'rented' order by property_id, date_trunc('month', changed_at at time zone tz), changed_at desc, id desc
  ), deal as (
    select 'sale' as kind, changed_at from sales
    union all
    select 'rent', changed_at from rentals
  )
  select jsonb_build_object(
    'sales', count(*) filter (where kind = 'sale' and changed_at >= f and changed_at < t),
    'rentals', count(*) filter (where kind = 'rent' and changed_at >= f and changed_at < t),
    'sales_total', count(*) filter (where kind = 'sale'),
    'rentals_total', count(*) filter (where kind = 'rent')
  ) into deals from deal;

  select jsonb_build_object(
    'scheduled', count(*) filter (where status <> 'declined' and scheduled_at >= f and scheduled_at < t),
    'completed', count(*) filter (where status = 'completed' and scheduled_at >= f and scheduled_at < t),
    'cancelled', count(*) filter (where status = 'cancelled' and scheduled_at >= f and scheduled_at < t),
    'completed_total', count(*) filter (where status = 'completed')
  ) into viewings
  from public.viewings where agent_id = me;

  select jsonb_build_object(
    'inquiries', (select count(*) from public.conversations c where c.agent_id = me and c.created_at >= f and c.created_at < t),
    'inquiries_total', (select count(*) from public.conversations c where c.agent_id = me),
    'messages_sent', (select count(*) from public.messages m join public.conversations c on c.id = m.conversation_id
                      where c.agent_id = me and m.sender_id = me and m.created_at >= f and m.created_at < t),
    'clients_answered', (select count(distinct c.client_id) from public.messages m join public.conversations c on c.id = m.conversation_id
                         where c.agent_id = me and m.sender_id = me and m.created_at >= f and m.created_at < t)
  ) into contact;

  select jsonb_build_object(
    'added', count(*) filter (where created_at >= f and created_at < t),
    'won', count(*) filter (where status = 'won' and created_at >= f and created_at < t)
  ) into leads
  from public.leads where agent_id = me;

  -- Month by month since registration, in the caller's time zone.
  with months as (
    select generate_series(
      date_trunc('month', since at time zone tz),
      date_trunc('month', now() at time zone tz),
      interval '1 month') as m
  ), ev as (
    select id, property_id, from_status, to_status, changed_at
    from public.property_status_events where agent_id = me
  ), done as (
    select e.id, e.property_id, e.to_status, e.changed_at from ev e
    where e.to_status in ('sold', 'rented')
      and not exists (
        select 1 from ev r
        where r.property_id = e.property_id and r.from_status = e.to_status
          and r.id > e.id and r.changed_at < e.changed_at + interval '7 days'
      )
  ), deal_months as (
    select date_trunc('month', changed_at at time zone tz) as m, count(*) as n from (
      select distinct on (property_id) changed_at from done where to_status = 'sold' order by property_id, changed_at desc, id desc
    ) s group by 1
    union all
    select mm, count(*) from (
      select distinct date_trunc('month', changed_at at time zone tz) as mm, property_id from done where to_status = 'rented'
    ) r group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'month', to_char(months.m, 'YYYY-MM'),
    'listings', (select count(*) from public.properties p
                 where coalesce(p.agent_id, p.owner_id) = me and p.status not in ('draft', 'pending_review')
                   and date_trunc('month', p.created_at at time zone tz) = months.m),
    'transactions', coalesce((select sum(n) from deal_months d where d.m = months.m), 0),
    'viewings', (select count(*) from public.viewings v
                 where v.agent_id = me and v.status = 'completed'
                   and date_trunc('month', v.scheduled_at at time zone tz) = months.m),
    'inquiries', (select count(*) from public.conversations c
                  where c.agent_id = me and date_trunc('month', c.created_at at time zone tz) = months.m)
  ) order by months.m), '[]'::jsonb) into monthly
  from months;

  select to_jsonb(b) - 'agent_id' into baseline
  from public.agent_performance_baselines b where b.agent_id = me;

  return jsonb_build_object(
    'since', since,
    'time_zone', tz,
    'listings', listings,
    'deals', deals,
    'viewings', viewings,
    'contact', contact,
    'leads', leads,
    'monthly', monthly,
    'baseline', baseline
  );
end;
$$;
revoke execute on function public.my_performance_report(timestamptz, timestamptz, text) from public, anon;
grant execute on function public.my_performance_report(timestamptz, timestamptz, text) to authenticated;
