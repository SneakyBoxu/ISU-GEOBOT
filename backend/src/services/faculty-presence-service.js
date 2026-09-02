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

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, ml, log } from '../utilities/service-clients.js';
import { config } from '../utilities/configuration.js';
import { maskOverride, maskPrediction, maskScheduleOnly } from '../middleware/privacy-masking-middleware.js';
import { findCurrentAvailabilityEvent } from './availability-event-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SNAPSHOT_DIR = path.resolve(__dirname, '../../data');
const SNAPSHOT_FILE = path.join(SNAPSHOT_DIR, 'offline_schedule_snapshot.json');

let memorySnapshot = null;

export function getMemorySnapshot() {
  if (memorySnapshot) return memorySnapshot;
  try {
    if (fs.existsSync(SNAPSHOT_FILE)) {
      const raw = fs.readFileSync(SNAPSHOT_FILE, 'utf8');
      memorySnapshot = JSON.parse(raw);
      log.info({ cachedAt: memorySnapshot.cachedAt, facultyCount: memorySnapshot.faculty?.length }, 'Loaded offline schedule snapshot from disk');
    }
  } catch (err) {
    log.warn({ err: err.message }, 'Could not load offline schedule snapshot from disk');
  }
  return memorySnapshot;
}

async function fetchAllTableRows(tableName, selectFields, filterFn = (q) => q) {
  const PAGE_SIZE = 1000;
  let all = [];
  let from = 0;
  while (true) {
    let query = db.from(tableName).select(selectFields);
    query = filterFn(query);
    if (query.range) {
      query = query.range(from, from + PAGE_SIZE - 1);
    }
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

export function normalizeTime(t) {
  if (!t) return '';
  const parts = String(t).split(':');
  const h = (parts[0] || '0').padStart(2, '0');
  const m = (parts[1] || '00').padStart(2, '0');
  const s = (parts[2] || '00').padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export async function preloadOfflineSnapshot() {
  log.info('Preloading offline schedule snapshot from database...');
  try {
    const [facData, deptData, schedData, pseudoData, eventData] = await Promise.all([
      fetchAllTableRows('faculty', 'id, full_name, department_id, is_active, is_consented', (q) => q.eq('is_active', true)),
      fetchAllTableRows('department', 'id, name'),
      fetchAllTableRows('faculty_schedule', 'id, faculty_id, day_of_week, start_time, end_time, block_kind, course_code, campus, semester'),
      fetchAllTableRows('faculty_pseudonym_map', 'faculty_id, pseudonym_id'),
      fetchAllTableRows('institutional_event', 'id, event_date, title, event_type, disrupts_schedule'),
    ]);

    const deptMap = {};
    (deptData ?? []).forEach((d) => {
      deptMap[d.id] = d.name;
    });

    const pseudoMap = {};
    (pseudoData ?? []).forEach((p) => {
      pseudoMap[p.faculty_id] = p.pseudonym_id;
    });

    const snapshot = {
      cachedAt: new Date().toISOString(),
      campus: config.presence.campus,
      timezone: config.presence.timezone,
      faculty: (facData ?? []).map((f) => ({
        id: f.id,
        full_name: f.full_name,
        department: deptMap[f.department_id] || 'General Faculty',
        is_consented: Boolean(f.is_consented),
      })),
      schedules: schedData ?? [],
      pseudonymMap: pseudoMap,
      events: eventData ?? [],
    };

    if (!fs.existsSync(SNAPSHOT_DIR)) {
      fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
    }
    fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2), 'utf8');
    memorySnapshot = snapshot;

    log.info({ facultyCount: snapshot.faculty.length, scheduleCount: snapshot.schedules.length }, 'Offline snapshot preloaded and saved successfully');

    return {
      ok: true,
      cachedAt: snapshot.cachedAt,
      facultyCount: snapshot.faculty.length,
      scheduleCount: snapshot.schedules.length,
      eventsCount: snapshot.events.length,
      faculty: snapshot.faculty,
    };
  } catch (err) {
    log.error({ err: err.message }, 'Failed to preload offline snapshot from database');
    throw err;
  }
}

export async function resolvePresence(facultyId, at = new Date()) {
  try {
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
  } catch (err) {
    log.warn({ err: err.message, facultyId }, 'resolvePresence fallback: returning unknown state (offline mode)');
    return {
      state: 'unknown',
      lastEventType: null,
      lastEventAt: null,
    };
  }
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatClock(timeStr) {
  if (!timeStr) return '';
  const [hh, mm] = timeStr.split(':');
  const h = parseInt(hh, 10);
  if (Number.isNaN(h)) return timeStr;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${mm} ${ampm}`;
}

async function scheduleContext(facultyId, at) {
  const local = new Date(at.toLocaleString('en-US', { timeZone: config.presence.timezone }));
  const dow = local.getDay();
  const timeStr = local.toTimeString().slice(0, 8);
  const normTime = normalizeTime(timeStr);
  const dateIso = local.toISOString().slice(0, 10);

  let row = null;
  let allSched = null;

  try {
    const { data, error } = await db.rpc('schedule_lookup_status', {
      p_faculty_id: facultyId,
      p_at: at.toISOString(),
      p_semester: null,
      p_timezone: config.presence.timezone,
      p_campus: config.presence.campus,
    });
    if (error) throw error;
    row = Array.isArray(data) ? data[0] : data;

    const { data: schedData } = await db
      .from('faculty_schedule')
      .select('day_of_week, start_time, end_time, block_kind, course_code, campus')
      .eq('faculty_id', facultyId)
      .order('day_of_week')
      .order('start_time');
    allSched = schedData;
  } catch (err) {
    log.warn({ err: err.message, facultyId }, 'scheduleContext using offline snapshot fallback');
    const snapshot = getMemorySnapshot();
    if (snapshot?.schedules) {
      allSched = snapshot.schedules.filter((s) => s.faculty_id === facultyId);
      
      const eventToday = snapshot.events?.find((e) => {
        const eDate = typeof e.event_date === 'string' ? e.event_date.slice(0, 10) : new Date(e.event_date).toISOString().slice(0, 10);
        return eDate === dateIso && e.disrupts_schedule;
      });

      if (eventToday) {
        row = {
          status_code: 'unavailable_off_schedule',
          matched_block: null,
          is_event_day: true,
          event_type: eventToday.event_type,
        };
      } else {
        const matchingBlocks = allSched
          .filter((s) => {
            if (s.day_of_week !== dow) return false;
            const start = normalizeTime(s.start_time);
            const end = normalizeTime(s.end_time);
            return start <= normTime && end > normTime;
          })
          .sort((a, b) => {
            const rank = (k) => (k === 'class' ? 1 : k === 'consultation' ? 2 : 3);
            return rank(a.block_kind) - rank(b.block_kind);
          });

        const curBlock = matchingBlocks[0] || null;

        if (!curBlock) {
          row = { status_code: 'unavailable_off_schedule', matched_block: null, is_event_day: false, event_type: null };
        } else if (curBlock.campus && curBlock.campus !== config.presence.campus) {
          row = { status_code: 'unavailable_off_schedule', matched_block: 'class_other_campus', is_event_day: false, event_type: null };
        } else if (curBlock.block_kind === 'class') {
          row = { status_code: 'in_scheduled_class', matched_block: 'class', is_event_day: false, event_type: null };
        } else if (['consultation', 'admin'].includes(curBlock.block_kind)) {
          row = { status_code: 'available_consultation', matched_block: curBlock.block_kind, is_event_day: false, event_type: null };
        } else {
          row = { status_code: 'unavailable_off_schedule', matched_block: null, is_event_day: false, event_type: null };
        }
      }
    }
  }

  const matchedBlock = row?.matched_block ?? null;
  let courseCode = null;
  let currentEndTime = null;
  let nextAvailable = null;

  try {
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
      let next = null;
      if (!row?.is_event_day) {
        next = allSched.find(
          (s) =>
            s.day_of_week === dow
            && s.start_time >= (current ? current.end_time : timeStr)
            && s.block_kind === 'consultation',
        );
      }

      if (next) {
        nextAvailable = `today from ${formatClock(next.start_time)} to ${formatClock(next.end_time)}`;
      } else {
        const startIso = local.toISOString().slice(0, 10);
        const endLimit = new Date(local);
        endLimit.setDate(local.getDate() + 14);
        const endIso = endLimit.toISOString().slice(0, 10);

        let disruptedDates = new Set();
        try {
          const { data: upcomingEvents } = await db
            .from('institutional_event')
            .select('event_date, title, disrupts_schedule')
            .gte('event_date', startIso)
            .lte('event_date', endIso);

          disruptedDates = new Set(
            (upcomingEvents ?? [])
              .filter((e) => e.disrupts_schedule)
              .map((e) => typeof e.event_date === 'string' ? e.event_date.slice(0, 10) : new Date(e.event_date).toISOString().slice(0, 10))
          );
        } catch {
          const snapshot = getMemorySnapshot();
          disruptedDates = new Set(
            (snapshot?.events ?? [])
              .filter((e) => e.disrupts_schedule)
              .map((e) => typeof e.event_date === 'string' ? e.event_date.slice(0, 10) : new Date(e.event_date).toISOString().slice(0, 10))
          );
        }

        for (let offset = 1; offset <= 14; offset++) {
          const candidate = new Date(local);
          candidate.setDate(local.getDate() + offset);
          const candidateDateStr = candidate.toISOString().slice(0, 10);
          const nextDow = candidate.getDay();

          if (disruptedDates.has(candidateDateStr)) {
            continue;
          }

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
    onOtherCampus: matchedBlock === 'class_other_campus',
  };
}

/**
 * The three historical-attendance features, thesis §3.5.2(b).
 */
/**
 * Does this person have ANY attendance observation at all?
 *
 * attendance_features() cannot answer this. Its SQL is
 *
 *     case when p.obs > 0 then p.hits / p.obs else 0.0 end
 *
 * so "never observed" and "observed, never present" both come back as 0.0.
 * The model was trained where 0.0 meant the second, so the first has to be
 * detected separately rather than quietly passed off as a real rate.
 */
async function hasAttendanceEvidence(pseudonym) {
  if (!pseudonym) return false;
  try {
    const { count, error } = await db
      .from('attendance_record')
      .select('id', { count: 'exact', head: true })
      .eq('pseudonym_id', pseudonym)
      .eq('granularity', 'intraday');
    if (error) throw error;
    return (count ?? 0) > 0;
  } catch (err) {
    // Fail toward the model rather than rerouting every request to the
    // schedule because one count query failed.
    log.warn({ err }, 'attendance existence check failed; assuming evidence exists');
    return true;
  }
}

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
    return zero;
  }
}

async function pseudonymFor(facultyId) {
  try {
    const { data, error } = await db
      .from('faculty_pseudonym_map')
      .select('pseudonym_id')
      .eq('faculty_id', facultyId)
      .maybeSingle();
    if (!error && data?.pseudonym_id) return data.pseudonym_id;
  } catch (err) {
    // offline fallback
  }

  const snapshot = getMemorySnapshot();
  return snapshot?.pseudonymMap?.[facultyId] ?? null;
}

/**
 * The one place a timestamp becomes a model feature.
 * Campus-local naive ISO string.
 */
export function toCampusLocalNaive(at, timezone = config.presence.timezone) {
  return at.toLocaleString('sv-SE', { timeZone: timezone }).replace(' ', 'T');
}

/**
 * The academic window, from institutional_event.
 */
let windowCache = { at: 0, value: null };
const WINDOW_TTL_MS = 60_000;

async function academicWindow() {
  if (Date.now() - windowCache.at < WINDOW_TTL_MS) return windowCache.value;
  let value = null;
  try {
    const { data, error } = await db
      .from('institutional_event')
      .select('event_date, title')
      .eq('event_type', 'other')
      .like('title', 'Academic window%')
      .order('event_date');
    if (!error && data?.length === 2) {
      value = { start: new Date(data[0].event_date), end: new Date(data[1].event_date) };
    }
  } catch (err) {
    const snapshot = getMemorySnapshot();
    const windowEvents = (snapshot?.events ?? [])
      .filter((e) => e.event_type === 'other' && e.title?.startsWith('Academic window'))
      .sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
    if (windowEvents.length === 2) {
      value = { start: new Date(windowEvents[0].event_date), end: new Date(windowEvents[1].event_date) };
    }
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
 * Full availability path: guard/event checks -> (override | model) -> masking boundary.
 *
 * Returns the masked result plus the internals a caller may CHOOSE to persist
 * for research. Nothing internal is attached to the returned masked object —
 * see maskingMiddleware for why that separation is deliberate.
 */
export function availabilityOverrideSource(presence, officialEvent) {
  // A confirmed departure remains the strongest presence signal. Otherwise a
  // current published mandatory event overrides both arrival and unknown state.
  if (presence?.state === 'confirmed_off_campus') return 'guard_override';
  if (officialEvent?.mandatory === true) return 'official_event_override';
  return null;
}

export async function getAvailability(facultyId, at = new Date()) {
  const t0 = performance.now();
  const presence = await resolvePresence(facultyId, at);

  if (presence.state === 'confirmed_off_campus') {
    // Departure takes precedence and stays available even if the separate
    // official-event store is unavailable.
    return {
      ...maskOverride(),
      presence,
      overrideApplied: true,
      timings: { guard: performance.now() - t0, rf: 0 },
    };
  }

  let officialEvent = null;
  try {
    officialEvent = await findCurrentAvailabilityEvent(facultyId, at);
  } catch (eventErr) {
    // Offline / database unreachable: proceed without official event override
  }

  if (availabilityOverrideSource(presence, officialEvent)) {
    // Do not return or log the event. maskOverride derives the only explanation
    // allowed to enter response phrasing, without event details.
    return {
      ...maskOverride({ source: 'official_event_override', safeReason: officialEvent.safeReason }),
      presence,
      overrideApplied: true,
      timings: { guard: performance.now() - t0, rf: 0 },
    };
  }

  const tGuard = performance.now() - t0;

  const [pseudonym, sched] = await Promise.all([
    pseudonymFor(facultyId),
    scheduleContext(facultyId, at),
  ]);

  /**
   * NO ATTENDANCE EVIDENCE -> DO NOT ASK THE MODEL.
   *
   * The three hist_* features are the only thing that lets the forest improve
   * on schedule_lookup_status(). Without an attendance record they are all
   * 0.0 — and attendance_features() returns that same 0.0 for "observed and
   * never present", which is what the model was trained to read it as. So a
   * lecturer with no attendance history is described to the model as someone
   * who is never on campus, and it duly returns unavailable_off_schedule while
   * they are standing in front of a class.
   *
   * Measured on this deployment: at hist_presence_rate 0.0 the model answers
   * unavailable_off_schedule; the identical request at 0.3 answers
   * in_scheduled_class. All 37 real lecturers have zero attendance rows, so
   * every one of them was being reported unavailable all day.
   *
   * Handing the model zeros asserts something we do not know. With no evidence
   * it has nothing to add over the timetable, so use the timetable and label
   * the answer `schedule_only` — an estimate must not be presented as more
   * than its evidence supports (audit F-18/F-20).
   */
  const hasEvidence = await hasAttendanceEvidence(pseudonym);
  if (!hasEvidence) {
    return {
      ...maskScheduleOnly(sched.ruleStatus),
      presence,
      scheduleContext: sched,
      overrideApplied: false,
      timings: { guard: tGuard, rf: 0 },
    };
  }

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
