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

export const poi = [
  ['p1', 'College of Computing Studies Building', 'college', 16.7102, 121.6751,
   'Academic instruction and computing laboratories', 'd2',
   'Houses the computing programs, lecture rooms and laboratories.', true],
  ['p2', 'College of Engineering Building', 'college', 16.7095, 121.6763,
   'Academic instruction and engineering laboratories', 'd3',
   'Engineering lecture rooms, drafting rooms and testing laboratories.', true],
  ['p3', 'College of Arts and Sciences Building', 'college', 16.7086, 121.6739,
   'Academic instruction in the natural and social sciences', 'd4',
   'General education and science programs.', true],
  ['p4', 'Office of the University Registrar', 'administrative', 16.7078, 121.6747,
   'Student records, enrollment and credential services', 'd5',
   'Enrollment, transcripts, certifications and academic records.', true],
  ['p5', 'University Main Library', 'library', 16.7091, 121.673,
   'Library and learning resources', null,
   'Reference collections, periodicals and study areas.', true],
  ['p6', 'Computer Laboratory Complex', 'laboratory', 16.7106, 121.6756,
   'Computing laboratories', 'd1',
   'Hands-on laboratories for programming and networking courses.', false],
  ['p7', 'University Gymnasium', 'facility', 16.707, 121.6761,
   'Athletics, assemblies and university events', null,
   'Venue for convocations, assemblies and physical education.', false],
  ['p8', 'Administration Building', 'administrative', 16.7082, 121.6752,
   'Central university administration', null,
   'Offices of university administration and student services.', false],
].map(([id, name, poi_type, lat, lng, building_function, department_id, description, is_featured]) => ({
  id, name, poi_type, lat, lng, building_function, department_id, description,
  is_featured, data_origin: 'synthetic',
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
