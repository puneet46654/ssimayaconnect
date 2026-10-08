import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ObjectId, type Db, type MongoClient } from 'mongodb';
import { api, testDatabase } from '../helpers/test-app';
import { bookingFixture, bookingPayload, removeBookingFixtures, submitBooking } from '../helpers/booking-fixture';

let db: Db, client: MongoClient;
const events: string[] = [];
before(async () => { ({ db, client } = await testDatabase()); });
after(async () => {
  if (!db) return;
  await removeBookingFixtures(db, events);
  await client.close();
});

/** A booking fixture with a second slot on the same day to move into. */
async function fixture(capacity = 10, secondCapacity = 10) {
  const f = await bookingFixture(db, capacity);
  events.push(f.eventId);
  const otherSlotId = new ObjectId();
  await db.collection('slots').insertOne({ _id: otherSlotId, eventId: new ObjectId(f.eventId), dayScheduleId: new ObjectId(f.dayScheduleId),
    startTime: '09:00', endTime: '09:30', capacity: secondCapacity, bookedCount: 0 });
  return { ...f, otherSlotId: String(otherSlotId) };
}
const bookedCount = async (slotId: string) => (await db.collection('slots').findOne({ _id: new ObjectId(slotId) }))?.bookedCount;
const reschedule = (cookie: string, body: Record<string, string>) => api('/api/bookings', {
  method: 'PATCH', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const cancel = (cookie: string, bookingId: string) => api(`/api/bookings?bookingId=${bookingId}`, { method: 'DELETE', headers: { Cookie: cookie } });

test('only the booking device can reschedule, and seats move between slots', async () => {
  const f = await fixture();
  const a = await submitBooking(bookingPayload(f, '1'));
  assert.equal(a.response.status, 201, JSON.stringify(a.body));
  const bookingId = a.body.booking.bookingId;
  const body = { bookingId, dayScheduleId: f.dayScheduleId, slotId: f.otherSlotId };

  assert.equal((await reschedule('', body)).status, 403);
  const moved = await reschedule(a.cookie, body);
  assert.equal(moved.status, 200, await moved.clone().text());
  assert.equal((await moved.json()).booking.slotId, f.otherSlotId);
  assert.equal(await bookedCount(f.slotId), 0);
  assert.equal(await bookedCount(f.otherSlotId), 1);
  assert.equal((await reschedule(a.cookie, body)).status, 409, 'moving into the current slot is rejected');
});

test('rescheduling into a full slot keeps the original seat', async () => {
  const f = await fixture(10, 1);
  const a = await submitBooking(bookingPayload(f, '1'));
  const b = await submitBooking({ ...bookingPayload(f, '2'), slotId: f.otherSlotId });
  assert.equal(b.response.status, 201, JSON.stringify(b.body));
  const full = await reschedule(a.cookie, { bookingId: a.body.booking.bookingId, dayScheduleId: f.dayScheduleId, slotId: f.otherSlotId });
  assert.equal(full.status, 409);
  assert.equal(await bookedCount(f.slotId), 1);
  assert.equal(await bookedCount(f.otherSlotId), 1);
});

test('cancel needs the booking device and frees the seat; checked-in or started bookings cannot change', async () => {
  const f = await fixture();
  const a = await submitBooking(bookingPayload(f, '1'));
  const b = await submitBooking(bookingPayload(f, '2'));
  const c = await submitBooking(bookingPayload(f, '3'));
  assert.equal(await bookedCount(f.slotId), 3);

  assert.equal((await cancel(b.cookie, a.body.booking.bookingId)).status, 403, 'another booking\'s cookie is not enough');
  assert.equal((await cancel(a.cookie, a.body.booking.bookingId)).status, 200);
  assert.equal(await db.collection('bookings').countDocuments({ bookingId: a.body.booking.bookingId }), 0);
  assert.equal(await bookedCount(f.slotId), 2);

  await db.collection('bookings').updateOne({ bookingId: b.body.booking.bookingId }, { $set: { attendanceStatus: 'PRESENT' } });
  assert.equal((await cancel(b.cookie, b.body.booking.bookingId)).status, 409);

  await db.collection('slots').updateOne({ _id: new ObjectId(f.slotId) }, { $set: { startTime: '00:00' } });
  await db.collection('dayschedules').updateOne({ _id: new ObjectId(f.dayScheduleId) }, { $set: { date: new Date(new Date().setUTCHours(0, 0, 0, 0) - 86400000) } });
  assert.equal((await cancel(c.cookie, c.body.booking.bookingId)).status, 409);
  assert.equal(await bookedCount(f.slotId), 2);
});

test('My Tickets marks only this device\'s upcoming bookings as manageable', async () => {
  const f = await fixture();
  const a = await submitBooking(bookingPayload(f, '1'));
  const lookup = (cookie: string) => api('/api/events/mytickets', {
    method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ mobile: '+919876540001' }) });
  const mine = (await (await lookup(a.cookie)).json()).tickets.find((t: { bookingId: string }) => t.bookingId === a.body.booking.bookingId);
  const theirs = (await (await lookup('')).json()).tickets.find((t: { bookingId: string }) => t.bookingId === a.body.booking.bookingId);
  assert.equal(mine?.canManage, true);
  assert.equal(theirs?.canManage, false);
});
