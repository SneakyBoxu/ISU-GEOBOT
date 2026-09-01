process.env.DEMO_MODE = 'true';
process.env.NODE_ENV = 'test';
process.env.SESSION_SALT = 'availability-event-tests-secret';

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const {
  SAFE_REASON_BY_CODE,
  buildAvailabilityExtractionPrompt,
  extractAvailabilityPreview,
  findAvailabilityFacultyCandidates,
  groqRetryAfterMs,
  listAvailabilityEvents,
  publishReviewedAvailabilityEvents,
  resolveAvailabilityEventScope,
  sanitizeAvailabilityExtraction,
} = await import('../src/services/availability-event-service.js');

describe('availability extraction sanitization', () => {
  it('reads Groq quota reset timing from headers and response messages', () => {
    assert.equal(groqRetryAfterMs({ headers: { 'retry-after': '12.5' } }), 12_500);
    assert.equal(groqRetryAfterMs({
      headers: { 'x-ratelimit-reset-tokens': '1m2.25s' },
    }), 62_250);
    assert.equal(groqRetryAfterMs({
      headers: {},
      body: JSON.stringify({ error: { message: 'Rate limit reached. Please try again in 3.4s.' } }),
    }), 3400);
  });

  it('treats formal assigned duties as mandatory without promoting invitations', () => {
    const prompt = buildAvailabilityExtractionPrompt(
      'Proposal defense | ADVISER | CONTENT | TECHNICAL | PANEL CHAIR | SCHEDULE',
      new Date('2026-08-31T00:00:00Z'),
    );
    assert.match(prompt, /assigned to a\s+fixed institutional duty and time/i);
    assert.match(prompt, /adviser, content panel, technical panel, panel\s+chair/i);
    assert.match(prompt, /invitation,\s+optional activity[\s\S]+is not\s+mandatory/i);
    assert.match(prompt, /evidence is uncertain, use false/i);
  });

  it('replaces invented reasons and model-authored safe detail', () => {
    const result = sanitizeAvailabilityExtraction({
      affectsFacultyAvailability: true,
      events: [{
        id: 'model-controlled-id',
        documentType: 'Confidential memo\u0000',
        startsAt: '2026-09-01T08:00:00+08:00',
        endsAt: '2026-09-01T12:00:00+08:00',
        allDay: false,
        scopeType: 'all_faculty',
        facultyNames: [],
        mandatory: true,
        reasonCode: 'private_medical_diagnosis',
        safeReason: 'Unavailable because of a disclosed diagnosis.',
      }],
    }, { assignIds: true });

    assert.equal(result.events[0].reasonCode, 'other_official_announcement');
    assert.equal(result.events[0].safeReason, SAFE_REASON_BY_CODE.other_official_announcement);
    assert.notEqual(result.events[0].id, 'model-controlled-id');
    assert.match(result.events[0].id, /^[0-9a-f-]{36}$/i);
  });

  it('interprets timezone-free institutional times in the configured campus timezone', () => {
    const result = sanitizeAvailabilityExtraction({
      affectsFacultyAvailability: true,
      events: [{
        documentType: 'Memo', startsAt: '2026-09-01T08:00:00',
        endsAt: '2026-09-01T12:00:00', allDay: false,
        scopeType: 'all_faculty', reasonCode: 'official_meeting',
      }],
    });
    assert.equal(result.events[0].startsAt, '2026-09-01T00:00:00.000Z');
    assert.equal(result.events[0].endsAt, '2026-09-01T04:00:00.000Z');
    assert.ok(result.events[0].warnings.some((warning) => warning.includes('Asia/Manila')));
  });

  it('rejects impossible and reversed all-day dates instead of normalizing them', () => {
    const impossible = sanitizeAvailabilityExtraction({
      affectsFacultyAvailability: true,
      events: [{
        startsAt: '2026-02-31', endsAt: '2026-03-02', allDay: true,
        scopeType: 'all_faculty', mandatory: true, reasonCode: 'official_meeting',
      }],
    });
    assert.equal(impossible.events[0].startsAt, null);

    const reversed = sanitizeAvailabilityExtraction({
      affectsFacultyAvailability: true,
      events: [{
        startsAt: '2026-09-10', endsAt: '2026-09-01', allDay: true,
        scopeType: 'all_faculty', mandatory: true, reasonCode: 'official_meeting',
      }],
    });
    assert.equal(reversed.events[0].endsAt, null);
    assert.ok(reversed.events[0].warnings.includes('The end must be later than the start.'));
  });
});

