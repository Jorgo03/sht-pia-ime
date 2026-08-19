-- Task 2 safeguard: a moderation-queue status. RLS already hides every
-- non-'active' status from the public (SELECT policy: status='active' OR
-- owner/agent), so pending_review listings are invisible the moment the
-- value exists. The publish default is NOT changed: with no admin/review UI
-- yet, defaulting to pending_review would strand every new listing
-- invisible with nobody able to approve it (see DECISIONS.md MP2).
alter table public.properties drop constraint properties_status_check;
alter table public.properties add constraint properties_status_check
  check (status = any (array['active','pending','pending_review','sold','rented','paused','draft']));
