-- =============================================
-- TABLES MISSING FROM THE MIGRATION HISTORY — RECOVERY
-- =============================================
--
-- These seven tables exist in the production database but were never captured
-- in a migration: they were created by hand in the Supabase dashboard, so the
-- repo has no DDL for them. Every later migration that references them
-- therefore fails on a fresh database, and `supabase start` / `supabase db
-- reset` currently stops before the schema is complete (see
-- supabase/seed_local.sql, "Nothing is written to saved_searches, leads,
-- wanted_homes, viewings, conversations, messages or property_views", and
-- AUDIT.md §1.3).
--
-- This file reconstructs them from the only evidence the repo actually has:
-- the RLS policies added in 20260702000003, the FK indexes added in
-- 20260815191112, the policy rewrites in 20260810200209 / 20260810200511 /
-- 20260810200825 / 20260815191225, the handle_new_message trigger and
-- realtime publication in 20260702000005 / 20260823180919, and every
-- .from('<table>') query in the Expo app (app/, hooks/) and the Vite web app
-- (src/). It is a reconstruction, not a dump: column choices that the
-- evidence does not pin down are listed at the bottom of this file.
--
-- Timestamped 20260702000000 so it runs before 20260702000003, the first
-- migration that touches any of these tables.
--
-- RLS is enabled here with NO policies, which is exactly the production state
-- 20260702000003 describes ("RLS was enabled with no policies") and then
-- remediates. Do not add policies here — every policy on these tables belongs
-- to a later migration, and the one policy a later migration drops
-- (20260711174920, "Participants update messages") is dropped with
-- `if exists`, so it does not need to pre-exist.

-- ---------- TABLES ----------

-- 1. SAVED_SEARCHES (named filter sets, created from AddSheet)
create table if not exists public.saved_searches (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  filters jsonb default '{}'::jsonb,
  alerts_enabled boolean not null default true,
  created_at timestamptz default now() not null
);

