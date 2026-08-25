/**
 * The paths the demo suite cannot reach.
 *
 *   LIVE_TESTS=1 npm test --prefix backend
 *
 * Skipped by default: it needs Supabase, the ML service and Groq actually
 * running, which a plain `npm test` has no right to assume.
 *
 * ------------------------------------------------------------------
 * WHY THIS FILE EXISTS
 * ------------------------------------------------------------------
 * Every other test in this directory opens with `process.env.DEMO_MODE =
 * 'true'`. All eighty-five run against the in-memory adapter and the lexical
 * embedder — never pgvector, never Supabase, never a language model.
 *
 * The cost of that is already recorded in this repository.
 * campus-location-protocol.test.js asserts:
 *
 *     assert.ok(!res.body.poiFocus?.slug, 'a policy question panned the map');
 *
 * which is precisely the bug that shipped: `poiFocus` fell back to any
 * retrieved place-card, so asking about a PERSON panned the map to a building
 * whose name merely embedded nearby, while the answer said the system had no
 * such information. The test passed the entire time, because the demo
 * retriever never returns the chunk that triggers the fallback.
 *
 * Two more got through the same gap: the historical-attendance features were
 * absent from the serving payload and silently defaulted to zero, and punch
 * timestamps were stored eight hours out because a naive literal was read in
 * the session timezone.
 *
 * None of those are exotic. They are ordinary integration bugs, invisible to a
 * suite that never integrates.
 *
 * ------------------------------------------------------------------
 * SIX ASSERTIONS, NOT EIGHTY-FIVE
 * ------------------------------------------------------------------
 * This is not a second copy of the suite. It covers only what demo mode
 * cannot: real retrieval, real RPC, real configuration. Breadth belongs in the
 * fast suite that runs on every save.
 */

process.env.NODE_ENV = 'test';

// The other suites never load this, because demo mode needs no credentials.
// This one talks to the real Supabase, so it needs the same .env the server
// reads — without it the client fails with "supabaseUrl is required", which
// looks like a broken test rather than a missing import.
import 'dotenv/config';

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const LIVE = process.env.LIVE_TESTS === '1';
const BASE = process.env.LIVE_BASE_URL ?? 'http://127.0.0.1:4000';

// A skipped suite should say why, once, rather than printing nothing and
// leaving someone to wonder whether it ran.
if (!LIVE) {
  console.log(
    '\n  live-stack tests skipped. Start the backend, the ML service and\n'
    + '  Supabase, then: LIVE_TESTS=1 npm test --prefix backend\n',
  );
}

