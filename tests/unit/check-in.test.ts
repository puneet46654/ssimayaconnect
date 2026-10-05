import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkInWindow } from '../../lib/events/check-in';

test('check-in includes exactly the reserved start and excludes the end in India and worldwide', () => {
  for (const [zone, start] of [['Asia/Kolkata', '2026-10-01T02:30:00Z'], ['America/New_York', '2026-10-01T12:00:00Z'],
    ['Pacific/Auckland', '2026-09-30T19:00:00Z']]) {
    const now = new Date(start).getTime();
    for (const [offset, allowed] of [[-1, false], [0, true], [1799999, true], [1800000, false]] as const) {
      assert.equal(checkInWindow('2026-10-01', '08:00', '08:30', zone, new Date(now + offset)).allowed, allowed, `${zone}:${offset}`);
    }
  }
  assert.equal(checkInWindow('2026-10-01', '08:00', '08:30', undefined, new Date('2026-10-01T02:30:00Z')).allowed, true);
});
test('invalid, skipped and repeated local times cannot admit a ticket; valid DST dates use their actual offset', () => {
  for (const [date, start, end] of [['2026-03-08', '02:00', '03:00'], ['2026-11-01', '01:00', '02:00'], ['2026-10-01', '09:00', '08:00']]) {
    assert.equal(checkInWindow(date, start, end, 'America/New_York').allowed, false);
  }
  assert.equal(checkInWindow('2026-11-01', '08:00', '08:30', 'America/New_York', new Date('2026-11-01T13:15:00Z')).allowed, true);
  assert.equal(checkInWindow('2026-03-08', '08:00', '08:30', 'America/New_York', new Date('2026-03-08T12:15:00Z')).allowed, true);
});
