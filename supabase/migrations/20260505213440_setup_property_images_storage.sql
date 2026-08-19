-- ---------- STORAGE BUCKET ----------
insert into storage.buckets (id, name, public)
values ('property-images', 'property-images', true)
on conflict (id) do nothing;

-- Storage policies — agents own a folder named after their UID
create policy "Property images are publicly viewable"
  on storage.objects for select
  using (bucket_id = 'property-images');

create policy "Agents can upload to their own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'property-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'agent'
    )
  );

create policy "Agents can update images in their own folder"
  on storage.objects for update
  using (
    bucket_id = 'property-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Agents can delete images in their own folder"
  on storage.objects for delete
  using (
    bucket_id = 'property-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
