-- Moderators can see what was reported (docs/LAUNCH_TASKS.md F3).
--
-- A report about a hidden listing, or about a buyer, pointed at a row the
-- moderator could not read: listings under review are visible only to their
-- owner, and buyer profiles only to people they deal with. Two read-only
-- policies close that gap for moderators and nobody else; no write access is
-- added (writes stay in moderate_listing() and resolve_report()).
--
-- is_moderator() is wrapped in a scalar subquery so Postgres evaluates it once
-- per statement rather than once per row (the same pattern as auth.uid()).

alter policy "Moderators read reports" on public.content_reports
  using ((select public.is_moderator()));

create policy "Moderators read listings" on public.properties
  for select to authenticated using ((select public.is_moderator()));

create policy "Moderators read profiles" on public.profiles
  for select to authenticated using ((select public.is_moderator()));

-- Applied 2026-10-21. Live checks: supabase/tests/rls_moderation_read.sql 6/6,
-- rls_moderation.sql 12/12 and rls_ownership_guards.sql 15/15 afterwards.
