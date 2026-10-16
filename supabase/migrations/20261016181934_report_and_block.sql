-- Report and block: required by Apple guideline 1.2 and Google Play's
-- user-generated-content policy for any app where users post content
-- (listings) and talk to each other (messages). See
-- replica/launch-checklist.md 1.5.
--
-- Applied 2026-10-16 on the owner's approval ("go report/block") as migration
-- 20261016181934. Verified live (rolled back): reports 8/8, blocks 11/11.
--
-- Additive only: two new tables, one helper function, and one RESTRICTIVE
-- policy on messages. Restrictive policies are ANDed with the existing
-- permissive ones, so this can only take away the ability to send a message to
-- someone who blocked you. It cannot widen anything. No existing table,
-- column, row or policy is altered or dropped.

-- 1. Reports ---------------------------------------------------------------
-- Anyone signed in can report a listing or a user. Nobody can read reports
-- through the API, not even the reporter. The owner reviews them in the
-- Supabase dashboard (service role), so a reported user can never find out
-- who reported them.
create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  reported_user_id uuid references auth.users(id) on delete cascade,
  reason text not null check (reason in ('spam', 'scam', 'wrong_info', 'unavailable', 'offensive', 'other')),
  details text check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint content_reports_has_target check (property_id is not null or reported_user_id is not null)
);

comment on table public.content_reports is
  'User reports of listings or users (store UGC requirement). Insert-only for clients; reviewed by the owner in the dashboard.';

-- One open report per person per target, so a single user cannot flood the
-- queue. A second report of the same thing fails with 23505, which the apps
-- treat as "already reported".
create unique index content_reports_one_open_per_target
  on public.content_reports (
    reporter_id,
    coalesce(property_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(reported_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status = 'open';

create index content_reports_open_queue on public.content_reports (created_at) where status = 'open';

alter table public.content_reports enable row level security;

create policy "Signed-in users file reports"
  on public.content_reports for insert to authenticated
  with check (reporter_id = (select auth.uid()) and status = 'open');

-- Column-level grant: a client may only fill in what it is reporting and why.
-- reporter_id, status and the timestamps always take their defaults.
revoke all on public.content_reports from anon, authenticated;
grant insert (property_id, reported_user_id, reason, details) on public.content_reports to authenticated;

-- 2. Blocks ----------------------------------------------------------------
create table public.user_blocks (
  blocker_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);

comment on table public.user_blocks is
  'Who each user has blocked. Visible only to the blocker. Enforced on messages by a restrictive policy.';

create index user_blocks_blocked on public.user_blocks (blocked_id);

alter table public.user_blocks enable row level security;

create policy "Users see their own blocks"
  on public.user_blocks for select to authenticated
  using (blocker_id = (select auth.uid()));

create policy "Users block others"
  on public.user_blocks for insert to authenticated
  with check (blocker_id = (select auth.uid()));

create policy "Users unblock"
  on public.user_blocks for delete to authenticated
  using (blocker_id = (select auth.uid()));

revoke all on public.user_blocks from anon, authenticated;
grant select, delete on public.user_blocks to authenticated;
grant insert (blocked_id) on public.user_blocks to authenticated;

-- 3. A blocked sender cannot message the person who blocked them -----------
-- The sender cannot read the recipient's blocks (RLS above), so the check runs
-- as a SECURITY DEFINER function that answers one yes/no question about the
-- caller and nothing else.
create function public.sender_is_blocked(conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversations c
    join public.user_blocks b
      on b.blocked_id = (select auth.uid())
     and b.blocker_id = case when c.client_id = (select auth.uid()) then c.agent_id else c.client_id end
    where c.id = conversation
  );
$$;

revoke all on function public.sender_is_blocked(uuid) from public, anon;
grant execute on function public.sender_is_blocked(uuid) to authenticated;

create policy "Blocked senders cannot message"
  on public.messages as restrictive for insert to authenticated
  with check (not public.sender_is_blocked(conversation_id));