-- 2. LEADS (an agent's private lead tracker)
create table if not exists public.leads (
  id uuid default gen_random_uuid() primary key,
  agent_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  phone text,
  notes text,
  created_at timestamptz default now() not null
);

-- 3. WANTED_HOMES (reverse listings: a buyer posts what they want)
create table if not exists public.wanted_homes (
  id uuid default gen_random_uuid() primary key,
  client_id uuid not null references public.profiles(id) on delete cascade,
  city text not null,
  listing_type text not null default 'sale' check (listing_type in ('sale','rent')),
  max_price numeric(12,2),
  min_bedrooms integer,
  notes text,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz default now() not null
);

-- 4. VIEWINGS (viewing appointments between a client and the listing's agent)
create table if not exists public.viewings (
  id uuid default gen_random_uuid() primary key,
  property_id uuid not null references public.properties(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  agent_id uuid references public.profiles(id) on delete set null,
  scheduled_at timestamptz not null,
  notes text,
  status text not null default 'requested'
    check (status in ('requested','confirmed','declined','cancelled')),
  created_at timestamptz default now() not null
);

-- 5. PROPERTY_VIEWS (legacy analytics log, superseded by property_activity;
--    unused by both apps, so only the columns the migrations reference are
--    recoverable)
create table if not exists public.property_views (
  id uuid default gen_random_uuid() primary key,
  property_id uuid references public.properties(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz default now() not null
);

-- 6. CONVERSATIONS (one client ↔ agent thread, usually about one property)
create table if not exists public.conversations (
  id uuid default gen_random_uuid() primary key,
  property_id uuid references public.properties(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  agent_id uuid not null references public.profiles(id) on delete cascade,
  last_message_at timestamptz default now(),
  unread_for_client integer not null default 0,
  unread_for_agent integer not null default 0,
  created_at timestamptz default now() not null
);

-- 7. MESSAGES (chat messages inside a conversation)
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz default now() not null
);

-- ---------- INDEXES ----------
-- Only the indexes the pre-existing production tables must already have had.
-- The FK columns that 20260815191112 indexes (conversations.agent_id,
-- conversations.property_id, leads.agent_id, saved_searches.user_id,
-- wanted_homes.client_id, viewings.property_id) are deliberately NOT created
-- here: the Supabase advisor listed them as UNINDEXED foreign keys
-- (AUDIT.md P3.3), which is proof the hand-made originals had no index on
-- them, and that migration owns them.
--
-- idx_messages_conv is named outright in 20260815191112:3-4 ("messages are
-- always fetched by conversation_id, which already has idx_messages_conv").
create index if not exists idx_messages_conv on public.messages(conversation_id);

-- The advisor's unindexed-FK list covered 8 columns across 8 tables and
-- shrank to exactly the 3 intentionally-skipped ones after 20260815191112
-- (AUDIT.md P3.3 + the post-migration re-check). That arithmetic only works
-- if conversations.client_id and property_views.property_id were already
-- indexed in production — they are the two FK columns on these tables that
-- neither appear in the leftover list nor get an index from that migration.
-- Index names are a guess; only their existence is evidenced.
create index if not exists idx_conversations_client_id  on public.conversations(client_id);
create index if not exists idx_property_views_property_id on public.property_views(property_id);

-- ---------- TRIGGER FUNCTIONS ----------

-- handle_new_message() was created out-of-band alongside these tables, and is
-- missing from the history the same way they are:
-- 20260702000004_harden_trigger_functions_and_storage_listing.sql:2 does
-- `revoke execute on function public.handle_new_message()` while the only
-- `create or replace` for it lives in 20260702000005 — one file LATER. On a
-- fresh database that revoke aborts with "function does not exist", so the
-- chain cannot complete without this definition existing first. Body is
-- byte-identical to the one 20260702000005 replaces it with; that migration
-- also creates the on_message_created trigger, so none is created here.
create or replace function public.handle_new_message()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.conversations
  set last_message_at = now(),
      unread_for_client = unread_for_client + (case when new.sender_id = agent_id then 1 else 0 end),
      unread_for_agent  = unread_for_agent  + (case when new.sender_id = client_id then 1 else 0 end)
  where id = new.conversation_id;
  return new;
end;
$$;

-- ---------- ROW LEVEL SECURITY ----------
-- Enabled with zero policies, matching production. 20260702000003 adds them.
alter table public.saved_searches  enable row level security;
alter table public.leads           enable row level security;
alter table public.wanted_homes    enable row level security;
alter table public.viewings        enable row level security;
alter table public.property_views  enable row level security;
alter table public.conversations   enable row level security;
alter table public.messages        enable row level security;

-- =============================================
-- UNCERTAIN CHOICES
-- =============================================
-- Everything below is reconstructed, not recovered. Each item is a place the
-- repo does not pin the answer down; none of them changes whether the later
-- migrations apply.
--
-- FK TARGETS — profiles(id) vs auth.users(id). profiles.id IS auth.users.id
-- (20260505213429:9), and the repo uses both conventions: favorites.user_id
-- and properties.agent_id point at public.profiles, while properties.owner_id
-- and property_activity.user_id point at auth.users. Chosen per table by
-- closest sibling: profiles for leads.agent_id, wanted_homes.client_id,
-- viewings.client_id/agent_id, conversations.client_id/agent_id and
-- messages.sender_id; auth.users for saved_searches.user_id and
-- property_views.user_id. Every policy, trigger and query works either way.
--
-- WHETHER THE FKs EXIST AT ALL — AUDIT.md P3.3 proves a foreign key exists on
-- one column per table, not on all of them. Declaring the rest as FKs is
-- possibly stricter than production, never looser.
--
-- ON DELETE ACTIONS — conversations.property_id uses `cascade` to match the
-- repo convention, but `set null` is arguably the real intent: property_id is
-- nullable, so a conversation can outlive its listing, and cascade silently
-- deletes chat history when a listing is removed. viewings.agent_id and
-- property_views.user_id use `set null` (the row should survive the person);
-- everything else cascades.
--
-- CHECK CONSTRAINTS — the four viewings statuses and the wanted_homes
-- listing_type/status domains are the only values that appear anywhere in
-- either codebase, but the constraints themselves are inferred from the
-- properties convention. No app code can violate them. If production carries
-- no CHECK, a hand-inserted out-of-domain value would not round-trip locally.
--
-- NOT NULL — derived from the TS row interfaces plus every insert site always
-- supplying the column (viewings property_id/client_id/scheduled_at,
-- wanted_homes.city, leads.name, messages.body, saved_searches.name,
-- conversations.client_id/agent_id). conversations.unread_for_* are NOT NULL
-- because handle_new_message() does `unread_for_client + ...`, which a NULL
-- would poison permanently — the TS interfaces type them `number | null`, but
-- no code path ever writes NULL.
--
-- conversations.last_message_at DEFAULT now() — production may have no
-- default (both apps type it `string | null`, and web's startChat creates a
-- conversation before any message exists). Harmless either way: the
-- on_message_created trigger overwrites it on the first message.
--
-- NO UNIQUE CONSTRAINT ON conversations — the find-or-create in
-- PropertyDetail.jsx:78-88 / app/property/[id].tsx:121-131 uses
-- .maybeSingle() over (property_id, client_id, agent_id), which reads like it
-- expects uniqueness. A plain index is used instead: a spurious UNIQUE could
-- reject legitimate inserts, and nullable property_id would leave it
-- non-enforcing anyway.
--
-- NO updated_at ANYWHERE — no migration creates an updated_at trigger for any
-- of these tables (handle_updated_at is wired only to profiles and
-- properties, 20260505213429:71-77), no app query reads one, and
-- 20260711174920 states no app code ever UPDATEs a message. If production has
-- such columns they are unused.
--
-- INDEX NAMES / SHAPE — idx_conversations_client_id and
-- idx_property_views_property_id are inferred from the advisor arithmetic
-- above, so their names are guesses. idx_messages_conv's name is evidenced
-- but its shape is not: every read is
-- .eq('conversation_id', id).order('created_at'), so production may hold a
-- composite (conversation_id, created_at) — which satisfies the same
-- FK-index advisor check.
--
-- COLUMN ORDER — unknowable for dashboard-created tables. Irrelevant here:
-- nothing in either codebase does a positional INSERT.
--
-- property_views EXTRA COLUMNS — ip, user_agent, session_id, referrer,
-- duration and similar are plausible for a view-tracking table but have zero
-- traces in migrations, app/, src/, hooks/, lib/, contexts/, tests/ or the
-- docs, so none were invented.
--
-- leads HAS NO OTHER FK — AUDIT.md P3.3 lists leads exactly once, for
-- agent_id. A second FK (property_id, conversation_id, …) would have been
-- flagged too, so none was added. Likewise no status/source/email column:
-- nothing in the code, the i18n bundles (only leadName, leadPhone, notes) or
-- the docs mentions one.
--
-- REALTIME — none of these tables is added to the supabase_realtime
-- publication here. 20260702000005 adds conversations and messages;
-- 20260823180919 adds viewings and confirms the publication held only those
-- first two before it.
