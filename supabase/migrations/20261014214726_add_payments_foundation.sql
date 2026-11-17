-- Payments foundation: listing promotion + monthly agency plans.
-- Design: replica/payments-plan.md. Decision: DECISIONS.md M1.
--
-- Applied to production 2026-10-14 after the owner reviewed and approved it
-- (recorded version 20261014214726). Tested first in PGlite
-- (supabase/tests_payments_foundation.test.mjs: 21/21, and 3 fail with the
-- promoted_until guard removed), then live as an agent, a client, signed out
-- and as the payment server, inside a rolled-back transaction: 14/14.
--
-- Provider-neutral on purpose: FHO is registered in Albania, where a standard
-- Stripe account is reportedly unavailable, and the provider (Paddle, a bank
-- virtual POS such as raiAccept, ...) is not chosen yet. Every provider gives
-- an event id and an object reference; that is all this schema assumes.
--
-- The one rule everything here serves: nothing a signed-in user sends can
-- mark something as paid. Paid state is written only by the payment webhook,
-- which runs as service_role. anon/authenticated get read access to their own
-- rows and no write policy at all.
--
-- Additive only. One existing table gains one nullable column
-- (properties.promoted_until); nothing is altered, renamed or dropped.
-- Not included yet, on purpose: the active-listing cap per plan. Its numbers
-- are a pricing decision (/replica-launch) and it lands with them.

-- 1. What can be bought -----------------------------------------------------
create table public.plans (
  id text primary key,                         -- e.g. 'promote_7d', 'agency_pro'
  kind text not null check (kind in ('promotion', 'agency_subscription')),
  name_i18n jsonb not null default '{}'::jsonb,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  -- promotions run a fixed number of days and never renew;
  -- agency plans bill monthly.
  duration_days integer check (duration_days > 0),
  billing_interval text check (billing_interval in ('month')),
  listing_cap integer check (listing_cap > 0),  -- null = no cap
  promotion_credits integer not null default 0 check (promotion_credits >= 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plans_shape check (
    (kind = 'promotion' and duration_days is not null and billing_interval is null)
    or (kind = 'agency_subscription' and billing_interval is not null and duration_days is null)
  )
);

create trigger plans_updated_at before update on public.plans
  for each row execute function public.handle_updated_at();

alter table public.plans enable row level security;
-- The price list is public: the pricing page and the apps read it signed out.
create policy "Active plans are public" on public.plans
  for select to anon, authenticated using (active);

-- 2. Agency subscriptions ---------------------------------------------------
create table public.agency_subscriptions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.profiles(id) on delete cascade,
  plan_id text not null references public.plans(id) on delete restrict,
  status text not null check (status in ('active', 'past_due', 'canceled')),
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  provider text not null,
  provider_ref text not null,                  -- the provider's subscription id
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agency_subscriptions_provider_ref_key unique (provider, provider_ref)
);

create index agency_subscriptions_agent_id_idx on public.agency_subscriptions (agent_id);
create index agency_subscriptions_plan_id_idx on public.agency_subscriptions (plan_id);
-- At most one live subscription per agent; a canceled one may coexist.
create unique index agency_subscriptions_one_live_per_agent
  on public.agency_subscriptions (agent_id) where status in ('active', 'past_due');

create trigger agency_subscriptions_updated_at before update on public.agency_subscriptions
  for each row execute function public.handle_updated_at();

alter table public.agency_subscriptions enable row level security;
create policy "Agents see their own subscription" on public.agency_subscriptions
  for select to authenticated using ((select auth.uid()) = agent_id);
-- No insert/update/delete policy: written by the webhook (service_role) only.

-- 3. Listing promotions -----------------------------------------------------
create table public.listing_promotions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  plan_id text not null references public.plans(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'expired', 'refunded')),
  provider text not null,                      -- or 'credit' when paid from plan credits
  provider_ref text not null,                  -- the provider's payment/order id
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listing_promotions_window check (ends_at > starts_at),
  constraint listing_promotions_provider_ref_key unique (provider, provider_ref)
);

create index listing_promotions_property_id_idx on public.listing_promotions (property_id);
create index listing_promotions_buyer_id_idx on public.listing_promotions (buyer_id);
create index listing_promotions_plan_id_idx on public.listing_promotions (plan_id);

create trigger listing_promotions_updated_at before update on public.listing_promotions
  for each row execute function public.handle_updated_at();

alter table public.listing_promotions enable row level security;
create policy "Buyers see their own promotions" on public.listing_promotions
  for select to authenticated using ((select auth.uid()) = buyer_id);
-- No write policy: the webhook (service_role) writes these.

-- 4. Provider events, for idempotency and audit ------------------------------
-- Providers retry webhooks. The handler inserts here first; a duplicate key
-- means "already processed", so a retry can never double-grant.
create table public.payment_events (
  provider text not null,
  event_id text not null,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  primary key (provider, event_id)
);

alter table public.payment_events enable row level security;
-- RLS on with no policy: unreachable through the API, service_role only.
-- (Same deliberate shape as ai_usage; the advisor's INFO note is expected.)

-- 5. The promoted flag the feed sorts by -------------------------------------
alter table public.properties add column promoted_until timestamptz;

create index properties_promoted_until_idx
  on public.properties (promoted_until) where promoted_until is not null;

-- "Owners can update own properties" allows every column, so without this an
-- owner could promote their own listing for free with one UPDATE. Only the
-- webhook (service_role) or a direct SQL session may set or change it.
create or replace function public.guard_promoted_until()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' and new.promoted_until is not null then
      raise exception 'promoted_until is set by payments only' using errcode = '42501';
    elsif tg_op = 'UPDATE' and new.promoted_until is distinct from old.promoted_until then
      raise exception 'promoted_until is set by payments only' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger properties_guard_promoted_until
  before insert or update on public.properties
  for each row execute function public.guard_promoted_until();

revoke all on function public.guard_promoted_until() from public;
