-- Rate-limit ledger for AI edge functions. Written only by the service role
-- inside edge functions; RLS enabled with no policies keeps clients out.
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  key text not null,          -- user id or client IP
  feature text not null,      -- 'generate-listing' | 'parse-search' | 'listing-assistant'
  created_at timestamptz not null default now()
);
create index ai_usage_lookup_idx on public.ai_usage (key, feature, created_at);
alter table public.ai_usage enable row level security;
