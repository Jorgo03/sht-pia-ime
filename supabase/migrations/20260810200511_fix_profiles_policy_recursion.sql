-- The wanted_homes branch of the previous policy queried public.profiles
-- (to check the viewer's own role) from inside a policy ON public.profiles,
-- which is self-referential: evaluating the policy for any row required
-- re-evaluating the same policy to check the viewer's row, recursively.
-- Confirmed live: 42P17 infinite recursion on the very first test query.
--
-- Fix: a SECURITY DEFINER helper. It runs as the function owner (the table
-- owner), which Postgres exempts from RLS on tables it owns by default — so
-- the lookup inside the function bypasses the policy instead of re-entering
-- it. auth.uid() still resolves to the real caller inside the function
-- (it reads a session-level GUC, unaffected by the owner-privilege switch).

create or replace function public.current_user_is_agent()
returns boolean
language sql
security definer
stable
set search_path = 'public'
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'agent'
  );
$$;

revoke all on function public.current_user_is_agent() from public;
grant execute on function public.current_user_is_agent() to authenticated;

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
    and exists (
      select 1 from public.wanted_homes w
      where w.client_id = profiles.id and w.status = 'open'
    )
  )
);
