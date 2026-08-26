-- =====================================================================
--  ISU-GeoBot — DEVELOPMENT SEED DATA
--
--  ############  EVERY ROW HERE IS data_origin = 'synthetic'  ############
--
--  Audit F-38 / R1-R12. This file exists so the system can be built and
--  demonstrated before real institutional data is collected. It is NOT
--  research data and nothing computed from it may be reported.
--
--  Three enforcement layers make that stick:
--    1. data_origin = 'synthetic' on every row.
--    2. corpus_is_research_ready() returns false while any of these exist, and
--       evalRunner.js / db.assert_research_ready() hard-fail on it.
--    3. Names and coordinates are VISIBLY fake. GET /api/map/pois prefixes
--       synthetic POIs with [DEMO], and faculty here are named "Demo Faculty
--       A..E" — so a screenshot of placeholder data is self-evidently
--       placeholder data.
--
--  Coordinates are offset placeholders near Echague, Isabela. They are NOT
--  surveyed positions. Real coordinates come from the on-site GPS mapping
--  described in thesis §3.4.1(a).
--
--  TO REPLACE WITH REAL DATA:
--    delete from geobot.faculty;       -- cascades
--    delete from geobot.poi;
--    delete from geobot.document;
--    ... then load real data with data_origin = 'real'.
-- =====================================================================

begin;
set search_path = geobot, public;

-- ---------------------------------------------------------------------
-- Departments
-- ---------------------------------------------------------------------
insert into department (name, short_code, college, data_origin) values
  ('Department of Information Technology', 'DIT',
   'College of Computing Studies, Information and Communication Technology', 'synthetic'),
  ('Department of Computer Science', 'DCS',
   'College of Computing Studies, Information and Communication Technology', 'synthetic'),
  ('Department of Civil Engineering', 'DCE', 'College of Engineering', 'synthetic'),
  ('Department of Biology', 'DBIO', 'College of Arts and Sciences', 'synthetic'),
  ('Office of the University Registrar', 'OUR', 'Administration', 'synthetic');

-- ---------------------------------------------------------------------
-- Faculty
--
-- All marked is_consented = true so the demo roster is non-empty. In the real
-- deployment this column is a HARD GATE (audit F-32 / C11): only faculty who
-- have given written informed consent may be asked about, because §3.10
-- obtains consent from the 15 validators while §3.4.1(b) ingests schedules for
-- entire departments.
-- ---------------------------------------------------------------------
insert into faculty (full_name, honorific, department_id, is_consented, consent_date, data_origin)
select v.name, v.honorific, d.id, true, current_date, 'synthetic'
from (values
  ('Demo Faculty A', 'Prof.', 'DIT'),
  ('Demo Faculty B', 'Dr.',   'DCS'),
  ('Demo Faculty C', 'Engr.', 'DCE'),
  ('Demo Faculty D', 'Prof.', 'DBIO'),
  ('Demo Faculty E', 'Dr.',   'DCS')
) as v(name, honorific, code)
join department d on d.short_code = v.code;

insert into faculty_alias (faculty_id, alias, alias_kind, data_origin)
select id, split_part(full_name, ' ', 3), 'surname', 'synthetic' from faculty;

-- Pseudonyms. Audit F-19: the classifier receives this, never a name.
insert into faculty_pseudonym_map (faculty_id) select id from faculty;

-- ---------------------------------------------------------------------
-- Schedules — one plausible teaching week per demo faculty member
--
-- room_label is populated because train_rf.py and baseline_rule.py read it.
-- It must NEVER be interpolated into an LLM prompt (audit F-27/F-28); the
-- masking egress boundary and the output filter both exist to guarantee that.
-- ---------------------------------------------------------------------
insert into faculty_schedule
  (faculty_id, day_of_week, start_time, end_time, block_kind, semester, course_code, room_label, data_origin)
select f.id, s.dow, s.start_t, s.end_t, s.kind, '2025-2026-1', s.course, s.room, 'synthetic'
from faculty f
cross join lateral (values
  (1, time '08:00', time '10:00', 'class',        'DEMO 101', 'DEMO-ROOM-1'),
  (1, time '13:00', time '15:00', 'consultation', null,       'DEMO-OFFICE'),
  (2, time '10:00', time '12:00', 'class',        'DEMO 102', 'DEMO-ROOM-2'),
  (3, time '08:00', time '10:00', 'consultation', null,       'DEMO-OFFICE'),
  (3, time '14:00', time '16:00', 'class',        'DEMO 103', 'DEMO-ROOM-1'),
  (4, time '09:00', time '11:00', 'class',        'DEMO 104', 'DEMO-ROOM-3'),
  (5, time '13:00', time '16:00', 'consultation', null,       'DEMO-OFFICE')
) as s(dow, start_t, end_t, kind, course, room);

