/**
 * Status masking boundary — adversarial test suite.
 *
 *   node --test tests/
 *
 * THIS FILE IS DEFENSE EVIDENCE (audit F-27).
 *
 * The thesis never plans a security audit or penetration test of the masking
 * protocol; §3.5.3 presents illustrative code and stops. These tests are the
 * substitute: they demonstrate that the boundary has an ENFORCEABLE INVARIANT
 * rather than being a hash map with a privacy-sounding name.
 *
 * If a panelist asks "how do you know the masking works?", the answer is this
 * file and its pass output — not the code listing in §3.5.3.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ALLOWED_STATUS_CODES,
  MaskingViolation,
  assertNoLeak,
  filterEgress,
  maskOverride,
  maskPrediction,
  toChatDto,
} from '../src/middleware/privacy-masking-middleware.js';

describe('allowlist projection (property 1)', () => {
  it('accepts each of the three allowlisted codes', () => {
    for (const code of ALLOWED_STATUS_CODES) {
      const { masked } = maskPrediction({ predicted_class: code, probabilities: {} });
      assert.equal(masked.statusCode, code);
    }
  });

  it('rejects a room label rather than passing it through', () => {
    assert.throws(
      () => maskPrediction({ predicted_class: 'Room_304' }),
      MaskingViolation,
    );
  });

  it('rejects an unknown class instead of defaulting to a safe status', () => {
    // Defaulting would be the intuitive "safe" choice and it is wrong: a model
    // emitting something unexpected is a model whose output must not be shown.
    assert.throws(() => maskPrediction({ predicted_class: 'on_leave' }), MaskingViolation);
    assert.throws(() => maskPrediction({ predicted_class: null }), MaskingViolation);
    assert.throws(() => maskPrediction({}), MaskingViolation);
  });

  it('never returns extra fields alongside the status', () => {
    const { masked } = maskPrediction({
      predicted_class: 'in_scheduled_class',
      probabilities: { in_scheduled_class: 0.91 },
      room_label: 'CCS-301',
      feature_list: ['day_of_week'],
    });
    assert.deepEqual(Object.keys(masked).sort(), ['maskedAt', 'source', 'statusCode']);
  });
});

describe('intermediate purge (property 3)', () => {
  it('nulls the raw prediction on the source object', () => {
    const prediction = {
      predicted_class: 'available_consultation',
      probabilities: { available_consultation: 0.8 },
      feature_list: ['day_of_week'],
    };
    maskPrediction(prediction);
    assert.equal(prediction.predicted_class, null);
    assert.equal(prediction.probabilities, null);
    assert.equal(prediction.feature_list, null);
  });

  it('hands probabilities back separately so they cannot travel by accident', () => {
    const { masked, internalProbabilities } = maskPrediction({
      predicted_class: 'available_consultation',
      probabilities: { available_consultation: 0.8 },
    });
    assert.equal(masked.probabilities, undefined);
    assert.equal(internalProbabilities.available_consultation, 0.8);
  });
});

describe('deterministic override (property 2)', () => {
  it('produces Unavailable and is attributable to the guard log', () => {
    const { masked, safeReason, internalProbabilities } = maskOverride();
    assert.equal(masked.statusCode, 'unavailable_off_schedule');
    assert.equal(masked.source, 'guard_override');
    assert.equal(safeReason, null);
    assert.equal(internalProbabilities, null);
  });

  it('exposes only a controlled reason for an official event', () => {
    const { masked, safeReason } = maskOverride({
      source: 'official_event_override',
      safeReason: 'Unavailable due to an official meeting.',
    });
    assert.equal(masked.statusCode, 'unavailable_off_schedule');
    assert.equal(masked.source, 'official_event_override');
    assert.equal(safeReason, 'Unavailable due to an official meeting.');
    assert.deepEqual(Object.keys(masked).sort(), ['maskedAt', 'source', 'statusCode']);
  });

  it('rejects an unrecognized source rather than accepting event detail', () => {
    assert.throws(
      () => maskOverride({ source: 'Faculty Assembly in Room 204' }),
      MaskingViolation,
    );
  });

  it('rejects raw event detail as an official-event reason', () => {
    assert.throws(
      () => maskOverride({
        source: 'official_event_override',
        safeReason: 'Faculty Assembly in Room 204',
      }),
      MaskingViolation,
    );
  });
});

describe('egress filter (property 4)', () => {
  const ctx = { facultyName: 'Prof. Santos', statusLabel: 'In Scheduled Class / Lecture' };

  const leaks = [
    'Prof. Santos is currently in Room 304.',
    'She is teaching in room 12b right now.',
    'You can find her in Building 3.',
    'She is on the 2nd floor.',
    'Try floor 4 of the CCS building.',
    'She is in Laboratory 205.',
    'Her class is in CCS-301 at the moment.',
    'She is probably in her office near the faculty lounge.',
    'She might be in the lecture hall on the third floor.',
    'You could try checking room 210.',
    'She is likely at the Engineering building office.',
  ];

  for (const text of leaks) {
    it(`blocks: "${text.slice(0, 44)}..."`, () => {
      const out = filterEgress(text, ctx);
      assert.equal(out.hit, true, 'expected the filter to fire');
      assert.match(out.text, /does not disclose the physical location/);
      assert.doesNotMatch(out.text, /\b(?:room|floor|building)\s*#?\s*\d/i);
    });
  }

  const clean = [
    'Prof. Santos is currently estimated to be in a scheduled class.',
    'Based on the schedule, she is likely unavailable right now.',
    'She is estimated as available for consultation. You may want to email ahead.',
    'I do not have information about that faculty member.',
  ];

  for (const text of clean) {
    it(`passes: "${text.slice(0, 44)}..."`, () => {
      assert.equal(filterEgress(text, ctx).hit, false);
    });
  }

  it('is applied to the response, not merely logged', () => {
    const out = filterEgress('She is in Room 101.', ctx);
    assert.doesNotMatch(out.text, /Room 101/);
  });
});

describe('response DTO allowlist (property 5)', () => {
  const base = {
    answer: 'Prof. Santos is estimated to be in a scheduled class.',
    route: { needsAvailability: true, category: 'faculty_availability' },
    sources: [{ document_title: 'Faculty Handbook', doc_type: 'handbook', content: 'x' }],
    masked: { statusCode: 'in_scheduled_class', maskedAt: '2026-08-18T06:00:00Z' },
    statusLabel: 'In Scheduled Class / Lecture',
    facultyName: 'Prof. Santos',
    timings: { total: 812 },
    // Internals that must NOT survive into the DTO:
    internalProbabilities: { in_scheduled_class: 0.93 },
    fusedPrompt: 'AVAILABILITY ... room_label CCS-301',
    modelVersion: 'rf-20260818-000000',
  };

  it('omits probabilities, the fused prompt and chunk bodies', () => {
    const dto = toChatDto(base);
    assert.equal(dto.internalProbabilities, undefined);
    assert.equal(dto.fusedPrompt, undefined);
    assert.equal(dto.sources[0].content, undefined);
    assertNoLeak(dto);
  });

  it('marks the status as an estimate', () => {
    // Audit §4.3: the qualifier is a privacy control, not decoration. A user
    // who reads the status as fact is being told more than the system knows.
    assert.equal(toChatDto(base).status.isEstimate, true);
  });

  it('does not label an official-event override as a model estimate', () => {
    const dto = toChatDto({
      ...base,
      masked: { ...base.masked, source: 'official_event_override' },
    });
    assert.equal(dto.status.isEstimate, false);
  });

  it('exposes no confidence value', () => {
    const dto = toChatDto(base);
    assert.equal(dto.status.confidence, undefined);
    assert.equal(dto.status.probability, undefined);
  });

  it('assertNoLeak catches a debug field added by mistake', () => {
    const dto = { ...toChatDto(base), debug: { rf_proba: { x: 1 } } };
    assert.throws(() => assertNoLeak(dto), MaskingViolation);
  });
});
