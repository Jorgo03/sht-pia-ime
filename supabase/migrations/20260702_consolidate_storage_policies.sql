-- property-images: collapse 10 overlapping policies into folder-scoped CRUD + public read
drop policy if exists "Agents can upload to their own folder" on storage.objects;
drop policy if exists "Agents can update images in their own folder" on storage.objects;
drop policy if exists "Agents can delete images in their own folder" on storage.objects;
drop policy if exists "Authenticated users can upload images" on storage.objects;
drop policy if exists "Authenticated users can upload property images" on storage.objects;
drop policy if exists "Users can delete own images" on storage.objects;
drop policy if exists "Users can delete own property images" on storage.objects;
drop policy if exists "Users can update own property images" on storage.objects;
drop policy if exists "Property images public read" on storage.objects;
drop policy if exists "Anyone can view property images" on storage.objects;

create policy "Property images public read" on storage.objects
  for select using (bucket_id = 'property-images');
create policy "Users upload to own property-images folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'property-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users update own property-images" on storage.objects
  for update to authenticated
  using (bucket_id = 'property-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users delete own property-images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'property-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- avatars: had no policies at all (uploads were impossible)
create policy "Avatar images public read" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "Users upload own avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users update own avatar" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users delete own avatar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
