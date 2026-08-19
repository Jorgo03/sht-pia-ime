-- =============================================
-- REAL ESTATE MARKETPLACE — FOUNDATION SCHEMA
-- =============================================

-- ---------- TABLES ----------

-- 1. PROFILES (extends auth.users)
create table public.profiles (
  id uuid not null references auth.users on delete cascade primary key,
  full_name text,
  avatar_url text,
  phone text,
  role text not null default 'buyer' check (role in ('buyer', 'agent')),
  agency_name text,
  bio text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 2. PROPERTIES
create table public.properties (
  id uuid default gen_random_uuid() primary key,
  agent_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  price numeric(12,2) not null,
  address text not null,
  city text,
  sqft integer,
  beds integer,
  baths numeric(3,1),
  property_type text check (property_type in ('apartment','house','land','commercial')),
  listing_type text not null default 'sale' check (listing_type in ('sale','rent')),
  image_urls text[] not null default '{}'::text[],
  status text not null default 'active' check (status in ('active','pending','sold','draft')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 3. FAVORITES (junction table)
create table public.favorites (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  created_at timestamptz default now() not null,
  unique (user_id, property_id)
);

-- ---------- INDEXES ----------
create index idx_properties_agent_id   on public.properties(agent_id);
create index idx_properties_status     on public.properties(status);
create index idx_properties_price      on public.properties(price);
create index idx_properties_city       on public.properties(city);
create index idx_properties_type       on public.properties(property_type);
create index idx_favorites_user_id     on public.favorites(user_id);
create index idx_favorites_property_id on public.favorites(property_id);

-- ---------- TRIGGERS ----------

-- Auto-update `updated_at`
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger properties_updated_at
  before update on public.properties
  for each row execute function public.handle_updated_at();

-- Auto-create profile when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, agency_name, phone)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_user_meta_data->>'role', 'buyer'),
    new.raw_user_meta_data->>'agency_name',
    new.raw_user_meta_data->>'phone'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- ROW LEVEL SECURITY ----------
alter table public.profiles   enable row level security;
alter table public.properties enable row level security;
alter table public.favorites  enable row level security;

-- PROFILES policies
create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- PROPERTIES policies
create policy "Properties are viewable by everyone"
  on public.properties for select
  using (true);

create policy "Only agents can create properties"
  on public.properties for insert
  with check (
    auth.uid() = agent_id
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'agent'
    )
  );

create policy "Agents can update own properties"
  on public.properties for update
  using (auth.uid() = agent_id)
  with check (auth.uid() = agent_id);

create policy "Agents can delete own properties"
  on public.properties for delete
  using (auth.uid() = agent_id);

-- FAVORITES policies
create policy "Users can view own favorites"
  on public.favorites for select
  using (auth.uid() = user_id);

create policy "Users can add own favorites"
  on public.favorites for insert
  with check (auth.uid() = user_id);

create policy "Users can remove own favorites"
  on public.favorites for delete
  using (auth.uid() = user_id);
