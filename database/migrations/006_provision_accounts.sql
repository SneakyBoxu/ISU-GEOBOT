-- =====================================================================
--  006 — Portal access
--
--  Grants portal roles to accounts that ALREADY EXIST in Supabase Auth.
--
--  ------------------------------------------------------------------
--  CREATE THE ACCOUNT IN THE DASHBOARD FIRST
--  ------------------------------------------------------------------
--  Supabase Dashboard -> Authentication -> Users -> Add user
--  (tick "Auto Confirm User"), then run this file.
--
--  This script does NOT insert into auth.users, deliberately. That table
--  is managed by GoTrue: a usable account also needs a matching row in
--  auth.identities plus provider metadata, and the exact shape changes
--  between Supabase versions. Hand-inserted users typically authenticate
--  once and then fail password reset, or fail immediately with no useful
--  error. The password is also yours to choose and should not travel
--  through a file in a git repository.
--
--  ------------------------------------------------------------------
--  WHY THIS IS NEEDED AT ALL
--  ------------------------------------------------------------------
--  DEMO_MODE=true recognises admin@demo.local and three siblings. The
--  moment it is false, every portal authenticates against Supabase, and
--  at the time of writing that project has ZERO auth users while
--  app_user_role holds one admin row for a UID that does not exist.
--  Flipping the flag without running this locks everyone — including
--  the researchers — out of the Campus Location editor.
--
--  Safe to re-run.
-- =====================================================================

begin;
set search_path = geobot, public;

-- ---------------------------------------------------------------------
-- 1. State before. Read this output; it explains anything that follows.
-- ---------------------------------------------------------------------
select 'auth users'          as what, count(*)::text as n from auth.users
union all
select 'role rows',          count(*)::text from geobot.app_user_role
union all
select 'orphaned role rows', count(*)::text
  from geobot.app_user_role r
 where not exists (select 1 from auth.users u where u.id = r.auth_user_id);

-- ---------------------------------------------------------------------
-- 2. Remove grants whose account no longer exists.
--
--    app_user_role has no foreign key to auth.users, so deleting a user
--    in the dashboard leaves its roles behind. A stale row is not inert:
--    if that UUID is ever reissued, it arrives pre-authorised.
-- ---------------------------------------------------------------------
delete from geobot.app_user_role r
 where not exists (select 1 from auth.users u where u.id = r.auth_user_id);

-- ---------------------------------------------------------------------
-- 3. The researchers.
--
--    EDIT THESE EMAILS to match the accounts you created. Matching on
--    email rather than a pasted UUID is deliberate — a mistyped UUID
--    inserts a row that grants nothing and looks correct.
--
--    'admin'      -> add and correct campus locations
--    'researcher' -> the above, plus evaluation runs
-- ---------------------------------------------------------------------
insert into geobot.app_user_role (auth_user_id, role)
select u.id, v.role
  from auth.users u
 cross join (values ('admin'), ('researcher')) as v(role)
 where lower(u.email) = any (array[
   lower('maintestuser@gmail.com')   -- <- edit
 ])
on conflict (auth_user_id, role) do update set is_active = true;

-- ---------------------------------------------------------------------
-- 4. Refuse to commit a no-op.
--
--    Without this, a typo in section 3 produces a script that reports
--    success, grants nothing, and is discovered at the login screen
--    after DEMO_MODE has already been switched off.
-- ---------------------------------------------------------------------
do $$
declare n integer;
begin
  select count(*) into n
    from geobot.app_user_role
   where role = 'admin' and is_active;

  if n = 0 then
    raise exception
      'No active admin role was granted. Create the account in Supabase Auth '
      '(Authentication -> Users -> Add user) and check that the addresses in '
      'section 3 match it exactly, then re-run.';
  end if;

  raise notice '% active admin role(s) present.', n;
end $$;

commit;


-- =====================================================================
--  OPTIONAL — run once at least one real account exists
-- =====================================================================
--
--  Make the orphan impossible rather than merely cleaned up. Must run
--  AFTER section 2, or it fails on the existing stale row.
--
--    alter table geobot.app_user_role
--      add constraint app_user_role_auth_user_fk
--      foreign key (auth_user_id) references auth.users(id) on delete cascade;
--
--  ------------------------------------------------------------------
--  OPTIONAL — the guard portal
--  ------------------------------------------------------------------
--  A guard needs a guard_user row as well as a role, because
--  guard_presence_event.logged_by references it. Per-person accounts,
--  never a shared credential: attributable entries are what make the
--  presence log usable as research evidence.
--
--    with u as (select id from auth.users where lower(email) = 'guard@example.com')
--    insert into geobot.guard_user (auth_user_id, display_name)
--    select id, 'Full Name' from u
--    on conflict (auth_user_id) do nothing;
--
--    insert into geobot.app_user_role (auth_user_id, role)
--    select id, 'guard' from auth.users where lower(email) = 'guard@example.com'
--    on conflict (auth_user_id, role) do update set is_active = true;
--
--  ------------------------------------------------------------------
--  OPTIONAL — a faculty validator
--  ------------------------------------------------------------------
--  faculty_id comes from the roster loaded by schedule_importer.py, so
--  run this after that import. 'faculty' and 'validator' are separate
--  roles on purpose: a person may withdraw from the validation study
--  while remaining a data subject, or the reverse.
--
--    insert into geobot.app_user_role (auth_user_id, role, faculty_id)
--    select u.id, 'validator', f.id
--      from auth.users u
--      join geobot.faculty f on f.full_name = 'SURNAME, FIRST M.'
--     where lower(u.email) = 'faculty@example.com'
--    on conflict (auth_user_id, role) do update set is_active = true;
--
-- =====================================================================
--  VERIFY
-- =====================================================================
--    select u.email, r.role, r.is_active
--      from geobot.app_user_role r
--      join auth.users u on u.id = r.auth_user_id
--     order by u.email, r.role;
--
--  Every portal check resolves through geobot.has_role(), which reads
--  this table via auth.uid(). A row here is the whole difference between
--  a signed-in account and a usable portal.
-- =====================================================================
