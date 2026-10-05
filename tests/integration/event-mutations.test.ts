import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ObjectId, type Db, type MongoClient } from 'mongodb';
import { api, createTestAdmin, testDatabase } from '../helpers/test-app';
import { bookingFixture, bookingPayload, removeBookingFixtures, submitBooking } from '../helpers/booking-fixture';
import { zonedDate } from '../../lib/events/dates';

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
async function fixture(capacity = 10) { const f = await bookingFixture(db, capacity); events.push(f.eventId); return f; }
type Fixture = Awaited<ReturnType<typeof fixture>>;
function schedule(f: Fixture, extra = {}) {
  return { date: f.date.slice(0, 10), startTime: '08:00', endTime: '09:00', slotDuration: '30', slotGap: '0',
    lunchEnabled: false, lunchStart: '', lunchEnd: '', capacity: '10', sameAsDay1: false, ...extra };
}
function form(f: Fixture, schedules = [schedule(f)], extra: Record<string, string> = {}) {
  const values = { eventName: 'Edited synthetic event', eventType: 'conference', venue: 'Edited venue', description: 'Edited description',
    startDate: schedules[0].date, endDate: schedules.at(-1)!.date, numberOfDays: String(schedules.length), timeZone: 'Asia/Kolkata',
    daySchedules: JSON.stringify(schedules), ...extra };
  const result = new FormData();
  for (const [key, value] of Object.entries(values)) result.set(key, value);
  return result;
}
const edit = (f: Fixture, body = form(f)) => api(`/api/events/${f.eventId}`, { method: 'PUT', headers: { Cookie: admin.cookie }, body });
const remove = (f: Fixture) => api(`/api/events/${f.eventId}`, { method: 'DELETE', headers: { Cookie: admin.cookie } });
async function snapshot(f: Fixture) {
  const eventId = new ObjectId(f.eventId);
  return { event: await db.collection('events').findOne({ _id: eventId }),
    days: await db.collection('dayschedules').find({ eventId }).sort({ _id: 1 }).toArray(),
    slots: await db.collection('slots').find({ eventId }).sort({ _id: 1 }).toArray() };
}

test('invalid final schedule leaves every original event record unchanged', async () => {
  const f = await fixture(), original = await snapshot(f);
  const nextDate = new Date(new Date(f.date).getTime() + 86400000).toISOString().slice(0, 10);
  const response = await edit(f, form(f, [schedule(f), schedule(f, { date: nextDate, slotDuration: '-1' })]));
  assert.equal(response.status, 400, await response.text());
  assert.deepEqual(await snapshot(f), original);
});

test('real reservations protect dates, times, timezone and capacity even when counters are stale', async () => {
  const f = await fixture();
  for (const suffix of ['1', '2']) assert.equal((await submitBooking(bookingPayload(f, suffix))).response.status, 201);
  await db.collection('slots').updateOne({ _id: new ObjectId(f.slotId) }, { $set: { bookedCount: 0 } });
  const original = await snapshot(f);
  const nextDate = new Date(new Date(f.date).getTime() + 86400000).toISOString().slice(0, 10);
  for (const proposed of [form(f, [schedule(f, { date: nextDate })]), form(f, [schedule(f, { startTime: '08:30' })]),
    form(f, [schedule(f)], { timeZone: 'America/New_York' }), form(f, [schedule(f, { capacity: '1' })])]) {
    const response = await edit(f, proposed);
    assert.equal(response.status, 409, await response.text());
    assert.deepEqual(await snapshot(f), original);
  }
});

test('adding an earlier day preserves booked IDs and dates while ordinary unbooked edits remain possible', async () => {
  const f = await fixture();
  const booked = await submitBooking(bookingPayload(f)); assert.equal(booked.response.status, 201);
  const earlier = new Date(new Date(f.date).getTime() - 86400000).toISOString().slice(0, 10);
  const response = await edit(f, form(f, [schedule(f, { date: earlier }), schedule(f)]));
  assert.equal(response.status, 200, await response.text());
  const records = await snapshot(f);
  assert.equal(records.days.find(day => String(day._id) === f.dayScheduleId)?.dayNumber, 2);
  assert.equal(records.days.find(day => String(day._id) === f.dayScheduleId)?.date.toISOString(), f.date);
  assert.equal(records.slots.find(slot => String(slot._id) === f.slotId)?.bookedCount, 1);
  const stillBooked = await db.collection('bookings').findOne({ _id: new ObjectId(booked.body.booking.id) });
  assert.equal(String(stillBooked?.slotId), f.slotId);
  assert.equal(String(stillBooked?.dayScheduleId), f.dayScheduleId);
  const unbooked = await fixture();
  assert.equal((await edit(unbooked, form(unbooked, [schedule(unbooked, { date: earlier, startTime: '10:00', endTime: '11:00' })]))).status, 200);
});

