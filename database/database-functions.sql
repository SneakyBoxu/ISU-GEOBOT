-- =====================================================================
--  ISU-GeoBot — Database Functions (STEP 1b)
--  Run AFTER schema.sql.
--
--  Two load-bearing functions:
--    resolve_presence()      — tri-state guard override            (F-07)
--    match_document_chunks() — exact cosine retrieval, no ANN      (F-36)
-- =====================================================================

begin;
set search_path = geobot, public, extensions;


-- =====================================================================
--  TRI-STATE PRESENCE RESOLUTION                          (F-07 / audit B1)
-- =====================================================================
--  Returns exactly one of: 'confirmed_on_campus' | 'confirmed_off_campus'
--                        | 'unknown'
--
--  Why this is not a boolean:
--    The thesis code sample is `if (!isFacultyOnCampus) -> "Unavailable"`.
--    In a boolean model, a faculty member with NO log is falsy and therefore
--    indistinguishable from one who left. On day one of the evaluation period,
--    with a guard who has logged nobody, every faculty resolves to Unavailable,
--    the Random Forest is NEVER INVOKED, and the thesis's claimed contribution
--    is dead code during its own validation — while faculty validators rate
--    the accuracy of a path that never ran.
--
--  The load-bearing rule is `unknown -> proceed to RF`. It is also the more
--  honest one: the RF is precisely the component meant to estimate presence
--  when ground truth is absent.
--
--  Validity window (audit C13): same calendar day, in campus-local time.
--  A departure log governs until end of day; anything longer is not
--  defensible as "real-time".
-- =====================================================================

create or replace function geobot.resolve_presence(
  p_faculty_id  uuid,
  p_at          timestamptz default now(),
  p_timezone    text        default 'Asia/Manila'
)
returns table (
  presence_state  text,
  last_event_type text,
  last_event_at   timestamptz,
  window_start    timestamptz,
  is_stale        boolean
)
language plpgsql
stable
as $$
declare
  v_window_start timestamptz;
  v_event_type   text;
  v_event_at     timestamptz;
begin
  -- Start of the campus-local calendar day containing p_at.
  v_window_start := date_trunc('day', p_at at time zone p_timezone)
                    at time zone p_timezone;

  select e.event_type, e.occurred_at
    into v_event_type, v_event_at
  from geobot.guard_presence_event e
  where e.faculty_id  = p_faculty_id
    and e.occurred_at >= v_window_start
    and e.occurred_at <= p_at
  order by e.occurred_at desc, e.created_at desc
  limit 1;

  if v_event_type is null then
    -- No log today. NOT the same as "off campus". Proceed to the classifier.
    return query select 'unknown'::text, null::text, null::timestamptz,
                        v_window_start, false;
  elsif v_event_type = 'departure' then
    -- Deterministic override. Thesis §3.5.3: bypass the AI entirely.
    return query select 'confirmed_off_campus'::text, v_event_type, v_event_at,
                        v_window_start, false;
  else
    return query select 'confirmed_on_campus'::text, v_event_type, v_event_at,
                        v_window_start, false;
  end if;
end;
$$;

