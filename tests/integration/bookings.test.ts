import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { ObjectId, type Db, type MongoClient } from 'mongodb';
import { api, createTestAdmin, testDatabase } from '../helpers/test-app';
import { bookingFixture, bookingPayload, removeBookingFixtures, submitBooking } from '../helpers/booking-fixture';

let db: Db, client: MongoClient;
let admin: Awaited<ReturnType<typeof createTestAdmin>>;
const events: string[] = [];
before(async () => { ({ db, client } = await testDatabase()); admin = await createTestAdmin(); });
after(async () => {
  if (!db) return;
  await removeBookingFixtures(db, events);
  if (admin) {
    await db.collection('adminusers').deleteOne({ username: admin.username });
    await db.collection('adminactivitylogs').deleteMany({ admin: admin.username });
  }
  await client.close();
});
async function fixture(capacity = 10) { const result = await bookingFixture(db, capacity); events.push(result.eventId); return result; }
async function occupancy(slotId: string, expected: number) {
  assert.equal(await db.collection('bookings').countDocuments({ slotId: new ObjectId(slotId) }), expected);
  assert.equal((await db.collection('slots').findOne({ _id: new ObjectId(slotId) }))?.bookedCount, expected);
}

test('concurrent retries create exactly one booking and return the same ticket', async () => {
  const f = await fixture(); const payload = bookingPayload(f);
  const results = await Promise.all(Array.from({ length: 6 }, () => submitBooking(payload)));
  assert.equal(results.filter(r => r.response.status === 201).length, 1, JSON.stringify(results.map(r => r.body)));
  assert.equal(results.filter(r => r.response.status === 200).length, 5);
  assert.equal(new Set(results.map(r => r.body.booking.bookingId)).size, 1);
  await occupancy(f.slotId, 1);
  const reused = await submitBooking({ ...payload, details: { ...payload.details, fullName: 'Someone else' } });
  assert.equal(reused.response.status, 409); assert.equal(reused.body.booking, undefined);
  assert.equal(reused.cookie, '');
});

test('one email or mobile can hold several tickets for the same event', async () => {
  const f = await fixture(); const payload = bookingPayload(f);
  const results = await Promise.all([submitBooking(payload), submitBooking({ ...payload, idempotencyKey: randomUUID() })]);
  assert.equal(results.filter(r => r.response.status === 201).length, 2, JSON.stringify(results.map(r => r.body)));
  assert.equal(new Set(results.map(r => r.body.booking.bookingId)).size, 2);
  const byEmail = await submitBooking(bookingPayload(f, '2', { email: 'ATTENDEE-1@EXAMPLE.TEST' }));
  const byPhone = await submitBooking(bookingPayload(f, '3', { mobile: '+91 9876540001', countryCode: '+1' }));
  assert.equal(byEmail.response.status, 201); assert.equal(byPhone.response.status, 201);
  await occupancy(f.slotId, 4);
});

test('a browser can access two attendees in one slot and recovery requires full reference/contact match', async () => {
  const f = await fixture();
  const a = await submitBooking(bookingPayload(f, '1'));
  const b = await submitBooking(bookingPayload(f, '2', { mobile: '9876540001', countryCode: '+44' }));
  assert.equal(a.response.status, 201, JSON.stringify(a.body)); assert.equal(b.response.status, 201, JSON.stringify(b.body));
  const combined = [a.cookie, b.cookie].join('; ');
  for (const result of [a, b]) {
    const ref = result.body.booking.bookingId;
    assert.equal((await api(`/api/bookings?bookingId=${ref}`)).status, 403);
    const reopened = await api(`/api/bookings?bookingId=${ref}`, { headers: { Cookie: combined } });
    assert.equal(reopened.status, 200); assert.equal((await reopened.json()).booking.details.fullName, result.body.booking.details.fullName);
  }
  assert.equal((await api(`/api/events/mytickets?email=attendee-1@example.test&mobile=919876540001`)).status, 403);
  const recover = (mobile: string, bookingId = a.body.booking.bookingId) => api('/api/events/mytickets', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mobile, bookingId }) });
  assert.equal((await recover('9876540001')).status, 404);
  assert.equal((await recover('+449876540001')).status, 404);
  assert.equal((await recover('+919876540001', '')).status, 400);
  const recovered = await recover('+91 98765-40001');
  assert.equal(recovered.status, 200);
  const grant = recovered.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  assert.equal((await recovered.json()).tickets.length, 1);
  assert.equal((await api(`/api/bookings?bookingId=${a.body.booking.bookingId}`, { headers: { Cookie: grant } })).status, 200);
  assert.equal((await api(`/api/bookings?bookingId=${b.body.booking.bookingId}`, { headers: { Cookie: grant } })).status, 403);
  await occupancy(f.slotId, 2);
});

