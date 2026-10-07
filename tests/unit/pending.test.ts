import assert from 'node:assert/strict';
import { test } from 'node:test';
import { eventEndsAt } from '../../lib/bookings/pending';
import { getEventStatus } from '../../lib/events/status';

test('pending bookings expire exactly when the event becomes COMPLETED, in India and worldwide', () => {
  for (const zone of ['Asia/Kolkata', 'America/New_York', 'Pacific/Auckland']) {
    const end = eventEndsAt('2026-10-01', zone).getTime();
    assert.equal(getEventStatus('2026-09-30', '2026-10-01', new Date(end - 1), zone), 'LIVE', zone);
    assert.equal(getEventStatus('2026-09-30', '2026-10-01', new Date(end), zone), 'COMPLETED', zone);
  }
  assert.equal(eventEndsAt('2026-10-01', 'Asia/Kolkata').toISOString(), '2026-10-01T18:30:00.000Z');
});