test('a slot write failure rolls back event creation and all edit records', async () => {
  const f = await fixture(), original = await snapshot(f);
  // Only synthetic records in the isolated database can match this validator.
  await db.command({ collMod: 'slots', validator: { $nor: [{ eventId: new ObjectId(f.eventId), capacity: 7 }, { capacity: 19, startTime: '17:17' }] }, validationLevel: 'strict' });
  try {
    assert.equal((await edit(f, form(f, [schedule(f, { capacity: '7' })]))).status, 500);
    assert.deepEqual(await snapshot(f), original);
    const name = `Creation rollback ${f.eventId}`;
    const response = await api('/api/events', { method: 'POST', headers: { Cookie: admin.cookie },
      body: form(f, [schedule(f, { capacity: '19', startTime: '17:17', endTime: '18:17' })], { eventName: name }) });
    assert.equal(response.status, 500);
    assert.equal(await db.collection('events').countDocuments({ eventName: name }), 0);
    assert.equal(await db.collection('slots').countDocuments({ capacity: 19, startTime: '17:17' }), 0);
  } finally { await db.command({ collMod: 'slots', validator: {}, validationLevel: 'strict' }); }
});

test('concurrent schedule removal and booking cannot strand a reservation', async () => {
  for (let i = 0; i < 3; i++) {
    const f = await fixture();
    const [edited, booked] = await Promise.all([edit(f, form(f, [schedule(f, { startTime: '08:30' })])), submitBooking(bookingPayload(f))]);
    assert.ok([200, 409].includes(edited.status));
    assert.ok([201, 400, 409].includes(booked.response.status), JSON.stringify(booked.body));
    assert.equal(edited.status === 200 && booked.response.status === 201, false);
    if (booked.response.status === 201) {
      const records = await snapshot(f);
      assert.equal(records.slots.find(slot => String(slot._id) === f.slotId)?.startTime, '08:00');
      assert.equal(records.slots.find(slot => String(slot._id) === f.slotId)?.bookedCount, 1);
    } else assert.equal(await db.collection('bookings').countDocuments({ eventId: new ObjectId(f.eventId) }), 0);
  }
});

test('booked cancellation preserves ticket history and denies admission across all APIs', async () => {
  const f = await fixture(); const booked = await submitBooking(bookingPayload(f)); assert.equal(booked.response.status, 201);
  const eventId = new ObjectId(f.eventId), today = new Date(zonedDate(new Date(), 'Asia/Kolkata'));
  await db.collection('events').updateOne({ _id: eventId }, { $set: { startDate: today, endDate: today, status: 'LIVE' } });
  for (let i = 0; i < 2; i++) {
    const response = await remove(f); assert.equal(response.status, 200); assert.equal((await response.json()).cancelled, true);
  }
  assert.equal(await db.collection('bookings').countDocuments({ eventId }), 1);
  assert.equal(await db.collection('slots').countDocuments({ eventId }), 1);
  assert.equal(await db.collection('dayschedules').countDocuments({ eventId }), 1);
  assert.equal((await edit(f)).status, 409);
  assert.equal((await submitBooking(bookingPayload(f, '2'))).response.status, 409);
  const ticket = await (await api(`/api/bookings?bookingId=${booked.body.booking.bookingId}`, { headers: { Cookie: booked.cookie } })).json();
  assert.equal(ticket.booking.status, 'CANCELLED'); assert.equal(ticket.booking.qrData, '');
  const recovered = await (await api('/api/events/mytickets', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingId: booked.body.booking.bookingId, mobile: '+919876540001' }) })).json();
  assert.equal(recovered.tickets[0].status, 'CANCELLED');
  for (const path of [`/api/events/${f.eventId}`, `/api/events/${f.eventId}/slots`]) {
    const data = await (await api(path)).json(); assert.equal(data.event.status, 'CANCELLED');
    if (data.days) assert.ok(data.days.every((day: { slots: { available: boolean }[] }) => day.slots.every(slot => !slot.available)));
  }
  const headers = { Cookie: admin.cookie };
  const report = await (await api(`/api/admin/reports?eventId=${f.eventId}`, { headers })).json();
  assert.equal(report.eventOptions.find((event: { id: string }) => event.id === f.eventId).status, 'CANCELLED');
  const dashboard = await (await api('/api/admin/dashboard', { headers })).json();
  assert.ok(!dashboard.upcomingEvents.some((event: { id: string }) => event.id === f.eventId));
  const checkin = await api('/api/admin/attendance', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId: f.eventId, bookingId: booked.body.booking.bookingId, method: 'MANUAL' }) });
  assert.equal(checkin.status, 409);
  const list = await (await api(`/api/admin/bookings?eventId=${f.eventId}`, { headers })).json();
  assert.equal(list.bookings[0].event.status, 'CANCELLED');
});

