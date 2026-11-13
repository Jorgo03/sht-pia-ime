-- Photos and documents in chats (app/messages/[id].tsx;
-- src/features/messaging/lib/attachments.js).
--
-- A message may carry one file. The file lives in a PRIVATE bucket,
-- message-attachments, under the conversation's own folder:
--   <conversation id>/<time>-<random>.<ext>
-- Only the two people in that conversation can upload into its folder or read
-- from it; nobody else, signed in or not, can read a file even with its path.
-- The app shows a file through a short-lived signed URL.
--
-- The message row records what was sent: { path, name, mime, size, kind }.
-- The database checks the path is inside this conversation's folder, so a
-- message cannot point at another conversation's file, and the type and size
-- match the bucket's own limits. The text may now be empty when a file is
-- attached; it is still at most 4000 characters (src/lib/formLimits.js).
--
-- Blocked senders: the existing policy already refuses their messages, and the
-- upload policy refuses their files too.
-- Applied live as migration 20261111234947 (anon EXECUTE on the two helpers
-- revoked in 20261111235008). Check: supabase/tests/rls_message_attachments.sql.

alter table public.messages add column if not exists attachment jsonb;

alter table public.messages drop constraint if exists messages_body_length;
alter table public.messages
  add constraint messages_body_length check (
    char_length(btrim(body)) <= 4000
    and (char_length(btrim(body)) >= 1 or attachment is not null)
  );

alter table public.messages drop constraint if exists messages_attachment_shape;
alter table public.messages
  add constraint messages_attachment_shape check (
    attachment is null or (
      jsonb_typeof(attachment) = 'object'
      and attachment->>'path' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9]+-[a-z0-9]+\.(jpg|png|webp|pdf|doc|docx|xls|xlsx|txt)$'
      and split_part(attachment->>'path', '/', 1) = conversation_id::text
      and attachment->>'mime' in (
        'image/jpeg', 'image/png', 'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain'
      )
      and attachment->>'kind' in ('image', 'file')
      and jsonb_typeof(attachment->'size') = 'number'
      and (attachment->>'size')::numeric between 1 and 10485760
      and char_length(coalesce(attachment->>'name', '')) between 1 and 200
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-attachments',
  'message-attachments',
  false,
  10485760,
  array[
    'image/jpeg', 'image/png', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- True when the folder name is a conversation the caller takes part in. Text
-- in, so a folder that is not a uuid is simply "no" rather than a cast error.
create or replace function public.is_conversation_member(p_folder text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_folder is null or p_folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return exists (
    select 1 from public.conversations c
    where c.id = p_folder::uuid
      and (select auth.uid()) in (c.client_id, c.agent_id)
  );
end;
$$;

revoke all on function public.is_conversation_member(text) from public;
grant execute on function public.is_conversation_member(text) to authenticated;

-- Same as the message policy: a blocked sender cannot add files either.
create or replace function public.can_send_to_folder(p_folder text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_conversation_member(p_folder) then
    return false;
  end if;
  return not public.sender_is_blocked(p_folder::uuid);
end;
$$;

revoke all on function public.can_send_to_folder(text) from public;
grant execute on function public.can_send_to_folder(text) to authenticated;

drop policy if exists "Participants upload message attachments" on storage.objects;
create policy "Participants upload message attachments"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'message-attachments'
    and public.can_send_to_folder((storage.foldername(name))[1])
  );

drop policy if exists "Participants read message attachments" on storage.objects;
create policy "Participants read message attachments"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'message-attachments'
    and public.is_conversation_member((storage.foldername(name))[1])
  );

-- Only the uploader removes a file: the app does it when the message that
-- would carry the file was refused, so no file is left without a message.
drop policy if exists "Senders delete own message attachments" on storage.objects;
create policy "Senders delete own message attachments"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'message-attachments'
    and owner_id = (select auth.uid())::text
  );
