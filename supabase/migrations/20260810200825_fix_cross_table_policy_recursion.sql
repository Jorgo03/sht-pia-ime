-- Actual root cause of the recursion (my earlier fix addressed a different,
-- non-blocking issue): wanted_homes already has its own SELECT policy
-- ("Agents can view open wanted homes") that queries public.profiles
-- internally to check the viewer's role. So the cycle is cross-table:
--   profiles policy --(my EXISTS on wanted_homes)--> wanted_homes
--   wanted_homes's OWN policy --(its EXISTS on profiles)--> profiles
--   -> back to the profiles policy -> ...
-- current_user_is_agent() only stopped profiles from referencing itself
-- directly; it never touched this indirect, cross-table loop.
--
-- Same fix, applied to the actual source: a SECURITY DEFINER plpgsql helper
-- that reads wanted_homes as the table owner (postgres, force_rls=false),
-- which bypasses wanted_homes' own RLS for this one lookup — so evaluating
-- it never re-enters wanted_homes' policy, and therefore never loops back to
-- profiles at all.

create or replace function public.buyer_has_open_wanted_home(target_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = 'public'
as $$
begin
  return exists (
    select 1 from public.wanted_homes where client_id = target_id and status = 'open'
  );
end;
$$;

revoke all on function public.buyer_has_open_wanted_home(uuid) from public;
grant execute on function public.buyer_has_open_wanted_home(uuid) to authenticated;

drop policy "Profiles visible to self, agents publicly, or an existing relationship" on public.profiles;

create policy "Profiles visible to self, agents publicly, or an existing relationship"
on public.profiles for select
using (
  role = 'agent'
  or auth.uid() = id
  or exists (
    select 1 from public.viewings v
    where v.client_id = profiles.id and v.agent_id = auth.uid()
  )
  or exists (
    select 1 from public.conversations c
    where c.client_id = profiles.id and c.agent_id = auth.uid()
  )
  or (
    public.current_user_is_agent()
    and public.buyer_has_open_wanted_home(profiles.id)
  )
);
