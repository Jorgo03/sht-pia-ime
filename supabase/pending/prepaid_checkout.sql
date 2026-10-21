-- PENDING: not applied. Depends on supabase/pending/plans_by_period_months.sql
-- (which needs the owner to confirm its DROP COLUMNs). Apply after it.
--
-- Prepaid plans and listing promotion, paid on the website
-- (docs/LAUNCH_TASKS.md F15). Provider-neutral: the Paysera callback (Edge
-- Function paysera-callback) is the first caller, any other provider can call
-- the same functions.
--
-- The rules this enforces, whatever a client sends:
--   * prices, currency and period come from public.plans, never from the
--     browser: create_checkout_order() copies them onto the order;
--   * only a verified provider callback, running as service_role, can mark an
--     order paid: activate_paid_order() is not executable by any app role;
--   * a provider event is processed once (payment_events primary key), so a
--     retried or replayed callback cannot double-grant;
--   * the amount and currency the provider confirms must equal the order's,
--     or nothing is granted;
--   * prepaid time stacks: buying 3 months while 1 month is left gives 4;
--     nothing renews by itself (cancel_at_period_end is always true);
--   * entitlements are time-based (current_period_end > now()), so an expired
--     plan stops counting even if the expiry job has not run;
--   * a refund takes the bought time back and never leaves an end in the past
--     looking active.
-- Listing caps: a plan's listing_cap limits active listings while the plan is
-- live; without a plan, billing_settings.free_listing_cap applies. Both are
-- NULL today (no cap), so nothing changes until the owner sets prices and
-- allowances (a business decision this file does not make).
--
-- Tested offline in PGlite: supabase/tests_prepaid_checkout.test.mjs.

-- 1. Settings ---------------------------------------------------------------
create table public.billing_settings (
  id boolean primary key default true check (id),
  free_listing_cap integer check (free_listing_cap > 0),
  updated_at timestamptz not null default now()
);
insert into public.billing_settings default values;
alter table public.billing_settings enable row level security;
create policy "Billing settings are public" on public.billing_settings
  for select to anon, authenticated using (true);

-- 2. Orders -----------------------------------------------------------------
create table public.checkout_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null references public.plans(id) on delete restrict,
  property_id uuid references public.properties(id) on delete set null,
  period_months integer not null check (period_months in (1, 3, 6, 12)),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  provider text not null default 'paysera',
  status text not null default 'created' check (status in ('created', 'paid', 'refunded', 'cancelled')),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  refunded_at timestamptz
);
create index checkout_orders_user_idx on public.checkout_orders (user_id, created_at);
alter table public.checkout_orders enable row level security;
create policy "Buyers see their own orders" on public.checkout_orders
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.checkout_orders from anon, authenticated;

