import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { ObjectId } from 'mongodb';
import { api, baseURL, createTestAdmin, testDatabase } from '../helpers/test-app';
import { removeBookingFixtures } from '../helpers/booking-fixture';
import { calendarDate, DAY_MS, zonedDate } from '../../lib/events/dates';

type Slot = { _id: string; remaining: number; bookedCount: number; capacity: number };
type Day = { _id: string; date: string; slots: Slot[] };
type Attendee = { fullName: string; email: string; mobile: string; countryCode: string };
async function run() {
  const arrivals = Number(process.env.SCENARIO_ARRIVALS || 100);
  assert.ok([100, 120].includes(arrivals), 'Use the agreed 100 or 120 new attendees per event/day.');
  const { db, client } = await testDatabase();
  const admin = await createTestAdmin();
  const eventIds: string[] = [];
  const samples: number[] = [];
  const records: Record<string, unknown>[] = [];
  const zones = ['Europe/Madrid', 'Asia/Colombo', 'Asia/Jakarta'];
  const scenarios: { id: string; zone: string; days: Day[]; waiting: Attendee[]; confirmed: string[] }[] = [];
  const started = Date.now();
  let nextAttendee = 1;
  try {
    // Create the same three-day, 60-slot schedule through the real admin API.
    for (const zone of zones) {
      const first = new Date(zonedDate(new Date(), zone));
      const dates = [1, 2, 3].map(offset => calendarDate(new Date(first.getTime() + offset * DAY_MS)));
      const form = new FormData();
      for (const [key, value] of Object.entries({ eventName: `Event-day load ${zone} ${randomUUID()}`, eventType: 'conference',
        bookingFormTemplate: 'practitioner-institutional', venue: 'Isolated synthetic venue', description: 'Event-day verification',
        numberOfDays: '3', startDate: dates[0], endDate: dates[2], timeZone: zone,
        daySchedules: JSON.stringify(dates.map(date => ({ date, startTime: '08:00', endTime: '18:00', slotDuration: 10,
          slotGap: 0, capacity: 1, lunchEnabled: false, sameAsDay1: false }))) })) form.set(key, value);
      const response = await api('/api/events', { method: 'POST', headers: { Cookie: admin.cookie }, body: form });
      const result = await response.json(); assert.equal(response.status, 201, JSON.stringify(result)); eventIds.push(result.eventId);
      const slots = await (await api(`/api/events/${result.eventId}/slots`)).json();
      assert.equal(slots.days.length, 3); assert.equal(slots.event.timeZone, zone);
      for (const day of slots.days) assert.equal(day.slots.length, 60);
      scenarios.push({ id: result.eventId, zone, days: slots.days, waiting: [], confirmed: [] });
    }
    for (let dayIndex = 0; dayIndex < 3; dayIndex++) {
      const jobs: { event: typeof scenarios[number]; attendee: Attendee; slot: Slot; day: Day }[][] = [];
      for (const event of scenarios) {
        const candidates = event.waiting.concat(Array.from({ length: arrivals }, () => {
          const id = nextAttendee++;
          return { fullName: `Synthetic attendee ${id}`, email: `load-${id}@example.test`, mobile: `98765${String(id).padStart(5, '0')}`, countryCode: '+91' };
        }));
        event.waiting = [];
        jobs.push(candidates.map((attendee, index) => ({ event, attendee, slot: event.days[dayIndex].slots[index % 60], day: event.days[dayIndex] })));
      }
      // Interleave events so all three are active together, with 30 requests in flight.
      const queue = Array.from({ length: jobs[0].length }, (_, index) => jobs.map(list => list[index])).flat();
      let next = 0, conflicts = 0, confirmed = 0;
      const outcomes = await Promise.allSettled(Array.from({ length: 30 }, async () => {
        while (next < queue.length) {
          const job = queue[next++]; const start = performance.now();
          const response = await api('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId: job.event.id, dayScheduleId: job.day._id, slotId: job.slot._id,
              idempotencyKey: randomUUID(), details: job.attendee }), signal: AbortSignal.timeout(15000) });
          const result = await response.json(); samples.push(performance.now() - start);
          if (response.status === 201) { confirmed++; job.event.confirmed.push(result.booking.bookingId); }
          else {
            assert.equal(response.status, 409, JSON.stringify(result));
            assert.match(result.error || result.message, /no longer available/i);
            conflicts++; job.event.waiting.push(job.attendee);
          }
        }
      }));
      for (const outcome of outcomes) if (outcome.status === 'rejected') throw outcome.reason;
      assert.equal(confirmed, 180); assert.equal(conflicts, queue.length - 180);
      for (const event of scenarios) {
        assert.equal(event.waiting.length, (dayIndex + 1) * (arrivals - 60));
        const slots = await (await api(`/api/events/${event.id}/slots`)).json();
        for (let index = 0; index < 3; index++) {
          assert.equal(slots.days[index].slots.reduce((sum: number, slot: Slot) => sum + slot.remaining, 0), index <= dayIndex ? 0 : 60);
        }
        const rows = await db.collection('slots').find({ eventId: new ObjectId(event.id) }).toArray();
        for (const slot of rows) {
          const count = await db.collection('bookings').countDocuments({ slotId: slot._id });
          assert.equal(slot.bookedCount, count); assert.ok(count <= slot.capacity);
        }
        const reportResponse = await api(`/api/admin/reports?eventId=${event.id}`, { headers: { Cookie: admin.cookie } });
        const report = await reportResponse.json(); assert.equal(reportResponse.status, 200, JSON.stringify(report));
        assert.equal(report.summary.totalBookings, (dayIndex + 1) * 60); assert.equal(report.bookings.length, (dayIndex + 1) * 60);
        assert.equal(report.timeZone, event.zone);
        assert.equal(new Set(report.bookings.map((booking: { email: string }) => booking.email)).size, report.bookings.length);
      }
      records.push({ day: dayIndex + 1, attempts: queue.length, confirmed, expectedCapacityConflicts: conflicts,
        waitingPerEvent: scenarios.map(event => event.waiting.length) });
      console.log(JSON.stringify(records.at(-1)));
    }
    // A tomorrow ticket must not gain admission today, and the event relationship remains mandatory.
    for (const event of scenarios) {
      const response = await api('/api/admin/attendance', { method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id, bookingId: event.confirmed[0], method: 'MANUAL' }) });
      assert.equal(response.status, 409, await response.text());
    }
    // Advance only synthetic day-one reservations into their local admission window.
    const checkInsByEvent: { eventId: string; bookingId: string }[][] = [];
    for (const event of scenarios) {
      const date = new Date(zonedDate(new Date(), event.zone));
      const dayScheduleId = new ObjectId(event.days[0]._id);
      await db.collection('events').updateOne({ _id: new ObjectId(event.id) }, { $set: { startDate: date } });
      await db.collection('dayschedules').updateOne({ _id: dayScheduleId }, { $set: { date } });
      await db.collection('slots').updateMany({ dayScheduleId }, { $set: { startTime: '00:00', endTime: '23:59' } });
      const bookings = await db.collection('bookings').find({ eventId: new ObjectId(event.id), dayScheduleId }).toArray();
      assert.equal(bookings.length, 60);
      const eventCheckIns: { eventId: string; bookingId: string }[] = [];
      for (const booking of bookings) {
        const request = { eventId: event.id, bookingId: booking.bookingId as string };
        eventCheckIns.push(request, request); // Two devices may scan the same ticket together.
      }
      checkInsByEvent.push(eventCheckIns);
    }
    const checkIns = Array.from({ length: checkInsByEvent[0].length }, (_, index) => checkInsByEvent.map(list => list[index])).flat();
    let nextScan = 0, marked = 0, duplicates = 0;
    const scanTimes: number[] = [];
    const scanResults = await Promise.allSettled(Array.from({ length: 30 }, async () => {
      while (nextScan < checkIns.length) {
        const request = checkIns[nextScan++]; const start = performance.now();
        const response = await api('/api/admin/attendance', { method: 'POST',
          headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...request, method: 'MANUAL' }), signal: AbortSignal.timeout(15000) });
        const result = await response.json(); scanTimes.push(performance.now() - start);
        assert.equal(response.status, 200, JSON.stringify(result));
        if (result.alreadyPresent) duplicates++; else marked++;
      }
    }));
    for (const result of scanResults) if (result.status === 'rejected') throw result.reason;
    assert.equal(marked, 180); assert.equal(duplicates, 180);
    for (const event of scenarios) {
      assert.equal(await db.collection('bookings').countDocuments({ eventId: new ObjectId(event.id), attendanceStatus: 'PRESENT' }), 60);
      const response = await api(`/api/admin/reports?eventId=${event.id}`, { headers: { Cookie: admin.cookie } });
      const report = await response.json(); assert.equal(response.status, 200);
      assert.equal(report.summary.present, 60); assert.equal(report.summary.totalBookings, 180);
    }
    scanTimes.sort((a, b) => a - b);
    const attendance = { requests: checkIns.length, marked, duplicates, p95Ms: Math.round(scanTimes[Math.floor(scanTimes.length * .95)]) };
    samples.sort((a, b) => a - b);
    const summary = { baseURL, arrivalsPerEventDay: arrivals, events: 3, days: 3, slotsPerDay: 60, concurrency: 30,
      attempts: samples.length, confirmed: scenarios.reduce((sum, event) => sum + event.confirmed.length, 0),
      p50Ms: Math.round(samples[Math.floor(samples.length * .5)]), p95Ms: Math.round(samples[Math.floor(samples.length * .95)]),
      maxMs: Math.round(samples.at(-1)!), elapsedSeconds: Math.round((Date.now() - started) / 1000), records, attendance };
    await mkdir('playwright-report', { recursive: true });
    await writeFile(`playwright-report/event-day-load-${arrivals}.json`, JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary));
  } finally {
    await removeBookingFixtures(db, eventIds);
    await db.collection('adminusers').deleteOne({ username: admin.username });
    await db.collection('adminactivitylogs').deleteMany({ admin: admin.username });
    await client.close();
  }
}
void run().catch(error => { console.error(error); process.exitCode = 1; });
