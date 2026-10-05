import { test, expect, type Page } from '@playwright/test';
import { ObjectId } from 'mongodb';
import { baseURL, createTestAdmin, signTestAdminCookie, testDatabase } from '../helpers/test-app';
import { bookingFixture, bookingPayload, removeBookingFixtures, submitBooking } from '../helpers/booking-fixture';

let admin: Awaited<ReturnType<typeof createTestAdmin>>;
const events: string[] = [];
test.beforeAll(async () => { admin = await createTestAdmin(); });
test.afterAll(async () => {
  const { db, client } = await testDatabase(); await removeBookingFixtures(db, events);
  await db.collection('adminusers').deleteOne({ username: admin.username });
  await db.collection('adminactivitylogs').deleteMany({ admin: admin.username }); await client.close();
});
async function fixture(template = 'practitioner-institutional') {
  const { db, client } = await testDatabase(); const f = await bookingFixture(db); events.push(f.eventId);
  await db.collection('events').updateOne({ _id: new ObjectId(f.eventId) }, { $set: { bookingFormTemplate: template } });
  await client.close(); return f;
}
async function authenticate(page: Page, cookie = admin.cookie) {
  await page.context().addCookies(cookie.split('; ').map(pair => { const at = pair.indexOf('=');
    return { name: pair.slice(0, at), value: pair.slice(at + 1), url: baseURL }; }));
}
async function namedControls(page: Page) {
  const missing = await page.locator('input:not([type=hidden]), select, textarea, button').evaluateAll(elements => elements
    .filter(element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden')
    .filter(element => {
      const labels = (element as HTMLInputElement).labels;
      const labelledBy = element.getAttribute('aria-labelledby')?.split(' ').map(id => document.getElementById(id)?.textContent || '').join('');
      return !(element.getAttribute('aria-label') || labelledBy || element.getAttribute('title') ||
        (labels && Array.from(labels).map(label => label.textContent).join('')) ||
        (element.tagName === 'BUTTON' && element.textContent?.trim()));
    }).map(element => element.outerHTML.slice(0, 240)));
  expect.soft(missing, page.url()).toEqual([]);
}
async function keyboardDialog(page: Page, name: string) {
  const dialog = page.getByRole('dialog', { name, exact: true }); await expect(dialog).toBeVisible();
  await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  const controls = dialog.locator('button:visible:not(:disabled), a[href]:visible, input:visible:not(:disabled), select:visible:not(:disabled)');
  await controls.first().focus(); await page.keyboard.press('Shift+Tab'); await expect(controls.last()).toBeFocused();
  await page.keyboard.press('Tab'); await expect(controls.first()).toBeFocused();
  await namedControls(page); await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
}

for (const template of ['practitioner-institutional', 'template-2']) {
  test(`${template} registration controls have names and visible labels focus their inputs`, async ({ page }) => {
    const f = await fixture(template);
    await page.route('**/api/location/countries', route => route.fulfill({ json: { success: true, countries: [{ name: 'India', iso2: 'IN', callingCode: '+91', flag: 'IN' }] } }));
    await page.route('**/api/location/states?*', route => route.fulfill({ json: { success: true, states: [] } }));
    await page.goto(`/events/${f.eventId}/book`);
    await expect(page.locator('[name=fullName]')).toBeVisible(); await namedControls(page);
    const input = page.locator('[name=fullName]'); const id = await input.getAttribute('id');
    await page.locator(`label[for="${id}"]`).click(); await expect(input).toBeFocused();
    await page.getByLabel(/Full Name/).fill('Keyboard Attendee');
  });
}

test('event forms and user-management dialogs expose labels and keyboard behavior', async ({ page }) => {
  test.setTimeout(90000); const f = await fixture(); await authenticate(page);
  for (const path of ['/admin/eventmanagement/new', `/admin/eventmanagement/${f.eventId}/edit`]) {
    await page.goto(path); await expect(page.getByPlaceholder('Enter event name')).toBeVisible(); await namedControls(page);
    await page.getByLabel('Event Name', { exact: false }).focus(); await expect(page.getByPlaceholder('Enter event name')).toBeFocused();
  }
  await authenticate(page, signTestAdminCookie({ username: 'puneet', role: 'superadmin', permissions: [], loggedInAt: Date.now() }));
  await page.goto('/admin/auth'); const add = page.getByRole('button', { name: 'Add User', exact: true }); await add.click();
  await page.getByLabel('Full Name', { exact: true }).fill('Keyboard Test');
  await keyboardDialog(page, 'Add user'); await expect(add).toBeFocused();
});

test('booking deletion and desktop/mobile logout dialogs trap and restore focus', async ({ page }) => {
  test.setTimeout(90000); const f = await fixture(); const booking = await submitBooking(bookingPayload(f)); await authenticate(page);
  await page.goto(`/admin/bookings/${booking.body.booking.id}`);
  const remove = page.getByRole('button', { name: 'Delete', exact: true }); await remove.click();
  await keyboardDialog(page, 'Delete booking'); await expect(remove).toBeFocused();
  const logout = page.getByRole('button', { name: 'Log out', exact: true }); await logout.click();
  await keyboardDialog(page, 'Log out'); await expect(logout).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  const navigation = page.getByRole('button', { name: 'Open navigation' }); await navigation.click();
  const drawer = page.getByRole('dialog', { name: 'Admin navigation' }); await expect(drawer).toBeVisible();
  await drawer.getByRole('button', { name: 'Log out', exact: true }).click();
  await keyboardDialog(page, 'Log out'); await expect(drawer).toBeVisible();
  await page.keyboard.press('Escape'); await expect(drawer).toHaveCount(0); await expect(navigation).toBeFocused();
});

test('catalogue, ticket and admin page controls have accessible names', async ({ page }) => {
  test.setTimeout(90000); await authenticate(page);
  for (const path of ['/events', '/events/mytickets', '/admin/eventmanagement', '/admin/bookings', '/admin/check-in', '/admin/reports']) {
    await page.goto(path); await expect(page.locator('main').first()).toBeVisible();
    await expect(page.getByText('Checking your session...')).toHaveCount(0);
    await namedControls(page);
  }
});