-- 3. Starting a checkout (signed-in user) -----------------------------------
create or replace function public.create_checkout_order(p_plan_id text, p_property_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  plan record;
  order_id uuid;
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;

  select * into plan from public.plans where id = p_plan_id and active;
  if plan.id is null then raise exception 'unknown plan' using errcode = '22023'; end if;

  if plan.kind = 'promotion' then
    if p_property_id is null or not exists (
      select 1 from public.properties p
      where p.id = p_property_id and p.status = 'active' and (p.owner_id = uid or p.agent_id = uid)
    ) then
      raise exception 'you can only promote your own active listing' using errcode = '42501';
    end if;
  else
    if not exists (select 1 from public.profiles where id = uid and role = 'agent') then
      raise exception 'agency plans are for agents' using errcode = '42501';
    end if;
    p_property_id := null;
  end if;

  -- A person starting more than 10 checkouts an hour is a script, not a buyer.
  if (select count(*) from public.checkout_orders
      where user_id = uid and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'too many checkouts, try again later' using errcode = '54000';
  end if;

  insert into public.checkout_orders (user_id, plan_id, property_id, period_months, amount_cents, currency)
  values (uid, plan.id, p_property_id, plan.period_months, plan.price_cents, plan.currency)
  returning id into order_id;
  return order_id;
end;
$$;
revoke all on function public.create_checkout_order(text, uuid) from public, anon;
grant execute on function public.create_checkout_order(text, uuid) to authenticated;

-- 4. Activation (provider callback, service role only) ----------------------
create or replace function public.activate_paid_order(
  p_order_id uuid,
  p_amount_cents integer,
  p_currency text,
  p_provider text,
  p_event_id text,
  p_payload jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  o record;
  plan record;
  sub record;
  starts timestamptz;
  ends timestamptz;
begin
  insert into public.payment_events (provider, event_id, event_type, payload)
  values (p_provider, p_event_id, 'payment.succeeded', coalesce(p_payload, '{}'::jsonb))
  on conflict do nothing;
  if not found then return 'duplicate'; end if;

  select * into o from public.checkout_orders where id = p_order_id for update;
  if o.id is null then return 'unknown_order'; end if;
  if o.status <> 'created' then return 'already_processed'; end if;
  if o.amount_cents <> p_amount_cents or o.currency <> upper(p_currency) then
    update public.payment_events set processed_at = now(), event_type = 'payment.amount_mismatch'
      where provider = p_provider and event_id = p_event_id;
    return 'amount_mismatch';
  end if;

  select * into plan from public.plans where id = o.plan_id;
  update public.checkout_orders set status = 'paid', paid_at = now() where id = o.id;

  if plan.kind = 'agency_subscription' then
    select * into sub from public.agency_subscriptions
      where agent_id = o.user_id and status in ('active', 'past_due') for update;
    if sub.id is null then
      insert into public.agency_subscriptions
        (agent_id, plan_id, status, current_period_end, cancel_at_period_end, provider, provider_ref)
      values (o.user_id, o.plan_id, 'active', now() + make_interval(months => o.period_months), true, p_provider, o.id::text);
    else
      update public.agency_subscriptions
        set plan_id = o.plan_id,
            status = 'active',
            cancel_at_period_end = true,
            current_period_end = greatest(current_period_end, now()) + make_interval(months => o.period_months)
        where id = sub.id;
    end if;
  else
    select greatest(now(), coalesce(p.promoted_until, now())) into starts
      from public.properties p where p.id = o.property_id;
    if starts is null then
      -- The listing was removed after checkout: keep the payment, grant nothing,
      -- leave it for a refund.
      update public.payment_events set processed_at = now(), event_type = 'payment.listing_gone'
        where provider = p_provider and event_id = p_event_id;
      return 'listing_gone';
    end if;
    ends := starts + make_interval(months => o.period_months);
    insert into public.listing_promotions
      (property_id, buyer_id, plan_id, starts_at, ends_at, status, provider, provider_ref)
    values (o.property_id, o.user_id, o.plan_id, starts, ends, 'active', p_provider, o.id::text);
    update public.properties set promoted_until = ends where id = o.property_id;
  end if;

  update public.payment_events set processed_at = now()
    where provider = p_provider and event_id = p_event_id;
  return 'activated';
end;
$$;
revoke all on function public.activate_paid_order(uuid, integer, text, text, text, jsonb) from public, anon, authenticated;

-- 5. Refunds (service role only) --------------------------------------------
create or replace function public.refund_order(p_order_id uuid, p_provider text, p_event_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  o record;
  plan record;
begin
  insert into public.payment_events (provider, event_id, event_type, payload)
  values (p_provider, p_event_id, 'payment.refunded', jsonb_build_object('order_id', p_order_id))
  on conflict do nothing;
  if not found then return 'duplicate'; end if;

  select * into o from public.checkout_orders where id = p_order_id for update;
  if o.id is null or o.status <> 'paid' then return 'not_refundable'; end if;
  select * into plan from public.plans where id = o.plan_id;
  update public.checkout_orders set status = 'refunded', refunded_at = now() where id = o.id;

  if plan.kind = 'agency_subscription' then
    update public.agency_subscriptions
      set current_period_end = greatest(now(), current_period_end - make_interval(months => o.period_months)),
          status = case when current_period_end - make_interval(months => o.period_months) <= now() then 'canceled' else status end
      where agent_id = o.user_id and status in ('active', 'past_due');
  else
    update public.listing_promotions set status = 'refunded'
      where provider_ref = o.id::text and provider = o.provider;
    update public.properties p
      set promoted_until = (select max(lp.ends_at) from public.listing_promotions lp
                            where lp.property_id = p.id and lp.status = 'active' and lp.ends_at > now())
      where p.id = o.property_id;
  end if;

  update public.payment_events set processed_at = now()
    where provider = p_provider and event_id = p_event_id;
  return 'refunded';
end;
$$;
revoke all on function public.refund_order(uuid, text, text) from public, anon, authenticated;

-- 6. Expiry (scheduled; entitlement checks are time-based regardless) ---------
create or replace function public.expire_entitlements()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
  m integer;
begin
  update public.agency_subscriptions set status = 'canceled'
    where status in ('active', 'past_due') and current_period_end <= now();
  get diagnostics n = row_count;
  update public.listing_promotions set status = 'expired'
    where status = 'active' and ends_at <= now();
  get diagnostics m = row_count;
  return n + m;
end;
$$;
revoke all on function public.expire_entitlements() from public, anon, authenticated;

-- 7. Listing caps -------------------------------------------------------------
create or replace function public.listing_cap_for(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select pl.listing_cap from public.agency_subscriptions s
       join public.plans pl on pl.id = s.plan_id
      where s.agent_id = p_user and s.status in ('active', 'past_due') and s.current_period_end > now()
      limit 1),
    (select free_listing_cap from public.billing_settings where id)
  );
$$;
revoke all on function public.listing_cap_for(uuid) from public, anon;
grant execute on function public.listing_cap_for(uuid) to authenticated;

-- SECURITY INVOKER on purpose, like the other guards: current_user must be
-- the caller's role (anon/authenticated) for the app-only check to work. A
-- definer function would always see its owner and skip the cap. The count
-- reads the caller's own active listings, which RLS lets them see.
create or replace function public.guard_listing_cap()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cap integer;
begin
  if current_user not in ('anon', 'authenticated') or new.status <> 'active' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'active' then return new; end if;
  cap := public.listing_cap_for(new.owner_id);
  if cap is not null and (
    select count(*) from public.properties p
    where p.owner_id = new.owner_id and p.status = 'active' and p.id <> new.id
  ) >= cap then
    raise exception 'listing limit reached' using errcode = 'P0001', hint = 'listing_cap';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_listing_cap() from public, anon, authenticated;

create trigger properties_guard_listing_cap
  before insert or update of status on public.properties
  for each row execute function public.guard_listing_cap();
