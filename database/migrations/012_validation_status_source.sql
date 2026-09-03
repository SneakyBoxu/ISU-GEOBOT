-- =====================================================================
--  012 — Record WHICH ENGINE produced the status a validator judged
--
--  ------------------------------------------------------------------
--  THE DEFECT
--  ------------------------------------------------------------------
--  faculty_validation stores the answer (system_status) but not its
--  author. Two different engines have been writing that column:
--
--    random_forest  the RF prediction, via maskPrediction()
--    schedule_only  schedule_lookup_status(), via maskScheduleOnly()
--    override       a guard departure or official event, maskOverride()
--
--  maskScheduleOnly() landed on 2026-09-02 (commit 76af5a0), because
--  attendance_features() returns 0.0 both for "observed and absent" and
--  for "never observed", and every real lecturer is the second case.
--  From that commit onward NO real faculty reaches the Random Forest.
--
--  So the table now pools rows measuring the model with rows measuring
--  a timetable lookup, under one heading, with nothing to separate
--  them. Reported as a single accuracy figure it would describe
--  neither engine. Chapter 4 cannot make that claim safely, and the
--  remaining ~130 field validations would join the same pile.
--
--  ------------------------------------------------------------------
--  INFERRED, AND SAID SO
--  ------------------------------------------------------------------
--  Existing rows cannot be re-derived: the engine was never recorded,
--  and the inputs it saw are gone. They are classified from queried_at
--  against the deployment timestamp, which is an INFERENCE, not an
--  observation. status_source_inferred marks every such row, so a
--  reader can exclude them. Rows written after this migration carry the
--  value the service actually returned, and are not inferred.
--
--  This migration adds columns and classifies existing rows. It does
--  not delete, merge, or alter any judgement a validator recorded.
-- =====================================================================

begin;
set search_path = geobot, public;

alter table faculty_validation
  add column if not exists status_source text,
  add column if not exists status_source_inferred boolean not null default false;

comment on column faculty_validation.status_source is
  'Engine that produced system_status: random_forest | schedule_only | override. '
  'See status_source_inferred before treating it as observed.';
comment on column faculty_validation.status_source_inferred is
  'true = back-filled from queried_at by migration 012, NOT recorded at the '
  'time of validation. Exclude these rows from any per-engine claim.';

-- ---------------------------------------------------------------------
-- Classify the rows that predate the column.
--
-- Order matters. An override short-circuits before either engine runs,
-- so override_applied wins regardless of date.
--
-- Boundary: 2026-09-02 17:37 +08, the commit that deployed
-- maskScheduleOnly(). Before it, a non-override request reached the
-- Random Forest -- with a degenerate hist_presence_rate of 0.0, which
-- is why those rows are evidence about a miscued model rather than a
-- healthy one. After it, the same request returns schedule_only.
-- ---------------------------------------------------------------------
update faculty_validation
   set status_source = case
         when override_applied then 'override'
         when queried_at < timestamptz '2026-09-02 17:37:00+08' then 'random_forest'
         else 'schedule_only'
       end,
       status_source_inferred = true
 where status_source is null;

alter table faculty_validation
  add constraint faculty_validation_status_source_check
  check (status_source is null
         or status_source in ('random_forest', 'schedule_only', 'override'));

do $$
declare r record; total integer;
begin
  select count(*) into total from faculty_validation;
  raise notice 'faculty_validation rows: %', total;
  for r in select status_source, status_source_inferred, count(*) n
             from faculty_validation group by 1,2 order by 1,2
  loop
    raise notice '  % (inferred=%): % row(s)', r.status_source, r.status_source_inferred, r.n;
  end loop;

  if exists (select 1 from faculty_validation where status_source is null) then
    raise exception 'some rows were left unclassified';
  end if;
end $$;

commit;
