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

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatClock(timeStr) {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
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
    // Migration 008. Without this the function defaults to 'echague', which
    // happens to be right for this deployment — but availability is always
    // relative to a place, and a lookup that does not say which place is one
    // configuration change away from being quietly wrong.
    p_campus: config.presence.campus,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  const matchedBlock = row?.matched_block ?? null;

  let courseCode = null;
  let currentEndTime = null;
  let nextAvailable = null;

  try {
    const local = new Date(at.toLocaleString('en-US', { timeZone: config.presence.timezone }));
    const dow = local.getDay();
    const timeStr = local.toTimeString().slice(0, 8);

    const { data: allSched } = await db
      .from('faculty_schedule')
      .select('day_of_week, start_time, end_time, block_kind, course_code, campus')
      .eq('faculty_id', facultyId)
      .order('day_of_week')
      .order('start_time');

    if (allSched?.length) {
      const current = allSched.find(
        (s) => s.day_of_week === dow && s.start_time <= timeStr && s.end_time > timeStr,
      );

      if (current) {
        currentEndTime = formatClock(current.end_time);
        if (current.block_kind === 'class') {
          courseCode = current.course_code ?? null;
        }
      }

      // Find next consultation block
      // 1. Later today
      let next = allSched.find(
        (s) =>
          s.day_of_week === dow
          && s.start_time >= (current ? current.end_time : timeStr)
          && s.block_kind === 'consultation',
      );

      if (next) {
        nextAvailable = `today from ${formatClock(next.start_time)} to ${formatClock(next.end_time)}`;
      } else {
        // 2. Look across next 6 days
        for (let offset = 1; offset <= 6; offset++) {
          const nextDow = (dow + offset) % 7;
          next = allSched.find(
            (s) => s.day_of_week === nextDow && s.block_kind === 'consultation',
          );
          if (next) {
            nextAvailable = `${DAY_NAMES[nextDow]} from ${formatClock(next.start_time)} to ${formatClock(next.end_time)}`;
            break;
          }
        }
      }
    }
  } catch { /* non-critical */ }

  return {
    ruleStatus: row?.status_code ?? 'unavailable_off_schedule',
    matchedBlock,
    courseCode,
    currentEndTime,
    nextAvailable,
    isEventDay: Boolean(row?.is_event_day),
    eventType: row?.event_type ?? null,
    /**
     * Teaching, but not here — and INTERNAL ONLY.
     *
     * The tempting move is to answer "they are teaching at the Santiago
     * campus", which is friendlier and more informative. It is also a
     * location disclosure about an identified person, which is precisely
     * what the Status Masking Protocol exists to prevent. Naming a city is
     * coarser than naming a room; it is not categorically different, and a
     * system that refuses to say "Room 304" while volunteering "Santiago"
     * has not drawn the line it claims to draw.
     *
     * So the disclosed status stays 'unavailable_off_schedule' — accurate,
     * because they are not available here — and this flag is used only
     * inside the process: it keeps is_scheduled_class at 0 for the feature
     * vector, and it explains the result in an audit trail. The DTO is
     * built from an allowlist in privacy-masking-middleware.js, so this
     * cannot reach a response by accident.
     */
    onOtherCampus: matchedBlock === 'class_other_campus',
  };
}

/**
 * The three historical-attendance features, thesis §3.5.2(b).
 *
 * WHY THIS EXISTS. dataset_loader.py computes these when it builds training
 * rows, and they carry roughly a third of the trained model's decision —
 * hist_presence_rate alone is its second strongest feature. This path used to
 * send seven features and leave these out, so the Flask service filled them
 * with zeros and every live prediction was made with a third of the model's
 * signal flat.
 *
 * That failure is silent by construction: the model still returns a class, the
 * logs still look healthy, and the offline accuracy stays high. It is the
 * train/serve skew feature_engineering.py opens by warning about.
 *
 * One definition, in the database, called by both sides. A degraded read
 * returns zeros rather than throwing: an availability answer computed from a
 * partial feature vector is worse than a slow one, but far better than a
 * 500 on the whole query.
 */
