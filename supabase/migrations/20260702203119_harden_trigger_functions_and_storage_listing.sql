-- Trigger functions must not be callable through the REST RPC surface
revoke execute on function public.handle_new_message() from anon, authenticated, public;
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.handle_updated_at() from anon, authenticated, public;

-- Public buckets serve object URLs without SELECT policies; the broad SELECT
-- policies only added the ability to LIST every file in the bucket.
drop policy if exists "Property images public read" on storage.objects;
drop policy if exists "Avatar images public read" on storage.objects;
