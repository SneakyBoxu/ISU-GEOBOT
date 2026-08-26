-- =====================================================================
--  003 — Real ISU Echague campus locations
--
--  Imports the 28 campus locations from the teammate reference repository
--  into the authoritative `geobot.poi` table.
--
--  WHAT IS IMPORTED: names, categories, descriptions and coordinates for
--  the actual ISU Echague Main Campus.
--
--  WHAT IS NOT IMPORTED: the source project's flat `locations` table, its
--  disabled row-level security, and its unauthenticated browser-side
--  editor. This system's Campus Location portal remains the only writer,
--  and RLS stays deny-by-default.
--
--  PROVENANCE (research integrity). The source states its coordinates were
--  "verified against Google Maps satellite imagery (2026)". Thesis
--  §3.4.1(a) specifies on-site GPS mapping verified against physical
--  landmarks. Satellite tracing is not that, so a new survey_method value
--  `satellite_imagery` is added and used here. The distinction stays
--  reportable, and replacing these with surveyed positions later is a
--  survey_method update rather than a re-import.
-- =====================================================================

begin;
set search_path = geobot, public, extensions;

-- ---------------------------------------------------------------------
-- 1. Vocabulary extensions
-- ---------------------------------------------------------------------

-- The real campus has an athletic oval and a covered gymnasium; folding
-- them into 'facility' would lose a distinction the source data makes.
alter table poi drop constraint if exists poi_poi_type_check;
alter table poi add constraint poi_poi_type_check
  check (poi_type in ('college', 'administrative', 'laboratory', 'library',
                      'facility', 'sports', 'landmark', 'other'));

-- Honest provenance for coordinates read off imagery rather than surveyed.
alter table poi drop constraint if exists poi_survey_method_check;
alter table poi add constraint poi_survey_method_check
  check (survey_method in ('gps_survey', 'satellite_imagery', 'floor_plan',
                           'estimated', 'unknown'));

comment on column poi.survey_method is
  'How the coordinate was obtained. gps_survey is the only value that meets '
  'thesis §3.4.1(a) (on-site mapping verified against physical landmarks). '
  'satellite_imagery means traced from aerial imagery — good enough to place '
  'a marker, not survey data, and reportable as such.';

-- ---------------------------------------------------------------------
-- 2. Stable human-readable key
-- ---------------------------------------------------------------------
-- The assistant's map-control protocol references locations by slug rather
-- than by uuid: a language model can reliably echo `university-library`
-- and cannot reliably echo a uuid. The slug is an external identifier, so
-- it is unique and stable; `id` remains the primary key.
alter table poi add column if not exists slug text;
alter table poi drop constraint if exists poi_slug_key;
alter table poi drop constraint if exists poi_slug_unique;
alter table poi add constraint poi_slug_unique unique (slug);

comment on column poi.slug is
  'Stable human-readable identifier used by the assistant''s location '
  'protocol. Not a primary key and never used for authorization.';

-- ---------------------------------------------------------------------
-- 3. The locations
-- ---------------------------------------------------------------------
-- Idempotent: re-running updates the existing row rather than duplicating.
-- Deliberately does NOT touch created_by/updated_by — these rows were
-- loaded by migration, not edited through the portal, and the audit trail
-- should say so by omission.

insert into poi (slug, name, poi_type, lat, lng, building_function,
                 description, is_featured, survey_method, data_origin)
