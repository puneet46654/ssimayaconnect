import { ObjectId, type Db } from 'mongodb';
import { randomUUID } from 'node:crypto';
import { api } from './test-app';

export async function bookingFixture(db: Db, capacity = 10) {
  const eventId = new ObjectId(), dayScheduleId = new ObjectId(), slotId = new ObjectId();
  const date = new Date(Date.now() + 7 * 86400000);
  date.setUTCHours(0, 0, 0, 0);
  await db.collection('events').insertOne({ _id: eventId, eventName: 'Isolated booking test', eventType: 'conference',
    bookingFormTemplate: 'practitioner-institutional', venue: 'Test venue', description: 'Synthetic event',
    numberOfDays: 1, startDate: date, endDate: date, timeZone: 'Asia/Kolkata', status: 'UPCOMING', imageUrl: '',
    createdAt: new Date(), updatedAt: new Date() });
  await db.collection('dayschedules').insertOne({ _id: dayScheduleId, eventId, dayNumber: 1, date,
    startTime: '08:00', endTime: '18:00', slotDuration: 30, slotGap: 0, capacity, lunchEnabled: false });
  await db.collection('slots').insertOne({ _id: slotId, eventId, dayScheduleId, startTime: '08:00', endTime: '08:30', capacity, bookedCount: 0 });
  return { eventId: String(eventId), dayScheduleId: String(dayScheduleId), slotId: String(slotId), date: date.toISOString() };
}

export function bookingPayload(fixture: Awaited<ReturnType<typeof bookingFixture>>, suffix = '1', overrides: Record<string, string> = {}) {
  return { eventId: fixture.eventId, dayScheduleId: fixture.dayScheduleId, slotId: fixture.slotId, idempotencyKey: randomUUID(),
    details: { fullName: `Test Attendee ${suffix}`, email: `attendee-${suffix}@example.test`, mobile: `987654${suffix.padStart(4, '0')}`, countryCode: '+91', ...overrides } };
}

export async function submitBooking(payload: ReturnType<typeof bookingPayload>) {
  const response = await api('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return { response, body: await response.json(), cookie: response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ') };
}

export async function removeBookingFixtures(db: Db, ids: string[]) {
  const eventId = { $in: ids.map(id => new ObjectId(id)) };
  for (const name of ['bookings', 'slots', 'dayschedules']) await db.collection(name).deleteMany({ eventId });
  await db.collection('events').deleteMany({ _id: eventId });
}
