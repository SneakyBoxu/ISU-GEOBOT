/**
 * In-memory fixture dataset for DEMO_MODE.
 *
 * Mirrors db/seed/001_demo_data.sql so that switching from demo mode to a real
 * Supabase project changes the data source, not the data shape.
 *
 * ############  EVERY RECORD HERE IS data_origin = 'synthetic'  ############
 *
 * Audit F-38 / R1-R12. Names are visibly fake ("Demo Faculty A"), coordinates
 * are unsurveyed placeholders, and documents are obviously illustrative. If a
 * screenshot of this data ends up anywhere near the thesis, it must be
 * self-evidently placeholder data.
 *
 * The evaluation harness refuses to run while any of this is loaded.
 */

const dept = (id, name, short_code, college) => ({
  id, name, short_code, college, data_origin: 'synthetic',
});

export const departments = [
  dept('d1', 'Department of Information Technology', 'DIT',
       'College of Computing Studies, Information and Communication Technology'),
  dept('d2', 'Department of Computer Science', 'DCS',
       'College of Computing Studies, Information and Communication Technology'),
  dept('d3', 'Department of Civil Engineering', 'DCE', 'College of Engineering'),
  dept('d4', 'Department of Biology', 'DBIO', 'College of Arts and Sciences'),
  dept('d5', 'Office of the University Registrar', 'OUR', 'Administration'),
];

export const faculty = [
  { id: 'f1', full_name: 'Demo Faculty A', honorific: 'Prof.', department_id: 'd1' },
  { id: 'f2', full_name: 'Demo Faculty B', honorific: 'Dr.', department_id: 'd2' },
  { id: 'f3', full_name: 'Demo Faculty C', honorific: 'Engr.', department_id: 'd3' },
  { id: 'f4', full_name: 'Demo Faculty D', honorific: 'Prof.', department_id: 'd4' },
  { id: 'f5', full_name: 'Demo Faculty E', honorific: 'Dr.', department_id: 'd2' },
].map((f) => ({
  ...f,
  // Audit F-32 / C11: in a real deployment this is a hard gate on the
  // answerable roster. Consent for the study is obtained from validators only,
  // while schedules may be ingested for whole departments.
  is_consented: true,
  consent_date: '2026-01-01',
  is_active: true,
  // RA 10173 right to object, exercised by the data subject rather than the
  // researchers. Faculty D starts paused so the behaviour is visible in the
  // demo without anyone having to toggle it first.
  availability_visible: f.id !== 'f4',
  availability_paused_at: f.id === 'f4' ? '2026-08-01T00:00:00Z' : null,
  availability_pause_reason: f.id === 'f4' ? 'On research leave this semester' : null,
  data_origin: 'synthetic',
}));

export const facultyAlias = faculty.flatMap((f) => {
  const letter = f.full_name.split(' ').at(-1);
  return [
    { id: `a-${f.id}-1`, faculty_id: f.id, alias: `Faculty ${letter}`, alias_kind: 'surname', data_origin: 'synthetic' },
    { id: `a-${f.id}-2`, faculty_id: f.id, alias: f.full_name, alias_kind: 'full', data_origin: 'synthetic' },
  ];
});

// Audit F-19: the classifier receives this, never a name.
export const facultyPseudonymMap = faculty.map((f, i) => ({
  faculty_id: f.id,
  pseudonym_id: `px${String(i + 1).padStart(4, '0')}`,
}));

/** One plausible teaching week per demo faculty member. */
const WEEK = [
  { day_of_week: 1, start_time: '08:00', end_time: '10:00', block_kind: 'class', course_code: 'DEMO 101' },
  { day_of_week: 1, start_time: '13:00', end_time: '15:00', block_kind: 'consultation', course_code: null },
  { day_of_week: 2, start_time: '10:00', end_time: '12:00', block_kind: 'class', course_code: 'DEMO 102' },
  { day_of_week: 3, start_time: '08:00', end_time: '10:00', block_kind: 'consultation', course_code: null },
  { day_of_week: 3, start_time: '14:00', end_time: '16:00', block_kind: 'class', course_code: 'DEMO 103' },
  { day_of_week: 4, start_time: '09:00', end_time: '11:00', block_kind: 'class', course_code: 'DEMO 104' },
  { day_of_week: 5, start_time: '13:00', end_time: '16:00', block_kind: 'consultation', course_code: null },
];

export const facultySchedule = faculty.flatMap((f, fi) =>
  WEEK.map((b, bi) => ({
    id: `s-${f.id}-${bi}`,
    faculty_id: f.id,
    ...b,
    // Shift each person by an hour so the demo shows different statuses at the
    // same moment rather than all five moving in lockstep.
    start_time: shift(b.start_time, fi),
    end_time: shift(b.end_time, fi),
    semester: '2025-2026-1',
    // Relational/training use only — must never reach an LLM prompt (F-27/F-28).
    room_label: b.block_kind === 'class' ? `DEMO-ROOM-${(bi % 3) + 1}` : 'DEMO-OFFICE',
    data_origin: 'synthetic',
  })),
);

