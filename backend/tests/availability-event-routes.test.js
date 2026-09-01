process.env.DEMO_MODE = 'true';
process.env.NODE_ENV = 'test';
process.env.SESSION_SALT = 'availability-route-tests-secret';

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import express from 'express';

const { api } = await import('../src/routes/index.js');

let base;
let server;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api', api);
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(() => server?.close());

async function call(method, path, token, body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
}

describe('availability-event route authorization', () => {
  it('requires authentication', async () => {
    const result = await call('GET', '/availability-events');
    assert.equal(result.status, 401);
  });

  it('denies faculty and students', async () => {
    for (const token of ['demo-validator-token', 'demo-student-token']) {
      const result = await call('GET', '/availability-events', token);
      assert.equal(result.status, 403);
    }
  });

  it('allows administrators to list sanitized records', async () => {
    const result = await call('GET', '/availability-events?status=published', 'demo-admin-token');
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.ok(Array.isArray(result.body.events));
  });

  it('lets administrators refresh edited faculty matches without extraction', async () => {
    const result = await call('POST', '/availability-events/resolve', 'demo-admin-token', {
      event: {
        id: 'draft-event',
        documentType: 'panel schedule',
        startsAt: '2026-09-04T08:00:00+08:00',
        endsAt: '2026-09-04T09:00:00+08:00',
        allDay: false,
        scopeType: 'named_faculty',
        facultyNames: ['Faculty A'],
        mandatory: true,
        reasonCode: 'official_meeting',
      },
    });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.resolution.faculty.length, 1);
    assert.equal(result.body.resolution.faculty[0].fullName, 'Demo Faculty A');
  });

  it('keeps official-roster candidate search private', async () => {
    const denied = await call('GET', '/availability-events/faculty-candidates?q=Faculty');
    assert.equal(denied.status, 401);

    const allowed = await call(
      'GET', '/availability-events/faculty-candidates?q=Faculty%20A', 'demo-admin-token',
    );
    assert.equal(allowed.status, 200, JSON.stringify(allowed.body));
    assert.equal(allowed.body.candidates[0].name, 'Demo Faculty A');
  });

  it('rejects raw OCR at the publication boundary', async () => {
    const result = await call('POST', '/availability-events/publish', 'demo-admin-token', {
      events: [],
      rawOcr: 'private source text',
    });
    assert.equal(result.status, 400);
    assert.equal(result.body.error, 'raw_ocr_not_accepted');
  });
});
