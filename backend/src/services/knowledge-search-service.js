/**
 * The unified Enhanced RAG pipeline.
 *
 * THE CENTRAL INVARIANT OF THIS FILE (audit F-01):
 *
 *   Routing and retrieval are IDENTICAL in both arms. The only difference
 *   between `standard` and `enhanced` is whether Context Fusion appends the
 *   masked availability block.
 *
 * One code path, one mode flag. Not two pipelines. Any design where the router
 * behaves differently in standard mode, or retrieves different chunks, or uses
 * a different prompt skeleton, invalidates the thesis's primary evaluation.
 *
 * Flow (thesis §3.5.4 process flow, with the audit's corrections):
 *   1. route              deterministic gazetteer + intent
 *   2. embed the query    Flask /embed — the same code path as ingestion
 *   3. retrieve           exact cosine over pgvector, top-K
 *      ...simultaneously (§3.5.4 step 4 — retrieval is NOT conditional)...
 *   4. availability       guard tri-state -> RF -> masking boundary
 *   5. Context Fusion     query + chunks + masked status
 *   6. generate           Llama 3.1 8B via Groq, temperature 0
 *   7. egress filter      output-side location-leak scan
 */

import { db, generate, log, ml } from '../utilities/service-clients.js';
import { config } from '../utilities/configuration.js';
import { buildPrompt } from '../utilities/ai-prompt-templates.js';
import { filterEgress } from '../middleware/privacy-masking-middleware.js';
import { routeQuery } from './intent-query-router.js';
import { getAvailability } from './faculty-presence-service.js';

let statusLabels = null;
let gazetteer = { at: 0, rows: [] };
const GAZETTEER_TTL_MS = 60_000;

/**
 * The published campus locations, as {slug, name}.
 *
 * Read-only, and cached briefly because it is small and changes only when a
 * Campus Location administrator edits it. Unpublished locations are excluded,
 * so unpublishing removes a place from the assistant as well as from the map.
 */
async function loadGazetteer() {
  if (Date.now() - gazetteer.at < GAZETTEER_TTL_MS) return gazetteer.rows;
  const { data } = await db
    .from('poi')
    .select('id, slug, name, is_published')
    .order('name');
  gazetteer = {
    at: Date.now(),
    rows: (data ?? []).filter((p) => p.slug && p.is_published !== false),
  };
  return gazetteer.rows;
}

export function clearGazetteerCache() {
  gazetteer = { at: 0, rows: [] };
}

/**
 * Pull the [LOCATION: id] tag out of a generated answer.
 *
 * THE VALIDATION IS THE POINT. The model proposes an id; the server checks it
 * against the authoritative location list and discards anything that is not
 * there. A hallucinated or malicious id moves nothing.
 *
 * This is a READ-ONLY channel: its entire effect is to pan a map. It cannot
 * create, modify or delete a location — those live behind the Campus Location
 * portal's authenticated, role-checked endpoints.
 */
export function extractLocationTag(answer, locations) {
  const m = answer.match(/\[LOCATION:\s*([a-z0-9-]{1,64})\s*\]/i);
  if (!m) return { text: answer, poi: null };

  const text = answer.replace(m[0], '').trim();
  const hit = locations.find((l) => l.slug === m[1].toLowerCase());
  if (!hit) {
    log.warn({ proposed: m[1] }, 'assistant proposed an unknown location id; ignored');
    return { text, poi: null };
  }
  return { text, poi: { poiId: hit.id, slug: hit.slug, name: hit.name } };
}

/**
 * What may be carried forward from earlier turns.
 *
 * Multi-turn chat is a real gain — "where is the library" then "how do I get
 * there from the Oval" is how people actually ask — but replaying history to a
 * language model has a specific hazard here, and it is not a general one.
 *
 * THE HAZARD. Every availability answer is a masked, present-moment estimate,
 * and that is deliberate: §4.3 and audit F-29 exist because a sequence of
 * present-moment answers IS a presence timeline. Feeding prior answers back in
 * hands the model exactly that sequence and invites it to summarise the
 * pattern — "she has been unavailable all morning" — which no single response
 * would ever have said, and which the egress filter cannot catch because it is
 * not a location.
 *
 * SO: any prior turn carrying a status is dropped, along with the question that
 * produced it. Navigation and document follow-ups keep their context; faculty
 * availability stays strictly single-turn, which is what the design always
 * claimed it was.
 *
 * This is not a security boundary and is not presented as one — a client can
 * post whatever history it likes. It is a correctness boundary for honest
 * clients. The actual controls on aggregation are the auth gate and the rate
 * limit, and both are untouched by this.
 */
