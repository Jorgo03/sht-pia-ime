-- =============================================
-- TABLES MISSING FROM THE MIGRATION HISTORY — RECOVERY
-- =============================================
--
-- These seven tables exist in the production database but were never captured
-- in a migration: they were created by hand in the Supabase dashboard, so the
-- repo has no other DDL for them. Every later migration that references them
-- would fail on a fresh database without this file, and `supabase start` /
-- `supabase db reset` would stop before the schema is complete.
--
-- VERIFIED AGAINST PRODUCTION on 2026-10-07. This file was first written as a
-- reconstruction from indirect evidence (policies, indexes and app queries),
-- because production could not be inspected. It has since been rewritten from
-- production's own catalog — information_schema.columns, pg_constraint and
-- pg_indexes for project fho-marketplace — so columns, types, nullability,
-- defaults, foreign keys, CHECK domains and constraint names now match the
-- live tables exactly. The reconstruction differed in ways that changed
-- behaviour on a rebuilt database: viewings.status allowed 'declined' and
-- rejected 'completed' and 'no_show'; conversations.property_id cascaded, so
-- deleting a listing deleted its chats; and five columns the apps use were
-- missing (viewings.duration_minutes, messages.read_at, leads.email,
-- leads.status, saved_searches.last_match_count).
--
-- This migration is NOT recorded in production's
-- supabase_migrations.schema_migrations, because production never ran it: the
-- tables were made by hand. Before the first `supabase db push`, mark it as
-- applied so the CLI does not try to run it against tables that already exist:
--
--   supabase migration repair --status applied 20260702000000
--
-- Timestamped 20260702000000 so it runs before 20260702201520, the first
-- migration that touches any of these tables.
--
-- RLS is enabled here with NO policies, which is the state 20260702201520
-- describes ("RLS was enabled with no policies") and then remediates. Do not
-- add policies here: every policy on these tables belongs to a later
-- migration.
--
-- Indexes: only those production has that no later migration creates.
-- 20260815191112 owns the foreign-key indexes on conversations.agent_id,
-- conversations.property_id, leads.agent_id, saved_searches.user_id,
-- wanted_homes.client_id and viewings.property_id; 20260908055318 owns
-- messages.sender_id and property_views.user_id.

-- ---------- TABLES ----------

-- 1. SAVED_SEARCHES (named filter sets, created from AddSheet)
create table if not exists public.saved_searches (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  filters jsonb not null,
  alerts_enabled boolean default true,
  last_match_count integer default 0,
  created_at timestamptz default now()
);

-- 2. LEADS (an agent's private lead tracker)
create table if not exists public.leads (
  id uuid not null default gen_random_uuid() primary key,
  agent_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  notes text,
  status text default 'new'
    check (status in ('new', 'contacted', 'qualified', 'lost', 'won')),
  created_at timestamptz default now()
);

-- 3. WANTED_HOMES (reverse listings: a buyer posts what they want)
create table if not exists public.wanted_homes (
  id uuid not null default gen_random_uuid() primary key,
  client_id uuid not null references public.profiles(id) on delete cascade,
  city text not null,
  listing_type text not null check (listing_type in ('sale', 'rent')),
  max_price numeric,
  min_bedrooms integer,
  notes text,
  status text default 'open' check (status in ('open', 'matched', 'closed')),
  created_at timestamptz default now()
);

-- 4. VIEWINGS (viewing appointments between a client and the listing's agent)
create table if not exists public.viewings (
  id uuid not null default gen_random_uuid() primary key,
  property_id uuid not null references public.properties(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  agent_id uuid references public.profiles(id) on delete set null,
  scheduled_at timestamptz not null,
  duration_minutes integer default 30,
  status text not null default 'requested'
    check (status in ('requested', 'confirmed', 'cancelled', 'completed', 'no_show')),
  notes text,
  created_at timestamptz default now()
);

-- 5. PROPERTY_VIEWS (legacy analytics log, superseded by property_activity;
--    no code in either app reads or writes it)
create table if not exists public.property_views (
  id uuid not null default gen_random_uuid() primary key,
  property_id uuid not null references public.properties(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  viewed_at timestamptz default now()
);

-- 6. CONVERSATIONS (one client <-> agent thread, usually about one property).
--    property_id is SET NULL, not CASCADE: a conversation outlives its listing.
create table if not exists public.conversations (
  id uuid not null default gen_random_uuid() primary key,
  property_id uuid references public.properties(id) on delete set null,
  client_id uuid not null references public.profiles(id) on delete cascade,
  agent_id uuid not null references public.profiles(id) on delete cascade,
  last_message_at timestamptz default now(),
  unread_for_client integer default 0,
  unread_for_agent integer default 0,
  created_at timestamptz default now(),
  unique (client_id, agent_id, property_id)
);

-- 7. MESSAGES (chat messages inside a conversation)
create table if not exists public.messages (
  id uuid not null default gen_random_uuid() primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz default now()
);

-- ---------- INDEXES ----------
-- Present in production and created by no later migration.
-- conversations.client_id needs no index of its own: it leads the unique
-- constraint above.
create index if not exists idx_messages_conv
  on public.messages (conversation_id, created_at desc);
create index if not exists idx_views_property_date
  on public.property_views (property_id, viewed_at desc);
create index if not exists idx_viewings_agent_date
  on public.viewings (agent_id, scheduled_at);
create index if not exists idx_viewings_client
  on public.viewings (client_id);

-- ---------- ROW LEVEL SECURITY ----------
-- Enabled with zero policies, matching production before 20260702201520.
alter table public.saved_searches  enable row level security;
alter table public.leads           enable row level security;
alter table public.wanted_homes    enable row level security;
alter table public.viewings        enable row level security;
alter table public.property_views  enable row level security;
alter table public.conversations   enable row level security;
alter table public.messages        enable row level security;

-- handle_new_message() and its on_message_created trigger are NOT defined
-- here. An earlier version of this file had to, because the repo ran
-- harden_trigger_functions (which revokes it) before
-- tighten_properties_select_fix_signup_trigger (which creates it). With the
-- migrations carrying production's recorded versions, the create
-- (20260702201540) runs before the revoke (20260702203119), as it did in
-- production.
