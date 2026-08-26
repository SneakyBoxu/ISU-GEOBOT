-- =====================================================================
--  ISU-GeoBot — Database Schema (STEP 1)
--  PostgreSQL 15+ / Supabase, with pgvector
--
--  Design authority: PRE_IMPLEMENTATION_AUDIT.md (findings F-01..F-38)
--  Thesis authority: ISU_GeoBot_revised1.pdf, sections 3.5, 3.7, 3.8, 3.9
--
--  Non-negotiable invariants encoded structurally in this file:
--    I1  Every research-relevant table carries data_origin ∈ (synthetic|real).
--        The evaluation harness aborts on synthetic rows.                (F-38)
--    I2  guard_presence_event is APPEND-ONLY. Presence is DERIVED, never
--        stored as a mutable boolean. Tri-state, same-day window.        (F-07)
--    I3  document_chunk.token_count <= 220, enforced by CHECK, because
--        all-MiniLM-L6-v2 silently truncates at 256 word-pieces.         (F-34)
--    I4  NO ANN index on the embedding column. Exact cosine search only. (F-36)
--    I5  eval_result stores retrieved contexts VERBATIM or RAGAS cannot
--        be computed and the run cannot be reproduced.                   (F-03)
--    I6  Availability labels live in a lookup table, not hardcoded, so the
--        thesis vocabulary and the display vocabulary stay reconcilable.  (F-09)
--    I7  RLS is deny-by-default on every table. The anon key ships in the
--        browser bundle; application checks are not a boundary.           (F-30)
--    I8  attendance_record is pseudonymised and has NO FK to faculty.     (F-19)
--
--  Run order:  schema.sql  ->  policies.sql  ->  functions.sql  ->  seed/
-- =====================================================================

begin;

create extension if not exists "vector";
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";   -- fuzzy faculty-name gazetteer (F-31)

drop schema if exists geobot cascade;
create schema if not exists geobot;
set search_path = geobot, public, extensions;


-- =====================================================================
--  0. SHARED DOMAINS
-- =====================================================================

-- I1 / F-38. No DEFAULT on purpose: every insert must declare provenance.
create domain data_origin_t as text
  check (value in ('synthetic', 'real'));

comment on domain data_origin_t is
  'Provenance marker. The evaluation harness (evalRunner) MUST refuse to run '
  'when any row it touches is ''synthetic''. There is deliberately no default '
  'value: callers are forced to declare provenance. See audit F-38.';


-- =====================================================================
--  1. AVAILABILITY STATUS VOCABULARY                       (I6 / F-09)
-- =====================================================================
--  The thesis uses THREE inconsistent vocabularies:
--    §3.5.2 Gini     : Available / Late / Absent
--    §3.5.4 fusion   : Available / In a Lecture / Absent
--    §3.5.2 output,
--    §3.3, §3.9 eval : Available for Consultation /
--                      Currently in a Lecture / Unavailable
--  §3.9 defines the EVALUATED vocabulary, so it is the binding one.
--
--  The build brief specifies different display strings again
--  ("In Scheduled Class / Lecture", "Unavailable / Off-Schedule").
--  Those are *better* — they are honest that the estimate is schedule-derived
--  — but they are a DEVIATION from the strings faculty validators confirm
--  against in §3.9. This table keeps both, so the deviation is data rather
--  than a hardcoded string, and Chapter 3 can be reconciled without a
--  migration. RESEARCHER ACTION REQUIRED: audit C1.
-- =====================================================================

create table availability_status (
  code            text primary key
                  check (code in ('available_consultation',
                                  'in_scheduled_class',
                                  'unavailable_off_schedule')),
  display_label   text not null,   -- what the UI and the LLM context show
  thesis_label    text not null,   -- the §3.9 evaluated string (do not change)
  sort_order      smallint not null unique,
  description     text
);

insert into availability_status (code, display_label, thesis_label, sort_order, description) values
  ('available_consultation',   'Available for Consultation',
                               'Available for Consultation',   1,
   'Faculty is within a consultation window and not scheduled to teach.'),
  ('in_scheduled_class',       'In Scheduled Class / Lecture',
                               'Currently in a Lecture',       2,
   'Faculty has a scheduled teaching block at the queried time.'),
  ('unavailable_off_schedule', 'Unavailable / Off-Schedule',
                               'Unavailable',                  3,
   'Outside scheduled hours, on institutional event, or guard-confirmed off campus.');