// Matched against the DISPLAY LABELS in `availability_status`, plus the
// estimate qualifier every status answer is required to carry. Built from a
// list rather than written as one literal: the previous version carried an
// escape that survived as a control character and silently matched nothing,
// which a regex is uniquely good at hiding.
//
// Deliberately over-broad. Dropping a navigation turn that happens to say
// "estimated" costs a little context; keeping a status turn costs the
// property this whole function exists to hold.
const STATUS_HINT = new RegExp(
  [
    'available for consultation',
    'in scheduled class',
    'unavailable',
    'off-schedule',
    'estimated to be',
  ].join('|'),
  'i',
);
export function sanitiseHistory(raw) {
  if (!Array.isArray(raw)) return [];
  const clean = [];
  for (const m of raw) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) continue;
    const content = String(m.content ?? '').slice(0, 600).trim();
    if (!content) continue;
    if (m.role === 'assistant' && STATUS_HINT.test(content)) {
      // Drop the answer AND the question that prompted it, so the model is not
      // left with "is Prof. Santos free?" and no reply to it.
      if (clean.at(-1)?.role === 'user') clean.pop();
      continue;
    }
    clean.push({ role: m.role, content });
  }
  // Six turns is enough for a follow-up to make sense and short enough that a
  // long session cannot quietly become a transcript in every request.
  return clean.slice(-6);
}

async function labelFor(code) {
  if (!statusLabels) {
    const { data } = await db
      .from('availability_status')
      .select('code, display_label, thesis_label');
    statusLabels = Object.fromEntries(
      (data ?? []).map((r) => [r.code, r.display_label]),
    );
  }
  return statusLabels[code] ?? code;
}

/**
 * Retrieval. Called identically in both arms — see the file header.
 * Exact cosine scan, no ANN index (audit F-36).
 */
export async function retrieve(query, { includeSynthetic = true } = {}) {
  const t0 = performance.now();
  const { embedding } = await ml.embed(query);
  const tEmbed = performance.now() - t0;

  const t1 = performance.now();
  const { data, error } = await db.rpc('match_document_chunks', {
    p_query_embedding: embedding,
    p_match_count: config.retrieval.topK,
    p_similarity_floor: config.retrieval.similarityFloor,
    p_include_synthetic: includeSynthetic,
  });
  if (error) throw error;
  const tRetrieve = performance.now() - t1;

  return { chunks: data ?? [], timings: { embed: tEmbed, retrieve: tRetrieve } };
}

/**
 * @param {object} args
 * @param {string} args.query
 * @param {'standard'|'enhanced'} args.mode
 * @param {Date}   [args.at]
 * @param {boolean}[args.includeSynthetic]
 * @param {boolean}[args.allowAvailability] false for anonymous callers (F-29)
 * @param {Array}  [args.history] prior turns. Defaults to none, which is what
 *                 the evaluation harness uses — see sanitiseHistory.
 */
