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
 * construction: structured fields, a closed type vocabulary and a full audit
 * trail. It is also operationally necessary. A campus map that
 * cannot be corrected goes stale during the evaluation period, and stale
 * geospatial data would show up as degraded Context Precision that has nothing
 * to do with the architecture being evaluated.
 *
 * THE ONE FILE THIS PORTAL DOES ACCEPT, AND WHY THAT CHANGED.
 * This file used to say "no file handling", and that was true and deliberate.
 * It stopped being adequate once the map was meant to show what a building
 * looks like: a visitor standing in front of a hall identifies it from a
 * photograph faster than from any sentence we can write about it.
 *
 * The surface is answered rather than waved away. One image per location, admin
 * or researcher only, the bytes checked against their own magic number rather
 * than a declared MIME type, a size ceiling enforced twice (here and by the
 * bucket), and a fixed object name per location so an upload replaces rather
 * than accumulates. The image never enters the retrieval corpus -- see
 * buildPlaceCard, which takes prose and nothing else.
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

/** Sentence-packing to the same budget document_knowledge_importer.py enforces (audit F-34). */
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

/**
 * Republish a previously unpublished location.
 */
export async function republishPoi(poiId, userId, note) {
  const { data: before } = await db.from('poi').select('*').eq('id', poiId).maybeSingle();
  if (!before) {
    const err = new Error('Location not found');
    err.status = 404;
    throw err;
  }

  await db.from('poi').update({
    is_published: true,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  }).eq('id', poiId);

  const index = await reindexPoi(poiId);
  await audit('republish', poiId, before, { ...before, is_published: true }, userId, note);
  return { poi: { ...before, is_published: true }, indexed: index.chunks };
}

/**
 * Hard delete a location, removing its place card, chunks, audit records, and POI record.
 */
export async function deletePoi(poiId, userId, note) {
  const { data: before } = await db.from('poi').select('*').eq('id', poiId).maybeSingle();
  if (!before) {
    const err = new Error('Location not found');
    err.status = 404;
    throw err;
  }

  // Remove place card document and its chunks
  const { data: current } = await db
    .from('document')
    .select('id')
    .eq('doc_type', 'poi_place_card')
    .eq('source_origin', `generated:poi:${poiId}`);
  const { data: legacy } = await db
    .from('document')
    .select('id')
    .eq('doc_type', 'poi_place_card')
    .eq('source_origin', 'generated:poi')
    .eq('title', `Place card — ${before.name}`);

  for (const d of [...(current ?? []), ...(legacy ?? [])]) {
    await db.from('document_chunk').delete?.().eq?.('document_id', d.id);
    await db.from('document').delete?.().eq?.('id', d.id);
  }

  await db.from('poi_document').delete?.().eq?.('poi_id', poiId);
  await db.from('poi_audit').delete?.().eq?.('poi_id', poiId);

  // The photograph goes with it. A hard delete that leaves the object behind
  // orphans a file in the bucket with no row pointing at it and no way to find
  // it again.
  await removeStoredPhoto(poiId, before.image_url);

  await db.from('poi').delete?.().eq?.('id', poiId);

  log.info({ poiId, name: before.name, by: userId }, 'POI permanently deleted');
  return { deleted: true, name: before.name };
}


// ---------------------------------------------------------------------------
// The location photograph
// ---------------------------------------------------------------------------

const PHOTO_BUCKET = 'campus-photos';
const PHOTO_MAX_BYTES = 8 * 1024 * 1024;

/**
 * What kind of image these bytes actually are.
 *
 * Read from the file's own leading bytes, never from a declared MIME type or a
 * filename extension. Both of those are supplied by the caller, and a caller
 * who can name the type can name it wrongly -- a .txt renamed .jpg would
 * otherwise be stored and served as an image.
 */
function sniffImage(buffer) {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: 'jpg', contentType: 'image/jpeg' };
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { ext: 'png', contentType: 'image/png' };
  }
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return { ext: 'webp', contentType: 'image/webp' };
  }
  return null;
}

/** Best-effort removal of a stored object. Never throws. */
async function removeStoredPhoto(poiId, imageUrl) {
  if (!imageUrl) return;
  try {
    const name = imageUrl.split('/').pop()?.split('?')[0];
    if (name) await db.storage.from(PHOTO_BUCKET).remove([name]);
  } catch (err) {
    // A stale object is untidy; failing the delete over it would be worse.
    log.warn({ err: err.message, poiId }, 'could not remove location photograph');
  }
}