comment on table availability_status is
  'CLOSED allowlist. The status masking egress boundary (maskingMiddleware) '
  'MUST reject any value not present here before it can reach Context Fusion. '
  'Audit F-26: this table IS the allowlist that makes masking an enforceable '
  'boundary rather than a string rename.';


-- =====================================================================
--  2. ORGANISATION & PEOPLE
-- =====================================================================

create table department (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  short_code      text unique,
  college         text,
  data_origin     data_origin_t not null,
  created_at      timestamptz not null default now(),
  unique (name)
);

-- Faculty NAMES live here and only here. Never in attendance_record. (F-19)
create table faculty (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null,
  honorific       text,                       -- 'Prof.', 'Dr.', 'Engr.'
  department_id   uuid references department(id) on delete set null,

  -- F-32 / audit C11. The router gazetteer MUST filter on is_consented.
  -- Faculty whose schedules were ingested but who never gave written consent
  -- are data subjects; the system must not answer questions about them.
  is_consented    boolean not null default false,
  consent_date    date,
  is_active       boolean not null default true,

  data_origin     data_origin_t not null,
  created_at      timestamptz not null default now(),

  constraint consent_requires_date
    check (is_consented = false or consent_date is not null)
);

create index faculty_consented_idx on faculty (is_consented) where is_consented;
create index faculty_name_trgm_idx on faculty using gin (full_name gin_trgm_ops);

comment on column faculty.is_consented is
  'Audit F-32. Hard gate on the answerable roster. /api/faculty/search and the '
  'deterministic router gazetteer must both filter on this column.';

-- Surname / spelling variants for EXACT-OR-CLARIFY resolution.        (F-31)
create table faculty_alias (
  id              uuid primary key default gen_random_uuid(),
  faculty_id      uuid not null references faculty(id) on delete cascade,
  alias           text not null,
  alias_kind      text not null default 'surname'
                  check (alias_kind in ('surname','full','nickname','spelling')),
  data_origin     data_origin_t not null,
  unique (alias, faculty_id)
);

create index faculty_alias_lookup_idx on faculty_alias (lower(alias));
create index faculty_alias_trgm_idx on faculty_alias using gin (alias gin_trgm_ops);

comment on table faculty_alias is
  'Audit F-31. Resolution is EXACT-OR-CLARIFY. Never fuzzy-resolve across '
  'people: matching "Prof. Santoso" to "Prof. Santos" discloses one person''s '
  'status in answer to a query about another. Trigram index is for detecting '
  'AMBIGUITY (>1 candidate -> ask), not for auto-selecting a winner.';

-- Pseudonym map. Held separately; NEVER exposed to the model or the API. (F-19)
create table faculty_pseudonym_map (
  faculty_id      uuid primary key references faculty(id) on delete cascade,
  pseudonym_id    text not null unique default encode(gen_random_bytes(9), 'hex'),
  created_at      timestamptz not null default now()
);

comment on table faculty_pseudonym_map is
  'Audit F-19. The thesis says attendance data is "anonymized" while §3.5.2 '
  'requires modelling INDIVIDUAL punctuality tendencies. Those are mutually '
  'exclusive. What is actually implemented is PSEUDONYMISATION: a stable '
  'surrogate key replaces the name in the ML feature store. Chapter 3 wording '
  'must be corrected — pseudonymised data is still personal data under RA 10173.';


-- =====================================================================
--  3. SCHEDULE & TEMPORAL FEATURES
-- =====================================================================

create table faculty_schedule (
  id              uuid primary key default gen_random_uuid(),
  faculty_id      uuid not null references faculty(id) on delete cascade,
  day_of_week     smallint not null check (day_of_week between 0 and 6), -- 0=Sun
  start_time      time not null,
  end_time        time not null,
  block_kind      text not null default 'class'
                  check (block_kind in ('class','consultation','admin')),
  semester        text not null,               -- '2025-2026-1'
  course_code     text,

  -- Relational / training use ONLY. This column must NEVER be interpolated
  -- into an LLM prompt or returned by /api/chat.                 (F-27, F-28)
  room_label      text,

  data_origin     data_origin_t not null,
  created_at      timestamptz not null default now(),

  check (end_time > start_time)
);

