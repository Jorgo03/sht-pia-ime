-- client_errors redaction fix, found by supabase/tests/rls_client_errors.sql
-- (E7): the phone-number pattern ran before the id pattern and ate the digit
-- runs inside a UUID, leaving fragments like "9c47f15e-<redacted>e-...".
-- Ids and tokens are now scrubbed first. Applied 2026-10-21; check 7/7 after.
create or replace function public.client_errors_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Order matters: ids and tokens before phone numbers, whose pattern would
  -- otherwise eat the digit runs inside a UUID and leave fragments behind.
  scrub constant text[] := array[
    '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}',
    '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}',
    'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)?',
    '(sk|pk|rk)[-_][A-Za-z0-9_-]{16,}',
    '[Bb]earer\s+[A-Za-z0-9._~+/-]+=*',
    '\+?[0-9][0-9 ()-]{6,}[0-9]'
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

revoke execute on function public.client_errors_before_insert() from public, anon, authenticated;
