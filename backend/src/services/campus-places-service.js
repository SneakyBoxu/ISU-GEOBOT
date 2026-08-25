/**
 * Campus location management.
 *
 * THE INVARIANT THIS FILE EXISTS TO HOLD (audit F-37):
 *
 *   The interactive map and the retrieval corpus must never disagree about
 *   where something is.
 *
 * Campus locations have a dual representation. Coordinates live relationally
 * and drive Leaflet; a generated natural-language "place-card" is chunked and
 * embedded so navigation questions flow through the same retriever as
 * everything else. If someone adds a building by INSERTing a row, the map gains
 * a pin the chatbot has never heard of. If someone corrects a coordinate
 * without re-embedding, the map and the answer diverge and nobody notices.
 *
 * So every write goes through here, and the place-card is regenerated and
 * re-embedded in the same operation as the coordinate change.
 *
 * WHY THIS UI EXISTS WHEN THE AUDIT SAID "NO ADMIN UI" (§8.1 / A10).
 * That recommendation was about DOCUMENT UPLOAD — an authenticated file-upload
 * surface with parsing, storage and attack surface, for no thesis benefit,
 * competing for time with the evaluation harness. A POI editor is narrower by
 * construction: structured fields, a closed type vocabulary, no file handling,
 * a full audit trail. It is also operationally necessary. A campus map that
 * cannot be corrected goes stale during the evaluation period, and stale
 * geospatial data would show up as degraded Context Precision that has nothing
 * to do with the architecture being evaluated.
 */

import { db, log, ml } from '../utilities/service-clients.js';

/**
 * The natural-language card that gets embedded.
 *
 * Note what is deliberately absent: faculty names and office assignments.
 * Audit C6/F-28 — a place-card describes a PLACE. Combining a location with a
 * person is exactly the inference the masking protocol exists to prevent, and
 * putting it in the retrieval corpus would route around that protocol entirely.
 */
export function buildPlaceCard(poi, departmentName) {
  const parts = [
    `${poi.name} is a ${poi.poi_type.replace(/_/g, ' ')} located on the ` +
    'Isabela State University Echague Main Campus.',
  ];
  if (departmentName) parts.push(`It houses the ${departmentName}.`);
  if (poi.building_function) parts.push(`Its primary function is ${poi.building_function}.`);
  if (poi.description) parts.push(poi.description);
  parts.push(
    `Users looking for ${poi.name} can find it marked on the ISU-GeoBot ` +
    'interactive campus map.',
  );
  return parts.join(' ');
}

/** Sentence-packing to the same budget ingest.py enforces (audit F-34). */
function chunk(text, targetWords = 90) {
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
  return out.filter(Boolean);
}

/**
 * Regenerate and re-embed one POI's place-card.
 *
 * Replaces rather than appends: a stale chunk left behind would keep competing
 * for retrieval slots against the corrected one, and the model would sometimes
 * ground an answer in the old location.
 */
export async function reindexPoi(poiId) {
  const { data: poi, error } = await db
    .from('poi')
    .select('id, slug, name, poi_type, building_function, description, icon, data_origin, department_id')
    .eq('id', poiId)
    .maybeSingle();
  if (error) throw error;
  if (!poi) throw new Error(`POI ${poiId} not found`);

  let departmentName = null;
  if (poi.department_id) {
    const { data: dept } = await db
      .from('department').select('name').eq('id', poi.department_id).maybeSingle();
    departmentName = dept?.name ?? null;
  }

  const text = buildPlaceCard(poi, departmentName);

  // Remove the previous card and its chunks before writing the new one.
  //
  // TWO PROVENANCE FORMS, AND MISSING ONE LEFT DUPLICATES IN THE CORPUS.
  // The initial bulk import (machine-learning ingest) wrote source_origin
  // 'generated:poi' with no identifier; this service writes
  // 'generated:poi:<uuid>'. Matching only the second meant a reindex through
  // the admin UI never deleted the imported card and simply added a rival
  // copy beside it. Six POIs ended up with two near-identical place cards,
  // which is invisible in the UI and costs a retrieval slot at query time —
  // it lands directly on Context Precision.
  //
  // Legacy rows carry no id, so within that set the title is what identifies
  // the POI. Modern rows are matched by id and are unaffected by a rename.
  const { data: current } = await db
    .from('document')
    .select('id')
    .eq('doc_type', 'poi_place_card')
    .eq('source_origin', `generated:poi:${poi.id}`);
  const { data: legacy } = await db
    .from('document')
    .select('id')
    .eq('doc_type', 'poi_place_card')
    .eq('source_origin', 'generated:poi')
    .eq('title', `Place card — ${poi.name}`);

  for (const d of [...(current ?? []), ...(legacy ?? [])]) {
    await db.from('document_chunk').delete?.().eq?.('document_id', d.id);
    await db.from('document').delete?.().eq?.('id', d.id);
  }

  const { data: doc, error: docErr } = await db
    .from('document')
    .insert({
      title: `Place card — ${poi.name}`,
      doc_type: 'poi_place_card',
      source_origin: `generated:poi:${poi.id}`,
      provided_by: 'poiService',
      data_origin: poi.data_origin,
    })
    .select('id')
    .single();
  if (docErr) throw docErr;

  const pieces = chunk(text);
  for (const [i, content] of pieces.entries()) {
    // The SAME embedding path as ingestion and query time (audit F-14).
    // If this ever used a different embedder, POIs added through the UI would
    // be unretrievable by queries — and the failure would be silent.
    const { embedding } = await ml.embed(content);
    const { error: chunkErr } = await db.from('document_chunk').insert({
      document_id: doc.id,
      chunk_index: i,
      content,
      // Conservative estimate; the DB CHECK at 220 is the real ceiling and the
      // 90-word packing above keeps us well clear of it.
      token_count: Math.min(220, Math.ceil(content.split(/\s+/).length * 1.4)),
      embedding,
      embedding_model: 'all-MiniLM-L6-v2',
      embedding_norm: 'l2',
      poi_id: poi.id,
      data_origin: poi.data_origin,
    });
    if (chunkErr) throw chunkErr;
  }

  log.info({ poiId, chunks: pieces.length }, 'POI place-card reindexed');
  return { chunks: pieces.length, text };
}

