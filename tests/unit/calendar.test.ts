import assert from 'node:assert/strict';
import { test } from 'node:test';
import { googleCalendarUrl } from '../../lib/events/calendar';

test('Google Calendar link keeps the slot in the event time zone', () => {
  const url = new URL(googleCalendarUrl({
    bookingId: 'SSI-MC-2026-ABC', eventName: 'Robotic Surgery Workshop', venue: 'YCMH, Pune',
    date: '2026-10-21T00:00:00.000Z', startTime: '14:00', endTime: '14:30', timeZone: 'Asia/Kolkata',
  }));
  assert.equal(url.origin + url.pathname, 'https://calendar.google.com/calendar/render');
  assert.equal(url.searchParams.get('action'), 'TEMPLATE');
  assert.equal(url.searchParams.get('text'), 'Robotic Surgery Workshop');
  assert.equal(url.searchParams.get('dates'), '20261021T140000/20261021T143000');
  assert.equal(url.searchParams.get('ctz'), 'Asia/Kolkata');
  assert.equal(url.searchParams.get('location'), 'YCMH, Pune');
  assert.match(url.searchParams.get('details') || '', /SSI-MC-2026-ABC/);
});