test('capacity is based on actual records and concurrent deletes release only their booking', async () => {
  const f = await fixture(2);
  const a = await submitBooking(bookingPayload(f, '1'));
  await db.collection('slots').updateOne({ _id: new ObjectId(f.slotId) }, { $set: { bookedCount: 0 } });
  const candidates = await Promise.all([submitBooking(bookingPayload(f, '2')), submitBooking(bookingPayload(f, '3'))]);
  assert.equal(candidates.filter(r => r.response.status === 201).length, 1);
  assert.equal(candidates.filter(r => r.response.status === 409).length, 1);
  await occupancy(f.slotId, 2);
  const deletions = await Promise.all(Array.from({ length: 4 }, () => api(`/api/admin/bookings/${a.body.booking.id}`, { method: 'DELETE', headers: { Cookie: admin.cookie } })));
  for (const response of deletions) assert.equal(response.status, 200, await response.text());
  await occupancy(f.slotId, 1);
  assert.equal((await submitBooking(bookingPayload(f, '4'))).response.status, 201);
  await occupancy(f.slotId, 2);
});

test('a booking insertion failure rolls back the seat reservation', async () => {
  const f = await fixture();
  // Apply a narrowly scoped validator only in the isolated test database.
  await db.command({ collMod: 'bookings', validator: { 'details.fullName': { $ne: `Reject-${f.eventId}` } }, validationLevel: 'strict' });
  try {
    const result = await submitBooking(bookingPayload(f, '1', { fullName: `Reject-${f.eventId}` }));
    assert.equal(result.response.status, 500);
    await occupancy(f.slotId, 0);
  } finally { await db.command({ collMod: 'bookings', validator: {} }); }
  assert.equal((await submitBooking(bookingPayload(f, '1'))).response.status, 201);
  await occupancy(f.slotId, 1);
});

test('legacy duplicates stay readable and repeat contacts can book and be edited', async () => {
  const f = await fixture();
  const payload = bookingPayload(f, '1');
  const a = await submitBooking(payload);
  const original = await db.collection('bookings').findOne({ _id: new ObjectId(a.body.booking.id) });
  assert.ok(original);
  const { requestKeyHash: _key, requestFingerprint: _fingerprint, ...legacy } = original;
  void _key; void _fingerprint;
  await db.collection('bookings').insertOne({ ...legacy, _id: new ObjectId(), bookingId: `LEGACY-${f.eventId}` });
  assert.equal((await submitBooking({ ...payload, idempotencyKey: randomUUID() })).response.status, 201);
  const b = await submitBooking(bookingPayload(f, '2'));
  const patch = (id: string, details: Record<string, string>) => api(`/api/admin/bookings/${id}`, { method: 'PATCH', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ details }) });
  assert.equal((await patch(a.body.booking.id, { ...payload.details, fullName: 'Renamed legacy attendee' })).status, 200);
  assert.equal((await patch(b.body.booking.id, { ...bookingPayload(f, '2').details, email: payload.details.email })).status, 200);
  assert.equal((await db.collection('bookings').findOne({ _id: new ObjectId(b.body.booking.id) }))?.details.email, payload.details.email);
  await occupancy(f.slotId, 4);
});
