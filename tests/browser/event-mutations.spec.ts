import { test, expect, type BrowserContext } from '@playwright/test';
import { ObjectId } from 'mongodb';
import { baseURL, createTestAdmin, testDatabase } from '../helpers/test-app';
import { bookingFixture, bookingPayload, removeBookingFixtures, submitBooking } from '../helpers/booking-fixture';

const events: string[] = [];
let admin: Awaited<ReturnType<typeof createTestAdmin>>;
test.beforeAll(async () => { admin = await createTestAdmin(); });
test.afterAll(async () => {
  const { db, client } = await testDatabase();
  await removeBookingFixtures(db, events);
  if (admin) {
    await db.collection('adminusers').deleteOne({ username: admin.username });
    await db.collection('adminactivitylogs').deleteMany({ admin: admin.username });
  }
  await client.close();
});
async function fixture() {
  const { db, client } = await testDatabase(); const f = await bookingFixture(db); events.push(f.eventId);
  await db.collection('events').updateOne({ _id: new ObjectId(f.eventId) }, { $set: { eventName: `Scheduling browser ${f.eventId}` } });
  await client.close(); return f;
}
async function cookies(context: BrowserContext, value: string) {
  await context.addCookies(value.split('; ').map(pair => {
    const index = pair.indexOf('='); return { name: pair.slice(0, index), value: pair.slice(index + 1), url: baseURL };
  }));
}

test('create and edit slot previews stay responsive with invalid duration and capacity', async ({ page, context }) => {
  const f = await fixture(); await cookies(context, admin.cookie);
  for (const path of ['/admin/eventmanagement/new', `/admin/eventmanagement/${f.eventId}/edit`]) {
    await page.goto(path);
    const duration = page.locator('input[type="number"]:not([max])').first();
    for (const value of ['-1', '0', '0.5', '5e-324']) {
      await duration.fill(value);
      await expect(duration).toHaveValue(value);
      expect(await page.evaluate(() => document.readyState)).toBe('complete');
    }
    await duration.fill('30');
    const capacity = page.locator('input[type="number"][max="20"]');
    await capacity.fill('21'); await expect(capacity).toHaveValue('21');
    await capacity.fill('5'); await expect(capacity).toHaveValue('5');
    await expect(duration).toHaveValue('30');
  }
});

test('admin cancellation remains visible in history and removes admission from public screens', async ({ page, context }) => {
  test.setTimeout(90000); // Includes first-time compilation of several public and admin routes.
  const f = await fixture(); const booked = await submitBooking(bookingPayload(f));
  expect(booked.response.status).toBe(201);
  await cookies(context, `${admin.cookie}; ${booked.cookie}`);
  await page.goto(`/events/${f.eventId}/book/confirm?bookingId=${booked.body.booking.bookingId}`);
  await expect(page.getByText('Ready for Venue Scan')).toBeVisible();
  const adminPage = await context.newPage();
  await adminPage.goto('/admin/eventmanagement');
  const card = adminPage.locator('article').filter({ hasText: `Scheduling browser ${f.eventId}` });
  await card.getByRole('button', { name: 'Cancel Event', exact: true }).click();
  await expect(adminPage.getByText('Booking history will be retained.', { exact: false })).toBeVisible();
  const response = adminPage.waitForResponse(r => r.url().endsWith(`/api/events/${f.eventId}`) && r.request().method() === 'DELETE');
  await adminPage.getByRole('button', { name: 'Cancel Event', exact: true }).last().click();
  expect((await response).status()).toBe(200);
  await expect(card.getByText('Cancelled', { exact: true })).toBeVisible();
  await expect(card.getByRole('link', { name: 'Edit Event' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Event Cancelled', exact: true })).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('Event cancelled. Not valid for admission.', { exact: true })).toBeVisible();
  await expect(page.getByText('Ready for Venue Scan')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Download Confirmation' })).toHaveCount(0);
  await page.goto(`/events/${f.eventId}/book`);
  await expect(page.getByText('This event has been cancelled.', { exact: false })).toBeVisible();
  await page.goto(`/events/${f.eventId}/book/slots`);
  await expect(page.getByRole('heading', { name: 'Event cancelled' })).toBeVisible();
  await page.goto('/events/mytickets');
  await page.getByLabel('Booking reference').fill(booked.body.booking.bookingId);
  await page.getByLabel('Registered mobile number').fill('+919876540001');
  await page.getByRole('button', { name: 'View Tickets', exact: true }).click();
  await page.getByRole('button', { name: 'View cancellation' }).click();
  await expect(page.getByText('Event cancelled. This ticket is not valid for admission.', { exact: true })).toBeVisible();
  await page.goto('/events');
  await expect(page.getByText(`Scheduling browser ${f.eventId}`, { exact: true })).toHaveCount(0);
  await adminPage.goto(`/admin/eventmanagement/${f.eventId}/edit`);
  await expect(adminPage.getByText('Cancelled events are kept for history and cannot be edited.')).toBeVisible();
});
