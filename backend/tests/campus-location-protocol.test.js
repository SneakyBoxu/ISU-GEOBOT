/**
 * The [LOCATION: id] map-control protocol — test suite.
 *
 *   npm test --prefix server
 *
 * This is the one behaviour imported from the reference project, and it is the
 * one place where output from a language model is allowed to drive the
 * interface. The reference implementation parsed the tag in the browser and
 * looked the id up in a client-side array. Here the model's proposal is checked
 * against the database before it has any effect.
 *
 * Two properties are under test:
 *
 *   1. An id the model invents does nothing. Not "logs a warning and proceeds"
 *      — does nothing. The protocol is only as trustworthy as its worst input,
 *      and the worst input is a model that pattern-matched a plausible slug.
 *
 *   2. The tag never reaches the user. It is a control signal, and a control
 *      signal rendered as prose is a bug the user has to read past.
 *
 * The channel is read-only by construction: its entire vocabulary is one id and
 * its entire effect is a map pan. There is no verb. See authorization.test.js
 * for the proof that no write path is reachable from the chat surface at all.
 */

process.env.DEMO_MODE = 'true';
process.env.NODE_ENV = 'test';

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import express from 'express';

const { api } = await import('../src/routes/index.js');
const { extractLocationTag } = await import('../src/services/knowledge-search-service.js');

const LOCATIONS = [
  { id: 'p01', slug: 'admin-building', name: 'Administrative Building' },
  { id: 'p07', slug: 'university-library', name: 'University Library' },
];

describe('extractLocationTag — validation', () => {
  it('resolves a known id', () => {
    const r = extractLocationTag('The library is here. [LOCATION: university-library]', LOCATIONS);
    assert.deepEqual(r.poi, {
      poiId: 'p07', slug: 'university-library', name: 'University Library',
    });
  });

  it('strips the tag from the answer', () => {
    const r = extractLocationTag('The library is here. [LOCATION: university-library]', LOCATIONS);
    assert.equal(r.text, 'The library is here.');
    assert.ok(!r.text.includes('LOCATION'));
  });

  it('discards an id that does not exist', () => {
    const r = extractLocationTag('Here it is. [LOCATION: secret-vault]', LOCATIONS);
    assert.equal(r.poi, null, 'an invented id moved the map');
    assert.equal(r.text, 'Here it is.', 'the invented tag was left in the answer');
  });

  it('discards an id for an unpublished location', () => {
    // The gazetteer excludes unpublished locations, so an id for one simply is
    // not in the list — the same path as a hallucination, deliberately.
    const r = extractLocationTag('[LOCATION: retired-annex]', LOCATIONS);
    assert.equal(r.poi, null);
  });

  it('is case-insensitive on the id but still requires a real one', () => {
    assert.equal(extractLocationTag('x [LOCATION: Admin-Building]', LOCATIONS).poi.poiId, 'p01');
    assert.equal(extractLocationTag('x [LOCATION: Admin-Buildings]', LOCATIONS).poi, null);
  });

  it('ignores text that merely mentions the protocol', () => {
    const r = extractLocationTag('I answer with a LOCATION tag when asked.', LOCATIONS);
    assert.equal(r.poi, null);
    assert.equal(r.text, 'I answer with a LOCATION tag when asked.');
  });

  it('takes only the first tag when several are emitted', () => {
    const r = extractLocationTag(
      'Both. [LOCATION: admin-building] [LOCATION: university-library]', LOCATIONS,
    );
    assert.equal(r.poi.poiId, 'p01');
  });

  it('accepts an answer with no tag unchanged', () => {
    const text = 'Enrollment runs from the first week of August.';
    const r = extractLocationTag(text, LOCATIONS);
    assert.equal(r.poi, null);
    assert.equal(r.text, text);
  });

  it('rejects an id carrying anything but slug characters', () => {
    // A defence against the id being used as a smuggling channel — path
    // fragments, quotes, angle brackets. The pattern accepts [a-z0-9-] only, so
    // these do not match at all and the bracketed text stays in the prose where
    // it is visible rather than being silently consumed.
    for (const bad of [
      '[LOCATION: ../../etc/passwd]',
      '[LOCATION: admin-building"><script>]',
      "[LOCATION: '; drop table poi; --]",
    ]) {
      assert.equal(extractLocationTag(`x ${bad}`, LOCATIONS).poi, null, bad);
    }
  });
});

// ---------------------------------------------------------------------------
// End to end, through the real route.
// ---------------------------------------------------------------------------
let base;
let server;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api', api);
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(() => server?.close());

async function chat(query) {
  const res = await fetch(`${base}/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  return { status: res.status, body: await res.json() };
}

describe('POST /chat — map focus', () => {
  it('returns a validated location for a navigation question', async () => {
    const res = await chat('Where is the University Library?');
    assert.equal(res.status, 200);
    assert.ok(res.body.poiFocus, 'no map focus was returned');
    assert.equal(res.body.poiFocus.slug, 'university-library');
  });

  it('never shows the raw tag to the user', async () => {
    const res = await chat('Where is the Administrative Building?');
    assert.ok(!res.body.answer.includes('[LOCATION'), res.body.answer);
    assert.ok(!res.body.answer.includes('LOCATION:'), res.body.answer);
  });

  it('does not move the map for a non-navigation question', async () => {
    const res = await chat('What are the enrollment requirements?');
    assert.ok(!res.body.poiFocus?.slug, 'a policy question panned the map');
  });
});

describe('GET /map/pois — the authoritative location list', () => {
  it('exposes the slug the protocol resolves against', async () => {
    const res = await fetch(`${base}/map/pois`);
    const { pois } = await res.json();
    assert.ok(pois.length >= 20, `expected the real campus set, got ${pois.length}`);
    assert.ok(pois.every((p) => p.slug), 'a location has no slug');
    assert.equal(new Set(pois.map((p) => p.slug)).size, pois.length, 'duplicate slugs');
  });

  it('carries the sports category the real campus needs', async () => {
    const res = await fetch(`${base}/map/pois`);
    const { pois } = await res.json();
    assert.ok(pois.some((p) => p.type === 'sports'), 'no sports locations');
  });
});
