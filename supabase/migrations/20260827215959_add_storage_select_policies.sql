-- storage.objects had INSERT, UPDATE and DELETE policies for both buckets but
-- no SELECT policy at all. Storage resolves the object row before it will
-- delete it, so with no SELECT grant the owner's own delete came back
-- 403 "Access denied", and the bulk remove API returned 200 with an empty
-- array -- a silent no-op.
--
-- Two things were broken by that, both verified live before this migration:
--   * an agent could not remove a photo from their own listing;
--   * removeUploadedImages() -- the rollback both listing forms run when the
--     properties INSERT fails after the photos are already uploaded -- never
--     deleted anything, so every failed publish leaked its images into the
--     bucket permanently.
--
-- Scoped to the caller's own folder, which is the same `(storage.foldername
-- (name))[1] = auth.uid()` shape the existing INSERT/UPDATE/DELETE policies
-- use. This grants no new read access in practice: both buckets are already
-- `public = true`, so anyone can fetch an object through its public CDN URL.
-- What it adds is the ability for a user to enumerate and therefore delete
-- their OWN objects through the authenticated API.
create policy "Users read own property-images"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'property-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users read own avatar"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
