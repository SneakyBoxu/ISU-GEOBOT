-- =====================================================================
--  005 — Which campus a teaching block is on
--
--  CCSICT faculty are not a single-campus population. In the 1st Sem
--  2026-2027 schedule, 12 of the 37 Echague faculty also teach sections
--  in Santiago City — a different campus, roughly two hours away.
--
--  WHY THIS COLUMN EXISTS. Without it there are only two options, and
--  both are wrong:
--
--    Drop the Santiago blocks. Those hours become an empty gap, and an
--    empty gap is indistinguishable from a free period. The system then
--    reports someone as available at Echague while they are provably
--    teaching in another city. That is not a missing feature; it is the
--    system asserting something false about a real person.
--
--    Import them untagged. The time is correctly marked busy, but the
--    system cannot say why, so it cannot distinguish "in class here"
--    from "not on this campus at all" — and those are different answers
--    to the student standing outside the office door.
--
--  With the column, resolve_presence() and the availability classifier
--  can both say "teaching, not here", which is the true statement.
--
--  DEFAULT 'echague'. Every row that existed before this migration was
--  an Echague block, and the campus this system is deployed for is
--  Echague. A NOT NULL default keeps the existing loader and every
--  existing query working unchanged.
-- =====================================================================

begin;
set search_path = geobot, public;

alter table faculty_schedule
  add column if not exists campus text not null default 'echague';

alter table faculty_schedule drop constraint if exists faculty_schedule_campus_check;
alter table faculty_schedule add constraint faculty_schedule_campus_check
  check (campus in ('echague', 'santiago'));

comment on column faculty_schedule.campus is
  'Which campus the block is taught on. A block on another campus makes the '
  'faculty member unavailable at Echague for its duration PLUS travel time — '
  'it is not free time, and it is not local teaching either. Populated by '
  'machine-learning/schedule_importer.py from the STGO sheets of the '
  'departmental schedule workbook.';

-- Lookups are always "this faculty, this semester, this day" and now
-- frequently "...on this campus". Extending the existing composite index
-- keeps that a single index scan.
drop index if exists faculty_schedule_lookup_idx;
create index faculty_schedule_lookup_idx
  on faculty_schedule (faculty_id, semester, day_of_week, start_time, end_time);
create index if not exists faculty_schedule_campus_idx
  on faculty_schedule (semester, campus);

commit;