describe('scope resolution', () => {
  it('returns roster candidates for reordered names without selecting one', async () => {
    const rows = {
      faculty: [{
        id: 'f-live', full_name: 'VINLUAN, ALBERT A.', department_id: 'd1',
        is_active: true, is_consented: true, availability_visible: true,
      }],
      department: [{ id: 'd1', name: 'Department of Computing', short_code: 'DC' }],
      faculty_alias: [],
    };
    const dbClient = {
      from(table) {
        return {
          select() { return this; }, eq() { return this; }, in() { return this; },
          then(resolve) { return Promise.resolve({ data: rows[table], error: null }).then(resolve); },
        };
      },
    };
    const result = await findAvailabilityFacultyCandidates('Dr. Albert A. Vinluan', { dbClient });
    assert.deepEqual(result, [{
      id: 'f-live', name: 'VINLUAN, ALBERT A.', department: 'Department of Computing',
    }]);
  });

  it('matches exact faculty aliases and reports unresolved names', async () => {
    const result = await resolveAvailabilityEventScope({
      scopeType: 'named_faculty',
      facultyNames: ['Faculty A', 'Nobody Here'],
    });
    assert.deepEqual(result.facultyIds, ['f1']);
    assert.deepEqual(result.unresolvedFacultyNames, ['Nobody Here']);
  });

  it('matches a department by acronym and expands active faculty', async () => {
    const result = await resolveAvailabilityEventScope({
      scopeType: 'department',
      departmentCode: 'DCS',
      facultyNames: [],
    });
    assert.equal(result.department.code, 'DCS');
    assert.deepEqual(result.facultyIds.sort(), ['f2', 'f5']);
  });

  it('matches reordered titled names while ignoring a conflicting middle initial', async () => {
    const rows = {
      faculty: [{
        id: 'f-live', full_name: 'FELICIANO, CATLEEN GLO R.', department_id: 'd1',
        is_active: true, is_consented: true, availability_visible: true,
      }],
      department: [{ id: 'd1', name: 'Department of Computing', short_code: 'DC' }],
      faculty_alias: [],
    };
    const dbClient = {
      from(table) {
        return {
          select() { return this; },
          eq() { return this; },
          in() { return this; },
          then(resolve) { return Promise.resolve({ data: rows[table], error: null }).then(resolve); },
        };
      },
    };
    const result = await resolveAvailabilityEventScope({
      scopeType: 'named_faculty', facultyNames: ['Catleen Glo M. Feliciano'],
    }, { dbClient });
    assert.deepEqual(result.facultyIds, ['f-live']);
  });
});

