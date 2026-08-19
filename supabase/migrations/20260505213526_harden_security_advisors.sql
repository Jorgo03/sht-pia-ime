-- 1. Pin search_path on handle_updated_at (was mutable)
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2. Lock down handle_new_user so it can ONLY run as a trigger,
-- not be called as a public RPC by anon or authenticated users.
revoke execute on function public.handle_new_user() from anon, authenticated, public;

-- 3. Tighten the public bucket: drop the broad SELECT policy.
-- Files in a public bucket are still accessible via their direct URL —
-- this only removes the ability to LIST all files in the bucket.
drop policy if exists "Property images are publicly viewable" on storage.objects;