test('empty events delete normally; concurrent deletion and booking leave no orphans', async () => {
  const empty = await fixture(); const removed = await remove(empty);
  assert.equal(removed.status, 200); assert.equal((await removed.json()).cancelled, false);
  assert.deepEqual(await snapshot(empty), { event: null, days: [], slots: [] });
  for (let i = 0; i < 3; i++) {
    const f = await fixture();
    const [deleted, booked] = await Promise.all([remove(f), submitBooking(bookingPayload(f))]);
    assert.equal(deleted.status, 200);
    const records = await snapshot(f);
    if (booked.response.status === 201) {
      assert.equal(records.event?.status, 'CANCELLED');
      assert.equal(records.days.length, 1); assert.equal(records.slots.length, 1);
    } else {
      assert.ok([404, 409].includes(booked.response.status), JSON.stringify(booked.body));
      assert.equal(await db.collection('bookings').countDocuments({ eventId: new ObjectId(f.eventId) }), 0);
    }
  }
});

test('capacity edits and cancellation serialize against booking and check-in', async () => {
  const f = await fixture(2);
  assert.equal((await submitBooking(bookingPayload(f))).response.status, 201);
  const [edited, second] = await Promise.all([edit(f, form(f, [schedule(f, { capacity: '1' })])), submitBooking(bookingPayload(f, '2'))]);
  assert.ok([200, 409].includes(edited.status));
  assert.ok([201, 409].includes(second.response.status));
  const slot = await db.collection('slots').findOne({ _id: new ObjectId(f.slotId) });
  assert.ok(slot && slot.bookedCount <= slot.capacity);
  assert.equal(slot.bookedCount, await db.collection('bookings').countDocuments({ slotId: slot._id }));
  const live = await fixture(); const ticket = await submitBooking(bookingPayload(live));
  const today = new Date(zonedDate(new Date(), 'Asia/Kolkata'));
  await db.collection('events').updateOne({ _id: new ObjectId(live.eventId) }, { $set: { startDate: today, endDate: today } });
  await db.collection('dayschedules').updateOne({ _id: new ObjectId(live.dayScheduleId) }, { $set: { date: today } });
  await db.collection('slots').updateOne({ _id: new ObjectId(live.slotId) }, { $set: { startTime: '00:00', endTime: '23:59' } });
  const checkin = () => api('/api/admin/attendance', { method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId: live.eventId, bookingId: ticket.body.booking.bookingId, method: 'MANUAL' }) });
  const [removed, admitted] = await Promise.all([remove(live), checkin()]);
  assert.equal(removed.status, 200); assert.ok([200, 409].includes(admitted.status), await admitted.text());
  const recorded = await db.collection('bookings').findOne({ _id: new ObjectId(ticket.body.booking.id) });
  assert.equal(recorded?.attendanceStatus, admitted.status === 200 ? 'PRESENT' : 'NOT_PRESENT');
  assert.equal((await checkin()).status, 409, 'Check-in cannot succeed after cancellation commits.');
});
