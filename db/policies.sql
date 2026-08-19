-- =====================================================================
--  ISU-GeoBot — Row-Level Security (STEP 1c)
--  Run AFTER schema.sql and functions.sql.
--
--  Audit F-30 / W1 — the single highest-severity item in the security section.
--
--  WHY THIS FILE EXISTS AT ALL:
--    Supabase exposes every table in an exposed schema through PostgREST.
--    The anon key ships inside the React bundle and is readable by anyone who
--    opens devtools. A table WITHOUT RLS is therefore world-readable. RLS is
--    the security boundary; application-layer checks in Express are not.
--
--  MODEL:
--    anon            -> no direct table access at all. Public data reaches the
--                       browser only through the Express API.
--    authenticated   -> narrow, role-scoped grants (guard, validator).
--    service_role    -> bypasses RLS by design. Node holds this key.
--                       It must NEVER appear in a VITE_* variable or the repo.
--
--  Deny-by-default is achieved by: enable RLS + grant nothing + add only the
--  policies below. A table with RLS enabled and zero policies returns zero
--  rows to every non-service role. That is the intended baseline.
--
--  VERIFICATION (do this before the defense, and screenshot it):
--    Connect with the ANON key and run a SELECT against every table.
--    Every one must return zero rows or permission denied.
-- =====================================================================

begin;
set search_path = geobot, public, extensions;


-- =====================================================================
--  0. BASELINE: revoke everything, enable RLS everywhere
-- =====================================================================

revoke all on all tables    in schema geobot from anon, authenticated;
revoke all on all functions in schema geobot from anon, authenticated;
revoke all on all sequences in schema geobot from anon, authenticated;

grant usage on schema geobot to anon, authenticated, service_role;

do $$
declare t record;
begin
  for t in
    select tablename from pg_tables where schemaname = 'geobot'
  loop
    execute format('alter table geobot.%I enable row level security', t.tablename);
    execute format('alter table geobot.%I force  row level security', t.tablename);
  end loop;
end;
$$;

comment on schema geobot is
  'RLS is deny-by-default on every table (audit F-30/W1). Tables with RLS '
  'enabled and no policy return zero rows to anon and authenticated. Only '
  'service_role, held exclusively by the Node server, bypasses RLS.';


-- =====================================================================
--  1. ROLE HELPERS
-- =====================================================================

-- Application roles, mapped to Supabase auth users. Provisioned manually by
-- the researchers — audit §7.2: NO self-registration on any of these portals.
create table if not exists app_user_role (
  auth_user_id  uuid not null,
  role          text not null check (role in ('guard','validator','researcher')),
  faculty_id    uuid references faculty(id) on delete cascade,  -- validators
  is_active     boolean not null default true,
  granted_at    timestamptz not null default now(),
  primary key (auth_user_id, role)
);

alter table app_user_role enable row level security;
alter table app_user_role force  row level security;

create or replace function geobot.has_role(p_role text)
returns boolean
language sql
stable
security definer
set search_path = geobot, public
as $$
  select exists (
    select 1 from geobot.app_user_role r
    where r.auth_user_id = auth.uid()
      and r.role = p_role
      and r.is_active
  );
$$;

create or replace function geobot.validator_faculty_id()
returns uuid
language sql
stable
security definer
set search_path = geobot, public
as $$
  select r.faculty_id from geobot.app_user_role r
  where r.auth_user_id = auth.uid()
    and r.role = 'validator'
    and r.is_active
  limit 1;
$$;

grant execute on function geobot.has_role(text)          to authenticated;
grant execute on function geobot.validator_faculty_id()  to authenticated;

-- A signed-in user may read their own role rows and nothing else.
create policy app_user_role_self_read on app_user_role
  for select to authenticated
  using (auth_user_id = auth.uid());


-- =====================================================================
--  2. GUARD PORTAL  (/guard)
-- =====================================================================
--  Guards may: read the CONSENTED roster, insert presence events, and read
--  today's events. They may not update or delete anything, ever — the
--  append-only trigger in schema.sql enforces that even for service_role.
-- =====================================================================

grant select on faculty, department to authenticated;

create policy faculty_guard_read on faculty
  for select to authenticated
  using (
    is_active
    and is_consented                       -- audit F-32 / C11
    and (geobot.has_role('guard') or geobot.has_role('researcher'))
  );

create policy department_read on department
  for select to authenticated
  using (geobot.has_role('guard') or geobot.has_role('researcher'));

grant select, insert on guard_presence_event to authenticated;
grant select on guard_user to authenticated;

