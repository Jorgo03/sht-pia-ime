-- H1 remediation. Genuinely unauthenticated scraping is already blocked
-- (Phase 1's `revoke all ... from anon`). What remains: the SELECT policy is
-- `USING (true)` for authenticated too, so any signed-up account can read
-- every column — including phone/bio — of any other user's profile, with no
-- relationship at all.
--
-- Swept every .select() touching profiles in both codebases (web + RN):
-- every legitimate read is already bounded by an existing relationship
-- (own conversation, own viewing, an open wanted_homes lead, or the target
-- being an agent, which is intentionally public marketing). This policy
-- encodes exactly those relationships and nothing broader. The
-- wanted_homes-lead branch is deliberately UNRESTRICTED to any agent — that
-- is an intentional lead-generation feature, not a bug, and is preserved
-- exactly as it behaves today.

drop policy "Profiles are viewable by everyone" on public.profiles;

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
  or exists (
    select 1 from public.wanted_homes w
    join public.profiles me on me.id = auth.uid()
    where w.client_id = profiles.id and w.status = 'open' and me.role = 'agent'
  )
);
