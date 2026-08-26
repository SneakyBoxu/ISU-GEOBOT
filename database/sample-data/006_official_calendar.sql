-- =====================================================================
--  006 — Academic calendar, corrected against the official ISU source
--
--  Source: https://isu.edu.ph/school-calendar/
--          S.Y. 2026-2027, FIRST SEMESTER, Undergraduate column.
--
--  WHAT WAS WRONG. The examination rows in 003_synthetic_attendance.sql
--  were placeholders invented before the official calendar was consulted.
--  They put the examinations roughly a month away from where the
--  university put them:
--
--      midterm   placeholder Oct 12-16   official Sep 15-17
--      finals    placeholder Dec 14-18   official Nov 10-12 (graduating)
--                                                 Nov 17-19 (non-graduating)
--
--  Those dates are not inert. institutional_event drives
--  schedule_lookup_status(), which drives live availability answers, and
--  it supplies exam_period_flag / campus_event_flag to both ML training
--  and ML serving. A wrong exam date is a wrong answer and a wrong
--  feature.
--
--  WHAT IS NOT CHANGED. The six national-holiday rows stay exactly as
--  they are, and stay marked data_origin='synthetic'. They are factually
--  correct Philippine regular holidays, but the ISU calendar does not
--  enumerate holidays, so calling them 'real' would claim an official
--  provenance they do not have. A row is not deleted for being
--  synthetic; it is deleted for being wrong.
-- =====================================================================

begin;
set search_path = geobot, public;

-- ---------------------------------------------------------------------
-- 1. Remove only the contradicted rows, by exact date.
--
--    Deliberately not "delete where event_type='exam_period'": that
--    would also remove any correct row a future import had added.
-- ---------------------------------------------------------------------
delete from institutional_event
 where event_type = 'exam_period'
   and event_date in (
     date '2026-10-12', date '2026-10-13', date '2026-10-14',
     date '2026-10-15', date '2026-10-16',          -- placeholder midterm
     date '2026-12-14', date '2026-12-15', date '2026-12-16',
     date '2026-12-17', date '2026-12-18'           -- placeholder finals
   );

-- ---------------------------------------------------------------------
-- 2. The official examination periods.
--
--    Undergraduate column only: the modelled cohort is CCSICT
--    undergraduate teaching. The Law, Medicine and Graduate columns give
--    different dates and are not represented, because no faculty in this
--    system teaches those programmes.
--
--    data_origin='real' — each date is quoted from the official page.
-- ---------------------------------------------------------------------
insert into institutional_event (event_date, event_type, title, disrupts_schedule, data_origin)
values
  -- "Mid-Term Examination — Undergraduate: September 15-17, 2026"
  (date '2026-09-15', 'exam_period', 'Mid-Term Examination (Undergraduate)', true, 'real'),
  (date '2026-09-16', 'exam_period', 'Mid-Term Examination (Undergraduate)', true, 'real'),
  (date '2026-09-17', 'exam_period', 'Mid-Term Examination (Undergraduate)', true, 'real'),

  -- "Final Examination for Graduating Students — Undergraduate: November 10-12, 2026"
  (date '2026-11-10', 'exam_period', 'Final Examination, Graduating (Undergraduate)', true, 'real'),
  (date '2026-11-11', 'exam_period', 'Final Examination, Graduating (Undergraduate)', true, 'real'),
  (date '2026-11-12', 'exam_period', 'Final Examination, Graduating (Undergraduate)', true, 'real'),

  -- "Final Examination for Non-Graduating Students — Undergraduate: November 17-19, 2026"
  (date '2026-11-17', 'exam_period', 'Final Examination, Non-Graduating (Undergraduate)', true, 'real'),
  (date '2026-11-18', 'exam_period', 'Final Examination, Non-Graduating (Undergraduate)', true, 'real'),
  (date '2026-11-19', 'exam_period', 'Final Examination, Non-Graduating (Undergraduate)', true, 'real')
on conflict (event_date, event_type) do update
  set title = excluded.title,
      disrupts_schedule = excluded.disrupts_schedule,
      data_origin = excluded.data_origin;

-- ---------------------------------------------------------------------
-- 3. The academic window, for semester_phase_of().
--
--    WHY THESE LIVE HERE. feature_engineering.semester_phase_of() needs a
--    start and an end to say early / mid / finals. Training receives them
--    as --start/--end arguments; serving had nothing, so semesterPhase()
--    returned "mid" unconditionally. Putting the window in a config file
--    would create a second source of truth alongside those arguments.
--    institutional_event is the project's existing calendar mechanism, so
--    the window lives here and both sides read one place.
--
--    disrupts_schedule = false IS LOAD-BEARING. schedule_lookup_status()
--    selects `where ie.disrupts_schedule`, so these two markers are
--    invisible to availability resolution. Without the false they would
--    each make an entire day "unavailable" for every lecturer.
--
--    ON THE END DATE — READ THIS BEFORE QUOTING IT.
--    The official calendar does NOT state "the semester ends on X". It
--    states that the final examination for non-graduating undergraduates
--    is November 17-19, 2026. November 19 is taken as the end boundary
--    because it is the last explicitly published undergraduate teaching
--    or examination date; the title below says so rather than claiming a
--    quotation the source does not contain. Later dates exist in the
--    calendar (grade submission November 27, academic council meetings
--    into December) and could be argued for instead — this choice is an
--    interpretation, and is recorded as one.
-- ---------------------------------------------------------------------
insert into institutional_event (event_date, event_type, title, disrupts_schedule, data_origin)
values
  (date '2026-07-20', 'other',
   'Academic window start: Start of Classes, Undergraduate (official)',
   false, 'real'),
  (date '2026-11-19', 'other',
   'Academic window end (interpretation): last published undergraduate final examination date',
   false, 'real')
on conflict (event_date, event_type) do update
  set title = excluded.title,
      disrupts_schedule = excluded.disrupts_schedule,
      data_origin = excluded.data_origin;

-- ---------------------------------------------------------------------
-- 4. Refuse to leave the calendar in a state the phase logic cannot use.
-- ---------------------------------------------------------------------
do $$
declare n_window integer; n_exam integer; n_bad integer;
begin
  select count(*) into n_window from institutional_event
   where event_type = 'other' and title like 'Academic window%';
  if n_window <> 2 then
    raise exception 'Expected exactly 2 academic-window markers, found %.', n_window;
  end if;

  select count(*) into n_bad from institutional_event
   where event_type = 'other' and title like 'Academic window%' and disrupts_schedule;
  if n_bad > 0 then
    raise exception
      'An academic-window marker has disrupts_schedule = true. It would make '
      'that whole day unavailable for every lecturer.';
  end if;

  select count(*) into n_exam from institutional_event where event_type = 'exam_period';
  raise notice '% examination days, % window markers.', n_exam, n_window;
end $$;

commit;