values
  ('admin-building', 'Administrative Building', 'administrative', 16.72086, 121.68961,
   'University management and executive offices',
   'The main administrative hub of ISU Echague, housing the Office of the University President, Vice Presidents, and other top management offices.',
   true, 'satellite_imagery', 'real'),

  ('registrar', 'Office of the Registrar', 'administrative', 16.72098, 121.68981,
   'Student records and enrollment services',
   'Handles student enrollment, academic records, transcripts, and other registration services for the university.',
   true, 'satellite_imagery', 'real'),

  ('cashier-office', 'Cashier''s Office', 'administrative', 16.72059, 121.68960,
   'Financial transactions and tuition payments',
   'Manages financial transactions, tuition fee payments, and other monetary matters for students and staff.',
   false, 'satellite_imagery', 'real'),

  ('college-engineering', 'College of Engineering', 'college', 16.72100, 121.69320,
   'Academic instruction in engineering disciplines',
   'Offers engineering programs including Agricultural Engineering, Civil Engineering, Electrical Engineering, and Mechanical Engineering.',
   true, 'satellite_imagery', 'real'),

  ('college-education', 'College of Teacher Education', 'college', 16.72190, 121.69340,
   'Teacher training and education programs',
   'Prepares future educators with programs in Elementary Education, Secondary Education, and other teacher training courses.',
   false, 'satellite_imagery', 'real'),

  ('college-arts-sciences', 'College of Arts and Sciences', 'college', 16.71840, 121.68911,
   'Natural sciences, social sciences and humanities',
   'Offers programs in natural sciences, social sciences, humanities, and communication arts.',
   false, 'satellite_imagery', 'real'),

  ('college-agriculture', 'College of Agriculture', 'college', 16.72349, 121.69089,
   'Agricultural sciences instruction and research',
   'The flagship college of ISU, providing programs in Agricultural Sciences, Animal Science, Crop Science, and Soil Science.',
   true, 'satellite_imagery', 'real'),

  ('college-business', 'College of Business, Accountancy and Public Administration', 'college', 16.72010, 121.69310,
   'Business, accountancy and public administration programs',
   'Offers business-related programs including Accountancy, Business Administration, Public Administration, and Hospitality Management.',
   false, 'satellite_imagery', 'real'),

  ('college-computing', 'College of Computing, Information and Communication Technology', 'college', 16.71871, 121.68841,
   'Computing and ICT instruction and laboratories',
   'Provides programs in Information Technology, Computer Science, and Information Systems, equipped with modern computer laboratories.',
   true, 'satellite_imagery', 'real'),

  ('college-criminal-justice', 'College of Criminal Justice Education', 'college', 16.71750, 121.69250,
   'Criminology and criminal justice education',
   'Offers the Bachelor of Science in Criminology program, preparing students for careers in law enforcement and criminal justice.',
   false, 'satellite_imagery', 'real'),

  ('graduate-school', 'Graduate School', 'college', 16.72030, 121.69050,
   'Postgraduate instruction and research',
   'Offers master''s and doctoral programs across various disciplines, supporting advanced academic research and professional development.',
   false, 'satellite_imagery', 'real'),

  ('university-library', 'University Library', 'library', 16.71960, 121.69030,
   'Library and learning resources',
   'The main library of ISU Echague, housing thousands of volumes of books, periodicals, and digital resources for academic research.',
   true, 'satellite_imagery', 'real'),

  ('university-infirmary', 'University Infirmary', 'facility', 16.71830, 121.69050,
   'Primary healthcare and first aid',
   'Provides primary healthcare services, first aid, and medical consultations for students, faculty, and staff.',
   false, 'satellite_imagery', 'real'),

  ('cvcdc', 'Cagayan Valley Cacao Development Center', 'laboratory', 16.72350, 121.69400,
   'Cacao research, processing and development',
   'A research and development center dedicated to cacao production, processing, and quality improvement in the Cagayan Valley region.',
   false, 'satellite_imagery', 'real'),

  ('emcc', 'Equipment Manufacturing Cluster Center', 'laboratory', 16.72150, 121.69400,
   'Fabrication and agricultural equipment development',
   'A fabrication and manufacturing facility that supports research and development of agricultural equipment and machinery.',
   false, 'satellite_imagery', 'real'),

  ('ict-center', 'ICT Center', 'laboratory', 16.72000, 121.69200,
   'Campus network infrastructure and IT services',
   'The university''s information and communications technology hub, managing campus network infrastructure and IT services.',
   false, 'satellite_imagery', 'real'),

  ('dormitory', 'University Dormitory', 'facility', 16.72117, 121.69549,
   'Student residential accommodation',
   'Student residential facilities providing affordable accommodation for students from distant municipalities and provinces.',
   false, 'satellite_imagery', 'real'),

  ('canteen', 'University Canteen', 'facility', 16.72000, 121.68920,
   'Dining and refreshments',
   'The main dining area where students, faculty, and staff can enjoy affordable meals and refreshments throughout the day.',
   false, 'satellite_imagery', 'real'),

  ('oval', 'The Oval (Athletic Field)', 'sports', 16.71982, 121.69398,
   'Athletics, physical education and intramurals',
   'The main athletic field used for sports activities, physical education classes, intramurals, and university-wide fitness programs.',
   false, 'satellite_imagery', 'real'),

  ('open-gymnasium', 'Covered Court / Open Gymnasium', 'sports', 16.71900, 121.69320,
   'Indoor sports and university events',
   'An open-air gymnasium used for basketball, volleyball, badminton, and other indoor sports activities and university events.',
   false, 'satellite_imagery', 'real'),

  ('amphitheater', 'University Amphitheater', 'landmark', 16.71877, 121.69245,
   'Open-air venue for ceremonies and performances',
   'An open-air venue for university-wide events, forums, ceremonies, cultural performances, and large gatherings.',
   false, 'satellite_imagery', 'real'),

  ('alba-hall', 'Alba Hall', 'landmark', 16.72050, 121.68880,
   'Formal events, seminars and conferences',
   'A major venue for formal events, MOA signings, seminars, conferences, and university ceremonies.',
   false, 'satellite_imagery', 'real'),

  ('de-venecia-hall', 'De Venecia Hall', 'landmark', 16.72533, 121.69192,
   'Multi-purpose academic and administrative hall',
   'A multi-purpose hall used for academic and administrative functions, named in honor of notable benefactors of the university.',
   false, 'satellite_imagery', 'real'),

  ('student-plaza', 'Student Plaza', 'landmark', 16.72010, 121.68960,
   'Central student gathering space',
   'A central gathering space for students featuring seating areas, bulletin boards, and spaces for student organization activities.',
   false, 'satellite_imagery', 'real'),

  ('main-gate', 'Main Gate', 'landmark', 16.72165, 121.68551,
   'Primary campus entrance and security checkpoint',
   'The primary entrance to the ISU Echague Main Campus along the national highway, featuring the university signage and security checkpoint.',
   true, 'satellite_imagery', 'real'),

  ('library-park', 'Library Park', 'landmark', 16.71980, 121.69060,
   'Green space for reading and rest',
   'A serene green space near the university library, perfect for reading, relaxation, and quiet contemplation amidst nature.',
   false, 'satellite_imagery', 'real'),

  ('security-park', 'Security Park', 'landmark', 16.72130, 121.68620,
   'Landscaped rest area and assembly point',
   'A landscaped park area near the campus security office, serving as a peaceful rest area and assembly point.',
   false, 'satellite_imagery', 'real'),

  ('bike-station', 'Bike Station', 'facility', 16.72140, 121.68600,
   'Free campus transport bicycles',
   'Free transport bike station providing eco-friendly mobility for students to travel conveniently around the 355-hectare campus.',
   false, 'satellite_imagery', 'real')

