/**
 * Tri-state presence resolution and Random Forest invocation.
 *
 * THE RULE THAT KEEPS THE STUDY ALIVE (audit F-07 / B1).
 *
 * The thesis's illustrative code is `if (!isFacultyOnCampus) -> "Unavailable"`.
 * Implemented as a boolean, a faculty member with NO log is falsy and therefore
 * indistinguishable from one who left. On day one of the evaluation period,
 * with a guard who has logged nobody, every faculty resolves to Unavailable,
 * the Random Forest is NEVER INVOKED, and the thesis's claimed contribution is
 * dead code during its own validation — while faculty validators dutifully
 * rate the accuracy of a path that never ran.
 *
 * So:
 *   confirmed_off_campus -> deterministic override, skip the model  [§3.5.3]
 *   confirmed_on_campus  -> run the model
 *   unknown              -> RUN THE MODEL
 *
 * That last line is load-bearing. It is also the more honest design: the
 * Random Forest is precisely the component meant to estimate presence when
 * ground truth is absent.
 */

import { db, ml, log } from '../utilities/service-clients.js';
import { config } from '../utilities/configuration.js';
import { maskOverride, maskPrediction } from '../middleware/privacy-masking-middleware.js';

export async function resolvePresence(facultyId, at = new Date()) {
  const { data, error } = await db.rpc('resolve_presence', {
    p_faculty_id: facultyId,
    p_at: at.toISOString(),
    p_timezone: config.presence.timezone,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    state: row?.presence_state ?? 'unknown',
    lastEventType: row?.last_event_type ?? null,
    lastEventAt: row?.last_event_at ?? null,
  };
}

/**
 * Schedule context for the feature vector. Uses the same SQL function that
 * backs baseline_rule.py, so the forest and the baseline see the same view of
 * the schedule (audit F-20).
 */
async function scheduleContext(facultyId, at) {
  const { data, error } = await db.rpc('schedule_lookup_status', {
    p_faculty_id: facultyId,
    p_at: at.toISOString(),
    p_semester: null,
    p_timezone: config.presence.timezone,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    ruleStatus: row?.status_code ?? 'unavailable_off_schedule',
    matchedBlock: row?.matched_block ?? null,
    isEventDay: Boolean(row?.is_event_day),
    eventType: row?.event_type ?? null,
  };
}

async function pseudonymFor(facultyId) {
  // Audit F-19. The model receives a pseudonym, never a name and never the
  // faculty UUID. The map is held separately and is not exposed by any route.
  const { data } = await db
    .from('faculty_pseudonym_map')
    .select('pseudonym_id')
    .eq('faculty_id', facultyId)
    .maybeSingle();
  return data?.pseudonym_id ?? null;
}

function semesterPhase() {
  // Refined by dataset.py at training time from the real semester window; at
  // inference we default to mid-term unless a calendar is configured.
  return 1;
}

/**
 * Full availability path: guard check -> (override | model) -> masking boundary.
 *
 * Returns the masked result plus the internals a caller may CHOOSE to persist
 * for research. Nothing internal is attached to the returned masked object —
 * see maskingMiddleware for why that separation is deliberate.
 */
export async function getAvailability(facultyId, at = new Date()) {
  const t0 = performance.now();
  const presence = await resolvePresence(facultyId, at);
  const tGuard = performance.now() - t0;

  if (presence.state === 'confirmed_off_campus') {
    // Thesis §3.5.3: bypass the AI entirely. The model is never consulted, so
    // there is no prediction to mask — only the override to project.
    return {
      ...maskOverride(),
      presence,
      overrideApplied: true,
      timings: { guard: tGuard, rf: 0 },
    };
  }

  const [pseudonym, sched] = await Promise.all([
    pseudonymFor(facultyId),
    scheduleContext(facultyId, at),
  ]);

  const t1 = performance.now();
  let prediction;
  try {
    prediction = await ml.predict({
      when: at.toISOString(),
      pseudonym_id: pseudonym,
      is_consultation_hour: sched.matchedBlock === 'consultation' ? 1 : 0,
      is_scheduled_class: sched.matchedBlock === 'class' ? 1 : 0,
      exam_period_flag: sched.eventType === 'exam_period' ? 1 : 0,
      campus_event_flag: sched.isEventDay ? 1 : 0,
      semester_phase: semesterPhase(),
    });
  } catch (err) {
    if (err.mlError === 'model_unavailable') {
      // No trained model yet. Audit R6: do NOT substitute a placeholder
      // prediction and do NOT silently fall back to the rule baseline dressed
      // up as a model output. Say so.
      const e = new Error(
        'The availability classifier has not been trained yet. ' +
        'Faculty availability estimates are unavailable until the Random ' +
        'Forest is trained on real ISU schedule and attendance data.',
      );
      e.status = 503;
      e.code = 'model_untrained';
      throw e;
    }
    throw err;
  }
  const tRf = performance.now() - t1;

  log.debug({ facultyId, presenceState: presence.state }, 'availability resolved');

  return {
    ...maskPrediction(prediction),
    presence,
    overrideApplied: false,
    scheduleContext: sched,
    timings: { guard: tGuard, rf: tRf },
  };
}