comment on function geobot.resolve_presence is
  'Audit F-07. Tri-state. Callers (presenceService.js) must treat BOTH '
  '''confirmed_on_campus'' AND ''unknown'' as "proceed to Random Forest". '
  'Only ''confirmed_off_campus'' triggers the deterministic override. '
  'Never collapse this to a boolean.';


-- Bulk variant for the guard dashboard roster view.
create or replace function geobot.resolve_presence_roster(
  p_at        timestamptz default now(),
  p_timezone  text        default 'Asia/Manila'
)
returns table (
  faculty_id      uuid,
  full_name       text,
  department_name text,
  presence_state  text,
  last_event_type text,
  last_event_at   timestamptz
)
language sql
stable
as $$
  select f.id,
         f.full_name,
         d.name,
         r.presence_state,
         r.last_event_type,
         r.last_event_at
  from geobot.faculty f
  left join geobot.department d on d.id = f.department_id
  cross join lateral geobot.resolve_presence(f.id, p_at, p_timezone) r
  where f.is_active
    and f.is_consented              -- audit F-32 / C11: consented roster only
  order by f.full_name;
$$;


-- =====================================================================
--  EXACT COSINE RETRIEVAL                                 (F-36 / audit B11)
-- =====================================================================
--  Deliberately an exact scan. There is NO ivfflat/hnsw index on
--  document_chunk.embedding.
--
--  Rationale to state at defense: at this corpus size (hundreds to low
--  thousands of chunks) exact nearest-neighbour search is sub-millisecond,
--  whereas an under-populated IVFFlat index measurably degrades recall.
--  Context Recall is one of the four primary thesis metrics — trading it for
--  latency the system does not need would be the wrong optimisation.
--
--  pgvector's <=> operator is COSINE DISTANCE. similarity = 1 - distance.
--  Embeddings are L2-normalised at write time by the Flask /embed path; query
--  vectors MUST come from that same path (audit F-14) or document and query
--  vectors silently diverge.
--
--  IMPORTANT (audit F-01): this function is called IDENTICALLY in both the
--  standard and enhanced arms. Retrieval must never differ between arms or the
--  RAGAS comparison is confounded.
-- =====================================================================

create or replace function geobot.match_document_chunks(
  p_query_embedding   vector(384),
  p_match_count       integer default 5,
  p_similarity_floor  double precision default 0.0,
  p_include_synthetic boolean default true
)
returns table (
  chunk_id        uuid,
  document_id     uuid,
  document_title  text,
  doc_type        text,
  content         text,
  poi_id          uuid,
  similarity      double precision,
  data_origin     text
)
language sql
stable
as $$
  select c.id,
         c.document_id,
         d.title,
         d.doc_type,
         c.content,
         c.poi_id,
         1 - (c.embedding <=> p_query_embedding) as similarity,
         c.data_origin
  from geobot.document_chunk c
  join geobot.document d on d.id = c.document_id
  where (p_include_synthetic or c.data_origin = 'real')
    and 1 - (c.embedding <=> p_query_embedding) >= p_similarity_floor
  order by c.embedding <=> p_query_embedding
  limit greatest(p_match_count, 1);
$$;

comment on function geobot.match_document_chunks is
  'Audit F-36. Exact cosine scan, no ANN index — a deliberate decision, not an '
  'oversight. Audit F-01: called identically in both arms; retrieval must never '
  'differ between standard and enhanced or Context Precision/Recall deltas '
  'become routing artifacts rather than architecture effects. '
  'p_include_synthetic=false is what evalRunner passes.';


-- =====================================================================
--  DETERMINISTIC SCHEDULE LOOKUP                          (F-20 / audit C12)
-- =====================================================================
--  The SQL twin of baseline_rule.py.
--
--  The thesis (§3.5.2) claims feature-importance analysis validates "the
--  necessity of the machine learning approach over a simple rule-based
--  alternative". It cannot: feature importance is an INTRA-model diagnostic
--  and says nothing about how a rule-based lookup would have performed. The
--  only way to support that claim is to run the rule baseline and compare.
--
--  This function is also used by the RF feature builder to derive
--  is_consultation_hour and the scheduled-block indicator.
-- =====================================================================

create or replace function geobot.schedule_lookup_status(
  p_faculty_id  uuid,
  p_at          timestamptz default now(),
  p_semester    text default null,
  p_timezone    text default 'Asia/Manila'
)
returns table (
  status_code       text,
  matched_block     text,
  is_event_day      boolean,
  event_type        text
)
language plpgsql
stable
as $$
declare
  v_local     timestamp;
  v_dow       smallint;
  v_time      time;
  v_date      date;
  v_block     text;
  v_event     text;
  v_disrupts  boolean := false;
begin
  v_local := p_at at time zone p_timezone;
  v_dow   := extract(dow from v_local)::smallint;
  v_time  := v_local::time;
  v_date  := v_local::date;

  select ie.event_type, ie.disrupts_schedule
    into v_event, v_disrupts
  from geobot.institutional_event ie
  where ie.event_date = v_date
    and ie.disrupts_schedule
  limit 1;

  if v_event is not null then
    return query select 'unavailable_off_schedule'::text, null::text, true, v_event;
    return;
  end if;

  select fs.block_kind
    into v_block
  from geobot.faculty_schedule fs
  where fs.faculty_id = p_faculty_id
    and fs.day_of_week = v_dow
    and v_time >= fs.start_time
    and v_time <  fs.end_time
    and (p_semester is null or fs.semester = p_semester)
  order by case fs.block_kind
             when 'class' then 1 when 'consultation' then 2 else 3 end
  limit 1;

  if v_block = 'class' then
    return query select 'in_scheduled_class'::text, v_block, false, null::text;
  elsif v_block in ('consultation','admin') then
    return query select 'available_consultation'::text, v_block, false, null::text;
  else
    return query select 'unavailable_off_schedule'::text, null::text, false, null::text;
  end if;
end;
$$;

comment on function geobot.schedule_lookup_status is
  'Audit F-20 / C12. The rule-based comparison floor. If the Random Forest '
  'cannot beat this, that is a finding worth knowing BEFORE the panel finds it '
  '— and an honest one either way. Audit F-18: if RF training labels are '
  'themselves derived from this function while the features are also purely '
  'schedule-derived, the comparison is circular and must not be reported.';


-- =====================================================================
--  FACULTY RESOLUTION — EXACT OR CLARIFY                  (F-31 / audit B5)
-- =====================================================================
--  Returns ALL candidates. The caller (router.js) must ask a clarifying
--  question when more than one row comes back and must return "no such
--  faculty" when zero come back. It must NEVER auto-select the top match:
--  resolving "Prof. Santoso" to "Prof. Santos" discloses one person's status
--  in answer to a query about another.
-- =====================================================================

create or replace function geobot.resolve_faculty_candidates(
  p_needle  text,
  p_limit   integer default 5
)
returns table (
  faculty_id      uuid,
  full_name       text,
  department_name text,
  match_kind      text,
  score           real
)
language sql
stable
as $$
  with needle as (select lower(trim(p_needle)) as n)
  select f.id, f.full_name, d.name, 'exact_name'::text, 1.0::real
  from geobot.faculty f
  left join geobot.department d on d.id = f.department_id, needle
  where f.is_active and f.is_consented and lower(f.full_name) = needle.n

  union all
  select f.id, f.full_name, d.name, 'exact_alias'::text, 1.0::real
  from geobot.faculty_alias a
  join geobot.faculty f on f.id = a.faculty_id
  left join geobot.department d on d.id = f.department_id, needle
  where f.is_active and f.is_consented and lower(a.alias) = needle.n

  union all
  select f.id, f.full_name, d.name, 'fuzzy'::text,
         similarity(f.full_name, p_needle)
  from geobot.faculty f
  left join geobot.department d on d.id = f.department_id, needle
  where f.is_active and f.is_consented
    and similarity(f.full_name, p_needle) > 0.45
    and lower(f.full_name) <> needle.n

  order by 5 desc, 3 nulls last
  limit greatest(p_limit, 1);
$$;

comment on function geobot.resolve_faculty_candidates is
  'Audit F-31. EXACT-OR-CLARIFY. The ''fuzzy'' rows exist to DETECT ambiguity '
  'so the assistant can ask, not to auto-pick a winner. router.js must treat '
  '0 candidates as "unknown faculty" and >1 as "ask which one". Consent-gated '
  'via is_consented (audit F-32 / C11).';

commit;