/**
 * Attach or replace a location's photograph.
 *
 * The object is named after the location id, so an upload replaces the previous
 * image instead of leaving a trail of orphans nobody can match to a building.
 * A cache-busting query string is appended to the stored URL because the object
 * name never changes and browsers would otherwise keep showing the old picture.
 */
export async function setPoiPhoto(poiId, { contentB64, alt, userId }) {
  const { data: before } = await db
    .from('poi').select('id, name, image_url').eq('id', poiId).maybeSingle();
  if (!before) {
    const err = new Error('Location not found');
    err.status = 404;
    throw err;
  }

  const base64 = String(contentB64 || '').replace(/^data:[^;]+;base64,/, '');
  let buffer;
  try {
    buffer = Buffer.from(base64, 'base64');
  } catch {
    buffer = Buffer.alloc(0);
  }
  if (!buffer.length) {
    const err = new Error('No image data was received.');
    err.status = 400;
    throw err;
  }
  if (buffer.length > PHOTO_MAX_BYTES) {
    const err = new Error(
      `Image is ${(buffer.length / 1048576).toFixed(1)} MB; the limit is 8 MB. `
      + 'Resize it and try again.',
    );
    err.status = 413;
    throw err;
  }

  const kind = sniffImage(buffer);
  if (!kind) {
    const err = new Error(
      'That file is not a JPEG, PNG or WebP image. The check reads the file\'s '
      + 'own leading bytes, so renaming the extension will not help.',
    );
    err.status = 400;
    throw err;
  }

  const objectName = `${poiId}.${kind.ext}`;
  const { error: uploadError } = await db.storage
    .from(PHOTO_BUCKET)
    .upload(objectName, buffer, { contentType: kind.contentType, upsert: true });
  if (uploadError) {
    const err = new Error(`Could not store the image: ${uploadError.message}`);
    err.status = 502;
    throw err;
  }

  // A previous upload in a different format leaves an object under another
  // extension. Remove it, or the bucket accumulates one file per format tried.
  for (const ext of ['jpg', 'png', 'webp']) {
    if (ext !== kind.ext) {
      await db.storage.from(PHOTO_BUCKET).remove([`${poiId}.${ext}`]).catch(() => {});
    }
  }

  const { data: pub } = db.storage.from(PHOTO_BUCKET).getPublicUrl(objectName);
  const imageUrl = `${pub.publicUrl}?v=${Date.now()}`;

  const { data: after, error } = await db
    .from('poi')
    .update({
      image_url: imageUrl,
      image_alt: alt?.trim() || `Photograph of ${before.name}`,
      image_updated_at: new Date().toISOString(),
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', poiId)
    .select('*')
    .single();
  if (error) throw error;

  await audit('photo', poiId, { image_url: before.image_url }, { image_url: imageUrl },
              userId, `photo ${before.image_url ? 'replaced' : 'added'}`);

  log.info({ poiId, name: before.name, bytes: buffer.length, type: kind.contentType },
           'location photograph stored');

  // NOT reindexed on purpose: the place-card text is unchanged, and re-embedding
  // it because a picture changed would burn an embedding call for nothing.
  return { poi: after, imageUrl, bytes: buffer.length, contentType: kind.contentType };
}

/** Remove a location's photograph and return the card to its unillustrated state. */
export async function clearPoiPhoto(poiId, userId) {
  const { data: before } = await db
    .from('poi').select('id, name, image_url').eq('id', poiId).maybeSingle();
  if (!before) {
    const err = new Error('Location not found');
    err.status = 404;
    throw err;
  }

  await removeStoredPhoto(poiId, before.image_url);

  const { data: after, error } = await db
    .from('poi')
    .update({
      image_url: null,
      image_alt: null,
      image_updated_at: null,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', poiId)
    .select('*')
    .single();
  if (error) throw error;

  await audit('photo_removed', poiId, { image_url: before.image_url }, null, userId, null);
  log.info({ poiId, name: before.name }, 'location photograph removed');
  return { poi: after, removed: Boolean(before.image_url) };
}
