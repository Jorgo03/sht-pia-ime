-- Applied 2026-10-21 as migration 20261021002739, under the owner's "go" in
-- the completion prompt (docs/LAUNCH_TASKS.md L13, AUDIT.md S-4). Verified
-- after applying: signed out still sees the same 6 agent profiles, and a
-- signed-out call to buyer_has_open_wanted_home() fails with 42501.
--
-- Problem: current_user_is_agent() and buyer_has_open_wanted_home(uuid) are
-- SECURITY DEFINER and executable while signed out. The second answers "does
-- this user id have an open wanted-home post?" for any id, to anyone.
--
-- Why a plain REVOKE is wrong: the profiles SELECT policy
-- "Profiles visible to self, agents publicly, or an existing relat…" applies
-- to every role (TO public) and is the only policy that calls the helpers.
-- Revoking EXECUTE from anon alone would make every signed-out read of
-- profiles (agent pages, agent names on listings) fail with "permission
-- denied for function".
--
-- Fix, with the same visibility as today:
--   1. narrow that policy to signed-in users (its expression is unchanged);
--   2. give signed-out visitors their own policy: agents only. That is the
--      only branch of the old expression that can be true for anon, because
--      auth.uid() is null for anon, so "self", "viewing", "conversation" and
--      "agent browsing a buyer" are all false;
--   3. revoke EXECUTE on the two helpers from anon (and PUBLIC).
-- No DROP: the policy is altered in place.
--
-- Tested 2026-10-21 inside a rolled-back transaction on the live project:
-- signed-out visible profiles 6 before / 6 after; each of the 15 accounts sees
-- exactly the same number of profiles before and after; signed-out calls to
-- both helpers now fail with 42501. Nothing was kept.
--
-- Rollback after applying:
--   alter policy "Profiles visible to self, agents publicly, or an existing relat" on public.profiles to public;
--   drop policy "Signed-out visitors see agent profiles" on public.profiles;
--   grant execute on function public.current_user_is_agent() to anon;
--   grant execute on function public.buyer_has_open_wanted_home(uuid) to anon;

alter policy "Profiles visible to self, agents publicly, or an existing relat"
  on public.profiles to authenticated;

create policy "Signed-out visitors see agent profiles"
  on public.profiles for select to anon
  using (role = 'agent');

revoke execute on function public.current_user_is_agent() from public, anon;
revoke execute on function public.buyer_has_open_wanted_home(uuid) from public, anon;
