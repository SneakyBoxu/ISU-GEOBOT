/**
 * STATUS MASKING PROTOCOL — implemented as an EGRESS BOUNDARY.
 *
 * Thesis §3.5.3 describes masking as a hash map plus a variable purge. Taken
 * literally under the (correct) reading that the Random Forest predicts
 * availability statuses directly, that reduces to renaming "available" to
 * "Available for Consultation" — a string constant. §2.1.7 claims
 * privacy-preserving masking as part of the study's contribution, and a string
 * constant will not survive cross-examination.
 *
 * So this module implements masking as a security boundary with an ENFORCEABLE
 * INVARIANT (audit F-26):
 *
 *     No faculty-location-bearing value can reach the client, from any path.
 *
 * Five enforced properties:
 *
 *   1. ALLOWLIST PROJECTION   Only a member of the closed three-value enum may
 *                             cross into Context Fusion. Not an object, not a
 *                             struct with extra fields — one enum value.
 *                             Anything else is a hard error, never a fallback.
 *   2. OVERRIDE PRECEDENCE    A guard-confirmed departure short-circuits the
 *                             model entirely (thesis §3.5.3).
 *   3. PURGE                  The prediction object, probability vector and
 *                             feature vector do not survive past the boundary.
 *   4. EGRESS FILTERING       The generated answer is scanned for location
 *                             leakage before it is returned. This is the piece
 *                             §3.5.3 does not have and it is what makes the
 *                             protocol non-trivial (audit F-27).
 *   5. DTO ALLOWLIST          The response body is built by allowlist, so a
 *                             debug field cannot leak by accident.
 *
 * Properties 1-3 sanitise the LLM's INPUT. Property 4 exists because nothing
 * in the thesis constrains its OUTPUT: given "Currently in a Lecture" and asked
 * "where can I find her?", Llama will happily synthesise "probably in one of
 * the CCS rooms on the second floor". The privacy boundary would then be
 * breached at the generation step, invisibly to the masking layer.
 */

import { log } from '../utilities/logger.js';

/** The closed allowlist. Mirrors geobot.availability_status. */
export const ALLOWED_STATUS_CODES = Object.freeze([
  'available_consultation',
  'in_scheduled_class',
  'unavailable_off_schedule',
]);

/**
 * Patterns that must never appear in an answer to a faculty-availability query.
 *
 * Deliberately broad. A false positive costs one templated fallback sentence;
 * a false negative is a privacy incident and a failed defense.
 */
const LOCATION_PATTERNS = [
  /\b(?:room|rm\.?|office)\s*#?\s*\d{1,4}[a-z]?\b/i,
  /\b(?:bldg|building)\s*#?\s*\d{1,3}\b/i,
  /\b\d{1,2}(?:st|nd|rd|th)\s+floor\b/i,
  /\bfloor\s+\d{1,2}\b/i,
  /\b(?:lab|laboratory|lecture\s+hall|classroom)\s*#?\s*\d{1,4}\b/i,
  /\b[A-Z]{2,4}[-\s]?\d{3}\b/,          // CCS-301, ENG 204
  /\b(?:faculty\s+lounge|faculty\s+room)\b/i,
  /\bis\s+(?:currently\s+)?(?:in|at|inside)\s+(?:the\s+)?[A-Z][\w\s]{2,30}\s+(?:room|hall|building|office|lab)\b/i,
];