function shift(hhmm, hours) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${String((h + hours) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const institutionalEvent = [];   // none today, so the demo runs normally

const POI_ROWS = [
  ['p01', 'admin-building', 'Administrative Building', 'administrative', 16.72086, 121.68961,
   'University management and executive offices',
   'The main administrative hub of ISU Echague, housing the Office of the University President, Vice Presidents, and other top management offices.',
   true],
  ['p02', 'registrar', 'Office of the Registrar', 'administrative', 16.72098, 121.68981,
   'Student records and enrollment services',
   'Handles student enrollment, academic records, transcripts, and other registration services for the university.',
   true],
  ['p03', 'cashier-office', 'Cashier\'s Office', 'administrative', 16.72059, 121.6896,
   'Financial transactions and tuition payments',
   'Manages financial transactions, tuition fee payments, and other monetary matters for students and staff.',
   false],
  ['p04', 'college-engineering', 'College of Engineering', 'college', 16.721, 121.6932,
   'Academic instruction in engineering disciplines',
   'Offers engineering programs including Agricultural Engineering, Civil Engineering, Electrical Engineering, and Mechanical Engineering.',
   true],
  ['p05', 'college-education', 'College of Teacher Education', 'college', 16.7219, 121.6934,
   'Teacher training and education programs',
   'Prepares future educators with programs in Elementary Education, Secondary Education, and other teacher training courses.',
   false],
  ['p06', 'college-arts-sciences', 'College of Arts and Sciences', 'college', 16.7184, 121.68911,
   'Natural sciences, social sciences and humanities',
   'Offers programs in natural sciences, social sciences, humanities, and communication arts.',
   false],
  ['p07', 'college-agriculture', 'College of Agriculture', 'college', 16.72349, 121.69089,
   'Agricultural sciences instruction and research',
   'The flagship college of ISU, providing programs in Agricultural Sciences, Animal Science, Crop Science, and Soil Science.',
   true],
  ['p08', 'college-business', 'College of Business, Accountancy and Public Administration', 'college', 16.7201, 121.6931,
   'Business, accountancy and public administration programs',
   'Offers business-related programs including Accountancy, Business Administration, Public Administration, and Hospitality Management.',
   false],
  ['p09', 'college-computing', 'College of Computing, Information and Communication Technology', 'college', 16.71871, 121.68841,
   'Computing and ICT instruction and laboratories',
   'Provides programs in Information Technology, Computer Science, and Information Systems, equipped with modern computer laboratories.',
   true],
  ['p10', 'college-criminal-justice', 'College of Criminal Justice Education', 'college', 16.7175, 121.6925,
   'Criminology and criminal justice education',
   'Offers the Bachelor of Science in Criminology program, preparing students for careers in law enforcement and criminal justice.',
   false],
  ['p11', 'graduate-school', 'Graduate School', 'college', 16.7203, 121.6905,
   'Postgraduate instruction and research',
   'Offers master\'s and doctoral programs across various disciplines, supporting advanced academic research and professional development.',
   false],
  ['p12', 'university-library', 'University Library', 'library', 16.7196, 121.6903,
   'Library and learning resources',
   'The main library of ISU Echague, housing thousands of volumes of books, periodicals, and digital resources for academic research.',
   true],
  ['p13', 'university-infirmary', 'University Infirmary', 'facility', 16.7183, 121.6905,
   'Primary healthcare and first aid',
   'Provides primary healthcare services, first aid, and medical consultations for students, faculty, and staff.',
   false],
  ['p14', 'cvcdc', 'Cagayan Valley Cacao Development Center', 'laboratory', 16.7235, 121.694,
   'Cacao research, processing and development',
   'A research and development center dedicated to cacao production, processing, and quality improvement in the Cagayan Valley region.',
   false],
  ['p15', 'emcc', 'Equipment Manufacturing Cluster Center', 'laboratory', 16.7215, 121.694,
   'Fabrication and agricultural equipment development',
   'A fabrication and manufacturing facility that supports research and development of agricultural equipment and machinery.',
   false],
  ['p16', 'ict-center', 'ICT Center', 'laboratory', 16.72, 121.692,
   'Campus network infrastructure and IT services',
   'The university\'s information and communications technology hub, managing campus network infrastructure and IT services.',
   false],
  ['p17', 'dormitory', 'University Dormitory', 'facility', 16.72117, 121.69549,
   'Student residential accommodation',
   'Student residential facilities providing affordable accommodation for students from distant municipalities and provinces.',
   false],
  ['p18', 'canteen', 'University Canteen', 'facility', 16.72, 121.6892,
   'Dining and refreshments',
   'The main dining area where students, faculty, and staff can enjoy affordable meals and refreshments throughout the day.',
   false],
  ['p19', 'oval', 'The Oval (Athletic Field)', 'sports', 16.71982, 121.69398,
   'Athletics, physical education and intramurals',
   'The main athletic field used for sports activities, physical education classes, intramurals, and university-wide fitness programs.',
   false],
  ['p20', 'open-gymnasium', 'Covered Court / Open Gymnasium', 'sports', 16.719, 121.6932,
   'Indoor sports and university events',
   'An open-air gymnasium used for basketball, volleyball, badminton, and other indoor sports activities and university events.',
   false],
  ['p21', 'amphitheater', 'University Amphitheater', 'landmark', 16.71877, 121.69245,
   'Open-air venue for ceremonies and performances',
   'An open-air venue for university-wide events, forums, ceremonies, cultural performances, and large gatherings.',
   false],
  ['p22', 'alba-hall', 'Alba Hall', 'landmark', 16.7205, 121.6888,
   'Formal events, seminars and conferences',
   'A major venue for formal events, MOA signings, seminars, conferences, and university ceremonies.',
   false],
  ['p23', 'de-venecia-hall', 'De Venecia Hall', 'landmark', 16.72533, 121.69192,
   'Multi-purpose academic and administrative hall',
   'A multi-purpose hall used for academic and administrative functions, named in honor of notable benefactors of the university.',
   false],
  ['p24', 'student-plaza', 'Student Plaza', 'landmark', 16.7201, 121.6896,
   'Central student gathering space',
   'A central gathering space for students featuring seating areas, bulletin boards, and spaces for student organization activities.',
   false],
  ['p25', 'main-gate', 'Main Gate', 'landmark', 16.72165, 121.68551,
   'Primary campus entrance and security checkpoint',
   'The primary entrance to the ISU Echague Main Campus along the national highway, featuring the university signage and security checkpoint.',
   true],
  ['p26', 'library-park', 'Library Park', 'landmark', 16.7198, 121.6906,
   'Green space for reading and rest',
   'A serene green space near the university library, perfect for reading, relaxation, and quiet contemplation amidst nature.',
   false],
  ['p27', 'security-park', 'Security Park', 'landmark', 16.7213, 121.6862,
   'Landscaped rest area and assembly point',
   'A landscaped park area near the campus security office, serving as a peaceful rest area and assembly point.',
   false],
  ['p28', 'bike-station', 'Bike Station', 'facility', 16.7214, 121.686,
   'Free campus transport bicycles',
   'Free transport bike station providing eco-friendly mobility for students to travel conveniently around the 355-hectare campus.',
   false],
];

// Mirrors the `update` block in db/migrations/004_poi_icon.sql. Locations not
// listed keep their category icon.
const POI_ICONS = {
  'bike-station': 'bike',
  'canteen': 'utensils',
  'university-infirmary': 'stethoscope',
  'oval': 'trophy',
  'open-gymnasium': 'dumbbell',
  'cvcdc': 'nut',
  'ict-center': 'cpu',
  'university-library': 'book-open',
  'main-gate': 'shield',
  'student-plaza': 'users',
  'library-park': 'trees',
  'security-park': 'trees',
  'amphitheater': 'music',
  'college-engineering': 'wrench',
  'college-agriculture': 'wheat',
  'graduate-school': 'graduation-cap',
  'college-criminal-justice': 'scale',
  'emcc': 'wrench',
  'dormitory': 'building',
  'registrar': 'landmark',
  'alba-hall': 'music',
  'de-venecia-hall': 'presentation',
  'college-computing': 'cpu',
  'college-education': 'presentation',
  'college-business': 'store',
  'college-arts-sciences': 'microscope',
  'cashier-office': 'landmark',
  'admin-building': 'landmark',
};

export const poi = POI_ROWS.map(([id, slug, name, poi_type, lat, lng, building_function, description, is_featured]) => ({
  id, slug, name, poi_type, lat, lng, building_function, description, is_featured,
  icon: POI_ICONS[slug] ?? null,
  department_id: null,
  is_published: true,
  // Traced from satellite imagery by the reference project, not surveyed on
  // site. Thesis §3.4.1(a) requires GPS mapping verified against physical
  // landmarks; recording the difference keeps it reportable.
  survey_method: 'satellite_imagery',
  data_origin: 'real',
}));

/**
 * Illustrative institutional documents.
 *
 * Deliberately generic and obviously not real ISU memoranda (audit R5). Real
 * documents come from administrative offices per thesis §3.4.1(c). Note that
 * none of these contains a faculty office assignment — audit C6/F-28: static
 * office location and live whereabouts must not be combinable.
 */
export const documents = [
  {
    id: 'doc1',
    title: 'Demo Academic Calendar',
    doc_type: 'academic_calendar',
    text: `The demonstration academic calendar for the first semester lists the enrollment period at the start of the term, a midterm examination period near the middle of the semester, and a final examination period in the last two weeks. Classes are suspended during university-wide convocations and faculty assemblies. Students should confirm all dates with the Office of the University Registrar, which publishes the official calendar.`,
  },
  {
    id: 'doc2',
    title: 'Demo Registrar Services Guide',
    doc_type: 'handbook',
    text: `The Office of the University Registrar handles enrollment, student records, transcripts of records, certifications, and credential evaluation. Students requesting a transcript should file a request at the Registrar and allow several working days for processing. Enrollment for continuing students requires academic advising and clearance from the college. The Registrar is located in the administrative area of the campus and is marked on the ISU-GeoBot campus map.`,
  },
  {
    id: 'doc3',
    title: 'Demo Consultation Hours Policy',
    doc_type: 'memorandum',
    text: `Faculty members are expected to hold regular consultation hours each week for student advising. Consultation hours are published by each department and are separate from scheduled teaching hours. Students are encouraged to check a faculty member's availability before visiting, and to coordinate through the department office when a consultation falls outside published hours. Availability may change due to university-wide events, examination periods, and administrative meetings.`,
  },
  {
    id: 'doc4',
    title: 'Demo Campus Facilities Overview',
    doc_type: 'handbook',
    text: `The Echague Main Campus includes academic buildings for the colleges, a main library, computing and engineering laboratories, a university gymnasium, and central administrative offices. The main library provides reference collections, periodicals and study areas. The gymnasium serves as the venue for convocations, assemblies and physical education classes. Building locations are shown on the interactive campus map.`,
  },
];

/**
 * Landing-page demo queries.
 *
 * Audit F-16 + F-29: the comparison widget accepts only these. Free text with a
 * client-side arm toggle would put `mode` under client control on a public
 * endpoint and reopen the aggregation-polling surface.
 */
export const demoQuery = [
  { id: 'dq1', label: 'Find a building', query_text: 'Where is the College of Computing Studies?', category: 'campus_navigation', sort_order: 1, is_active: true },
  { id: 'dq2', label: 'Institutional info', query_text: 'What services does the Office of the University Registrar provide?', category: 'general_institutional', sort_order: 2, is_active: true },
  { id: 'dq3', label: 'Faculty availability', query_text: 'Is Demo Faculty A available for consultation right now?', category: 'faculty_availability', sort_order: 3, is_active: true },
  { id: 'dq4', label: 'Combined question', query_text: 'Where is Demo Faculty B based and are they free right now?', category: 'combined', sort_order: 4, is_active: true },
];

export const availabilityStatus = [
  { code: 'available_consultation', display_label: 'Available for Consultation', thesis_label: 'Available for Consultation', sort_order: 1 },
  { code: 'in_scheduled_class', display_label: 'In Scheduled Class / Lecture', thesis_label: 'Currently in a Lecture', sort_order: 2 },
  { code: 'unavailable_off_schedule', display_label: 'Unavailable / Off-Schedule', thesis_label: 'Unavailable', sort_order: 3 },
];

/** Mutable. The guard dashboard writes here in demo mode. */
export const guardPresenceEvent = [];

export const guardUser = [
  { id: 'g1', auth_user_id: 'demo-guard', display_name: 'Demo Security Officer', is_active: true },
];

export const appUserRole = [
  { auth_user_id: 'demo-guard', role: 'guard', faculty_id: null, is_active: true },
  { auth_user_id: 'demo-validator', role: 'validator', faculty_id: 'f1', is_active: true },
  // The validator is also a faculty member — the two roles are separate
  // because validation participation and being a data subject are separate
  // things, and a faculty member may withdraw from one without the other.
  { auth_user_id: 'demo-validator', role: 'faculty', faculty_id: 'f1', is_active: true },
  { auth_user_id: 'demo-student', role: 'student', faculty_id: null, is_active: true },
  { auth_user_id: 'demo-admin', role: 'admin', faculty_id: null, is_active: true },
  { auth_user_id: 'demo-admin', role: 'researcher', faculty_id: null, is_active: true },
];

export const poiAudit = [];
export const facultyVisibilityEvent = [];

/** Empty on purpose. Audit R6/R7: no seeded metrics, ever. */
export const evalRun = [];
export const evalQuery = [];
export const evalResult = [];
export const ragasScore = [];
export const rfModelVersion = [];
export const facultyValidation = [];
export const chatLog = [];
