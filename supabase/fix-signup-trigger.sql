-- ═══════════════════════════════════════════════════════════════
-- FIX: signup returns 500 "Database error saving new user"
-- ───────────────────────────────────────────────────────────────
-- Cause: the on_auth_user_created trigger's handle_new_user() function
-- errored while inserting into profiles, which rolled back the auth.users
-- INSERT — blocking BOTH email/password AND Google signups.
--
-- This hardens the function so it can never block auth:
--   * SET search_path = public  (security-definer contexts otherwise may not
--     resolve the unqualified table name)
--   * schema-qualified public.profiles
--   * EXCEPTION guard that returns NEW even if the insert fails
-- The /api/profile route upserts the profile row lazily anyway.
--
-- Run this in the Supabase SQL editor. Idempotent — safe to run more than once.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
exception when others then
  return new;  -- never block signup on a profile hiccup
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for any users created before this fix.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

-- ── Optional diagnostic: list every trigger on auth.users. If a SECOND,
-- ── differently-named trigger shows up, an old one may also need dropping.
-- select tgname, proname
-- from pg_trigger t join pg_proc p on p.oid = t.tgfoid
-- where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal;