/**
 * THE RATE LIMITER IS PRODUCTION BEHAVIOUR, SO THE TEST YIELDS TO IT.
 *
 * `RATE_CHAT_MAX` is 15 per minute and exists for a reason recorded in
 * configuration.js: status masking protects one answer, but unlimited polling
 * of "is X available?" reconstructs a presence timeline. Raising it for the
 * convenience of a test would remove a privacy control to make a green tick
 * appear.
 *
 * This suite makes three chat calls, and all three exercise paths that only the
 * real pipeline has — retrieval, routing, the consent gate — so none can be
 * dropped. Running the suite twice inside a minute therefore trips the limiter
 * and reports a 429 as a test failure, which is a false alarm about the one
 * thing that was working correctly.
 *
 * So: wait and retry, twice, then let it fail honestly. Bounded, and it never
 * touches the limiter.
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ask = async (query, token, attempt = 0) => {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST', headers, body: JSON.stringify({ query }),
  });

  if (res.status === 429 && attempt < 2) {
    const wait = Number(res.headers.get('retry-after')) * 1000 || 20_000;
    console.log(`      rate limited; waiting ${wait / 1000}s (attempt ${attempt + 1}/2)`);
    await sleep(wait);
    return ask(query, token, attempt + 1);
  }

  return { status: res.status, body: await res.json() };
};

describe('live stack', { skip: !LIVE }, () => {
  it('is actually live — not demo mode wearing a costume', async () => {
    const res = await fetch(`${BASE}/api/health`);
    assert.equal(res.status, 200, 'the backend is not running');
    const health = await res.json();
    assert.equal(health.demoMode, false,
      'DEMO_MODE is true — these assertions would prove nothing');
    assert.equal(health.ml, true, 'the ML service is unreachable');
  });

  it('moves the map for a question about a place', async () => {
    const { status, body } = await ask('Where is the university library?');
    assert.equal(status, 200);
    assert.ok(body.poiFocus, 'a navigation query returned no map focus');
    assert.equal(body.poiFocus.slug, 'university-library',
      `the map moved to ${body.poiFocus.name} instead`);
  });

  /**
   * THE REGRESSION THE DEMO SUITE MISSED.
   *
   * Retrieval always returns its top-k, so a question with no location in it
   * still surfaces whichever building embeds closest. If the fallback ever
   * stops checking the route category, this is the test that notices.
   */
  it('leaves the map alone for a question about a person', async () => {
    const { status, body } = await ask('Is Professor Alado available right now?');
    assert.equal(status, 200);
    assert.equal(body.poiFocus ?? null, null,
      `a question about a person panned the map to ${body.poiFocus?.name}`);
  });

  it('refuses to discuss a lecturer who has not consented', async () => {
    const { status, body } = await ask('Is BARTOLOME, BRYAN B. available right now?');
    assert.equal(status, 200);
    const answer = String(body.answer ?? '').toLowerCase();

    // The refusal may be phrased either way: the gazetteer only contains
    // consented faculty, so an unconsented name is usually simply unknown.
    // What matters is that no status escaped.
    const disclosed = ['in a lecture', 'in class', 'available for consultation',
                       'currently available', 'in scheduled class']
      .some((phrase) => answer.includes(phrase));
    assert.ok(!disclosed,
      `an availability status was disclosed for an unconsented lecturer: ${body.answer}`);
    assert.equal(body.status ?? null, null,
      'a status object was attached for an unconsented lecturer');
  });

  /**
   * TRAIN/SERVE SKEW.
   *
   * hist_presence_rate carries roughly a quarter of the trained model's
   * decision. When the serving path omitted it the service filled in zero, the
   * model kept weighting it, and predictions flipped class with high
   * confidence — while every log looked healthy. One non-zero read is enough
   * to catch that returning.
   */
  it('computes the historical attendance features rather than sending zeros', async () => {
    const { createClient } = await import('@supabase/supabase-js');
    const db = createClient(
      process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false }, db: { schema: process.env.DB_SCHEMA ?? 'geobot' } },
    );

    const { data: rows } = await db
      .from('faculty')
      .select('id, full_name, faculty_pseudonym_map(pseudonym_id)')
      .eq('full_name', 'SIM-01')
      .limit(1);

    const pseudonym = rows?.[0]?.faculty_pseudonym_map?.[0]?.pseudonym_id
      ?? rows?.[0]?.faculty_pseudonym_map?.pseudonym_id;
    assert.ok(pseudonym, 'the SIM-01 simulation cohort is not loaded');

    // A Tuesday late morning, when SIM-01 is present in most weeks.
    const { data, error } = await db.rpc('attendance_features', {
      p_pseudonym: pseudonym,
      p_at: '2026-11-03T11:02:00+08:00',
      p_timezone: 'Asia/Manila',
    });
    assert.ok(!error, `attendance_features failed: ${error?.message}`);

    const f = Array.isArray(data) ? data[0] : data;
    assert.ok(Number(f.hist_presence_rate) > 0,
      'hist_presence_rate is 0 — the serving path is back to sending zeros');
  });

  /**
   * THE CAMPUS REGRESSION (migration 008).
   *
   * SIM-02 teaches 07:00-10:00 on a Tuesday, campus = 'santiago'. Before the
   * fix, schedule_lookup_status() ignored the campus column entirely and
   * returned ('in_scheduled_class', 'class', false, null) — the system telling
   * a student outside an Echague office that the lecturer was in a lecture,
   * while the lecturer was two hours away.
   *
   * Both directions are asserted on purpose. Checking only the Echague case
   * would still pass if the function had regressed to answering "other campus"
   * for everything; the mirror proves it discriminates rather than blankets.
   */
  it('does not report an other-campus class as a class here', async () => {
    const { createClient } = await import('@supabase/supabase-js');
    const db = createClient(
      process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false }, db: { schema: process.env.DB_SCHEMA ?? 'geobot' } },
    );

    const { data: fac } = await db
      .from('faculty').select('id').eq('full_name', 'SIM-02').maybeSingle();
    assert.ok(fac?.id, 'SIM-02 is not loaded — run 003_synthetic_attendance.sql');

    // 2026-11-03 is a Tuesday. 08:00 local sits inside the 07:00-10:00 block.
    const at = '2026-11-03T08:00:00+08:00';

    const asked = async (campus) => {
      const { data, error } = await db.rpc('schedule_lookup_status', {
        p_faculty_id: fac.id,
        p_at: at,
        p_semester: '2026-2027-1',
        p_timezone: 'Asia/Manila',
        p_campus: campus,
      });
      assert.ok(!error, `schedule_lookup_status failed: ${error?.message}`);
      return Array.isArray(data) ? data[0] : data;
    };

    const here = await asked('echague');
    assert.notEqual(here.status_code, 'in_scheduled_class',
      'a Santiago class is being reported as a class on this campus');
    assert.equal(here.status_code, 'unavailable_off_schedule');
    assert.equal(here.matched_block, 'class_other_campus',
      'the caller cannot tell "teaching elsewhere" from "no block at all"');

    const there = await asked('santiago');
    assert.equal(there.status_code, 'in_scheduled_class',
      'the same block is not recognised even when asked about its own campus');
    assert.equal(there.matched_block, 'class');
  });

  it('never serves an unpublished location', async () => {
    const res = await fetch(`${BASE}/api/map/pois`);
    const { pois } = await res.json();
    assert.ok(pois.length > 0, 'the public map returned nothing');

    const { createClient } = await import('@supabase/supabase-js');
    const db = createClient(
      process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false }, db: { schema: process.env.DB_SCHEMA ?? 'geobot' } },
    );
    const { count } = await db
      .from('poi')
      .select('id', { count: 'exact', head: true })
      .eq('is_published', true);

    assert.equal(pois.length, count,
      'the public map and the published-location count disagree');
  });
});
