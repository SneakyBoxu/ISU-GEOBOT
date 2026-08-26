/**
 * Train/serve temporal agreement.
 *
 * Three defects of one family have now been found in this project: the
 * historical-attendance features were absent from the serving payload and
 * silently defaulted to zero; punch timestamps were stored eight hours out; and
 * serving sent UTC where training used campus-local naive time. Each was
 * invisible — the model kept returning a class, the logs kept looking healthy.
 *
 * The common shape is that training and serving each build the feature vector
 * their own way, in different runtimes, and nothing compares them. These tests
 * are that comparison. They are deliberately cheap: no network, no database, no
 * ML service, so they run in the normal suite on every save.
 */

process.env.DEMO_MODE = 'true';
process.env.NODE_ENV = 'test';

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const { toCampusLocalNaive, phaseFor } =
  await import('../src/services/faculty-presence-service.js');

// The official academic window (ISU S.Y. 2026-2027, first semester).
// Start of Classes 20 July 2026; end taken as the last published undergraduate
// final examination, 19 November 2026 — see 006_official_calendar.sql for why
// that is an interpretation rather than a quotation.
const WINDOW = {
  start: new Date('2026-07-20T00:00:00Z'),
  end: new Date('2026-11-19T00:00:00Z'),
};

const TZ = 'Asia/Manila';

/** What feature_engineering.time_slot() would compute, in 30-minute buckets. */
const slotOf = (naive) => {
  const [h, m] = naive.slice(11, 16).split(':').map(Number);
  return Math.floor((h * 60 + m) / 30);
};
/** What build_vector computes: (python weekday + 1) % 7, i.e. Sunday = 0. */
const dowOf = (naive) => (new Date(`${naive}Z`).getUTCDay());

describe('campus-local conversion', () => {
  /**
   * THE WEEKDAY BOUNDARY.
   *
   * Manila is UTC+8, so anything before 08:00 local belongs to the previous
   * UTC day. 07:00 is inside the teaching day — this is not an edge case, it
   * is most of the morning.
   */
  it('keeps a pre-08:00 local time on the same weekday', () => {
    const at = new Date('2026-11-03T07:00:00+08:00');   // Tuesday
    assert.equal(at.toISOString(), '2026-11-02T23:00:00.000Z',
      'precondition: UTC really does fall on the previous day here');

    const local = toCampusLocalNaive(at, TZ);
    assert.equal(local, '2026-11-03T07:00:00');
    assert.equal(dowOf(local), 2, 'Tuesday became a different weekday');
    assert.notEqual(dowOf(local), new Date(at.toISOString()).getUTCDay(),
      'this test proves nothing if UTC and local agree');
  });

  it('keeps an afternoon local time in the same slot', () => {
    const at = new Date('2026-11-03T16:30:00+08:00');
    const local = toCampusLocalNaive(at, TZ);
    assert.equal(local, '2026-11-03T16:30:00');
    assert.equal(slotOf(local), 33, '16:30 is slot 33 of 48');
    assert.notEqual(slotOf(local), slotOf(at.toISOString().slice(0, 19)),
      'the UTC slot should differ, or the fixture is not exercising the bug');
  });

  it('does not shift a midday time by the UTC offset', () => {
    const local = toCampusLocalNaive(new Date('2026-09-16T12:00:00+08:00'), TZ);
    assert.equal(local.slice(11, 16), '12:00');
  });
});

describe('semester phase — official calendar dates', () => {
  const phase = (iso) => phaseFor(new Date(iso), WINDOW);

  it('start of classes is early', () => {
    assert.equal(phase('2026-07-20T09:00:00+08:00'), 0);
  });

  it('a mid-semester date is mid', () => {
    assert.equal(phase('2026-09-16T09:00:00+08:00'), 1, 'midterm week sits in mid');
  });

  it('the graduating final examination window is finals', () => {
    for (const d of ['2026-11-10', '2026-11-11', '2026-11-12']) {
      assert.equal(phase(`${d}T09:00:00+08:00`), 2, `${d} should be finals`);
    }
  });

  it('the non-graduating final examination window is finals', () => {
    for (const d of ['2026-11-17', '2026-11-18', '2026-11-19']) {
      assert.equal(phase(`${d}T09:00:00+08:00`), 2, `${d} should be finals`);
    }
  });

  /**
   * Outside the window the Python function does not special-case anything: the
   * arithmetic simply carries on, so a date after the end stays in the finals
   * band and a date well before the start is "early". Asserted so that any
   * future attempt to add out-of-window handling has to change both runtimes.
   */
  it('behaves the same as the Python arithmetic outside the window', () => {
    assert.equal(phase('2026-12-25T09:00:00+08:00'), 2, 'after the end: still finals');
    assert.equal(phase('2026-07-01T09:00:00+08:00'), 0, 'before the start: early');
  });

  it('falls back to mid when the window is unknown', () => {
    // Matches semester_phase_of() returning SEMESTER_PHASES['mid'] when either
    // bound is None. A missing calendar must not invent a phase.
    assert.equal(phaseFor(new Date('2026-09-16T09:00:00+08:00'), null), 1);
    assert.equal(phaseFor(new Date('2026-09-16T09:00:00+08:00'), { start: null, end: null }), 1);
  });

  /**
   * CROSS-LANGUAGE AGREEMENT.
   *
   * feature_engineering.semester_phase_of() is:
   *
   *     if elapsed <= 28:              early
   *     if (total - elapsed) <= 21:    finals
   *     otherwise                      mid
   *
   * Reimplemented here from that source and asserted against the shipped Node
   * implementation across the whole semester. If either side is edited without
   * the other, this fails on the day the bands move.
   */
  it('agrees with the Python arithmetic on every day of the semester', () => {
    const DAY = 86_400_000;
    const total = Math.round((WINDOW.end - WINDOW.start) / DAY);
    const pythonPhase = (elapsed) => {
      if (elapsed <= 28) return 0;
      if (total - elapsed <= 21) return 2;
      return 1;
    };

    let checked = 0;
    for (let e = 0; e <= total; e += 1) {
      const day = new Date(WINDOW.start.getTime() + e * DAY);
      const iso = `${day.toISOString().slice(0, 10)}T09:00:00+08:00`;
      assert.equal(phaseFor(new Date(iso), WINDOW), pythonPhase(e),
        `phase disagrees on day ${e} (${iso.slice(0, 10)})`);
      checked += 1;
    }
    assert.ok(checked > 100, `expected a full semester, checked only ${checked} days`);
  });
});