create index faculty_schedule_lookup_idx
  on faculty_schedule (faculty_id, semester, day_of_week, start_time, end_time);

comment on column faculty_schedule.room_label is
  'Audit F-27/F-28. Physical room. Used by train_rf.py and baseline_rule.py '
  'only. The masking egress boundary and the output-side regex filter both '
  'exist to guarantee this value cannot reach a generated answer.';

-- Drives exam_period_flag and campus_event_flag features (§3.5.2 c/d).
create table institutional_event (
  id              uuid primary key default gen_random_uuid(),
  event_date      date not null,
  event_type      text not null
                  check (event_type in ('convocation','faculty_assembly',
                                        'enrollment','exam_period',
                                        'semester_break','holiday','other')),
  title           text,
  disrupts_schedule boolean not null default true,
  data_origin     data_origin_t not null,
  unique (event_date, event_type)
);

create index institutional_event_date_idx on institutional_event (event_date);

-- Historical attendance. Pseudonymous. NO foreign key to faculty. (I8 / F-19)
--
-- AUDIT C4 / F-18 IS STILL OPEN. The build brief's RF feature list contains no
-- attendance features at all, which means that as specified the model is
-- trained on schedule-derived features against schedule-derived labels — i.e.
-- it would be learning the rule-based baseline and could not outperform it.
-- This table exists so the attendance feature block can be switched on the
-- moment real logs arrive, without a migration. See docs/OPEN_DECISIONS.md.
create table attendance_record (
  id              uuid primary key default gen_random_uuid(),
  pseudonym_id    text not null,                -- -> faculty_pseudonym_map
  event_time      timestamptz not null,
  event_type      text not null check (event_type in ('check_in','check_out')),
  source          text not null
                  check (source in ('biometric','logbook','manual')),
  granularity     text not null default 'unknown'
                  check (granularity in ('intraday','daily','unknown')),
  data_origin     data_origin_t not null
);

create index attendance_pseudonym_time_idx on attendance_record (pseudonym_id, event_time);

comment on column attendance_record.granularity is
  'Audit F-18 (blocking question C4). ''daily'' means the source is a sign-in '
  'sheet with one bit per day, from which intra-day availability labels CANNOT '
  'be derived without imputing them from the schedule — which is circular. '
  'train_rf.py must refuse to derive intra-day labels from daily-granularity data.';


-- =====================================================================
--  4. GEOSPATIAL — DUAL REPRESENTATION                     (F-37)
-- =====================================================================
--  Coordinates stay relational (structured data does not belong in a vector
--  store) and drive Leaflet. A generated natural-language "place-card" per POI
--  is embedded into document_chunk so navigation queries flow through the SAME
--  retriever that RAGAS measures. §2.2 Phase 2 supports this: "the RAG pipeline
--  processes the unstructured institutional AND geospatial data".
-- =====================================================================

create table poi (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  poi_type          text not null
                    check (poi_type in ('college','administrative','laboratory',
                                        'library','facility','landmark','other')),
  lat               double precision not null check (lat between -90 and 90),
  lng               double precision not null check (lng between -180 and 180),
  building_function text,
  department_id     uuid references department(id) on delete set null,
  description       text,
  is_featured       boolean not null default false,  -- landing-page POI grid
  data_origin       data_origin_t not null,
  created_at        timestamptz not null default now(),
  unique (name)
);

create index poi_type_idx on poi (poi_type);

comment on column poi.lat is
  'Placeholder coordinates during development MUST be visibly offset and the '
  'row marked data_origin=''synthetic''. Real coordinates come from the on-site '
  'GPS survey described in thesis §3.4.1(a). Audit R4.';

-- The generated natural-language card that gets chunked + embedded.
create table poi_document (
  id              uuid primary key default gen_random_uuid(),
  poi_id          uuid not null unique references poi(id) on delete cascade,
  generated_text  text not null,
  generated_at    timestamptz not null default now(),
  data_origin     data_origin_t not null
);

comment on table poi_document is
  'Audit F-37. Bridges the relational map layer and the RAG corpus. ingest.py '
  'regenerates these from poi rows, then chunks + embeds them like any other '
  'document so navigation queries are retrieved uniformly.';


-- =====================================================================
--  5. RAG CORPUS
-- =====================================================================