export async function runPipeline({
  query,
  mode = 'enhanced',
  at = new Date(),
  includeSynthetic = true,
  allowAvailability = true,
  history = [],
}) {
  const tStart = performance.now();
  const timings = { route: 0, guard: 0, rf: 0, embed: 0, retrieve: 0, llm: 0, total: 0 };

  // 1. Route -------------------------------------------------------------
  const tRoute = performance.now();
  const route = await routeQuery(query);
  timings.route = performance.now() - tRoute;

  // Audit F-31. Ambiguity is answered with a question, never a guess.
  if (route.ambiguous) {
    const names = route.facultyCandidates.map((c) => c.fullName).join(', ');
    timings.total = performance.now() - tStart;
    return {
      answer: `More than one faculty member matches that name: ${names}. Which one did you mean?`,
      route,
      sources: [],
      masked: null,
      clarification: { kind: 'ambiguous_faculty', options: route.facultyCandidates },
      mode,
      timings,
    };
  }

  // 2-3. Retrieval runs unconditionally, in BOTH arms (§3.5.4 step 4) ------
  const retrievalPromise = retrieve(query, { includeSynthetic });
  const locationsPromise = loadGazetteer();

  // 4. Availability — enhanced arm only. This is the ONLY divergence. ------
  //
  // Two gates before the classifier is invoked at all:
  //   allowAvailability  the caller is signed in (audit F-29)
  //   faculty_is_answerable  active + consented + not self-paused
  //
  // Both are checked BEFORE prediction, not after. A paused faculty member's
  // estimate is never computed, not computed-then-withheld — which is the
  // difference between respecting an objection and merely honouring it in the
  // presentation layer.
  let availabilityPromise = Promise.resolve(null);
  let availabilityWithheld = false;
  let withheldReason = null;

  if (mode === 'enhanced' && route.needsAvailability) {
    const faculty = route.facultyCandidates[0];
    if (!allowAvailability) {
      availabilityWithheld = true;
      withheldReason = 'auth_required';
    } else {
      const { data: answerable } = await db.rpc('faculty_is_answerable', {
        p_faculty_id: faculty.facultyId,
      });
      if (answerable === false) {
        availabilityWithheld = true;
        withheldReason = 'faculty_paused';
      } else {
        availabilityPromise = getAvailability(faculty.facultyId, at).catch((err) => {
          if (err.code === 'model_untrained') return { untrained: true, error: err };
          throw err;
        });
      }
    }
  }

  const [retrieval, availability, locations] = await Promise.all([
    retrievalPromise,
    availabilityPromise,
    locationsPromise,
  ]);
  timings.embed = retrieval.timings.embed;
  timings.retrieve = retrieval.timings.retrieve;
  if (availability?.timings) {
    timings.guard = availability.timings.guard;
    timings.rf = availability.timings.rf;
  }

  const faculty = route.facultyCandidates[0] ?? null;

  if (availabilityWithheld) {
    timings.total = performance.now() - tStart;
    const answer = withheldReason === 'auth_required'
      ? 'Faculty availability is only shown to signed-in campus users. Please '
        + 'sign in with your ISU account to ask about a faculty member. I can '
        + 'still help with campus navigation and university information.'
      // Deliberately does NOT say "this person opted out". Announcing that a
      // named individual exercised their right to object discloses a choice
      // they made about their own data, and could invite exactly the social
      // pressure the right exists to protect them from. Pausing and simply not
      // participating are made indistinguishable from the outside.
      : 'I do not have availability information for that faculty member. You '
        + 'can contact their department office directly, and I can help you '
        + 'find the building on the campus map.';
    return {
      answer, route, sources: retrieval.chunks, masked: null, mode, timings,
      contextsForRagas: retrieval.chunks.map((c) => c.content),
      facultyName: faculty?.fullName ?? null,
      availabilityWithheld: true,
      withheldReason,
    };
  }

  if (availability?.untrained) {
    timings.total = performance.now() - tStart;
    return {
      answer:
        'I can help with campus navigation and institutional information, but ' +
        'faculty availability estimates are not available yet — the ' +
        'availability classifier has not been trained on real schedule data.',
      route, sources: retrieval.chunks, masked: null, mode, timings,
      facultyName: faculty?.fullName ?? null,
    };
  }

  // 5. Context Fusion ----------------------------------------------------
  let statusLabel = null;
  let availabilityBlock = null;
  if (availability?.masked) {
    statusLabel = await labelFor(availability.masked.statusCode);

    /**
     * A class on another campus, said without saying where.
     *
     * The status CODE is unchanged — `unavailable_off_schedule`, one of the
     * three in `availability_status`. No new state is introduced; only the
     * human label differs, which is what the label field is for.
     *
     * Why bother: "Unavailable / Off-Schedule" reads as "not working", which
     * is false when the person is in fact teaching, and gives a student
     * nothing to act on. This says they are occupied and that waiting here is
     * pointless, without naming a campus, building, room or coordinate.
     *
     * SUBORDINATE TO THE MODEL. The override fires only when the authoritative
     * status is ALREADY `unavailable_off_schedule`. If the Random Forest
     * returns `available_consultation` or `in_scheduled_class` from attendance
     * evidence, that result stands and this does nothing — the schedule
     * explains the model's answer, it never replaces it.
     */
    if (
      availability.masked.statusCode === 'unavailable_off_schedule'
      && availability.scheduleContext?.onOtherCampus
    ) {
      statusLabel = 'Teaching this period; not scheduled on this campus';
    }

    availabilityBlock = {
      facultyName: faculty?.fullName ?? 'the faculty member',
      statusLabel,
      asOf: availability.masked.maskedAt,
      courseCode: availability.scheduleContext?.courseCode ?? null,
      currentEndTime: availability.scheduleContext?.currentEndTime ?? null,
      nextAvailable: availability.scheduleContext?.nextAvailable ?? null,
    };
  }

  const { messages, fusedPrompt, contextsForRagas } = buildPrompt({
    mode,
    query,
    chunks: retrieval.chunks,
    availability: availabilityBlock,
    locations,
    history: sanitiseHistory(history),
  });

  // 6. Generate ----------------------------------------------------------
  const tLlm = performance.now();
  let answer = await generate(messages);
  timings.llm = performance.now() - tLlm;

  // 6b. Location tag ------------------------------------------------------
  const tagged = extractLocationTag(answer, locations);
  answer = tagged.text;

  // 7. Egress filter -----------------------------------------------------
  // Audit F-27. Masking sanitises the INPUT; nothing in the thesis constrains
  // the OUTPUT. Given a status and asked "where is she?", the model will
  // cheerfully synthesise a floor and a room. Applied only where a status was
  // disclosed — a pure navigation answer is *supposed* to name a building.
  let egressHit = false;
  if (availabilityBlock) {
    const filtered = filterEgress(answer, {
      facultyName: availabilityBlock.facultyName,
      statusLabel,
      courseCode: availabilityBlock.courseCode,
    });
    answer = filtered.text;
    egressHit = filtered.hit;
  }

  timings.total = performance.now() - tStart;

  // Map focus. Two sources, in priority order:
  //   1. a validated [LOCATION: id] tag — the user explicitly asked to see it
  //   2. the retrieved place-card — the answer was grounded in that place
  // The tag wins because "where is the library" should move the map even when
  // the retriever surfaced a different chunk first.
  // Both sources resolve to the same shape — id, slug and name — so the
  // interface can say WHICH place it moved to without a second lookup. A map
  // that pans with no caption asks the user to work out what just happened.
  //
  // THE FALLBACK ONLY APPLIES TO QUESTIONS ABOUT PLACES.
  //
  // It used to fire on any retrieved place-card, whatever was asked. Retrieval
  // always returns its top-k, so a question with no location in it still
  // surfaced whichever building embedded closest -- and the map moved. Asking
  // "Is Professor Alado available right now?" panned to a building called
  // "Alamario" while the answer said the system had no such information: the
  // text declined and the interface pointed somewhere anyway, which is worse
  // than either on its own.
  //
  // A validated [LOCATION: id] tag still wins unconditionally above; that one
  // is the model deliberately naming a place, not the retriever's leftovers.
  const wantsPlace = route.category === 'campus_navigation'
    || route.category === 'combined';
  const poiChunk = wantsPlace ? retrieval.chunks.find((c) => c.poi_id) : null;
  const chunkPoi = poiChunk
    ? locations.find((l) => l.id === poiChunk.poi_id) ?? { id: poiChunk.poi_id }
    : null;

  return {
    answer,
    route,
    mode,
    sources: retrieval.chunks,
    contextsForRagas,
    fusedPrompt,
    masked: availability?.masked ?? null,
    statusLabel,
    facultyName: faculty?.fullName ?? null,
    overrideApplied: Boolean(availability?.overrideApplied),
    // Internal. Persisted by evalRunner only; never reaches a DTO.
    internalProbabilities: availability?.internalProbabilities ?? null,
    modelVersion: availability?.modelVersion ?? null,
    egressFilterHit: egressHit,
    poiFocus: tagged.poi ?? (chunkPoi
      ? { poiId: chunkPoi.id, slug: chunkPoi.slug ?? null, name: chunkPoi.name ?? null }
      : null),
    availabilityWithheld: false,
    timings,
  };
}

export async function logChat(result, { sessionHash, isDemo = false }) {
  try {
    await db.from('chat_log').insert({
      session_hash: sessionHash,
      query: result.route?.query ?? null,
      route_decision: {
        category: result.route.category,
        needsAvailability: result.route.needsAvailability,
        routerVersion: result.route.routerVersion,
      },
      answer: result.answer,
      masked_status: result.masked?.statusCode ?? null,
      t_total_ms: Math.round(result.timings.total),
      egress_filter_hit: result.egressFilterHit,
      is_demo: isDemo,
    });
  } catch (err) {
    log.warn({ err }, 'chat_log write failed (non-fatal)');
  }
}
