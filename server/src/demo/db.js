/**
 * In-memory adapter presenting the subset of the Supabase client API that the
 * services actually use.
 *
 * WHY AN ADAPTER RATHER THAN A SEPARATE DEMO SERVER.
 *
 * Everything that matters — router.js, presenceService.js, ragService.js, the
 * masking boundary, the prompt template — runs UNCHANGED against this. The
 * demo therefore exercises the real pipeline, including the real privacy
 * boundary, rather than a parallel implementation that could drift from it.
 *
 * Switching to a real Supabase project is one environment variable. Nothing in
 * the service layer knows which adapter it is talking to.
 */

import * as D from './data.js';
import { cosine, embed } from './embeddings.js';

const TABLES = {
  department: D.departments,
  faculty: D.faculty,
  faculty_alias: D.facultyAlias,
  faculty_pseudonym_map: D.facultyPseudonymMap,
  faculty_schedule: D.facultySchedule,
  institutional_event: D.institutionalEvent,
  poi: D.poi,
  demo_query: D.demoQuery,
  availability_status: D.availabilityStatus,
  guard_presence_event: D.guardPresenceEvent,
  guard_user: D.guardUser,
  app_user_role: D.appUserRole,
  eval_run: D.evalRun,
  eval_query: D.evalQuery,
  eval_result: D.evalResult,
  ragas_score: D.ragasScore,
  rf_model_version: D.rfModelVersion,
  faculty_validation: D.facultyValidation,
  chat_log: D.chatLog,
  poi_audit: D.poiAudit,
  faculty_visibility_event: D.facultyVisibilityEvent,
  // Registered late — see the assignment after documentChunks is built.
  document: null,
  document_chunk: null,
};

// ---------------------------------------------------------------------------
// Corpus: place-cards + institutional documents, chunked and embedded at boot.
// ---------------------------------------------------------------------------

function placeCardText(p) {
  const dept = D.departments.find((d) => d.id === p.department_id);
  const parts = [
    `${p.name} is a ${p.poi_type.replace('_', ' ')} located on the Isabela State University Echague Main Campus.`,
  ];
  if (dept) parts.push(`It houses the ${dept.name}.`);
  if (p.building_function) parts.push(`Its primary function is ${p.building_function}.`);
  if (p.description) parts.push(p.description);
  parts.push(`Users looking for ${p.name} can find it marked on the ISU-GeoBot interactive campus map.`);
  return parts.join(' ');
}

/** Sentence-packing to roughly the same budget ingest.py enforces. */
function chunkText(text, targetWords = 90) {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const out = [];
  let cur = [];
  let n = 0;
  for (const s of sentences) {
    const w = s.split(/\s+/).length;
    if (n + w > targetWords && cur.length) {
      out.push(cur.join(' '));
      cur = [];
      n = 0;
    }
    cur.push(s);
    n += w;
  }
  if (cur.length) out.push(cur.join(' '));
  return out;
}

export const documentChunks = [];
export const documentRows = D.documents.map((d) => ({
  id: d.id, title: d.title, doc_type: d.doc_type,
  source_origin: null, data_origin: 'synthetic',
}));

for (const p of D.poi) {
  documentRows.push({
    id: `pd-${p.id}`,
    title: `Place card — ${p.name}`,
    doc_type: 'poi_place_card',
    source_origin: `generated:poi:${p.id}`,
    data_origin: 'synthetic',
  });
}

for (const p of D.poi) {
  const text = placeCardText(p);
  chunkText(text).forEach((content, i) => {
    documentChunks.push({
      id: `c-${p.id}-${i}`,
      document_id: `pd-${p.id}`,
      document_title: `Place card — ${p.name}`,
      doc_type: 'poi_place_card',
      content,
      poi_id: p.id,
      embedding: embed(content),
      data_origin: 'synthetic',
    });
  });
}

for (const doc of D.documents) {
  chunkText(doc.text).forEach((content, i) => {
    documentChunks.push({
      id: `c-${doc.id}-${i}`,
      document_id: doc.id,
      document_title: doc.title,
      doc_type: doc.doc_type,
      content,
      poi_id: null,
      embedding: embed(content),
      data_origin: 'synthetic',
    });
  });
}

// The corpus tables are live arrays, not snapshots: a POI created through
// /api/admin/pois writes a document + chunks here and becomes retrievable on
// the very next query, exactly as it would against Postgres.
TABLES.document = documentRows;
TABLES.document_chunk = documentChunks;

// ---------------------------------------------------------------------------
// Minimal chainable query builder
// ---------------------------------------------------------------------------

function resolveNested(row, select) {
  // Supports the one nested form the services use:
  //   'department:department_id (name)'
  const out = { ...row };
  for (const part of select.split(',').map((s) => s.trim())) {
    const m = part.match(/^(\w+):(\w+)\s*\(([^)]+)\)$/);
    if (!m) continue;
    const [, alias, fk, cols] = m;
    const target = fk.replace(/_id$/, '');
    const table = TABLES[target] ?? TABLES[`${target}s`] ?? [];
    const hit = table.find((r) => r.id === row[fk]);
    out[alias] = hit
      ? Object.fromEntries(cols.split(',').map((c) => [c.trim(), hit[c.trim()]]))
      : null;
  }
  return out;
}

