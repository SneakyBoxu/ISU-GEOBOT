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

import { db, generate, log, ml } from '../lib/clients.js';
import { config } from '../lib/config.js';
import { buildPrompt } from '../lib/prompt.js';
import { filterEgress } from '../middleware/maskingMiddleware.js';
import { routeQuery } from './router.js';
import { getAvailability } from './presenceService.js';

let statusLabels = null;

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
 */
export async function runPipeline({
  query,
  mode = 'enhanced',
  at = new Date(),
  includeSynthetic = true,
  allowAvailability = true,
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

  const [retrieval, availability] = await Promise.all([
    retrievalPromise,
    availabilityPromise,
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
    availabilityBlock = {
      facultyName: faculty?.fullName ?? 'the faculty member',
      statusLabel,
      asOf: availability.masked.maskedAt,
    };
  }

  const { messages, fusedPrompt, contextsForRagas } = buildPrompt({
    mode,
    query,
    chunks: retrieval.chunks,
    availability: availabilityBlock,
  });

  // 6. Generate ----------------------------------------------------------
  const tLlm = performance.now();
  let answer = await generate(messages);
  timings.llm = performance.now() - tLlm;

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
    });
    answer = filtered.text;
    egressHit = filtered.hit;
  }

  timings.total = performance.now() - tStart;

  // Map focus for the frontend (audit S1 / brief §3B). Derived from the
  // retrieved place-cards, so the map follows what actually grounded the
  // answer rather than a second, unrelated lookup.
  const poiChunk = retrieval.chunks.find((c) => c.poi_id);

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
    poiFocus: poiChunk ? { poiId: poiChunk.poi_id } : null,
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