/** Hedged location guesses — the model speculating past its context. */
const SPECULATION_PATTERNS = [
  /\b(?:probably|likely|might be|may be|possibly|presumably|i'?d guess|perhaps)\b[^.]{0,80}\b(?:in|at|near|inside|around)\b[^.]{0,40}\b(?:room|office|building|floor|hall|lab|lounge)\b/i,
  /\byou\s+(?:could|should|can|might)\s+(?:try|check|look)\b[^.]{0,60}\b(?:room|office|floor|building|lab)\b/i,
];

export class MaskingViolation extends Error {
  constructor(message, detail) {
    super(message);
    this.name = 'MaskingViolation';
    this.status = 500;
    this.detail = detail;
  }
}

/**
 * Property 1 + 3. Project a raw prediction down to one allowlisted code and
 * purge everything else.
 *
 * `prediction` is the full /predict response: predicted_class, probabilities,
 * feature_list, model_version. Only `statusCode` survives the return. The
 * probability vector is handed back SEPARATELY and explicitly, so that a caller
 * has to make a deliberate choice to persist it for research (eval_result.
 * rf_proba) and cannot pass it onward by accident.
 */
export function maskPrediction(prediction, { source = 'random_forest' } = {}) {
  const raw = prediction?.predicted_class;

  if (!ALLOWED_STATUS_CODES.includes(raw)) {
    // Never fall back to a default status. A model that emits something
    // unexpected is a model whose output must not be shown to anyone.
    throw new MaskingViolation(
      'Prediction rejected at the status masking boundary',
      { received: typeof raw === 'string' ? raw : typeof raw },
    );
  }

  const masked = {
    statusCode: raw,
    source,
    maskedAt: new Date().toISOString(),
  };

  // Property 3: purge. Detach the internal fields from the object graph the
  // request continues to hold, mirroring §3.5.3's `rawPrediction = null;`.
  const internalProbabilities = prediction.probabilities ?? null;
  const modelVersion = prediction.model_version ?? null;
  prediction.predicted_class = null;
  prediction.probabilities = null;
  prediction.feature_list = null;

  return { masked, internalProbabilities, modelVersion };
}

/** Property 2. The deterministic guard override, thesis §3.5.3. */
export function maskOverride() {
  return {
    masked: {
      statusCode: 'unavailable_off_schedule',
      source: 'guard_override',
      maskedAt: new Date().toISOString(),
    },
    internalProbabilities: null,
    modelVersion: null,
  };
}

/**
 * Property 4. Output-side filter.
 *
 * Applied to every answer that carried an availability status. Returns the
 * answer unchanged when clean, or a templated safe response when a location
 * pattern is detected.
 *
 * `hit` is recorded on eval_result.egress_filter_hit and chat_log so the
 * filter's trigger rate is measurable — which is itself defense evidence that
 * the protocol does something.
 */
export function filterEgress(answer, { facultyName, statusLabel, courseCode } = {}) {
  if (typeof answer !== 'string' || !answer) {
    return { text: answer ?? '', hit: false, pattern: null };
  }

  // If a scheduled course code is provided (e.g. "DSA 213", "LIS 411"), strip it temporarily
  // from the test string so it is not misidentified as a room pattern (e.g. /[A-Z]{2,4}[-\s]?\d{3}/)
  let testAnswer = answer;
  if (courseCode) {
    const tokens = String(courseCode).trim().split(/\s+/).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = tokens.join('[\\s\\u202F\\u00A0]*');
    testAnswer = testAnswer.replace(new RegExp(`\\b${pattern}\\b`, 'gi'), 'COURSE_CODE');
  }

  const all = [...LOCATION_PATTERNS, ...SPECULATION_PATTERNS];
  const matched = all.find((re) => re.test(testAnswer));

  if (!matched) return { text: answer, hit: false, pattern: null };

  log.warn(
    { pattern: String(matched) },
    'egress filter blocked a response containing location detail (audit F-27)',
  );

  const who = facultyName ? `${facultyName} is` : 'This faculty member is';
  return {
    text:
      `${who} currently estimated as: ${statusLabel}. ` +
      'ISU-GeoBot provides generalized availability status only and does not ' +
      'disclose the physical location of faculty members. For directions to an ' +
      'office, please use the campus map or ask about a specific building.',
    hit: true,
    pattern: String(matched),
  };
}

/**
 * Property 5. Response DTO built by allowlist.
 *
 * It is very easy to attach a debug object during development and forget to
 * strip it. Constructing the body here — rather than spreading an internal
 * result object — makes that failure mode unreachable.
 */
export function toChatDto(result) {
  const dto = {
    answer: result.answer,
    route: {
      needsAvailability: result.route.needsAvailability,
      category: result.route.category,
    },
    sources: (result.sources ?? []).map((s) => ({
      title: s.document_title,
      docType: s.doc_type,
    })),
    tookMs: result.timings?.total ?? null,
  };

  if (result.masked) {
    dto.status = {
      code: result.masked.statusCode,
      label: result.statusLabel,
      // Audit §4.3: an explicit estimate qualifier is a privacy control, not
      // decoration. A user who reads the status as fact is being told
      // something more precise than the system knows.
      isEstimate: true,
      asOf: result.masked.maskedAt,
      facultyName: result.facultyName ?? null,
    };
  }

  if (result.clarification) dto.clarification = result.clarification;
  if (result.poiFocus) dto.poiFocus = result.poiFocus;
  return dto;
}

/**
 * Development-only assertion that no forbidden key escaped into a DTO.
 * Wired into the test suite; cheap enough to leave on in dev.
 */
const FORBIDDEN_DTO_KEYS = [
  'probabilities', 'rf_proba', 'predicted_class', 'raw_prediction',
  'room_label', 'feature_list', 'fused_prompt', 'embedding',
];

export function assertNoLeak(dto) {
  const seen = JSON.stringify(dto).toLowerCase();
  const leak = FORBIDDEN_DTO_KEYS.find((k) => seen.includes(k.toLowerCase()));
  if (leak) {
    throw new MaskingViolation(`Forbidden key "${leak}" reached the response DTO`);
  }
  return dto;
}