class Query {
  constructor(rows, table) {
    this.rows = [...rows];
    this.table = table;
    this.select_ = '*';
  }
  select(sel = '*') { this.select_ = sel; return this; }
  eq(col, val) { this.rows = this.rows.filter((r) => r[col] === val); return this; }
  neq(col, val) { this.rows = this.rows.filter((r) => r[col] !== val); return this; }
  in(col, vals) { this.rows = this.rows.filter((r) => vals.includes(r[col])); return this; }
  gte(col, val) { this.rows = this.rows.filter((r) => r[col] >= val); return this; }
  order(col, { ascending = true } = {}) {
    this.rows.sort((a, b) => {
      const x = a[col], y = b[col];
      if (x === y) return 0;
      return (x > y ? 1 : -1) * (ascending ? 1 : -1);
    });
    return this;
  }
  limit(n) { this.rows = this.rows.slice(0, n); return this; }

  #project() {
    if (this.select_ === '*' || !this.select_) return this.rows;
    return this.rows.map((r) => resolveNested(r, this.select_));
  }

  async maybeSingle() {
    const rows = this.#project();
    return { data: rows[0] ?? null, error: null };
  }
  async single() {
    const rows = this.#project();
    return rows.length
      ? { data: rows[0], error: null }
      : { data: null, error: { message: 'no rows' } };
  }
  insert(payload) {
    const rows = (Array.isArray(payload) ? payload : [payload]).map((p) => ({
      id: `x${Math.random().toString(36).slice(2, 11)}`,
      created_at: new Date().toISOString(),
      occurred_at: p.occurred_at ?? new Date().toISOString(),
      queried_at: p.queried_at ?? new Date().toISOString(),
      ...p,
    }));
    TABLES[this.table]?.push(...rows);
    const q = new Query(rows, this.table);
    // Supabase returns a thenable; insert() alone must also resolve.
    q.then = (res) => Promise.resolve({ data: rows, error: null }).then(res);
    return q;
  }
  update(patch) {
    const applied = [];
    const apply = (rows) => {
      for (const r of rows) { Object.assign(r, patch); applied.push(r); }
      return applied;
    };
    const self = this;
    return {
      eq(col, val) {
        apply(self.rows.filter((r) => r[col] === val));
        const q = new Query(applied, self.table);
        q.then = (res) => Promise.resolve({ data: applied, error: null }).then(res);
        return q;
      },
      select() { apply(self.rows); return this; },
      single() { return Promise.resolve({ data: applied[0] ?? null, error: null }); },
      then: (res) => {
        apply(self.rows);
        return Promise.resolve({ data: applied, error: null }).then(res);
      },
    };
  }
  delete() {
    const self = this;
    const removeWhere = (pred) => {
      const table = TABLES[self.table];
      const removed = table.filter(pred);
      for (const r of removed) {
        const i = table.indexOf(r);
        if (i >= 0) table.splice(i, 1);
      }
      return removed;
    };
    return {
      eq(col, val) {
        const removed = removeWhere((r) => r[col] === val);
        return Promise.resolve({ data: removed, error: null });
      },
      then: (res) => {
        const ids = new Set(self.rows.map((r) => r.id));
        const removed = removeWhere((r) => ids.has(r.id));
        return Promise.resolve({ data: removed, error: null }).then(res);
      },
    };
  }
  then(resolve) {
    return Promise.resolve({ data: this.#project(), error: null, count: this.rows.length })
      .then(resolve);
  }
}

// ---------------------------------------------------------------------------
// RPC — the SQL functions, reimplemented over the fixtures
// ---------------------------------------------------------------------------

function localDayStart(at) {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Tri-state presence (audit F-07).
 *
 * The load-bearing rule is `unknown -> proceed to the classifier`. A boolean
 * model would make "no log today" indistinguishable from "left campus", and on
 * day one of an evaluation period every faculty member would resolve to
 * Unavailable while the classifier never ran at all.
 */
function resolvePresence({ p_faculty_id, p_at }) {
  const at = p_at ? new Date(p_at) : new Date();
  const windowStart = localDayStart(at);
  const events = D.guardPresenceEvent
    .filter((e) => e.faculty_id === p_faculty_id
      && new Date(e.occurred_at) >= windowStart
      && new Date(e.occurred_at) <= at)
    .sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at));

  const last = events[0];
  if (!last) {
    return [{ presence_state: 'unknown', last_event_type: null, last_event_at: null }];
  }
  return [{
    presence_state: last.event_type === 'departure'
      ? 'confirmed_off_campus'
      : 'confirmed_on_campus',
    last_event_type: last.event_type,
    last_event_at: last.occurred_at,
  }];
}