async function attendanceHistory(pseudonym, at) {
  const zero = {
    hist_presence_rate: 0,
    hist_punctuality_rate: 0,
    hist_early_departure_rate: 0,
  };
  if (!pseudonym) return zero;

  try {
    const { data, error } = await db.rpc('attendance_features', {
      p_pseudonym: pseudonym,
      p_at: at.toISOString(),
      p_timezone: config.presence.timezone,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return zero;
    return {
      hist_presence_rate: Number(row.hist_presence_rate ?? 0),
      hist_punctuality_rate: Number(row.hist_punctuality_rate ?? 0),
      hist_early_departure_rate: Number(row.hist_early_departure_rate ?? 0),
    };
  } catch (err) {
    log.warn({ err }, 'attendance_features unavailable; predicting without §3.5.2(b)');
    return zero;
  }
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

/**
 * THE ONE PLACE A TIMESTAMP BECOMES A MODEL FEATURE.
 *
 * `day_of_week` and `time_slot` are read straight off the `when` the model is
 * handed: `feature_engineering.build_vector()` calls `row.when.weekday()` and
 * `time_slot(row.when.time())` with no conversion of its own. Training builds
 * those rows from `dataset_loader._slots_for_day()`, which yields CAMPUS-LOCAL
 * NAIVE datetimes.
 *
 * Serving used to send `at.toISOString()` — UTC. Manila is UTC+8, so every
 * prediction was made eight hours from the moment asked about:
 *
 *     16:30 Manila Tue -> 2026-11-03T08:30:00Z   model reads 08:30
 *     07:00 Manila Tue -> 2026-11-02T23:00:00Z   model reads MONDAY 23:00
 *
 * The second is the damaging one. Any query before 08:00 local — most of the
 * teaching morning — crossed into the previous UTC day, so the model was asked
 * about a different weekday's pattern entirely.
 *
 * `sv-SE` is not a style choice: it is the locale whose output is already
 * ISO-shaped (`YYYY-MM-DD HH:mm:ss`), so the conversion needs no dependency and
 * no hand-rolled zero-padding. The zone comes from `config.presence.timezone`
 * rather than a hardcoded offset, so another campus stays correct.
 *
 * Exported for the regression tests: no network, no database.
 */
export function toCampusLocalNaive(at, timezone = config.presence.timezone) {
  return at.toLocaleString('sv-SE', { timeZone: timezone }).replace(' ', 'T');
}

/**
 * The academic window, from institutional_event.
 *
 * Two rows of event_type 'other' titled 'Academic window…' carry the start and
 * end (see database/sample-data/006_official_calendar.sql). They are marked
 * disrupts_schedule = false so schedule_lookup_status(), which selects only
 * `where ie.disrupts_schedule`, never sees them.
 *
 * Cached for a minute like the other lookups — a semester window does not move
 * during a request, and this is on the availability hot path.
 */
let windowCache = { at: 0, value: null };
const WINDOW_TTL_MS = 60_000;

async function academicWindow() {
  if (Date.now() - windowCache.at < WINDOW_TTL_MS) return windowCache.value;
  let value = null;
  try {
    const { data } = await db
      .from('institutional_event')
      .select('event_date, title')
      .eq('event_type', 'other')
      .like('title', 'Academic window%')
      .order('event_date');
    if (data?.length === 2) {
      value = { start: new Date(data[0].event_date), end: new Date(data[1].event_date) };
    }
  } catch (err) {
    log.warn({ err }, 'academic window unavailable; semester_phase falls back to mid');
  }
  windowCache = { at: Date.now(), value };
  return value;
}

/**
 * Semester phase, matching feature_engineering.semester_phase_of() exactly.
 *
 * THIS USED TO BE `return 1`. Training derived early/mid/finals from the date;
 * serving always said "mid", so the feature disagreed between the two for the
 * first four and last three weeks of every semester — the same class of
 * train/serve mismatch as the UTC bug above and the missing hist_* features
 * before it.
 *
 * The arithmetic is duplicated here because training is Python and serving is
 * Node; that duplication cannot be removed without merging the runtimes. What
 * it CAN have is a test that fails when the two drift, and
 * tests/temporal-consistency.test.js is that test.
 *
 * Returning 'mid' when the window is missing is not a guess — it is precisely
 * what semester_phase_of() does when semester_start or semester_end is None.
 */
const PHASE = { early: 0, mid: 1, finals: 2 };
const DAY_MS = 86_400_000;

export function phaseFor(at, window) {
  if (!window?.start || !window?.end) return PHASE.mid;
  const day = new Date(`${toCampusLocalNaive(at).slice(0, 10)}T00:00:00Z`);
  const total = Math.round((window.end - window.start) / DAY_MS) || 1;
  const elapsed = Math.round((day - window.start) / DAY_MS);
  if (elapsed <= 28) return PHASE.early;
  if (total - elapsed <= 21) return PHASE.finals;
  return PHASE.mid;
}

async function semesterPhase(at) {
  return phaseFor(at, await academicWindow());
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

  const history = await attendanceHistory(pseudonym, at);

  const t1 = performance.now();
  let prediction;
  try {
    prediction = await ml.predict({
      // Campus-local naive, matching how training builds its rows. Sending
      // toISOString() here shifted every weekday and time slot by the UTC
      // offset — see toCampusLocalNaive.
      when: toCampusLocalNaive(at),
      pseudonym_id: pseudonym,
      is_consultation_hour: sched.matchedBlock === 'consultation' ? 1 : 0,
      is_scheduled_class: sched.matchedBlock === 'class' ? 1 : 0,
      exam_period_flag: sched.eventType === 'exam_period' ? 1 : 0,
      campus_event_flag: sched.isEventDay ? 1 : 0,
      semester_phase: await semesterPhase(at),
      // Thesis §3.5.2(b). Omitting these does not omit the features — the
      // service defaults them to zero, and the model goes on weighting them.
      ...history,
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
