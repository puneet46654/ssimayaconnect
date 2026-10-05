import { test, expect } from '@playwright/test';
import { ObjectId } from 'mongodb';
import { testDatabase } from '../helpers/test-app';
import { bookingFixture, bookingPayload, removeBookingFixtures, submitBooking } from '../helpers/booking-fixture';

test('losing the last slot allows next-day booking without duplicating a reservation', async ({ page }) => {
  const { db, client } = await testDatabase(); const f = await bookingFixture(db, 1);
  try {
    const secondDay = new ObjectId(), secondSlot = new ObjectId(), date = new Date(Date.parse(f.date) + 86400000);
    const schedule = await db.collection('dayschedules').findOne({ _id: new ObjectId(f.dayScheduleId) });
    const slot = await db.collection('slots').findOne({ _id: new ObjectId(f.slotId) });
    await db.collection('dayschedules').insertOne({ ...schedule, _id: secondDay, dayNumber: 2, date });
    await db.collection('slots').insertOne({ ...slot, _id: secondSlot, dayScheduleId: secondDay });
    await db.collection('events').updateOne({ _id: new ObjectId(f.eventId) }, { $set: { numberOfDays: 2, endDate: date } });
    const details = bookingPayload(f, '1', { fullName: 'Next Day Attendee' }).details;
    await page.goto('/events/mytickets');
    await page.evaluate(({ id, details }) => sessionStorage.setItem(`ssi-booking-details:${id}`, JSON.stringify(details)), { id: f.eventId, details });
    await page.goto(`/events/${f.eventId}/book/slots`);
    await page.getByRole('button', { name: /08:00.*08:30/ }).click();
    let competing = false;
    await page.route('**/api/bookings', async route => {
      if (!competing && route.request().method() === 'POST') {
        competing = true;
        // Another real attendee takes the last seat after our selection but before our submission.
        const other = await submitBooking(bookingPayload(f, '2')); expect(other.response.status).toBe(201);
      }
      await route.continue();
    });
    const rejected = page.waitForResponse(response => response.url().endsWith('/api/bookings') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Continue', exact: true }).filter({ visible: true }).click();
    expect((await rejected).status()).toBe(409);
    await page.getByRole('button', { name: 'Choose Another Time', exact: true }).click();
    await page.waitForURL('**/book/slots');
    const dates = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Select a date', exact: true }) });
    await dates.getByRole('button').nth(1).click();
    await page.getByRole('button', { name: /08:00.*08:30/ }).click();
    const confirmed = page.waitForResponse(response => response.url().endsWith('/api/bookings') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Continue', exact: true }).filter({ visible: true }).click();
    const response = await confirmed; expect(response.status()).toBe(201); const ticket = await response.json();
    await expect(page.getByText('Next Day Attendee', { exact: true })).toBeVisible();
    expect(ticket.booking.slotId).toBe(String(secondSlot));
    expect(await db.collection('bookings').countDocuments({ eventId: new ObjectId(f.eventId), 'details.email': details.email })).toBe(1);
    for (const id of [new ObjectId(f.slotId), secondSlot]) {
      expect(await db.collection('bookings').countDocuments({ slotId: id })).toBe(1);
      expect((await db.collection('slots').findOne({ _id: id }))?.bookedCount).toBe(1);
    }
  } finally { await removeBookingFixtures(db, [f.eventId]); await client.close(); }
});
