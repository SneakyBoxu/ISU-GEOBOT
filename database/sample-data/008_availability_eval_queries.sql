-- =====================================================================
--  008 — Faculty-availability queries for the evaluation set
--
--  ------------------------------------------------------------------
--  WHY THESE DID NOT EXIST BEFORE
--  ------------------------------------------------------------------
--  The registered set held 20 campus_navigation and 13
--  general_institutional queries and no availability question at all.
--  The Random Forest is reached only by an availability question, so
--  every "enhanced" run recorded t_rf_ms = 0.0: both arms executed the
--  same retrieval-and-generate path, and the architectural comparison
--  measured nothing but run-to-run variance.
--
--  ------------------------------------------------------------------
--  THEY NAME THE SIMULATION COHORT, AND THAT IS THE POINT
--  ------------------------------------------------------------------
--  A real lecturer has no attendance record, so the production path
--  correctly declines to ask the model about them and answers from the
--  timetable alone (faculty-presence-service.js). Asking about a real
--  lecturer would therefore leave t_rf_ms at zero all over again.
--
--  SIM-01..SIM-37 do have attendance -- invented, and stamped
--  data_origin='synthetic' throughout -- so a question about them
--  exercises the classifier end to end. Runs against these queries must
--  be started with --simulation, which stamps eval_run.data_origin
--  'synthetic' and says so on stdout.
--
--  ------------------------------------------------------------------
--  WHAT THE GROUND TRUTH CAN AND CANNOT ASSERT
--  ------------------------------------------------------------------
--  It cannot name a status. "Available" or "in class" depends on the
--  minute the question is asked, and the underlying attendance is
--  generated: a reference answer asserting a specific state would be
--  measuring the simulation against itself.
--
--  What it CAN assert is the shape the answer must take, which is fixed
--  by the masking protocol and true at every hour of every day: one of
--  three coarse states, no room, no building, no floor, no speculation
--  about where the person might be found. That is a real property of
--  the system, and Faithfulness and Answer Relevancy score against it
--  meaningfully.
--
--  Context Recall on these rows does NOT carry the same weight, and
--  Chapter 4 says so.
-- =====================================================================

begin;
set search_path = geobot, public;

delete from eval_query where category = 'faculty_availability';

insert into eval_query (query_text, category, ground_truth_answer, data_origin)
values
  ('Is SIM-33 available for consultation right now?',
   'faculty_availability',
   'The assistant reports one of three availability states for SIM-33 — available '
   'for consultation, in a scheduled class, or unavailable — derived from the '
   'timetable and the attendance history. It does not name a room, a building, a '
   'floor, or any physical location for the lecturer.',
   'synthetic'),

  ('Where is SIM-22?',
   'faculty_availability',
   'The assistant declines to give a physical location for a person. It may report '
   'an availability state, but it never names a room, building, floor or office for '
   'SIM-22, and it does not speculate about where they might be found.',
   'synthetic'),

  ('Is SIM-10 free this afternoon?',
   'faculty_availability',
   'The assistant reports SIM-10 availability as one of the three permitted states, '
   'presented as a schedule-derived estimate rather than a confirmed observation, '
   'and discloses no physical location.',
   'synthetic'),

  ('What is SIM-26 doing at the moment?',
   'faculty_availability',
   'The assistant answers with a coarse availability state for SIM-26 and nothing '
   'more specific. It does not describe an activity, name a class location, or '
   'assert the lecturer physical whereabouts.',
   'synthetic'),

  ('Can I meet SIM-18 today?',
   'faculty_availability',
   'The assistant reports whether SIM-18 is estimated to be available for '
   'consultation, in a scheduled class, or unavailable, and makes clear the answer '
   'is an estimate. It gives no room or office at which to meet them.',
   'synthetic'),

  ('Is SIM-33 in class at the moment?',
   'faculty_availability',
   'The assistant reports SIM-33 state as one of the three permitted values. Where '
   'the lecturer is in a scheduled class it may say so, without naming the room, '
   'the building or the course location.',
   'synthetic');

do $$
declare n integer;
begin
  select count(*) into n from eval_query where category = 'faculty_availability';
  raise notice 'faculty_availability queries registered: %', n;

  for n in (select 1 where exists (
      select 1 from eval_query where category = 'faculty_availability'
        and ground_truth_answer is null)) loop
    raise exception 'an availability query was registered without a ground truth';
  end loop;
end $$;

commit;
