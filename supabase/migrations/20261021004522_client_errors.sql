-- Crash and error reports from both apps (docs/LAUNCH_TASKS.md F11), without
-- a third-party service: no new account, no SDK, no cost.
--
-- What is stored, and what is not:
--   * platform, app version, the route (path only, never a query string), the
--     kind of failure, a short message, a stack trace and a fingerprint.
--   * NO user id, email, name, phone, token or message text. The apps redact
--     before sending (src/lib/errorReport.js); the trigger below redacts again
--     on the server, so a client that skips redaction still cannot store an
--     email address, a phone number or a token.
--
-- Insert-only from the apps (anon and authenticated: a crash before sign-in is
-- the most important kind). Nobody can read reports through the API; the owner
-- reads them in the Supabase dashboard (Table editor -> client_errors).
--
-- Flood guard: a report is silently dropped when the same fingerprint already
-- arrived 20 times in the last hour, or when 2000 reports in total arrived in
-- the last hour. Dropping (RETURN NULL) instead of raising keeps a crashing
-- app from retrying.
--
-- Retention: prune_client_errors() in 20261021004530. Redaction order fixed
-- in 20261021004604 (ids before phone numbers). Applied 2026-10-21; live check
-- supabase/tests/rls_client_errors.sql 7/7.

create table public.client_errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  platform text not null check (platform in ('web', 'ios', 'android')),
  app_version text check (char_length(app_version) <= 32),
  route text check (char_length(route) <= 200),
  kind text not null check (kind in ('render', 'uncaught', 'unhandled_rejection')),
  message text not null check (char_length(message) between 1 and 500),
  stack text check (char_length(stack) <= 4000),
  fingerprint text not null check (fingerprint ~ '^[a-z0-9]{1,64}$')
);

comment on table public.client_errors is
  'Redacted crash/error reports from the apps. Insert-only for clients; read in the dashboard. No personal data.';

create index client_errors_fingerprint_recent on public.client_errors (fingerprint, created_at);
create index client_errors_created_at on public.client_errors (created_at);

alter table public.client_errors enable row level security;

create policy "Apps report errors"
  on public.client_errors for insert to anon, authenticated
  with check (true);

revoke all on public.client_errors from anon, authenticated;
grant insert (platform, app_version, route, kind, message, stack, fingerprint)
  on public.client_errors to anon, authenticated;

-- Server-side redaction + flood guard. SECURITY DEFINER because the inserting
-- roles cannot read the table to count recent rows; it reads nothing else.
create or replace function public.client_errors_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  scrub constant text[] := array[
    '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}',             -- emails
    'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)?',         -- JWTs
    '(sk|pk|rk)[-_][A-Za-z0-9_-]{16,}',                              -- API keys
    '[Bb]earer\s+[A-Za-z0-9._~+/-]+=*',                               -- bearer tokens
    '\+?[0-9][0-9 ()-]{6,}[0-9]',                                    -- phone numbers
    '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}' -- ids
  ];
  pattern text;
begin
  if (select count(*) from public.client_errors
      where fingerprint = new.fingerprint and created_at > now() - interval '1 hour') >= 20
     or (select count(*) from public.client_errors
         where created_at > now() - interval '1 hour') >= 2000 then
    return null;
  end if;

  foreach pattern in array scrub loop
    new.message := regexp_replace(new.message, pattern, '<redacted>', 'g');
    new.stack := regexp_replace(new.stack, pattern, '<redacted>', 'g');
  end loop;
  new.route := split_part(split_part(new.route, '?', 1), '#', 1);
  new.message := left(new.message, 500);
  new.stack := left(new.stack, 4000);
  return new;
end;
$$;

create trigger client_errors_before_insert
  before insert on public.client_errors
  for each row execute function public.client_errors_before_insert();

revoke execute on function public.client_errors_before_insert() from public, anon, authenticated;
