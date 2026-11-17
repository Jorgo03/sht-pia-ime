-- Saved-search email alerts (docs/LAUNCH_TASKS.md F13). Sending stays OFF
-- until the owner configures an email provider; see the Edge Function
-- saved-search-alerts for the switch. Applied 2026-10-21 after a rolled-back
-- live test of the same statements passed 7/7.
--
-- saved_searches gains:
--   email_alerts       the person's explicit opt-in, separate from the in-app
--                      "new matches" badge (alerts_enabled). Default off.
--   last_alerted_at    the end of the last window already handled, so a listing
--                      is considered once.
--   unsubscribe_token  the secret in the one-click unsubscribe link. Only the
--                      owner can read their rows (existing RLS), and the Edge
--                      Function looks it up with the service role.
--
-- saved_search_alert_deliveries: one row per (search, listing) ever queued.
-- The primary key is the duplicate-prevention: a listing can never be
-- emailed twice for the same search, however often the job runs or retries.
--
-- email_outbox: messages waiting to be sent, written and read only by Edge
-- Functions (service role). RLS on with no policy: unreachable from the apps.
-- dedupe_key is unique, so a retried run cannot queue the same email twice.

alter table public.saved_searches
  add column email_alerts boolean not null default false,
  add column last_alerted_at timestamptz,
  add column unsubscribe_token uuid not null default gen_random_uuid();

create unique index saved_searches_unsubscribe_token_key on public.saved_searches (unsubscribe_token);
create index saved_searches_email_alerts_idx on public.saved_searches (id) where email_alerts;

create table public.saved_search_alert_deliveries (
  saved_search_id uuid not null references public.saved_searches(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  queued_at timestamptz not null default now(),
  primary key (saved_search_id, property_id)
);
create index saved_search_alert_deliveries_property_idx on public.saved_search_alert_deliveries (property_id);
alter table public.saved_search_alert_deliveries enable row level security;
revoke all on public.saved_search_alert_deliveries from anon, authenticated;

create table public.email_outbox (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('saved_search_alert')),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check (char_length(subject) <= 200),
  body_text text not null,
  body_html text not null,
  dedupe_key text not null unique check (char_length(dedupe_key) <= 120),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text check (char_length(last_error) <= 500),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index email_outbox_pending_idx on public.email_outbox (created_at) where status = 'pending';
create index email_outbox_user_idx on public.email_outbox (user_id);
alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from anon, authenticated;

comment on table public.email_outbox is
  'Emails queued by Edge Functions. Service role only. Nothing is sent until the owner enables dispatch.';