-- ---------------------------------------------------------------------
-- Institutional events — source of exam_period_flag and campus_event_flag
-- ---------------------------------------------------------------------
insert into institutional_event (event_date, event_type, title, disrupts_schedule, data_origin) values
  (current_date + 14, 'exam_period',      'Demo midterm examination period', true,  'synthetic'),
  (current_date + 30, 'convocation',      'Demo university convocation',     true,  'synthetic'),
  (current_date + 45, 'faculty_assembly', 'Demo faculty assembly',           true,  'synthetic');

-- ---------------------------------------------------------------------
-- Points of interest
--
-- PLACEHOLDER COORDINATES near Echague, Isabela. Not surveyed. The API prefixes
-- every synthetic POI name with [DEMO] before it reaches the browser.
-- ---------------------------------------------------------------------
insert into poi (name, poi_type, lat, lng, building_function, department_id, description, is_featured, data_origin)
select v.name, v.ptype, v.lat, v.lng, v.fn,
       (select id from department where short_code = v.dept),
       v.descr, v.featured, 'synthetic'
from (values
  ('College of Computing Studies Building', 'college', 16.71020, 121.67510,
   'Academic instruction and computing laboratories', 'DCS',
   'Houses computing programs, lecture rooms and laboratories.', true),
  ('College of Engineering Building', 'college', 16.70950, 121.67630,
   'Academic instruction and engineering laboratories', 'DCE',
   'Engineering lecture rooms, drafting rooms and testing laboratories.', true),
  ('College of Arts and Sciences Building', 'college', 16.70860, 121.67390,
   'Academic instruction in the natural and social sciences', 'DBIO',
   'General education and science programs.', true),
  ('Office of the University Registrar', 'administrative', 16.70780, 121.67470,
   'Student records, enrollment and credential services', 'OUR',
   'Enrollment, transcripts, certifications and academic records.', true),
  ('University Main Library', 'library', 16.70910, 121.67300,
   'Library and learning resources', null,
   'Reference collections, periodicals and study areas.', true),
  ('Computer Laboratory Complex', 'laboratory', 16.71060, 121.67560,
   'Computing laboratories', 'DIT',
   'Hands-on laboratories for programming and networking courses.', false),
  ('University Gymnasium', 'facility', 16.70700, 121.67610,
   'Athletics, assemblies and university events', null,
   'Venue for convocations, assemblies and physical education.', false),
  ('Administration Building', 'administrative', 16.70820, 121.67520,
   'Central university administration', null,
   'Offices of university administration and student services.', false)
) as v(name, ptype, lat, lng, fn, dept, descr, featured);

-- ---------------------------------------------------------------------
-- Landing-page demo queries
--
-- Audit F-16 + F-29. The comparison widget accepts ONLY these. Free text with
-- a client-side standard/enhanced toggle would put `mode` under client control
-- on a public endpoint AND reopen the aggregation-polling surface that status
-- masking does not close.
-- ---------------------------------------------------------------------
insert into demo_query (label, query_text, category, sort_order) values
  ('Find a building',
   'Where is the College of Computing Studies?', 'campus_navigation', 1),
  ('Institutional info',
   'What services does the Office of the University Registrar provide?',
   'general_institutional', 2),
  ('Faculty availability',
   'Is Demo Faculty A available for consultation right now?',
   'faculty_availability', 3),
  ('Combined question',
   'Where is Demo Faculty B''s department and are they free right now?',
   'combined', 4);

commit;

-- =====================================================================
--  NEXT
--    1. python machine-learning/ai_api_service.py   (start the ML service)
--    2. python machine-learning/document_knowledge_importer.py --place-cards --origin synthetic
--    3. python machine-learning/document_knowledge_importer.py --path ./data/documents --origin synthetic
--    4. python machine-learning/train_availability_model.py --semester 2025-2026-1 \
--         --start <term start> --end <term end> --plumbing-run
--
--  Step 4 REQUIRES --plumbing-run. Without real attendance data the features
--  and labels are both schedule-derived, so the forest reproduces the rule
--  baseline by construction and its accuracy is not a finding (audit F-18/F-20,
--  open decision C4). train_rf.py refuses to persist metrics for such a run.
-- =====================================================================