create table document (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  doc_type            text not null
                      check (doc_type in ('memorandum','academic_calendar',
                                          'handbook','announcement',
                                          'faculty_directory','poi_place_card',
                                          'other')),
  source_origin       text,          -- office / URL / file it came from
  official_date       date,
  provided_by         text,
  source_checksum     text,          -- re-ingest idempotency
  ingested_at         timestamptz not null default now(),
  data_origin         data_origin_t not null
);

create index document_type_idx on document (doc_type);

comment on column document.source_origin is
  'Audit §8.1. Provenance is mandatory: grounding claims require being able to '
  'answer "where did this answer come from?". Audit R5: faculty_directory '
  'content must be curated to office assignment only — no personal contact '
  'details — and office location must never be combined with a live status in '
  'the same response (audit C6 / F-28).';

create table document_chunk (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid not null references document(id) on delete cascade,
  chunk_index     integer not null,
  content         text not null,

  -- I3 / F-34. HARD CEILING. all-MiniLM-L6-v2 truncates at 256 word-pieces
  -- SILENTLY. Chunks above the limit lose their tail from the embedding and
  -- retrieval degrades invisibly. Brief specifies 180-220; 220 is the cap.
  token_count     integer not null check (token_count > 0 and token_count <= 220),

  embedding       vector(384) not null,
  embedding_model text not null default 'all-MiniLM-L6-v2',
  embedding_norm  text not null default 'l2'
                  check (embedding_norm in ('l2','none')),
  poi_id          uuid references poi(id) on delete cascade,  -- place-cards
  data_origin     data_origin_t not null,
  created_at      timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index document_chunk_doc_idx on document_chunk (document_id);
create index document_chunk_poi_idx on document_chunk (poi_id) where poi_id is not null;

-- I4 / F-36. DELIBERATELY NO ivfflat / hnsw INDEX.
-- At this corpus size (hundreds to low thousands of chunks) exact search is
-- sub-millisecond, while an under-populated IVFFlat index measurably DEGRADES
-- recall — and Context Recall is a headline thesis metric. This omission is a
-- decision, not an oversight. Do not "optimise" it without re-reading F-36.

comment on column document_chunk.embedding is
  'Audit F-34/F-36. 384-d, L2-normalised at write time by the Flask /embed '
  'path. Query vectors MUST come from that same code path (audit F-14) or '
  'document and query vectors silently diverge. Searched with the cosine '
  'operator (<=>) via exact scan — see functions.sql match_document_chunks().';


-- =====================================================================
--  6. PRESENCE — APPEND-ONLY EVENT LOG                     (I2 / F-07)
-- =====================================================================
--  The previous implementation report specified `is_on_campus BOOLEAN` with
--  "no check-out time needed". That design BREAKS THE STUDY: a faculty member
--  with no log is indistinguishable from one who left, so on day one of the
--  evaluation period every faculty resolves to Unavailable, the Random Forest
--  is never invoked, and the thesis's claimed contribution is dead code during
--  its own validation.
--
--  Tri-state resolution (see functions.sql resolve_presence):
--    confirmed_off_campus -> deterministic override, skip RF
--    confirmed_on_campus  -> proceed to RF
--    unknown              -> proceed to RF          <-- the load-bearing rule
-- =====================================================================

create table guard_user (
  id              uuid primary key default gen_random_uuid(),
  auth_user_id    uuid not null unique,        -- auth.users.id
  display_name    text not null,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

create table guard_presence_event (
  id              uuid primary key default gen_random_uuid(),
  faculty_id      uuid not null references faculty(id) on delete restrict,
  event_type      text not null check (event_type in ('arrival','departure')),
  occurred_at     timestamptz not null default now(),
  logged_by       uuid not null references guard_user(id) on delete restrict,
  note            text,
  supersedes_id   uuid references guard_presence_event(id),  -- corrections
  data_origin     data_origin_t not null,
  created_at      timestamptz not null default now()
);

create index guard_event_faculty_time_idx
  on guard_presence_event (faculty_id, occurred_at desc);

-- APPEND-ONLY enforced at the table level, not just by RLS.
create or replace function geobot.reject_presence_mutation()
returns trigger language plpgsql as $$
begin
  raise exception
    'guard_presence_event is append-only (audit F-07/F-30). Corrections must '
    'be inserted as a new row with supersedes_id set.';
end;
$$;

create trigger guard_presence_event_no_update
  before update or delete on guard_presence_event
  for each row execute function geobot.reject_presence_mutation();

comment on table guard_presence_event is
  'Audit F-30. This is the single most privacy-sensitive table in the system: '
  'unmasked, timestamped, person-linked physical presence data. It is more '
  'sensitive than anything the masking protocol touches. Append-only preserves '
  'the audit trail and is what makes the log defensible as research evidence. '
  'Audit C20: a retention policy and deletion date are still REQUIRED.';


-- =====================================================================
--  7. ML MODEL REGISTRY                                    (F-15 / F-21)
-- =====================================================================

create table rf_model_version (
  id                  uuid primary key default gen_random_uuid(),
  version             text not null unique,
  trained_at          timestamptz not null default now(),
  algorithm           text not null default 'RandomForestClassifier',
  sklearn_version     text not null,
  training_row_count  integer not null,
  class_order         text[] not null,       -- must match availability_status
  feature_list        text[] not null,

  -- F-21. "80/20" is not a specification. A random split on (faculty, time)
  -- rows puts the same faculty on the same day in both train and test.
  split_strategy      text not null
                      check (split_strategy in ('time_based','grouped_faculty',
                                                'random')),
  label_source        text not null
                      check (label_source in ('schedule_derived',
                                              'attendance_derived',
                                              'hybrid')),
  cv_folds            smallint,

  -- Audit R6: written ONLY from a real training run. Never seeded.
  metrics             jsonb,
  feature_importance  jsonb,
  artifact_path       text,
  notes               text,
  data_origin         data_origin_t not null
);

comment on column rf_model_version.label_source is
  'Audit F-18/F-20. If label_source = ''schedule_derived'' while the feature '
  'set is also purely schedule-derived, the model is reproducing the rule-based '
  'baseline by construction and its accuracy MUST NOT be reported as evidence '
  'that ML outperforms rule-based lookup. baseline_rule.py exists to make that '
  'comparison empirical rather than assumed.';

comment on column rf_model_version.metrics is
  'Audit R6. Accuracy / precision / recall / F1 / confusion matrix. Populated '
  'exclusively by train_rf.py from a real held-out split. Never hand-written, '
  'never seeded, never placeholdered.';


-- =====================================================================
--  8. EVALUATION & RESEARCH                                (F-01..F-05)
-- =====================================================================
--  Entirely absent from the previous implementation report. Without these
--  tables RAGAS cannot be computed and no run is reproducible.
-- =====================================================================

create table eval_run (
  id                      uuid primary key default gen_random_uuid(),
  run_label               text not null,
  started_at              timestamptz not null default now(),
  finished_at             timestamptz,

  -- F-01: identical config across arms; only the fusion block differs.
  groq_model_id           text not null,
  llm_temperature         numeric not null default 0
                          check (llm_temperature = 0),
  prompt_template_version text not null,
  top_k                   smallint not null check (top_k between 1 and 20),
  similarity_floor        numeric,
  embedding_model         text not null default 'all-MiniLM-L6-v2',
  rf_model_version_id     uuid references rf_model_version(id),

  -- F-05: the judge must NOT be the generator (self-evaluation bias).
  judge_model             text not null,
  judge_embedding_model   text not null default 'all-MiniLM-L6-v2',

  -- F-04 / audit C3: is the masked status passed to RAGAS as a contexts item?
  status_as_context       boolean not null default true,

  router_version          text not null,
  notes                   text,
  data_origin             data_origin_t not null,

  constraint judge_must_differ_from_generator
    check (judge_model is distinct from groq_model_id)
);

comment on table eval_run is
  'Audit F-02/F-05. One row per benchmarking session. This is the '
  'reproducibility record: if you cannot say which model, prompt version, K and '
  'judge produced a number, the number is not defensible. Audit F-02: BOTH arms '
  'must be run INTERLEAVED within a single run so Groq queue latency is not '
  'confounded with architecture.';

comment on column eval_run.status_as_context is
  'Audit F-04 (blocking, audit C3). Context Precision and Context Recall are '
  'RETRIEVER metrics and both arms share a retriever, so they cannot move '
  'unless the masked status is counted as a retrieved context item in the '
  'enhanced arm. With this false, two of the four primary thesis metrics are '
  'flat by construction and Faithfulness may favour the STANDARD arm.';

-- The curated test set. Audit C10: pre-register BEFORE any run.
create table eval_query (
  id                  uuid primary key default gen_random_uuid(),
  run_id              uuid references eval_run(id) on delete cascade,
  query_text          text not null,
  category            text not null
                      check (category in ('general_institutional',
                                          'campus_navigation',
                                          'faculty_availability',
                                          'combined')),
  ground_truth_answer text not null,
  registered_at       timestamptz not null default now(),
  data_origin         data_origin_t not null
);

comment on table eval_query is
  'Audit F-04 / C10. The MIX of categories determines the result: too few '
  'availability queries and the arms are identical; all availability queries '
  'and you are not evaluating a campus assistant. Register the mix in writing '
  'before the first run. Choosing it after seeing results is p-hacking.';

create table eval_result (
  id                  uuid primary key default gen_random_uuid(),
  run_id              uuid not null references eval_run(id) on delete cascade,
  eval_query_id       uuid not null references eval_query(id) on delete cascade,

  mode                text not null check (mode in ('standard','enhanced')),

  -- I5 / F-03. VERBATIM. RAGAS is defined over exactly these strings.
  retrieved_contexts  jsonb not null,
  fused_prompt        text not null,
  answer              text not null,

  -- Enhanced arm only. Masked status = the allowlisted code, never a raw label.
  masked_status       text references availability_status(code),
  override_applied    boolean not null default false,
  rf_proba            jsonb,          -- server-side only, never in an API DTO
  router_decision     jsonb,

  -- F-02. Component-level, because the enhanced arm is expected to be SLOWER
  -- and you need to attribute the delta rather than just report a regression.
  t_route_ms          integer,
  t_guard_ms          integer,
  t_rf_ms             integer,
  t_embed_ms          integer,
  t_retrieve_ms       integer,
  t_llm_ms            integer,
  t_total_ms          integer not null,

  egress_filter_hit   boolean not null default false,
  created_at          timestamptz not null default now(),
  data_origin         data_origin_t not null,

  unique (run_id, eval_query_id, mode)
);

create index eval_result_run_mode_idx on eval_result (run_id, mode);

comment on column eval_result.override_applied is
  'Audit C5 / F-07. Marks queries answered by the deterministic guard override '
  'rather than by the Random Forest. Recording it lets RF accuracy be computed '
  'with these rows EXCLUDED (recommended) while override-rate is reported '
  'separately — otherwise inconsistent guard logging becomes an uncontrolled '
  'variable inside your headline accuracy number.';

comment on column eval_result.rf_proba is
  'Audit F-22 / audit §4.2. predict_proba retained server-side for research '
  'only. It must never appear in an /api/chat response DTO and must never be '
  'interpolated into an LLM prompt.';

create table ragas_score (
  id                  uuid primary key default gen_random_uuid(),
  eval_result_id      uuid not null unique references eval_result(id) on delete cascade,
  context_precision   numeric check (context_precision between 0 and 1),
  context_recall      numeric check (context_recall between 0 and 1),
  faithfulness        numeric check (faithfulness between 0 and 1),
  answer_relevancy    numeric check (answer_relevancy between 0 and 1),
  scored_at           timestamptz not null default now(),
  ragas_version       text
);

comment on table ragas_score is
  'Audit R7. Written EXCLUSIVELY by score_ragas.py from real pipeline outputs. '
  'Never seeded, never estimated, never used to populate a UI placeholder.';

-- Thesis §3.8.2 / audit C14: in-system capture so the system''s own prediction
-- is recorded automatically and cannot be misremembered by the validator.
create table faculty_validation (
  id                  uuid primary key default gen_random_uuid(),
  faculty_id          uuid not null references faculty(id) on delete cascade,
  queried_at          timestamptz not null default now(),
  system_status       text not null references availability_status(code),
  actual_status       text not null references availability_status(code),

  -- Audit C15/F-08: §3.8.2 defines a 3-level scale, but a confusion matrix
  -- needs (predicted, actual) pairs — "partially correct" has no cell.
  -- Captured, then EXCLUDED from the matrix and reported separately.
  correctness         text not null
                      check (correctness in ('correct','partially_correct','incorrect')),
  include_in_matrix   boolean not null
                      generated always as (correctness <> 'partially_correct') stored,

  override_applied    boolean not null default false,
  notes               text,
  data_origin         data_origin_t not null
);

create index faculty_validation_faculty_idx on faculty_validation (faculty_id, queried_at);

comment on column faculty_validation.include_in_matrix is
  'Audit F-08 / C15. Decide the treatment of "partially correct" BEFORE '
  'validators start, not after seeing the data. Default here: excluded from '
  'the confusion matrix, reported as a separate count.';


-- =====================================================================
--  9. LIVE TRAFFIC & PUBLIC DEMO
-- =====================================================================
--  Deliberately SEPARATE from the eval tables so development traffic can never
--  be mistaken for evaluation evidence (audit §9.3).
-- =====================================================================

create table chat_log (
  id                  uuid primary key default gen_random_uuid(),
  session_hash        text not null,           -- salted hash, not an IP
  query               text not null,
  route_decision      jsonb,
  answer              text,
  masked_status       text references availability_status(code),
  t_total_ms          integer,
  egress_filter_hit   boolean not null default false,
  is_demo             boolean not null default false,
  created_at          timestamptz not null default now()
);

create index chat_log_created_idx on chat_log (created_at);

comment on table chat_log is
  'Short-retention operational log. Audit F-29: repeated availability polling '
  'reconstructs a presence timeline, which status masking does NOT prevent. '
  'session_hash is salted — never store raw IPs. Rate limiting is enforced in '
  'the Express layer; this table is how abuse is detected.';

-- Landing-page demo widget. Audit F-16: the standard/enhanced toggle must not
-- exist on the public free-text chat endpoint, or eval runs and live traffic
-- become indistinguishable and anyone can drive the baseline arm. The widget
-- is therefore restricted to this CURATED ALLOWLIST of queries.
create table demo_query (
  id                  uuid primary key default gen_random_uuid(),
  label               text not null,
  query_text          text not null unique,
  category            text not null
                      check (category in ('general_institutional',
                                          'campus_navigation',
                                          'faculty_availability',
                                          'combined')),
  sort_order          smallint not null default 0,
  is_active           boolean not null default true
);

comment on table demo_query is
  'Audit F-16 + F-29. The landing-page comparison widget accepts ONLY these '
  'pre-approved queries — never arbitrary user text. This preserves the demo '
  'value of showing standard vs enhanced side by side while keeping mode '
  'server-controlled and closing the aggregation-polling surface.';


-- =====================================================================
-- 10. INTEGRITY GUARDS
-- =====================================================================

-- Audit F-38 / I1. A single question answers "could synthetic data have
-- contaminated your results?". evalRunner.js calls this and ABORTS on false.
create or replace function geobot.corpus_is_research_ready()
returns table (
  entity        text,
  synthetic_rows bigint,
  ready         boolean
) language sql stable as $$
  select 'faculty',            count(*) filter (where data_origin = 'synthetic'),
         count(*) filter (where data_origin = 'synthetic') = 0 from faculty
  union all
  select 'faculty_schedule',   count(*) filter (where data_origin = 'synthetic'),
         count(*) filter (where data_origin = 'synthetic') = 0 from faculty_schedule
  union all
  select 'poi',                count(*) filter (where data_origin = 'synthetic'),
         count(*) filter (where data_origin = 'synthetic') = 0 from poi
  union all
  select 'document',           count(*) filter (where data_origin = 'synthetic'),
         count(*) filter (where data_origin = 'synthetic') = 0 from document
  union all
  select 'document_chunk',     count(*) filter (where data_origin = 'synthetic'),
         count(*) filter (where data_origin = 'synthetic') = 0 from document_chunk
  union all
  select 'attendance_record',  count(*) filter (where data_origin = 'synthetic'),
         count(*) filter (where data_origin = 'synthetic') = 0 from attendance_record
  union all
  select 'guard_presence_event', count(*) filter (where data_origin = 'synthetic'),
         count(*) filter (where data_origin = 'synthetic') = 0 from guard_presence_event;
$$;

comment on function geobot.corpus_is_research_ready is
  'Audit F-38. evalRunner.js and score_ragas.py MUST call this and hard-fail '
  'if any row is synthetic. A directory convention cannot prevent synthetic '
  'data reaching a reported result; a query that refuses to run can.';

commit;

-- =====================================================================
--  NEXT: database/security-and-permissions.sql  (deny-by-default RLS — audit F-30 / W1)
--        database/database-functions.sql (resolve_presence, match_document_chunks)
-- =====================================================================
