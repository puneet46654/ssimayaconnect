import { test, expect, type Page } from '@playwright/test';
import { baseURL, createTestAdmin, testDatabase } from '../helpers/test-app';
import { bookingFixture, bookingPayload, removeBookingFixtures, submitBooking } from '../helpers/booking-fixture';

const admins: string[] = [], events: string[] = [];
async function admin(...args: Parameters<typeof createTestAdmin>) { const user = await createTestAdmin(...args); admins.push(user.username); return user; }
async function login(page: Page, user: Awaited<ReturnType<typeof createTestAdmin>>) {
  await page.goto('/admin/login');
  await page.getByLabel('Login ID').fill(user.username);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.locator('button[type=submit]').click();
}
test.afterAll(async () => {
  const { db, client } = await testDatabase();
  await removeBookingFixtures(db, events);
  await db.collection('adminusers').deleteMany({ username: { $in: admins } });
  await db.collection('adminactivitylogs').deleteMany({ admin: { $in: admins } });
  await client.close();
});

test('view-only navigation and actions match current server permissions, including direct edit URLs', async ({ page }) => {
  const user = await admin(['dashboard', 'events', 'bookings'], { canCreate: false, canDelete: false });
  const { db, client } = await testDatabase();
  const f = await bookingFixture(db); events.push(f.eventId);
  const booking = await submitBooking(bookingPayload(f));
  await login(page, user); await page.waitForURL('**/admin/landing');
  await expect(page.getByRole('link', { name: /Create Event/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Reports & Export/ })).toHaveCount(0);
  await page.goto('/admin/eventmanagement');
  await expect(page.getByRole('link', { name: 'New Event', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Edit Event', exact: true })).toHaveCount(0);
  await page.goto(`/admin/eventmanagement/${f.eventId}/edit`);
  await expect(page.getByText('You have view-only access to events.')).toBeVisible();
  await page.goto(`/admin/bookings/${booking.body.booking.id}?mode=edit`);
  await expect(page.getByRole('heading', { name: 'Booking Details', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save Changes', exact: true })).toHaveCount(0);
  await db.collection('adminusers').updateOne({ username: user.username }, { $set: { permissions: ['reports'] } });
  await page.evaluate(() => window.dispatchEvent(new Event('ssi-admin-session-refresh')));
  await page.waitForURL('**/admin/reports');
  await expect(page.getByRole('link', { name: 'Bookings', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Reports & Export', exact: true })).toBeVisible();
  await client.close();
});

test('expired server authentication clears a fresh-looking client cache without a login loop', async ({ page, context }) => {
  const user = await admin(['bookings']);
  await login(page, user); await page.waitForURL('**/admin/bookings');
  await expect(page.getByRole('link', { name: 'Bookings', exact: true })).toBeVisible();
  await context.clearCookies();
  await page.evaluate(() => window.dispatchEvent(new Event('ssi-admin-session-refresh')));
  await page.waitForURL('**/admin/login');
  expect(await page.evaluate(() => localStorage.getItem('ssi_admin_token'))).toBeNull();
  await page.getByLabel('Login ID').fill(user.username);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.locator('button[type=submit]').click();
  await page.waitForURL('**/admin/bookings');
});

test('login recovers from network, malformed response and rate-limit errors; logout offers retry', async ({ page }) => {
  const user = await admin(['dashboard']);
  let attempt = 0;
  await page.route('**/api/admin/login', async route => {
    attempt++;
    if (attempt === 1) return route.abort('failed');
    if (attempt === 2) return route.fulfill({ status: 200, contentType: 'text/html', body: '<html>unavailable</html>' });
    if (attempt === 3) return route.fulfill({ status: 429, json: { success: false, error: 'Too many failed attempts. Try again in 15 minutes.' } });
    return route.continue();
  });
  await login(page, user);
  await expect(page.getByText('Unable to sign in. Check your connection and retry.')).toBeVisible();
  const submit = page.locator('button[type=submit]');
  await expect(submit).toBeEnabled(); await submit.click();
  await expect(page.getByText('Unable to sign in. Please retry.')).toBeVisible();
  await expect(submit).toBeEnabled(); await submit.click();
  await expect(page.getByText('Too many failed attempts. Try again in 15 minutes.')).toBeVisible();
  await expect(submit).toBeEnabled(); await submit.click();
  await page.waitForURL('**/admin/landing');
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await page.route('**/api/admin/logout', route => route.abort('failed'));
  await page.getByRole('button', { name: 'Log out', exact: true }).last().click();
  await expect(page.getByText('Unable to sign out. Check your connection and retry.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log out', exact: true }).last()).toBeEnabled();
  await page.unroute('**/api/admin/logout');
  await page.getByRole('button', { name: 'Log out', exact: true }).last().click();
  await page.waitForURL('**/admin/login');
  expect(await page.context().cookies(baseURL)).not.toEqual(expect.arrayContaining([expect.objectContaining({ name: 'ssi_admin_session' })]));
});

test('session service failures offer retry and accounts with no modules have a usable login exit', async ({ page }) => {
  const user = await admin([]);
  await page.route('**/api/admin/session', route => route.fulfill({ status: 503, json: { message: 'Temporary test outage' } }));
  await login(page, user);
  await expect(page.getByText('Temporary test outage')).toBeVisible();
  await page.unroute('**/api/admin/session');
  await page.getByRole('button', { name: 'Retry session check' }).click();
  await expect(page.getByText('No admin modules are assigned to this account. Contact your administrator.')).toBeVisible();
  await page.getByRole('button', { name: 'Go to login' }).click();
  await expect(page.getByLabel('Login ID')).toBeVisible();
});