function scheduleLookupStatus({ p_faculty_id, p_at }) {
  const at = p_at ? new Date(p_at) : new Date();
  const dow = at.getDay();
  const hhmm = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
  const dateStr = at.toISOString().slice(0, 10);

  const event = D.institutionalEvent.find(
    (e) => e.event_date === dateStr && e.disrupts_schedule,
  );
  if (event) {
    return [{ status_code: 'unavailable_off_schedule', matched_block: null,
              is_event_day: true, event_type: event.event_type }];
  }

  const blocks = D.facultySchedule.filter(
    (s) => s.faculty_id === p_faculty_id && s.day_of_week === dow
      && s.start_time <= hhmm && hhmm < s.end_time,
  );
  const cls = blocks.find((b) => b.block_kind === 'class');
  if (cls) {
    return [{ status_code: 'in_scheduled_class', matched_block: 'class',
              is_event_day: false, event_type: null }];
  }
  if (blocks.length) {
    return [{ status_code: 'available_consultation', matched_block: blocks[0].block_kind,
              is_event_day: false, event_type: null }];
  }
  return [{ status_code: 'unavailable_off_schedule', matched_block: null,
            is_event_day: false, event_type: null }];
}

/** Exact cosine scan — same semantics as match_document_chunks (audit F-36). */
function matchDocumentChunks({ p_query_embedding, p_match_count = 5, p_similarity_floor = 0 }) {
  return documentChunks
    .map((c) => {
      const doc = documentRows.find((d) => d.id === c.document_id);
      return {
        chunk_id: c.id,
        document_id: c.document_id,
        document_title: c.document_title ?? doc?.title ?? 'Untitled',
        doc_type: c.doc_type ?? doc?.doc_type ?? 'other',
        content: c.content,
        poi_id: c.poi_id,
        similarity: cosine(p_query_embedding, c.embedding),
        data_origin: c.data_origin,
      };
    })
    .filter((c) => c.similarity >= p_similarity_floor)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, p_match_count);
}

/** Exact-or-clarify (audit F-31). Returns candidates; never picks a winner. */
function resolveFacultyCandidates({ p_needle, p_limit = 5 }) {
  const needle = String(p_needle ?? '').trim().toLowerCase();
  if (needle.length < 2) return [];
  // Paused faculty are excluded from the gazetteer entirely, so the router
  // never even forms an availability intent for them (audit: the estimate is
  // never computed, not merely withheld).
  const roster = D.faculty.filter((f) => f.is_active && f.is_consented && f.availability_visible);
  const out = [];

  for (const f of roster) {
    const deptName = D.departments.find((d) => d.id === f.department_id)?.name ?? null;
    const aliases = D.facultyAlias.filter((a) => a.faculty_id === f.id).map((a) => a.alias.toLowerCase());
    if (f.full_name.toLowerCase() === needle || aliases.includes(needle)) {
      out.push({ faculty_id: f.id, full_name: f.full_name, department_name: deptName,
                 match_kind: 'exact_name', score: 1 });
    } else if (f.full_name.toLowerCase().includes(needle) && needle.length >= 3) {
      out.push({ faculty_id: f.id, full_name: f.full_name, department_name: deptName,
                 match_kind: 'fuzzy', score: 0.6 });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, p_limit);
}

function resolvePresenceRoster({ p_at }) {
  return D.faculty
    .filter((f) => f.is_active && f.is_consented)
    .map((f) => {
      const [p] = resolvePresence({ p_faculty_id: f.id, p_at });
      return {
        faculty_id: f.id,
        full_name: f.full_name,
        department_name: D.departments.find((d) => d.id === f.department_id)?.name ?? null,
        presence_state: p.presence_state,
        last_event_type: p.last_event_type,
        last_event_at: p.last_event_at,
      };
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

/** Audit F-38. Everything in demo mode is synthetic, so this is never ready. */
function corpusIsResearchReady() {
  return [
    { entity: 'faculty', synthetic_rows: D.faculty.length, ready: false },
    { entity: 'faculty_schedule', synthetic_rows: D.facultySchedule.length, ready: false },
    { entity: 'poi', synthetic_rows: D.poi.length, ready: false },
    { entity: 'document', synthetic_rows: D.documents.length, ready: false },
    { entity: 'document_chunk', synthetic_rows: documentChunks.length, ready: false },
  ];
}

/**
 * Audit F-32 extended. Three independent conditions, all required: active,
 * consented to the study, and not currently paused by the data subject.
 */
function facultyIsAnswerable({ p_faculty_id }) {
  const f = D.faculty.find((x) => x.id === p_faculty_id);
  return Boolean(f && f.is_active && f.is_consented && f.availability_visible);
}

const RPC = {
  faculty_is_answerable: facultyIsAnswerable,
  resolve_presence: resolvePresence,
  resolve_presence_roster: resolvePresenceRoster,
  schedule_lookup_status: scheduleLookupStatus,
  match_document_chunks: matchDocumentChunks,
  resolve_faculty_candidates: resolveFacultyCandidates,
  corpus_is_research_ready: corpusIsResearchReady,
};

export const demoDb = {
  from(table) {
    if (!TABLES[table]) TABLES[table] = [];
    return new Query(TABLES[table], table);
  },
  async rpc(name, params = {}) {
    const fn = RPC[name];
    if (!fn) return { data: null, error: { message: `demo rpc "${name}" not implemented` } };
    return { data: fn(params), error: null };
  },
};