on conflict (slug) do update set
  name              = excluded.name,
  poi_type          = excluded.poi_type,
  lat               = excluded.lat,
  lng               = excluded.lng,
  building_function = excluded.building_function,
  description       = excluded.description,
  is_featured       = excluded.is_featured,
  survey_method     = excluded.survey_method,
  data_origin       = excluded.data_origin,
  updated_at        = now();

-- ---------------------------------------------------------------------
-- 4. Retire the placeholder locations
-- ---------------------------------------------------------------------
-- Unpublish rather than delete: a hard delete would remove rows an earlier
-- evaluation run may have retrieved against. Unpublishing hides them from
-- the map and the corpus while the record survives.
update poi set is_published = false, updated_at = now()
 where data_origin = 'synthetic';

delete from document_chunk
 where document_id in (
   select d.id from document d
   join poi p on d.source_origin = 'generated:poi:' || p.id::text
   where p.data_origin = 'synthetic');

delete from document
 where id in (
   select d.id from document d
   join poi p on d.source_origin = 'generated:poi:' || p.id::text
   where p.data_origin = 'synthetic');

commit;

-- =====================================================================
--  AFTER RUNNING THIS
--
--  Regenerate the place-cards so the assistant can answer about the new
--  locations. Either:
--      cd ml && python ingest.py --place-cards --origin real
--  or, per location, POST /api/admin/pois/:id/reindex from the Campus
--  Location portal.
--
--  The coordinates here came from satellite imagery, not a survey. When
--  the on-site GPS mapping described in thesis §3.4.1(a) is done, update
--  the affected rows through the Campus Location portal and set
--  survey_method = 'gps_survey'.
-- =====================================================================