describe('review boundary', () => {
  it('cross-checks all proposal-defense rows against a surname-first roster', async () => {
    const roster = [
      ['f-vinluan', 'VINLUAN, ALBERT A.'],
      ['f-feliciano', 'FELICIANO, CATLEEN GLO R.'],
      ['f-lagarteja', 'LAGARTEJA, JOE G.'],
      ['f-san-jose', 'SAN JOSE, CHRISTINE CHARMAINE G.'],
      ['f-salum', 'SALUM, DANTE R.'],
      ['f-maribao', 'MARIBAO, BENCHIE L.'],
      ['f-bermusa', 'BERMUSA, JENEFER P.'],
    ].map(([id, full_name]) => ({
      id, full_name, department_id: 'd1', is_active: true,
      is_consented: true, availability_visible: true,
    }));
    const rows = {
      faculty: roster,
      department: [{ id: 'd1', name: 'Department of Computing', short_code: 'DC' }],
      faculty_alias: [],
    };
    const dbClient = {
      from(table) {
        return {
          select() { return this; }, eq() { return this; }, in() { return this; },
          then(resolve) { return Promise.resolve({ data: rows[table], error: null }).then(resolve); },
        };
      },
    };
    const expected = [
      ['08:00', '09:00', ['Dr. Albert A. Vinluan', 'Catleen Glo M. Feliciano', 'Dr. Joe G. Lagarteja', 'Dr. Christine Charmaine G. San Jose']],
      ['09:00', '10:00', ['Dr. Albert A. Vinluan', 'Catleen Glo M. Feliciano', 'Dr. Joe G. Lagarteja', 'Dr. Christine Charmaine G. San Jose']],
      ['10:00', '11:00', ['Dr. Albert A. Vinluan', 'Catleen Glo M. Feliciano', 'Dr. Joe G. Lagarteja', 'Dr. Christine Charmaine G. San Jose']],
      ['11:00', '12:00', ['Dr. Romero Dante Salum', 'Catleen Glo M. Feliciano', 'Dr. Benchie L. Maribao', 'Dr. Albert A. Vinluan']],
      ['13:00', '14:00', ['Jenefer Bermusa', 'Catleen Glo M. Feliciano', 'Dr. Joe G. Lagarteja', 'Dr. Albert A. Vinluan']],
      ['14:00', '15:00', ['Catleen Glo M. Feliciano', 'Dr. Romero Dante C. Salum', 'Dr. Albert A. Vinluan', 'Dr. Christine Charmaine G. San Jose']],
      ['15:00', '16:00', ['Catleen Glo M. Feliciano', 'Dr. Romero Dante C. Salum', 'Dr. Albert A. Vinluan', 'Dr. Christine Charmaine G. San Jose']],
      ['16:00', '17:00', ['Dr. Albert A. Vinluan', 'Jenefer Bermusa', 'Romero Dante C. Salum', 'Dr. Christine Charmaine G. San Jose']],
    ];
    const preview = await extractAvailabilityPreview('Proposal defense schedule with eight reviewed table rows', {
      dbClient,
      reviewSecret: 'defense-table-test',
      extractor: async () => ({
        affectsFacultyAvailability: true,
        events: expected.map(([start, end, facultyNames]) => ({
          documentType: 'proposal defense',
          startsAt: `2026-09-04T${start}:00`,
          endsAt: `2026-09-04T${end}:00`,
          allDay: false,
          scopeType: 'named_faculty',
          facultyNames,
          mandatory: true,
          reasonCode: 'official_meeting',
        })),
      }),
    });
    assert.equal(preview.events.length, 8);
    assert.ok(
      preview.events.every((event) => event.publishable),
      JSON.stringify(preview.events.map((event) => ({ names: event.facultyNames, warnings: event.warnings }))),
    );
    assert.ok(preview.events.every((event) => event.resolution.facultyIds.length === 4));
    assert.equal(preview.events[3].resolution.normalizedFacultyNames[0].fullName, 'SALUM, DANTE R.');
    assert.equal(preview.events[0].startsAt, '2026-09-04T00:00:00.000Z');
    assert.equal(preview.events[7].endsAt, '2026-09-04T09:00:00.000Z');
  });

  it('preserves OCR line breaks for the extractor and rejects unsigned IDs', async () => {
    const ocr = 'NAME | DATE\r\nFaculty A | September 1, 2026';
    let received;
    const preview = await extractAvailabilityPreview(ocr, {
      now: new Date('2026-08-31T00:00:00Z'),
      reviewSecret: 'test-review-secret',
      extractor: async (text) => {
        received = text;
        return {
          affectsFacultyAvailability: true,
          events: [{
            documentType: 'meeting notice',
            startsAt: '2026-09-01T08:00:00+08:00',
            endsAt: '2026-09-01T10:00:00+08:00',
            allDay: false,
            scopeType: 'named_faculty',
            campus: 'echague',
            departmentCode: null,
            facultyNames: ['Faculty A'],
            mandatory: true,
            reasonCode: 'official_meeting',
            safeReason: 'invented detail',
            warnings: [],
          }],
        };
      },
    });
    assert.equal(received, 'NAME | DATE\nFaculty A | September 1, 2026');
    assert.equal(preview.events[0].publishable, true);
    assert.equal(preview.events[0].safeReason, SAFE_REASON_BY_CODE.official_meeting);

    const altered = structuredClone(preview.events[0]);
    altered.id = '11111111-1111-4111-8111-111111111111';
    await assert.rejects(
      publishReviewedAvailabilityEvents({
        reviewToken: preview.reviewToken,
        ocrChecksum: preview.ocrChecksum,
        events: [altered],
      }, '22222222-2222-4222-8222-222222222222', {
        now: new Date('2026-08-31T00:01:00Z'),
        reviewSecret: 'test-review-secret',
      }),
      (err) => err.code === 'invalid_review_ids',
    );
  });

  it('publishes the reviewed ID with server identity and a clamped reason', async () => {
    const now = new Date('2026-08-31T00:00:00Z');
    const preview = await extractAvailabilityPreview('All faculty meeting notice', {
      now,
      reviewSecret: 'publish-review-secret',
      extractor: async () => ({
        affectsFacultyAvailability: true,
        events: [{
          documentType: 'meeting notice',
          startsAt: '2026-09-01T08:00:00+08:00',
          endsAt: '2026-09-01T10:00:00+08:00',
          allDay: false,
          scopeType: 'all_faculty',
          campus: null,
          departmentCode: null,
          facultyNames: [],
          mandatory: true,
          reasonCode: 'official_meeting',
          safeReason: 'model supplied detail',
          warnings: [],
        }],
      }),
    });
    const reviewed = structuredClone(preview.events[0]);
    reviewed.safeReason = 'reviewer supplied private detail';

    const published = await publishReviewedAvailabilityEvents({
      reviewToken: preview.reviewToken,
      ocrChecksum: preview.ocrChecksum,
      events: [reviewed],
    }, '22222222-2222-4222-8222-222222222222', {
      now: new Date('2026-08-31T00:01:00Z'),
      reviewSecret: 'publish-review-secret',
    });
    assert.equal(published.events[0].id, preview.events[0].id);
    assert.equal(published.events[0].safeReason, SAFE_REASON_BY_CODE.official_meeting);

    const [stored] = await listAvailabilityEvents({ status: 'published' });
    assert.equal(stored.safeReason, SAFE_REASON_BY_CODE.official_meeting);
    assert.equal(stored.facultyNames.length, 0);
    assert.equal(stored.targetCount, 5);
  });
});
