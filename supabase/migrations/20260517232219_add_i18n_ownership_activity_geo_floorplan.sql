
-- ============================================
-- Section 1: Translatable title & description
-- ============================================
alter table public.properties
  add column if not exists title_i18n jsonb default '{}'::jsonb,
  add column if not exists description_i18n jsonb default '{}'::jsonb;

update public.properties
  set title_i18n = jsonb_build_object('sq', title)
  where title is not null and (title_i18n is null or title_i18n = '{}'::jsonb);

update public.properties
  set description_i18n = jsonb_build_object('sq', description)
  where description is not null and (description_i18n is null or description_i18n = '{}'::jsonb);

-- ============================================
-- Section 3: Multi-role ownership + activity
-- ============================================
alter table public.properties
  add column if not exists owner_id uuid references auth.users(id) on delete set null,
  add column if not exists owner_type text default 'agent';

-- Backfill owner_id from agent_id for existing listings
update public.properties
  set owner_id = agent_id, owner_type = 'agent'
  where owner_id is null and agent_id is not null;

-- Expand property_type to include villa, office, garage
alter table public.properties drop constraint if exists properties_property_type_check;
alter table public.properties add constraint properties_property_type_check
  check (property_type in ('apartment', 'house', 'villa', 'land', 'commercial', 'office', 'garage'));

-- Expand listing_type to include daily_rent
alter table public.properties drop constraint if exists properties_listing_type_check;
alter table public.properties add constraint properties_listing_type_check
  check (listing_type in ('sale', 'rent', 'daily_rent'));

-- Expand status to include paused, rented
alter table public.properties drop constraint if exists properties_status_check;
alter table public.properties add constraint properties_status_check
  check (status in ('active', 'pending', 'sold', 'rented', 'paused', 'draft'));

-- Add features and currency columns
alter table public.properties
  add column if not exists features text[] default '{}'::text[],
  add column if not exists currency text default 'EUR',
  add column if not exists floor integer,
  add column if not exists total_floors integer,
  add column if not exists year_built integer,
  add column if not exists video_url text,
  add column if not exists whatsapp_enabled boolean default true,
  add column if not exists contact_email text,
  add column if not exists contact_phone text;

-- Update properties INSERT policy: allow any authenticated user to create
drop policy if exists "Only agents can create properties" on public.properties;
create policy "Authenticated users can create properties"
  on public.properties for insert
  with check (auth.uid() = owner_id);

-- Update properties UPDATE policy: allow owner_id too
drop policy if exists "Agents can update own properties" on public.properties;
create policy "Owners can update own properties"
  on public.properties for update
  using (auth.uid() = owner_id or auth.uid() = agent_id)
  with check (auth.uid() = owner_id or auth.uid() = agent_id);

-- Update properties DELETE policy: allow owner_id too
drop policy if exists "Agents can delete own properties" on public.properties;
create policy "Owners can delete own properties"
  on public.properties for delete
  using (auth.uid() = owner_id or auth.uid() = agent_id);

-- Activity tracking table
create table if not exists public.property_activity (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  type text not null check (type in ('call', 'message', 'meeting', 'view', 'favourite')),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_property_activity_lookup
  on public.property_activity(property_id, type, created_at desc);

alter table public.property_activity enable row level security;

create policy "Owners view their property activity"
  on public.property_activity for select
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_activity.property_id
        and (p.owner_id = auth.uid() or p.agent_id = auth.uid())
    )
  );

create policy "Anyone can insert activity"
  on public.property_activity for insert
  with check (true);

-- ============================================
-- Section 6: Geolocation
-- ============================================
alter table public.properties
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

create index if not exists idx_properties_geo
  on public.properties(latitude, longitude);

-- ============================================
-- Section 7: Floor plan JSON
-- ============================================
alter table public.properties
  add column if not exists floor_plan jsonb;
