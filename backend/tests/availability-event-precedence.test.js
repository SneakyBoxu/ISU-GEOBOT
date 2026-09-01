process.env.DEMO_MODE = 'true';
process.env.NODE_ENV = 'test';

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const { availabilityOverrideSource } =
  await import('../src/services/faculty-presence-service.js');

describe('official availability event precedence', () => {
  const event = { id: 'must-remain-internal', mandatory: true };

  it('overrides a confirmed arrival before prediction', () => {
    assert.equal(
      availabilityOverrideSource({ state: 'confirmed_on_campus' }, event),
      'official_event_override',
    );
  });

  it('overrides unknown presence before prediction', () => {
    assert.equal(
      availabilityOverrideSource({ state: 'unknown' }, event),
      'official_event_override',
    );
  });

  it('keeps a confirmed departure unavailable with guard precedence', () => {
    assert.equal(
      availabilityOverrideSource({ state: 'confirmed_off_campus' }, event),
      'guard_override',
    );
  });

  it('does not override arrival or unknown presence without an event', () => {
    assert.equal(availabilityOverrideSource({ state: 'confirmed_on_campus' }, null), null);
    assert.equal(availabilityOverrideSource({ state: 'unknown' }, null), null);
  });

  it('does not override presence for a non-mandatory official event', () => {
    assert.equal(
      availabilityOverrideSource({ state: 'confirmed_on_campus' }, { mandatory: false }),
      null,
    );
  });
});
