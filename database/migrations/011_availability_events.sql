-- =====================================================================
--  011 - Reviewed availability events
--
--  Stores only reviewed structured fields and an OCR checksum. Raw OCR is
--  deliberately absent and is never added to the retrieval corpus.
-- =====================================================================

begin;
set search_path = geobot, public, extensions;

create table if not exists geobot.availability_event (
  id                uuid primary key,
  document_type     text not null,
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  all_day           boolean not null default false,
  scope_type        text not null
                    check (scope_type in ('named_faculty', 'department', 'campus', 'all_faculty')),
  campus             text,
  department_code    text,
  faculty_names      text[] not null default '{}',
  mandatory          boolean not null default false check (mandatory),
  reason_code        text not null
                    check (reason_code in (
                      'institutional_event', 'official_business', 'official_meeting',
                      'training', 'approved_leave', 'institutional_closure',
                      'schedule_suspension', 'emergency', 'other_official_announcement'
                    )),
  safe_reason        text not null,
  warnings           text[] not null default '{}',
  source_checksum    text not null check (source_checksum ~ '^[0-9a-f]{64}$'),
  target_count       integer not null check (target_count > 0),
  status             text not null default 'published'
                     check (status in ('published', 'withdrawn')),
  published_by       uuid not null,
  published_at       timestamptz not null default now(),
  withdrawn_by       uuid,
  withdrawn_at       timestamptz,
  data_origin        data_origin_t not null default 'real',
  created_at         timestamptz not null default now(),

  check (ends_at > starts_at),
  check (safe_reason = case reason_code
    when 'institutional_event' then 'Unavailable due to an institutional event.'
    when 'official_business' then 'Unavailable due to official university duties.'
    when 'official_meeting' then 'Unavailable due to an official meeting.'
    when 'training' then 'Unavailable due to an official training activity.'
    when 'approved_leave' then 'Unavailable due to approved leave.'
    when 'institutional_closure' then 'Unavailable due to an institutional closure.'
    when 'schedule_suspension' then 'Availability is affected by an official schedule suspension.'
    when 'emergency' then 'Availability is affected by an emergency announcement.'
    when 'other_official_announcement' then 'Availability is affected by an official announcement.'
  end),
  check ((scope_type = 'named_faculty') = (cardinality(faculty_names) > 0)),
  check (scope_type <> 'department' or department_code is not null),
  check (scope_type <> 'campus' or campus is not null),
  check ((status = 'withdrawn') = (withdrawn_at is not null)),
  constraint availability_event_withdrawn_by_check
    check ((status = 'withdrawn') = (withdrawn_by is not null))
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'availability_event_withdrawn_by_check'
      and conrelid = 'geobot.availability_event'::regclass
  ) then
    alter table geobot.availability_event
      add constraint availability_event_withdrawn_by_check
      check ((status = 'withdrawn') = (withdrawn_by is not null));
  end if;
end;
$$;

create table if not exists geobot.availability_event_faculty (
  event_id           uuid not null references geobot.availability_event(id) on delete cascade,
  faculty_id         uuid not null references geobot.faculty(id) on delete restrict,
  created_at         timestamptz not null default now(),
  primary key (event_id, faculty_id)
);

create index if not exists availability_event_current_idx
  on geobot.availability_event (status, starts_at, ends_at);
create index if not exists availability_event_faculty_lookup_idx
  on geobot.availability_event_faculty (faculty_id, event_id);
create index if not exists availability_event_checksum_idx
  on geobot.availability_event (source_checksum);

create or replace function geobot.current_availability_event_for_faculty(
  p_faculty_id uuid,
  p_at timestamptz default now()
)
returns setof geobot.availability_event
language sql
stable
security definer
set search_path = geobot, public
as $$
  select event.*
  from geobot.availability_event event
  join geobot.availability_event_faculty target on target.event_id = event.id
  where target.faculty_id = p_faculty_id
    and event.status = 'published'
    and event.mandatory
    and event.starts_at <= p_at
    and event.ends_at > p_at
    and geobot.faculty_is_answerable(p_faculty_id)
  order by event.starts_at desc, event.published_at desc, event.id
  limit 1;
$$;

comment on table geobot.availability_event is
  'Human-reviewed availability effects extracted from OCR. Contains sanitized '
  'structured fields and a source checksum only; raw documents do not enter RAG.';
comment on column geobot.availability_event.safe_reason is
  'Disclosure-safe text clamped by the backend to its reason_code allowlist.';
comment on table geobot.availability_event_faculty is
  'Materialized scope expansion used for deterministic per-faculty current-event lookup.';

alter table geobot.availability_event enable row level security;
alter table geobot.availability_event force row level security;
alter table geobot.availability_event_faculty enable row level security;
alter table geobot.availability_event_faculty force row level security;

revoke all on geobot.availability_event from anon, authenticated;
revoke all on geobot.availability_event_faculty from anon, authenticated;
revoke all on function geobot.current_availability_event_for_faculty(uuid, timestamptz)
  from public, anon, authenticated;

-- No browser grants or authenticated policies. Reads and writes go through
-- the service-role backend so review identity and reason clamping are enforced.

commit;
