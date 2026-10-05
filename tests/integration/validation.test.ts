import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { ObjectId, type Db, type MongoClient } from 'mongodb';
import { api, createTestAdmin, testDatabase } from '../helpers/test-app';
import { calendarDate, DAY_MS, todayCalendarDate, zonedDate } from '../../lib/events/dates';

let db: Db;
let client: MongoClient;
let cookie: string;
let username: string;
const eventIds: ObjectId[] = [];
const tomorrow = calendarDate(new Date(todayCalendarDate().getTime() + DAY_MS));

before(async () => {
  ({ client, db } = await testDatabase());
  ({ cookie, username } = await createTestAdmin());
});

after(async () => {
  if (!db) return;
  for (const collection of ['bookings', 'slots', 'dayschedules']) await db.collection(collection).deleteMany({ eventId: { $in: eventIds } });
  await db.collection('events').deleteMany({ _id: { $in: eventIds } });
  await db.collection('adminusers').deleteOne({ username });
  await db.collection('adminactivitylogs').deleteMany({ admin: username });
  await client.close();
});

function eventForm(overrides: Record<string, string> = {}) {
  const values = {
    eventName: 'Isolated validation test', eventType: 'conference', venue: 'Test venue',
    description: 'Synthetic test event', bookingFormTemplate: 'practitioner-institutional',
    startDate: tomorrow, endDate: tomorrow, numberOfDays: '1',
    daySchedules: JSON.stringify([{ date: tomorrow, startTime: '08:00', endTime: '18:00',
      lunchEnabled: false, lunchStart: '', lunchEnd: '', slotDuration: '30', slotGap: '10', capacity: '5', sameAsDay1: false }]),
    ...overrides,
  };
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

test('event API rejects invalid date relationships before saving records', async () => {
  const response = await api('/api/events', { method: 'POST', headers: { Cookie: cookie }, body: eventForm({ endDate: '2000-01-01' }) });
  assert.equal(response.status, 400, await response.text());
});

test('event API rejects unsafe duration without hanging', async () => {
  const form = eventForm();
  const schedules = JSON.parse(String(form.get('daySchedules')));
  schedules[0].slotDuration = '5e-324';
  form.set('daySchedules', JSON.stringify(schedules));
  const response = await api('/api/events', { method: 'POST', headers: { Cookie: cookie }, body: form, signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, 400, await response.text());
});

test('status is current in every API even when stored status is stale', async () => {
  const response = await api('/api/events', { method: 'POST', headers: { Cookie: cookie }, body: eventForm() });
  const created = await response.json();
  assert.equal(response.status, 201, JSON.stringify(created));
  const eventId = new ObjectId(created.eventId);
  eventIds.push(eventId);
  await db.collection('events').updateOne({ _id: eventId }, { $set: { status: 'LIVE' } });
  const headers = { Cookie: cookie };
  const reports = await (await api(`/api/admin/reports?eventId=${eventId}`, { headers })).json();
  assert.equal(reports.eventOptions.find((event: { id: string }) => event.id === String(eventId)).status, 'UPCOMING');
  // The dashboard intentionally returns only three live/upcoming events. Make our
  // own fixture the earliest live event, so other test files cannot displace it.
  const firstEvent = await db.collection('events').find().sort({ startDate: 1 }).limit(1).next();
  const earlierStart = new Date(new Date(firstEvent!.startDate).getTime() - DAY_MS);
  await db.collection('events').updateOne({ _id: eventId }, { $set: { startDate: earlierStart, status: 'UPCOMING' } });
  try {
    const dashboard = await (await api('/api/admin/dashboard', { headers })).json();
    assert.ok(dashboard.success, JSON.stringify(dashboard));
    const card = dashboard.upcomingEvents.find((event: { id: string }) => event.id === String(eventId));
    assert.ok(card, 'The earliest live fixture must appear in the three dashboard cards.');
    assert.equal(card.status, 'LIVE');
  } finally {
    await db.collection('events').updateOne({ _id: eventId }, { $set: { startDate: new Date(tomorrow), status: 'LIVE' } });
  }
  const slots = await (await api(`/api/events/${eventId}/slots`)).json();
  assert.equal(slots.event.status, 'UPCOMING');
  const detail = await (await api(`/api/events/${eventId}`)).json();
  assert.equal(detail.event.status, 'UPCOMING');
  const listing = await (await api('/api/events')).json();
  assert.equal(listing.events.find((event: { _id: string }) => event._id === String(eventId)).status, 'UPCOMING');
  assert.equal((await db.collection('events').findOne({ _id: eventId }))?.status, 'LIVE', 'Reading the catalog must not mutate event records.');
});

test('booking and ticket lookup preserve a short international number and reject suffixes', async () => {
  const eventId = eventIds[0];
  assert.ok(eventId);
  const slot = await db.collection('slots').findOne({ eventId });
  assert.ok(slot);
  const response = await api('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
    eventId, slotId: slot._id, dayScheduleId: slot.dayScheduleId, idempotencyKey: randomUUID(),
    details: { fullName: 'Test Attendee', email: 'TEST@EXAMPLE.COM', mobile: '1234567', countryCode: '+354' },
  }) });
  const result = await response.json();
  assert.equal(response.status, 201, JSON.stringify(result));
  const recover = (mobile: string) => api('/api/events/mytickets', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingId: result.booking.bookingId, mobile }) });
  const tickets = await (await recover('+3541234567')).json();
  assert.equal(tickets.tickets.length, 1);
  assert.equal((await recover('1234567')).status, 404);
  assert.equal((await recover('+911234567')).status, 404);
  const bookingList = await (await api(`/api/admin/bookings?eventId=${eventId}`, { headers: { Cookie: cookie } })).json();
  assert.equal(bookingList.bookings[0].event.status, 'UPCOMING');
  const booking = await db.collection('bookings').findOne({ eventId });
  assert.ok(booking);
  const detail = await (await api(`/api/admin/bookings/${booking._id}`, { headers: { Cookie: cookie } })).json();
  assert.equal(detail.booking.eventId.status, 'UPCOMING');
});

