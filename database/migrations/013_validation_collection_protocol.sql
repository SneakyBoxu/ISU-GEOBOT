-- =====================================================================
--  013 — Record HOW each validation was collected
--
--  ------------------------------------------------------------------
--  THE DEFECT
--  ------------------------------------------------------------------
--  AdminFacultyValidationPanel.jsx pre-filled the ground-truth field
--  with the system's own estimate:
--
--      setSystemStatus(ctx.systemStatus);
--      setActualStatus(ctx.systemStatus);   -- the observed field
--
--  So the form arrived with the validator's answer already set to
--  agree. A validator who selected a faculty member and saved without
--  touching that dropdown recorded "the system was correct". 62 of the
--  first 71 rows (87%) came back correct, which this default alone is
--  sufficient to explain.
--
--  The form is changed in the same commit: the observed value starts
--  empty and cannot be submitted untouched, and the estimate stays
--  hidden until the validator has chosen. This column records which
--  form produced each row.
--
--  ------------------------------------------------------------------
--  OBSERVED, NOT INFERRED
--  ------------------------------------------------------------------
--  Unlike 012's status_source, nothing here is guesswork. Every row
--  that exists before this migration was collected on the pre-filling
--  form -- that is a fact about the deployed code, not an inference
--  from a timestamp -- so no _inferred companion column is needed.
--
--  WHY IT MATTERS TO CHAPTER 4. The thesis reports the full set as one
--  figure. That is sound only if the two protocols agree. This column
--  makes that checkable instead of assumed:
--
--    select collection_protocol, count(*),
--           round(100.0*count(*) filter (where correctness='correct')
--                 /count(*),1) as pct_correct
--      from faculty_validation group by 1;
--
--  Close together: pool them and cite the query. Far apart: the gap is
--  the anchoring effect and both figures must be reported.
-- =====================================================================

begin;
set search_path = geobot, public;

alter table faculty_validation
  add column if not exists collection_protocol text;

comment on column faculty_validation.collection_protocol is
  'How the row was captured. estimate_first = the old form, which pre-filled '
  'the observed field with the system estimate. observation_first = the '
  'validator chose the observed value before the estimate was revealed.';

-- Every pre-existing row came from the pre-filling form.
update faculty_validation
   set collection_protocol = 'estimate_first'
 where collection_protocol is null;

alter table faculty_validation
  add constraint faculty_validation_collection_protocol_check
  check (collection_protocol is null
         or collection_protocol in ('estimate_first', 'observation_first'));

do $$
declare r record; total integer;
begin
  select count(*) into total from faculty_validation;
  raise notice 'faculty_validation rows: %', total;
  for r in select collection_protocol,
                  count(*) n,
                  count(*) filter (where correctness = 'correct') ok
             from faculty_validation group by 1 order by 1
  loop
    raise notice '  %: % row(s), % correct, % pct',
      r.collection_protocol, r.n, r.ok,
      round(100.0 * r.ok / nullif(r.n, 0), 1);
  end loop;

  if exists (select 1 from faculty_validation where collection_protocol is null) then
    raise exception 'some rows were left unclassified';
  end if;
end $$;

commit;
