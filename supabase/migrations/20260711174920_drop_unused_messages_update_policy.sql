-- Either participant could UPDATE any column of any message in their
-- conversation, including the other side's body. No app code updates
-- messages (mark-read lives on conversations.unread_*). Drop the policy;
-- re-add a sender-scoped one if/when message editing ships.
drop policy if exists "Participants update messages" on public.messages;
