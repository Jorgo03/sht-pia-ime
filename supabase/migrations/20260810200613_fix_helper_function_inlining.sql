-- Still recursing after the SECURITY DEFINER helper, on the anon test which
-- never even reaches the wanted_homes branch. Root cause: a `language sql`
-- function is eligible for planner INLINING — Postgres can substitute its
-- body directly into the policy expression at query-rewrite time, before any
-- role/permission check runs. Inlined, the self-referencing subquery is back
-- in the profiles policy text verbatim, and the SECURITY DEFINER boundary
-- (a runtime privilege switch) never gets a chance to apply, since inlining
-- happens at rewrite/plan time, not execution time.
--
-- plpgsql functions are never inlined by the planner — they stay an opaque
-- call, so the recursion check at rewrite time sees no self-reference, and
-- the SECURITY DEFINER (owner-bypasses-own-RLS) protection actually applies
-- at the runtime call.

create or replace function public.current_user_is_agent()
returns boolean
language plpgsql
security definer
stable
set search_path = 'public'
as $$
begin
  return exists (
    select 1 from public.profiles where id = auth.uid() and role = 'agent'
  );
end;
$$;
