-- Supabase's default privileges grant EXECUTE on new public functions to anon.
-- Signed out these always answer false (no auth.uid()), but only signed-in
-- storage policies use them, so they are signed-in only.
revoke execute on function public.is_conversation_member(text) from anon;
revoke execute on function public.can_send_to_folder(text) from anon;
