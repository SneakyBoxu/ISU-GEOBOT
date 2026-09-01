-- =====================================================================
--  002 — User roles, faculty self-service, and campus location management
--
--  Three changes, each with an ethical justification that should appear in
--  Chapter 3:
--
--  1. ROLE SEPARATION. The thesis never describes authenticated end users, so
--     this is an IMPLEMENTATION DECISION. It is worth making because it lets
--     the system close the aggregation attack the audit identified (F-29):
--     anonymous visitors get the map and institutional information, but
--     faculty availability requires a campus account. Status masking protects
--     the granularity of one answer; it does nothing about VOLUME. Requiring
--     an account makes unlimited polling attributable and rate-limitable per
--     person rather than per IP.
--
--  2. FACULTY SELF-SERVICE VISIBILITY. Under RA 10173 a data subject has the
--     right to object and to withdraw consent. A one-time consent signature
--     does not satisfy that; a live control does. Faculty can pause their own
--     availability disclosure at any time, without asking the researchers.
--     This turns consent from a checkbox into an ongoing right, which is a
--     genuinely strong answer at defense.
--
--  3. CAMPUS LOCATION MANAGEMENT. Campuses build new buildings. The audit
--     recommended against an admin UI for DOCUMENT UPLOAD (§8.1) — that adds
--     an authenticated file-upload attack surface for no thesis benefit. A POI
--     editor is a different and much narrower thing: structured fields, no
--     file handling, a closed vocabulary, and a full audit trail. It is also
--     operationally necessary, because a campus map that cannot be corrected
--     is a campus map that goes stale during the evaluation period.
-- =====================================================================

begin;
set search_path = geobot, public, extensions;

-- ---------------------------------------------------------------------
-- 1. Expanded role vocabulary
-- ---------------------------------------------------------------------

alter table app_user_role drop constraint if exists app_user_role_role_check;
alter table app_user_role add constraint app_user_role_role_check
  check (role in ('student', 'faculty', 'guard', 'validator', 'researcher', 'admin'));

comment on table app_user_role is
  'Roles are provisioned by the researchers. Students may self-register only '
  'with an institutional email domain (enforced in the application layer); '
  'every other role is granted manually. A shared credential is never issued '
  'for guard accounts because logged_by accountability is what makes the '
  'presence log usable as research evidence.';

-- ---------------------------------------------------------------------
-- 2. Faculty self-service availability control
-- ---------------------------------------------------------------------

alter table faculty add column if not exists availability_visible boolean not null default true;
alter table faculty add column if not exists availability_paused_at timestamptz;
alter table faculty add column if not exists availability_pause_reason text;

comment on column faculty.availability_visible is
  'Data-subject control (RA 10173 right to object). When false, the assistant '
  'declines availability queries about this person and the classifier is not '
  'invoked for them at all — the estimate is never computed, not merely '
  'withheld. Distinct from is_consented, which gates study participation: a '
  'faculty member may remain consented to the study while temporarily pausing '
  'disclosure. Pauses are recorded so their effect on evaluation coverage can '
  'be reported honestly rather than appearing as missing data.';

-- Audit trail for the control itself, so "did anyone silently re-enable this?"
-- has an answer.
create table if not exists faculty_visibility_event (
  id            uuid primary key default gen_random_uuid(),
  faculty_id    uuid not null references faculty(id) on delete cascade,
  visible       boolean not null,
  reason        text,
  changed_by    uuid not null,           -- auth.users.id
  changed_at    timestamptz not null default now()
);

create index if not exists faculty_visibility_faculty_idx
  on faculty_visibility_event (faculty_id, changed_at desc);

-- ---------------------------------------------------------------------
-- 3. Campus location management
-- ---------------------------------------------------------------------

alter table poi add column if not exists created_by uuid;
alter table poi add column if not exists updated_by uuid;
alter table poi add column if not exists updated_at timestamptz;
alter table poi add column if not exists is_published boolean not null default true;
alter table poi add column if not exists survey_method text
  check (survey_method in ('gps_survey', 'floor_plan', 'estimated', 'unknown'));

comment on column poi.survey_method is
  'How the coordinate was obtained. Thesis §3.4.1(a) specifies on-site GPS '
  'mapping verified against physical landmarks. A coordinate entered as '
  '''estimated'' is not survey data and must not be presented as though it '
  'were — the admin UI marks these distinctly and they are reportable as a '
  'limitation, not hidden.';

-- Every change to the campus map is recorded. If a coordinate moves during the
-- evaluation period, that is a change to the retrieval corpus and it must be
-- reconstructable — otherwise a RAGAS run cannot be reproduced.
create table if not exists poi_audit (
  id            uuid primary key default gen_random_uuid(),
  poi_id        uuid references poi(id) on delete set null,
  action        text not null check (action in ('create', 'update', 'delete', 'publish', 'unpublish')),
  before_state  jsonb,
  after_state   jsonb,
  changed_by    uuid not null,
  changed_at    timestamptz not null default now(),
  note          text
);

create index if not exists poi_audit_poi_idx on poi_audit (poi_id, changed_at desc);

comment on table poi_audit is
  'Audit F-03 by extension: an evaluation run is only reproducible if the '
  'corpus it ran against can be reconstructed. Adding or moving a building '
  'changes the place-card embeddings, so those edits are part of the '
  'experimental record.';

-- ---------------------------------------------------------------------
-- 4. RLS for the new surfaces
-- ---------------------------------------------------------------------

alter table faculty_visibility_event enable row level security;
alter table faculty_visibility_event force  row level security;
alter table poi_audit enable row level security;
alter table poi_audit force  row level security;

-- Faculty read their own visibility history; researchers read all.
grant select on faculty_visibility_event to authenticated;
drop policy if exists visibility_event_self_read on faculty_visibility_event;
create policy visibility_event_self_read on faculty_visibility_event
  for select to authenticated
  using (
    geobot.has_role('researcher')
    or faculty_id in (
      select r.faculty_id from geobot.app_user_role r
      where r.auth_user_id = auth.uid() and r.is_active and r.faculty_id is not null
    )
  );

grant select on poi_audit to authenticated;
drop policy if exists poi_audit_admin_read on poi_audit;
create policy poi_audit_admin_read on poi_audit
  for select to authenticated
  using (geobot.has_role('admin') or geobot.has_role('researcher'));

-- POI writes go through the Express API under the service role so that the
-- place-card is regenerated and re-embedded in the same transaction as the
-- coordinate change. A direct client write would leave the map and the
-- retrieval corpus disagreeing with each other.
comment on table poi is
  'Written only via POST/PATCH /api/admin/pois. Direct client writes are not '
  'granted: a coordinate change must regenerate the POI place-card and its '
  'embeddings, or the interactive map and the RAG corpus silently diverge.';

-- ---------------------------------------------------------------------
-- 5. Helper: is this faculty member answerable right now?
-- ---------------------------------------------------------------------

create or replace function geobot.faculty_is_answerable(p_faculty_id uuid)
returns boolean
language sql
stable
as $$
  select coalesce(
    (select f.is_active and f.is_consented and f.availability_visible
       from geobot.faculty f where f.id = p_faculty_id),
    false);
$$;

comment on function geobot.faculty_is_answerable is
  'Single gate combining the three independent conditions under which the '
  'system may disclose an availability estimate: the person is active, has '
  'consented to the study, and has not paused disclosure. The router and the '
  'availability path both consult this, so a paused faculty member is not '
  'merely hidden from answers — the classifier is never invoked for them.';

commit;