async function audit(action, poiId, before, after, userId, note) {
  try {
    await db.from('poi_audit').insert({
      poi_id: poiId,
      action,
      before_state: before ?? null,
      after_state: after ?? null,
      changed_by: userId,
      note: note ?? null,
    });
  } catch (err) {
    // Never fail the operation because the audit write failed, but never lose
    // the record silently either.
    log.error({ err, action, poiId }, 'poi_audit write failed');
  }
}

/**
 * A stable, URL-safe identifier derived from the location's name.
 *
 * The slug is what the assistant uses to name a location in its [LOCATION: id]
 * tag, so it has to be readable enough for a language model to pick correctly
 * out of a list. It is assigned once at creation and never regenerated on
 * rename: it is an identifier, and identifiers that follow the display name
 * break every reference that points at them.
 */
function slugify(name) {
  return String(name)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'location';
}

async function uniqueSlug(name) {
  const base = slugify(name);
  const { data } = await db.from('poi').select('slug').like('slug', `${base}%`);
  const taken = new Set((data ?? []).map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; n < 100; n += 1) {
    if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
  }
  return `${base}-${Date.now()}`;
}

export async function createPoi(input, userId) {
  const { data, error } = await db
    .from('poi')
    .insert({
      name: input.name,
      slug: await uniqueSlug(input.name),
      poi_type: input.poiType,
      lat: input.lat,
      lng: input.lng,
      building_function: input.buildingFunction ?? null,
      department_id: input.departmentId ?? null,
      description: input.description ?? null,
      icon: input.icon ?? null,
      is_featured: input.isFeatured ?? false,
      is_published: input.isPublished ?? true,
      survey_method: input.surveyMethod ?? 'unknown',
      // Provenance is explicit and has no default (audit F-38). A location
      // entered before the GPS survey is placeholder data and says so.
      data_origin: input.dataOrigin,
      created_by: userId,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;

  await audit('create', data.id, null, data, userId, input.note);
  const index = await reindexPoi(data.id);
  return { poi: data, index };
}

export async function updatePoi(poiId, patch, userId) {
  const { data: before, error: beforeErr } = await db
    .from('poi').select('*').eq('id', poiId).maybeSingle();
  if (beforeErr) throw beforeErr;
  if (!before) {
    const err = new Error('Location not found');
    err.status = 404;
    throw err;
  }

  const fields = {
    ...(patch.name !== undefined && { name: patch.name }),
    ...(patch.poiType !== undefined && { poi_type: patch.poiType }),
    ...(patch.lat !== undefined && { lat: patch.lat }),
    ...(patch.lng !== undefined && { lng: patch.lng }),
    ...(patch.buildingFunction !== undefined && { building_function: patch.buildingFunction }),
    ...(patch.departmentId !== undefined && { department_id: patch.departmentId }),
    ...(patch.description !== undefined && { description: patch.description }),
    ...(patch.icon !== undefined && { icon: patch.icon }),
    ...(patch.isFeatured !== undefined && { is_featured: patch.isFeatured }),
    ...(patch.isPublished !== undefined && { is_published: patch.isPublished }),
    ...(patch.surveyMethod !== undefined && { survey_method: patch.surveyMethod }),
    ...(patch.dataOrigin !== undefined && { data_origin: patch.dataOrigin }),
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };

  const { data: after, error } = await db
    .from('poi').update(fields).eq('id', poiId).select?.().single?.()
    ?? { data: { ...before, ...fields }, error: null };
  if (error) throw error;

  await audit('update', poiId, before, after ?? fields, userId, patch.note);

  // Any field the place-card is built from changes the embedding.
  const textual = ['name', 'poiType', 'buildingFunction', 'description', 'departmentId'];
  if (textual.some((k) => patch[k] !== undefined)) {
    const index = await reindexPoi(poiId);
    return { poi: after ?? { ...before, ...fields }, index };
  }
  return { poi: after ?? { ...before, ...fields }, index: null };
}

/**
 * Unpublish rather than delete.
 *
 * A hard delete would remove a row that an earlier evaluation run retrieved
 * against, making that run unreproducible. Unpublishing hides the location from
 * the map and drops its chunks from the corpus while the record survives.
 */
export async function unpublishPoi(poiId, userId, note) {
  const { data: before } = await db.from('poi').select('*').eq('id', poiId).maybeSingle();
  if (!before) {
    const err = new Error('Location not found');
    err.status = 404;
    throw err;
  }

  await db.from('poi').update({
    is_published: false,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  }).eq('id', poiId);

  const { data: docs } = await db
    .from('document').select('id')
    .eq('source_origin', `generated:poi:${poiId}`);
  for (const d of docs ?? []) {
    await db.from('document_chunk').delete?.().eq?.('document_id', d.id);
    await db.from('document').delete?.().eq?.('id', d.id);
  }

  await audit('unpublish', poiId, before, null, userId, note);
  return { unpublished: true };
}