create policy guard_event_insert on guard_presence_event
  for insert to authenticated
  with check (
    geobot.has_role('guard')
    -- audit W3 (IDOR): a guard may only log against the consented roster.
    and exists (
      select 1 from geobot.faculty f
      where f.id = faculty_id and f.is_active and f.is_consented
    )
    -- accountability: logged_by must be the caller's own guard record.
    and exists (
      select 1 from geobot.guard_user g
      where g.id = logged_by and g.auth_user_id = auth.uid() and g.is_active
    )
  );

-- Read is scoped to the same-day validity window the override uses (C13),
-- so the dashboard cannot become a historical movement browser.
create policy guard_event_read_today on guard_presence_event
  for select to authenticated
  using (
    (geobot.has_role('guard') and occurred_at >= date_trunc('day', now()))
    or geobot.has_role('researcher')
  );

create policy guard_user_self_read on guard_user
  for select to authenticated
  using (auth_user_id = auth.uid() or geobot.has_role('researcher'));

comment on policy guard_event_read_today on guard_presence_event is
  'Audit F-30 + F-29. Guards see today only. Unbounded history on this table '
  'would turn the dashboard into a per-person movement archive — the exact '
  'harm the status masking protocol exists to prevent, reachable through a '
  'different door.';


-- =====================================================================
--  3. FACULTY VALIDATION PORTAL  (/validate)
-- =====================================================================
--  Thesis §3.8.2. A validator may submit and read ONLY their own rows.
--  Audit C14: in-system capture means the system's own prediction is recorded
--  automatically, removing a transcription-error attack on the results.
-- =====================================================================

grant select, insert on faculty_validation to authenticated;

create policy validation_insert_self on faculty_validation
  for insert to authenticated
  with check (
    geobot.has_role('validator')
    and faculty_id = geobot.validator_faculty_id()
  );

create policy validation_read_self on faculty_validation
  for select to authenticated
  using (
    (geobot.has_role('validator') and faculty_id = geobot.validator_faculty_id())
    or geobot.has_role('researcher')
  );

-- Validators need the status vocabulary to render the checklist.
grant select on availability_status to anon, authenticated;
create policy availability_status_public_read on availability_status
  for select to anon, authenticated using (true);

comment on policy validation_insert_self on faculty_validation is
  'Audit §3.8.2 / C14. A validator can only record their OWN ground truth. '
  'Cross-validator writes would corrupt the confusion matrix and are a privacy '
  'violation besides.';


-- =====================================================================
--  4. RESEARCHER
-- =====================================================================
--  Read-only through the client. All WRITES to research tables go through the
--  Node service role or the offline Python scripts, so that every row lands
--  with correct provenance and run linkage.
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'eval_run','eval_query','eval_result','ragas_score',
    'rf_model_version','attendance_record','institutional_event',
    'faculty_schedule','faculty_pseudonym_map','chat_log'
  ]
  loop
    execute format('grant select on geobot.%I to authenticated', t);
    execute format(
      'create policy %I_researcher_read on geobot.%I
         for select to authenticated using (geobot.has_role(''researcher''))',
      t, t);
  end loop;
end;
$$;


-- =====================================================================
--  5. PUBLIC SURFACE
-- =====================================================================
--  Audit F-12 / W4: the anon role gets NOTHING directly, not even POIs.
--  The map is served by GET /api/map/pois so that:
--    - the Supabase table shape is not published to every visitor,
--    - synthetic rows can be filtered/labelled server-side,
--    - rate limiting applies uniformly (audit F-29 / W5).
--
--  The single exception is availability_status (granted above): a closed,
--  non-sensitive vocabulary table the UI needs to render status chips.
--
--  demo_query is likewise read through the API only, so the landing-page
--  comparison widget cannot be repointed at arbitrary text (audit F-16).
-- =====================================================================

-- (intentionally no anon policies beyond availability_status)


-- =====================================================================
--  6. POST-DEPLOY VERIFICATION
-- =====================================================================
--  Run as the ANON key. Every row must report has_policy_for_anon = false
--  except availability_status. Screenshot this for the defense.
-- =====================================================================

drop function if exists geobot.rls_audit();

create or replace function geobot.rls_audit()
returns table (
  table_name          text,
  rls_enabled         boolean,
  rls_forced          boolean,
  policy_count        integer,
  anon_readable       boolean
)
language sql
stable
as $$
  select c.relname::text,
         c.relrowsecurity,
         c.relforcerowsecurity,
         (select count(*)::integer from pg_policies p
           where p.schemaname = 'geobot' and p.tablename = c.relname),
         exists (
           select 1 from pg_policies p
           where p.schemaname = 'geobot'
             and p.tablename = c.relname
             and 'anon' = any(p.roles)
         )
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'geobot' and c.relkind = 'r'
  order by c.relname;
$$;

comment on function geobot.rls_audit is
  'Audit W1 verification. Expected result: rls_enabled and rls_forced true for '
  'every table, and anon_readable true ONLY for availability_status. Any other '
  'true in that column is a data leak.';

commit;
