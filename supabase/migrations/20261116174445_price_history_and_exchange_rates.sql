-- Website brief (DECISIONS.md W4, approved 2026-11-16): price history on each
-- listing, and a currency toggle (ALL / EUR / USD / GBP) backed by stored
-- daily exchange rates.

-- 1. Price history ----------------------------------------------------------
-- One row per price the listing has had. Written only by the trigger below,
-- never by the apps; readable whenever the listing itself is readable (the
-- properties RLS applies inside the policy's subquery).
create table public.property_price_history (
  id bigint generated always as identity primary key,
  property_id uuid not null references public.properties(id) on delete cascade,
  price numeric not null check (price >= 0),
  currency text not null default 'EUR',
  changed_at timestamptz not null default now()
);
create index property_price_history_property_idx on public.property_price_history (property_id, changed_at);

alter table public.property_price_history enable row level security;

create policy "Price history follows its listing"
  on public.property_price_history for select
  using (exists (select 1 from public.properties p where p.id = property_id));

revoke insert, update, delete on public.property_price_history from anon, authenticated;
grant select on public.property_price_history to anon, authenticated;

create function public.record_price_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.price is null then return new; end if;
  if tg_op = 'INSERT'
     or new.price is distinct from old.price
     or coalesce(new.currency, 'EUR') is distinct from coalesce(old.currency, 'EUR') then
    insert into public.property_price_history (property_id, price, currency)
    values (new.id, new.price, coalesce(new.currency, 'EUR'));
  end if;
  return new;
end;
$$;
revoke all on function public.record_price_change() from public, anon, authenticated;

create trigger properties_record_price
  after insert or update of price, currency on public.properties
  for each row execute function public.record_price_change();

-- Every existing listing starts with its current price, dated when it was
-- listed (the first point of its history; no earlier prices are known).
insert into public.property_price_history (property_id, price, currency, changed_at)
select id, price, coalesce(currency, 'EUR'), coalesce(created_at, now())
from public.properties
where price is not null;

-- 2. Exchange rates ---------------------------------------------------------
-- Units of each currency per 1 EUR. Filled daily by the exchange-rates Edge
-- Function (service role); everyone may read them. When a fetch fails the
-- last stored rate simply stays.
create table public.exchange_rates (
  currency text primary key check (currency in ('ALL', 'EUR', 'USD', 'GBP')),
  per_eur numeric not null check (per_eur > 0),
  source text not null,
  updated_at timestamptz not null default now()
);
alter table public.exchange_rates enable row level security;

create policy "Anyone reads exchange rates"
  on public.exchange_rates for select
  using (true);

revoke insert, update, delete on public.exchange_rates from anon, authenticated;
grant select on public.exchange_rates to anon, authenticated;

-- The scheduler: once a day, the same pattern as saved-search-alerts.
create function public.request_exchange_rates()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  secret text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'push_dispatch_secret';
  perform net.http_post(
    url := 'https://xzzzhlwmzotibrxdqmcm.supabase.co/functions/v1/exchange-rates',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
exception when others then
  null;  -- tomorrow's run tries again; the last rates stay in use
end;
$$;
revoke all on function public.request_exchange_rates() from public, anon, authenticated;

select cron.schedule('exchange-rates', '15 6 * * *', 'select public.request_exchange_rates()');
