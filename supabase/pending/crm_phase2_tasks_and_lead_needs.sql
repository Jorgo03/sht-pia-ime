-- CRM phase 2 (docs/BSP_CRM_ANALYSIS.md): an agent's tasks with reminders, and
-- what each lead is looking for, so leads can be matched to listings the way
-- buyer requests already are.
--
-- PENDING: not applied. Apply on the owner's go, then move into
-- supabase/migrations/ under the version Supabase records. Checked in a
-- rolled-back transaction on 2026-10-27 (see the end of this file).
-- Everything is additive: no column is dropped or rewritten, and the one
-- existing CHECK change (push_outbox.kind) only widens the allowed values.
--
-- After applying, push-dispatch needs a title and body for kind 'task_due'
-- (an Edge Function deploy), and something has to call
-- enqueue_task_reminders() every few minutes. pg_cron is not installed in this
-- project (checked 2026-10-27): either enable it (Dashboard, Database,
-- Extensions, pg_cron) and run the statement at the end once, or have
-- push-dispatch call the function at the start of each run.

-- 1. What a lead wants. All optional: a lead can be just a name and a phone.
alter table public.leads
  add column wanted_city text check (char_length(wanted_city) <= 80),
  add column wanted_listing_type text check (wanted_listing_type in ('sale', 'rent')),
  add column wanted_max_price numeric check (wanted_max_price > 0 and wanted_max_price < 1e9),
  add column wanted_min_bedrooms integer check (wanted_min_bedrooms between 0 and 20),
  add column updated_at timestamptz not null default now();

-- Server-side limits matching the app's form (src/features/leads/lib/leads.js
-- LEAD_LIMITS), so a direct API call cannot store a novel in a name. NOT VALID
-- keeps any older, longer row as it is; new and edited rows are checked.
alter table public.leads
  add constraint leads_name_length check (char_length(name) between 1 and 120) not valid,
  add constraint leads_phone_length check (char_length(phone) <= 32) not valid,
  add constraint leads_email_length check (char_length(email) <= 254) not valid,
  add constraint leads_notes_length check (char_length(notes) <= 2000) not valid;

-- 2. Tasks: a call to make, a document to send, a follow-up. Optionally about
-- one lead, one listing or one viewing of the same agent.
create table public.agent_tasks (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  notes text check (char_length(notes) <= 2000),
  due_at timestamptz,
  done_at timestamptz,
  remind boolean not null default true,
  reminded_at timestamptz,
  lead_id uuid references public.leads(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  viewing_id uuid references public.viewings(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.agent_tasks is
  'An agent''s own to-dos with an optional due time and push reminder (CRM phase 2).';

-- The agenda reads open tasks by due time; the FKs need their own indexes.
create index agent_tasks_open_by_due on public.agent_tasks (agent_id, due_at) where done_at is null;
create index agent_tasks_lead_id on public.agent_tasks (lead_id) where lead_id is not null;
create index agent_tasks_property_id on public.agent_tasks (property_id) where property_id is not null;
create index agent_tasks_viewing_id on public.agent_tasks (viewing_id) where viewing_id is not null;
create index agent_tasks_reminders_due on public.agent_tasks (due_at)
  where done_at is null and remind and reminded_at is null and due_at is not null;

alter table public.agent_tasks enable row level security;

-- Only the agent sees and changes their tasks. A task may point only at the
-- agent's own lead, a listing they own or manage, and a viewing of theirs.
create policy "Agents read own tasks" on public.agent_tasks
  for select to authenticated using ((select auth.uid()) = agent_id);
create policy "Agents delete own tasks" on public.agent_tasks
  for delete to authenticated using ((select auth.uid()) = agent_id);
create policy "Agents add own tasks" on public.agent_tasks
  for insert to authenticated with check (
    (select auth.uid()) = agent_id
    and (lead_id is null or exists (select 1 from public.leads l where l.id = lead_id and l.agent_id = (select auth.uid())))
    and (property_id is null or exists (
      select 1 from public.properties p where p.id = property_id
        and ((select auth.uid()) = p.owner_id or (select auth.uid()) = p.agent_id)))
    and (viewing_id is null or exists (
      select 1 from public.viewings v where v.id = viewing_id and v.agent_id = (select auth.uid())))
  );
create policy "Agents change own tasks" on public.agent_tasks
  for update to authenticated
  using ((select auth.uid()) = agent_id)
  with check (
    (select auth.uid()) = agent_id
    and (lead_id is null or exists (select 1 from public.leads l where l.id = lead_id and l.agent_id = (select auth.uid())))
    and (property_id is null or exists (
      select 1 from public.properties p where p.id = property_id
        and ((select auth.uid()) = p.owner_id or (select auth.uid()) = p.agent_id)))
    and (viewing_id is null or exists (
      select 1 from public.viewings v where v.id = viewing_id and v.agent_id = (select auth.uid())))
  );

-- reminded_at is the reminder job's, not the app's: a client could otherwise
-- silence or replay reminders by hand. A new due time re-arms the reminder.
create or replace function public.agent_tasks_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.reminded_at := null;
  elsif new.due_at is distinct from old.due_at then
    new.reminded_at := null;
  elsif current_user <> 'postgres' and current_user <> 'service_role' then
    new.reminded_at := old.reminded_at;
  end if;
  return new;
end;
$$;

create trigger agent_tasks_guard
  before insert or update on public.agent_tasks
  for each row execute function public.agent_tasks_guard();

create or replace function public.leads_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger leads_touch
  before update on public.leads
  for each row execute function public.leads_touch();

-- 3. Reminders through the existing push queue: 30 minutes before a task is
-- due, once. push-dispatch sends whatever is pending.
alter table public.push_outbox drop constraint push_outbox_kind_check;
alter table public.push_outbox add constraint push_outbox_kind_check
  check (kind in ('message', 'viewing_requested', 'viewing_updated', 'task_due'));

create or replace function public.enqueue_task_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  queued integer;
begin
  with due as (
    update public.agent_tasks t
       set reminded_at = now()
     where t.done_at is null
       and t.remind
       and t.reminded_at is null
       and t.due_at is not null
       and t.due_at <= now() + interval '30 minutes'
       and t.due_at > now() - interval '1 day'
    returning t.id, t.agent_id, t.title, t.due_at
  )
  insert into public.push_outbox (user_id, kind, data, dedupe_key)
  select d.agent_id, 'task_due',
         jsonb_build_object('task_id', d.id, 'title', left(d.title, 120), 'due_at', d.due_at),
         'task_due:' || d.id || ':' || extract(epoch from d.due_at)::bigint
    from due d
  on conflict (dedupe_key) do nothing;
  get diagnostics queued = row_count;
  return queued;
end;
$$;

revoke all on function public.enqueue_task_reminders() from public, anon, authenticated;

-- With pg_cron enabled, run once, for every 5 minutes:
--   select cron.schedule('enqueue-task-reminders', '*/5 * * * *', 'select public.enqueue_task_reminders()');

-- Dry run, 2026-10-27, on production inside a transaction that was discarded
-- (verified afterwards: no agent_tasks table, no new lead columns, push_outbox
-- kind check unchanged). With one task due in 10 minutes and one next week:
--   first enqueue_task_reminders(): 1 queued, 1 push_outbox row of kind task_due;
--   the task due next week left alone; a second run queued 0 (no repeats);
--   leads.updated_at set on edit; `authenticated` cannot execute the job.
