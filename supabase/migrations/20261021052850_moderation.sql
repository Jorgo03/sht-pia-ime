-- Moderation of reports (docs/LAUNCH_TASKS.md F3): a moderator role, a review
-- queue and two narrow actions, instead of reviewing in the Supabase dashboard.
--
-- moderators        who may moderate. Managed by the owner with SQL only
--                   (insert a user id); nobody can add themselves.
-- is_moderator()    the one check every moderator path uses.
-- content_reports   moderators can now read the queue; reporters still cannot
--                   read anything (no policy for them), so a reported person
--                   can never learn who reported them.
-- moderation_hold   set when a moderator hides a listing. While it is set,
--                   the owner cannot put the listing back online or clear the
--                   flag; only a moderator can.
-- moderate_listing() / resolve_report(): the only write paths, each checking
--                   is_moderator(). No broad UPDATE policy on properties or
--                   reports is added.
--
-- Additive. Applied 2026-10-21 (recorded version 20261021052850); live check
-- supabase/tests/rls_moderation.sql 12/12.

create table public.moderators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.moderators enable row level security;
create policy "Moderators see their own row" on public.moderators
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.moderators from anon, authenticated;
grant select on public.moderators to authenticated;

create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.moderators where user_id = (select auth.uid()));
$$;
revoke all on function public.is_moderator() from public, anon;
grant execute on function public.is_moderator() to authenticated;

alter table public.content_reports
  add column reviewed_by uuid references auth.users(id) on delete set null,
  add column resolution_note text check (char_length(resolution_note) <= 1000);

create policy "Moderators read reports" on public.content_reports
  for select to authenticated using (public.is_moderator());
grant select on public.content_reports to authenticated;

alter table public.properties
  add column moderation_hold boolean not null default false;

-- SECURITY INVOKER, like the other guards: it must see the caller's role.
create or replace function public.guard_moderation_hold()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.moderation_hold then
      raise exception 'moderation_hold is set by moderators only' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.moderation_hold is distinct from old.moderation_hold then
    raise exception 'moderation_hold is set by moderators only' using errcode = '42501';
  end if;
  if old.moderation_hold and new.status = 'active' then
    raise exception 'this listing is under review' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_moderation_hold() from public, anon, authenticated;

create trigger properties_guard_moderation_hold
  before insert or update on public.properties
  for each row execute function public.guard_moderation_hold();

create or replace function public.moderate_listing(p_property uuid, p_hide boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_moderator() then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  update public.properties
    set moderation_hold = p_hide,
        status = case
          when p_hide then 'pending_review'
          when status = 'pending_review' then 'active'
          else status
        end
    where id = p_property;
  if not found then
    raise exception 'listing not found' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.moderate_listing(uuid, boolean) from public, anon;
grant execute on function public.moderate_listing(uuid, boolean) to authenticated;

create or replace function public.resolve_report(p_report uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_moderator() then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  if p_status not in ('actioned', 'dismissed') then
    raise exception 'status must be actioned or dismissed' using errcode = '22023';
  end if;
  update public.content_reports
    set status = p_status,
        reviewed_at = now(),
        reviewed_by = (select auth.uid()),
        resolution_note = left(p_note, 1000)
    where id = p_report;
  if not found then
    raise exception 'report not found' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.resolve_report(uuid, text, text) from public, anon;
grant execute on function public.resolve_report(uuid, text, text) to authenticated;
