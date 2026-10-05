import { test, expect, type Page } from '@playwright/test';
import { ObjectId } from 'mongodb';
import { api, testDatabase } from '../helpers/test-app';
import { bookingFixture, bookingPayload, removeBookingFixtures, submitBooking } from '../helpers/booking-fixture';

const events: string[] = [];
test.afterAll(async () => { const { db, client } = await testDatabase(); await removeBookingFixtures(db, events); await client.close(); });
async function fixture() {
  const { db, client } = await testDatabase();
  const result = await bookingFixture(db); events.push(result.eventId); await client.close(); return result;
}
async function draft(page: Page, f: Awaited<ReturnType<typeof fixture>>, details: ReturnType<typeof bookingPayload>['details']) {
  await page.evaluate(({ f, details }) => {
    sessionStorage.setItem(`ssi-booking-details:${f.eventId}`, JSON.stringify(details));
    sessionStorage.setItem(`ssi-booking-slot:${f.eventId}:latest`, JSON.stringify(f));
  }, { f, details });
}
async function count(f: Awaited<ReturnType<typeof fixture>>) {
  const { db, client } = await testDatabase();
  const result = await db.collection('bookings').countDocuments({ eventId: new ObjectId(f.eventId) });
  await client.close(); return result;
}

test('two attendees can book one slot in the same browser, and reopening uses server details', async ({ page }) => {
  const f = await fixture();
  await page.goto('/events/mytickets');
  await draft(page, f, bookingPayload(f, '1', { fullName: 'Browser Attendee One' }).details);
  const createdA = page.waitForResponse(r => r.url().endsWith('/api/bookings') && r.request().method() === 'POST');
  await page.goto(`/events/${f.eventId}/book/confirm`);
  const a = await (await createdA).json();
  await expect(page.getByText('Browser Attendee One', { exact: true })).toBeVisible();
  await draft(page, f, bookingPayload(f, '2', { fullName: 'Browser Attendee Two' }).details);
  const createdB = page.waitForResponse(r => r.url().endsWith('/api/bookings') && r.request().method() === 'POST');
  await page.reload();
  const b = await (await createdB).json();
  await expect(page.getByText('Browser Attendee Two', { exact: true })).toBeVisible();
  await expect(page.getByText('Browser Attendee One', { exact: true })).toHaveCount(0);
  expect(a.booking.bookingId).not.toBe(b.booking.bookingId);
  expect(await count(f)).toBe(2);
  for (const result of [a, b]) {
    await page.goto(`/events/${f.eventId}/book/confirm?bookingId=${result.booking.bookingId}`);
    await expect(page.getByText(result.booking.details.fullName, { exact: true })).toBeVisible();
  }
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await expect(page.getByText('Browser Attendee Two', { exact: true })).toBeVisible();
});

test('retry after a lost creation response reuses the persisted intent without consuming another seat', async ({ page }) => {
  const f = await fixture();
  await page.goto('/events/mytickets');
  await draft(page, f, bookingPayload(f, '1', { fullName: 'Lost Response Attendee' }).details);
  let lost = false;
  await page.route('**/api/bookings', async route => {
    if (route.request().method() === 'POST' && !lost) {
      lost = true;
      const response = await api('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: route.request().postData() });
      expect(response.status).toBe(201);
      await response.arrayBuffer();
      await route.abort('failed');
    } else await route.continue();
  });
  await page.goto(`/events/${f.eventId}/book/confirm`);
  await expect(page.getByRole('button', { name: 'Try Again', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Try Again', exact: true }).click();
  await expect(page.getByText('Lost Response Attendee', { exact: true })).toBeVisible();
  expect(await count(f)).toBe(1);
});

test('recovery reset clears identity and cache and discards a late response', async ({ page }) => {
  const f = await fixture();
  const a = await submitBooking(bookingPayload(f, '1'));
  const b = await submitBooking(bookingPayload(f, '2'));
  await page.goto('/events/mytickets');
  const mobile = page.getByLabel('Registered mobile number');
  const reference = page.getByLabel('Booking reference');
  await mobile.fill('+919876540001'); await reference.fill(a.body.booking.bookingId);
  await page.getByRole('button', { name: 'View Tickets', exact: true }).click();
  await expect(page.getByText(a.body.booking.bookingId, { exact: true }).first()).toBeVisible();
  await page.evaluate(() => sessionStorage.setItem('ssi-my-tickets-email', 'stale@example.test'));
  await page.getByRole('button', { name: 'Look up another ticket' }).click();
  await expect(mobile).toHaveValue(''); await expect(reference).toHaveValue('');
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(k => k.startsWith('ssi-my-tickets')))).toEqual([]);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let started!: () => void;
  const pending = new Promise<void>(resolve => { started = resolve; });
  await page.route('**/api/events/mytickets', async route => {
    const response = await route.fetch(); started(); await gate;
    await route.fulfill({ response }).catch(() => {});
  });
  await mobile.fill('+919876540001'); await reference.fill(a.body.booking.bookingId);
  await page.getByRole('button', { name: 'View Tickets', exact: true }).click();
  await pending;
  await page.getByRole('button', { name: 'Look up another ticket' }).click();
  release(); await page.unrouteAll({ behavior: 'wait' });
  await mobile.fill('+919876540002'); await reference.fill(b.body.booking.bookingId);
  await page.getByRole('button', { name: 'View Tickets', exact: true }).click();
  await expect(page.getByText(b.body.booking.bookingId, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(a.body.booking.bookingId, { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(b.body.booking.bookingId, { exact: true }).first()).toBeVisible();
});