test('event API persists international timezones and rejects invalid zones and DST ambiguity', async () => {
  const response = await api('/api/events', { method: 'POST', headers: { Cookie: cookie }, body: eventForm({ timeZone: 'America/New_York' }) });
  const created = await response.json();
  assert.equal(response.status, 201, JSON.stringify(created));
  const eventId = new ObjectId(created.eventId);
  eventIds.push(eventId);
  assert.equal((await db.collection('events').findOne({ _id: eventId }))?.timeZone, 'America/New_York');
  const slots = await (await api(`/api/events/${eventId}/slots`)).json();
  assert.equal(slots.event.timeZone, 'America/New_York');
  const invalid = await api('/api/events', { method: 'POST', headers: { Cookie: cookie }, body: eventForm({ timeZone: 'Not/AZone' }) });
  assert.equal(invalid.status, 400);
  const form = eventForm({ timeZone: 'America/New_York', startDate: '2027-11-07', endDate: '2027-11-07' });
  const schedules = JSON.parse(String(form.get('daySchedules')));
  Object.assign(schedules[0], { date: '2027-11-07', startTime: '01:00', endTime: '04:00' });
  form.set('daySchedules', JSON.stringify(schedules));
  const repeated = await api('/api/events', { method: 'POST', headers: { Cookie: cookie }, body: form });
  assert.equal(repeated.status, 400);
  assert.match((await repeated.json()).error, /clock change/);
});

test('live-event and booking-day filters follow each event across the international date line', async () => {
  const ids: ObjectId[] = [];
  for (const timeZone of ['Pacific/Kiritimati', 'Pacific/Honolulu']) {
    const date = zonedDate(new Date(), timeZone);
    const form = eventForm({ timeZone, startDate: date, endDate: date });
    const schedules = JSON.parse(String(form.get('daySchedules')));
    schedules[0].date = date;
    form.set('daySchedules', JSON.stringify(schedules));
    const response = await api('/api/events', { method: 'POST', headers: { Cookie: cookie }, body: form });
    const created = await response.json();
    assert.equal(response.status, 201, JSON.stringify(created));
    const eventId = new ObjectId(created.eventId);
    eventIds.push(eventId); ids.push(eventId);
    const slot = await db.collection('slots').findOne({ eventId });
    assert.ok(slot);
    await db.collection('bookings').insertOne({ eventId, slotId: slot._id, dayScheduleId: slot.dayScheduleId,
      bookingId: `TEST-${eventId}`, details: { fullName: 'Date line test', email: 'date@example.test', mobile: '+12025550123' }, attendanceStatus: 'PRESENT', createdAt: new Date() });
    const list = await (await api(`/api/admin/bookings?eventId=${eventId}&dateFilter=upcoming`, { headers: { Cookie: cookie } })).json();
    assert.equal(list.bookings.length, 1, JSON.stringify(list));
    assert.equal(list.bookings[0].event.status, 'LIVE');
  }
  const attendance = await (await api('/api/admin/attendance', { headers: { Cookie: cookie } })).json();
  for (const id of ids) assert.ok(attendance.events.some((event: { id: string }) => event.id === String(id)), JSON.stringify(attendance));
});

test('report date filters include exactly the selected DST day', async () => {
  const eventId = eventIds[1];
  assert.ok(eventId);
  const slot = await db.collection('slots').findOne({ eventId });
  assert.ok(slot);
  for (const createdAt of ['2026-03-08T04:59:59Z', '2026-03-08T05:00:00Z', '2026-03-09T03:59:59Z', '2026-03-09T04:00:00Z']) {
    await db.collection('bookings').insertOne({ eventId, slotId: slot._id, dayScheduleId: slot.dayScheduleId,
      bookingId: `TEST-${createdAt}`, details: { fullName: 'Report boundary test', email: 'report@example.test', mobile: '+12025550123' }, attendanceStatus: 'NOT_PRESENT', createdAt: new Date(createdAt) });
  }
  const report = await (await api(`/api/admin/reports?eventId=${eventId}&from=2026-03-08&to=2026-03-08&timeZone=America%2FNew_York`, { headers: { Cookie: cookie } })).json();
  assert.ok(report.success, JSON.stringify(report));
  assert.equal(report.timeZone, 'America/New_York');
  assert.equal(report.bookings.length, 2);
  assert.equal(report.charts.registrationTrend[0].registered, 2);
});

test('editing timezone cannot silently move an existing reservation', async () => {
  const eventId = eventIds[0];
  const response = await api(`/api/events/${eventId}`, { method: 'PUT', headers: { Cookie: cookie }, body: eventForm({ timeZone: 'America/New_York' }) });
  assert.equal(response.status, 409, await response.text());
  assert.equal((await db.collection('events').findOne({ _id: eventId }))?.timeZone, 'Asia/Kolkata');
});
