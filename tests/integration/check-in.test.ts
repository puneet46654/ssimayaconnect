import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { ObjectId, type Db, type MongoClient } from 'mongodb';
import { api, createTestAdmin, testDatabase } from '../helpers/test-app';
import { bookingFixture, bookingPayload, removeBookingFixtures, submitBooking } from '../helpers/booking-fixture';
import { zonedDate } from '../../lib/events/dates';

let db: Db, client: MongoClient, admin: Awaited<ReturnType<typeof createTestAdmin>>;
const events: string[] = [];
before(async () => { ({ db, client } = await testDatabase()); admin = await createTestAdmin(['check-in'], { role: 'staff', canCreate: false }); });
after(async () => {
  if (!db) return;
  await removeBookingFixtures(db, events); await db.collection('adminusers').deleteOne({ username: admin?.username }); await client.close();
});
async function fixture(timeZone: string) {
  const f = await bookingFixture(db); events.push(f.eventId);
  const ticket = await submitBooking(bookingPayload(f)); assert.equal(ticket.response.status, 201);
  const date = new Date(zonedDate(new Date(), timeZone));
  await db.collection('events').updateOne({ _id: new ObjectId(f.eventId) }, { $set: { timeZone, startDate: date, endDate: date } });
  await db.collection('dayschedules').updateOne({ _id: new ObjectId(f.dayScheduleId) }, { $set: { date } });
  await db.collection('slots').updateOne({ _id: new ObjectId(f.slotId) }, { $set: { startTime: '00:00', endTime: '23:59' } });
  return { ...f, booking: ticket.body.booking, date };
}
async function scan(f: Awaited<ReturnType<typeof fixture>>, qr = false) {
  const response = await api('/api/admin/attendance', { method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId: f.eventId, method: qr ? 'QR' : 'MANUAL', bookingId: f.booking.bookingId, code: f.booking.qrData }) });
  return { response, data: await response.json() };
}
test('staff check-in respects the booked day despite a live event and records concurrent scans once', async () => {
  for (const zone of ['Asia/Kolkata', 'America/New_York', 'Pacific/Auckland']) {
    const f = await fixture(zone);
    for (const offset of [-86400000, 86400000]) {
      await db.collection('dayschedules').updateOne({ _id: new ObjectId(f.dayScheduleId) }, { $set: { date: new Date(f.date.getTime() + offset) } });
      const result = await scan(f); assert.equal(result.response.status, 409); assert.match(result.data.message, /Check-in is available/);
    }
    await db.collection('dayschedules').updateOne({ _id: new ObjectId(f.dayScheduleId) }, { $set: { date: f.date } });
    const results = await Promise.all([scan(f), scan(f, true), scan(f), scan(f, true)]);
    assert.ok(results.every(result => result.response.status === 200), JSON.stringify(results.map(r => r.data)));
    assert.equal(results.filter(result => !result.data.alreadyPresent).length, 1);
    const booking = await db.collection('bookings').findOne({ _id: new ObjectId(f.booking.id) });
    assert.equal(booking?.attendanceStatus, 'PRESENT');
    // Already-present tickets still cannot be validated outside their reserved window.
    await db.collection('slots').updateOne({ _id: new ObjectId(f.slotId) }, { $set: { startTime: '00:00', endTime: '00:01' } });
    assert.equal((await scan(f)).response.status, 409);
  }
});
test('missing or cross-event schedule references never grant admission', async () => {
  const f = await fixture('Asia/Kolkata');
  await db.collection('slots').updateOne({ _id: new ObjectId(f.slotId) }, { $set: { dayScheduleId: new ObjectId() } });
  assert.equal((await scan(f)).response.status, 409);
  assert.equal((await db.collection('bookings').findOne({ _id: new ObjectId(f.booking.id) }))?.attendanceStatus, 'NOT_PRESENT');
});
