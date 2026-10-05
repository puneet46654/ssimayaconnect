import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { ObjectId } from 'mongodb';
import { api, baseURL, createTestAdmin, testDatabase } from '../helpers/test-app';
import { bookingFixture, bookingPayload, removeBookingFixtures, submitBooking } from '../helpers/booking-fixture';

const events: string[] = [];
let admin: Awaited<ReturnType<typeof createTestAdmin>>;
test.beforeAll(async () => { admin = await createTestAdmin(); });
test.afterAll(async () => {
  const { db, client } = await testDatabase();
  await db.collection('feedbacks').deleteMany({ $or: [{ eventId: { $in: events } }, { message: /^Draft browser test/ }] });
  await removeBookingFixtures(db, events);
  await db.collection('adminusers').deleteOne({ username: admin.username });
  await db.collection('adminactivitylogs').deleteMany({ admin: admin.username });
  await client.close();
});
async function fixture(template = 'practitioner-institutional') {
  const { db, client } = await testDatabase(); const f = await bookingFixture(db); events.push(f.eventId);
  await db.collection('events').updateOne({ _id: new ObjectId(f.eventId) }, { $set: { bookingFormTemplate: template, eventName: `Draft browser ${f.eventId}` } });
  await client.close(); return f;
}
async function cookies(context: BrowserContext, value: string) {
  await context.addCookies(value.split('; ').map(pair => { const at = pair.indexOf('='); return { name: pair.slice(0, at), value: pair.slice(at + 1), url: baseURL }; }));
}
const countries = [
  { name: 'India', iso2: 'IN', callingCode: '+91', flag: 'IN' },
  { name: 'United States', iso2: 'US', callingCode: '+1', flag: 'US' },
  { name: 'United Kingdom', iso2: 'GB', callingCode: '+44', flag: 'GB' },
  { name: 'Canada', iso2: 'CA', callingCode: '+1', flag: 'CA' },
];
async function locationLists(page: Page) {
  await page.route('**/api/location/countries', route => route.fulfill({ json: { success: true, countries } }));
  await page.route('**/api/location/states?*', route => route.fulfill({ json: { success: true, states: [] } }));
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = () => { throw new Error('Location must not be requested'); };
    navigator.geolocation.watchPosition = () => { throw new Error('Location must not be requested'); };
  });
}
for (const template of ['practitioner-institutional', 'template-2']) {
  test(`${template} restores independent residence, phone and partial attendee fields across reload and back navigation`, async ({ browser }) => {
    const context = await browser.newContext({ timezoneId: 'America/Los_Angeles' });
    const page = await context.newPage(); await locationLists(page); const f = await fixture(template);
    await page.goto(`${baseURL}/events/${f.eventId}/book`);
    await expect(page.locator('input[name="country"]')).toHaveValue('United States');
    await expect(page.locator('input[name="countryCode"]')).toHaveValue('+1');
    await page.getByRole('button', { name: 'Select phone country code' }).click();
    await page.getByPlaceholder('Search country or code').fill('United Kingdom');
    await page.getByRole('button', { name: /United Kingdom/ }).click();
    await page.getByRole('button', { name: /United States/ }).click();
    await page.getByPlaceholder('Search country', { exact: true }).fill('Canada');
    await page.getByRole('button', { name: /Canada/ }).click();
    for (const [name, value] of Object.entries({ fullName: 'Draft Attendee', specialty: 'Cardiology', mobile: '2025550199', email: 'draft@example.test', hospitalName: 'Test Hospital', state: 'Ontario', city: 'Toronto' })) {
      await page.locator(`[name="${name}"]`).fill(value);
    }
    for (const name of ['title', 'designation']) { const select = page.locator(`select[name="${name}"]`); if (await select.count()) await select.selectOption({ index: 1 }); }
    await page.reload();
    await expect(page.locator('[name="fullName"]')).toHaveValue('Draft Attendee');
    await expect(page.locator('[name="state"]')).toHaveValue('Ontario');
    await expect(page.locator('[name="country"]')).toHaveValue('Canada');
    await expect(page.locator('[name="phoneCountry"]')).toHaveValue('GB');
    await expect(page.locator('[name="countryCode"]')).toHaveValue('+44');
    await page.getByRole('button', { name: 'Continue to Time Slots', exact: true }).click();
    await page.waitForURL('**/book/slots'); await page.goBack();
    await expect(page.locator('[name="country"]')).toHaveValue('Canada');
    await expect(page.locator('[name="phoneCountry"]')).toHaveValue('GB');
    await expect(page.locator('[name="state"]')).toHaveValue('Ontario');
    await context.close();
  });
}

test('event drafts retain controlled schedules and images; saving an edit clears only that draft', async ({ page, context }) => {
  test.setTimeout(90000);
  await cookies(context, admin.cookie); const f = await fixture();
  await page.goto('/admin/eventmanagement/new');
  await page.getByPlaceholder('Enter event name').fill('Unfinished new event');
  await page.getByPlaceholder('Enter venue').fill('Draft venue');
  await page.getByPlaceholder('Event description').fill('Draft description');
  await page.locator('[name="eventType"]').selectOption('mantram');
  await page.getByRole('button', { name: /Template 2/ }).click();
  await page.getByLabel('Timezone', { exact: true }).selectOption('America/New_York');
  await page.locator('input[type="date"]').first().fill(f.date.slice(0, 10));
  await page.locator('select').filter({ has: page.locator('option', { hasText: /^2 Days$/ }) }).selectOption('2');
  await page.locator('input[type="number"]:not([max])').fill('45');
  await page.locator('input[type="number"][max="20"]').fill('7');
  await page.getByRole('button', { name: /^Day 2/ }).first().click();
  await page.getByRole('switch').first().click();
  await page.locator('input[type="number"]:not([max])').fill('35');
  await page.locator('input[type="number"][max="20"]').fill('9');
  // Test the actual file selected by the user without uploading anything to AWS.
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: 20, height: 20 } });
  await page.locator('input[type="file"]').setInputFiles({ name: 'draft-image.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByAltText('Event thumbnail')).toBeVisible();
  await page.reload();
  await expect(page.getByPlaceholder('Enter event name')).toHaveValue('Unfinished new event');
  await expect(page.getByLabel('Timezone', { exact: true })).toHaveValue('America/New_York');
  await expect(page.getByRole('button', { name: /Template 2/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('input[type="number"]:not([max])')).toHaveValue('35');
  await expect(page.locator('input[type="number"][max="20"]')).toHaveValue('9');
  await page.getByRole('button', { name: /^Day 1/ }).first().click();
  await expect(page.locator('input[type="number"]:not([max])')).toHaveValue('45');
  await expect(page.locator('input[type="number"][max="20"]')).toHaveValue('7');
  await expect(page.getByAltText('Event thumbnail')).toBeVisible();
  await expect(page.locator('select').filter({ has: page.locator('option', { hasText: /^2 Days$/ }) })).toHaveValue('2');
  await page.goto(`/admin/eventmanagement/${f.eventId}/edit`);
  await page.getByPlaceholder('Enter event name').fill('Saved edit after draft');
  await page.locator('input[type="number"]:not([max])').fill('60');
  await page.reload();
  await expect(page.getByPlaceholder('Enter event name')).toHaveValue('Saved edit after draft');
  await expect(page.locator('input[type="number"]:not([max])')).toHaveValue('60');
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await page.waitForURL('**/admin/eventmanagement');
  expect(await page.evaluate(id => sessionStorage.getItem(`ssi-event-draft:edit:${id}`), f.eventId)).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem('ssi-event-draft:new'))).toContain('Unfinished new event');
  await page.goto(`/admin/eventmanagement/${f.eventId}/edit`);
  await expect(page.getByPlaceholder('Enter event name')).toHaveValue('Saved edit after draft');
});

test('creating an event clears its draft while retaining an unfinished edit', async ({ page, context }) => {
  const f = await fixture(); await cookies(context, admin.cookie);
  await page.goto('/admin/eventmanagement/new');
  await page.getByPlaceholder('Enter event name').fill('Draft creation cleanup');
  await page.locator('[name="eventType"]').selectOption('conference');
  await page.getByPlaceholder('Enter venue').fill('Test venue');
  await page.getByPlaceholder('Event description').fill('Synthetic create test');
  await page.locator('input[type="date"]').first().fill(f.date.slice(0, 10));
  await page.evaluate(id => sessionStorage.setItem(`ssi-event-draft:edit:${id}`, 'unfinished edit'), f.eventId);
  const response = page.waitForResponse(r => r.url().endsWith('/api/events') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Create Event', exact: true }).click();
  const created = await response; expect(created.status()).toBe(201); events.push((await created.json()).eventId);
  await page.waitForURL('**/admin/eventmanagement');
  expect(await page.evaluate(() => sessionStorage.getItem('ssi-event-draft:new'))).toBeNull();
  expect(await page.evaluate(id => sessionStorage.getItem(`ssi-event-draft:edit:${id}`), f.eventId)).toBe('unfinished edit');
  await page.goto('/admin/eventmanagement/new');
  await expect(page.getByPlaceholder('Enter event name')).toHaveValue('');
});

test('booking completion clears only its registration draft and reopening preserves another attendee draft', async ({ page }) => {
  const f = await fixture(); await page.goto('/events/mytickets');
  await page.evaluate(({ f, details }) => {
    sessionStorage.setItem(`ssi-booking-details:${f.eventId}`, JSON.stringify(details));
    sessionStorage.setItem(`ssi-booking-slot:${f.eventId}:latest`, JSON.stringify(f));
    sessionStorage.setItem(`ssi-booking-draft:${f.eventId}`, JSON.stringify(details));
    sessionStorage.setItem(`ssi-booking-country:${f.eventId}`, '{}');
    sessionStorage.setItem('ssi-booking-draft:unrelated', 'unfinished');
  }, { f, details: bookingPayload(f).details });
  const response = page.waitForResponse(r => r.url().endsWith('/api/bookings') && r.request().method() === 'POST');
  await page.goto(`/events/${f.eventId}/book/confirm`);
  const ticket = await (await response).json();
  await expect(page.getByText('Test Attendee 1', { exact: true })).toBeVisible();
  expect(await page.evaluate(id => sessionStorage.getItem(`ssi-booking-draft:${id}`), f.eventId)).toBeNull();
  expect(await page.evaluate(id => sessionStorage.getItem(`ssi-booking-country:${id}`), f.eventId)).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem('ssi-booking-draft:unrelated'))).toBe('unfinished');
  await page.evaluate(id => sessionStorage.setItem(`ssi-booking-draft:${id}`, JSON.stringify({ fullName: 'Next attendee' })), f.eventId);
  await page.goto(`/events/${f.eventId}/book/confirm?bookingId=${ticket.booking.bookingId}`);
  await expect(page.getByText('Test Attendee 1', { exact: true })).toBeVisible();
  expect(await page.evaluate(id => sessionStorage.getItem(`ssi-booking-draft:${id}`), f.eventId)).toContain('Next attendee');
});

test('first feedback draft restores without an existing cache and successful submission clears only its draft', async ({ page }) => {
  const f = await fixture();
  await page.goto(`/events/${f.eventId}/book/feedback?scope=application`);
  await page.getByRole('button', { name: '4 stars', exact: true }).click();
  const message = page.getByPlaceholder('Tell us anything that could make your experience better...');
  await message.fill(`Draft browser test ${f.eventId}`);
  await page.getByPlaceholder('Example: calendar reminders, easier ticket access...').fill('Calendar reminder');
  await page.reload();
  await expect(message).toHaveValue(`Draft browser test ${f.eventId}`);
  await expect(page.getByPlaceholder('Example: calendar reminders, easier ticket access...')).toHaveValue('Calendar reminder');
  await page.evaluate(() => sessionStorage.setItem('ssi-feedback:event:unrelated', 'untouched'));
  const response = page.waitForResponse(r => r.url().endsWith('/api/feedback') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Submit Feedback', exact: true }).click();
  expect((await response).status()).toBe(200);
  await expect.poll(() => page.evaluate(id => sessionStorage.getItem(`ssi-feedback:application:${id}:`), f.eventId)).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem('ssi-feedback:event:unrelated'))).toBe('untouched');
});

test('feedback picker uses recovered session tickets and sends a verified booking reference', async ({ page }) => {
  const f = await fixture(), ticket = await submitBooking(bookingPayload(f));
  await page.goto('/events/mytickets');
  await page.getByLabel('Booking reference').fill(ticket.body.booking.bookingId);
  await page.getByLabel('Registered mobile number').fill('+919876540001');
  await page.getByRole('button', { name: 'View Tickets', exact: true }).click();
  await expect(page.getByText(ticket.body.booking.bookingId, { exact: true })).toBeVisible();
  await page.goto('/events');
  await page.getByRole('button', { name: 'Feedback', exact: true }).first().click();
  await page.getByRole('button', { name: /Review/ }).click();
  await page.waitForURL(`**/book/feedback?scope=event&bookingId=${ticket.body.booking.bookingId}`);
  await page.getByRole('button', { name: '5 stars', exact: true }).click();
  const response = page.waitForResponse(r => r.url().endsWith('/api/feedback') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Submit Feedback', exact: true }).click();
  expect((await response).status()).toBe(200);
  const { db, client } = await testDatabase();
  expect((await db.collection('feedbacks').findOne({ eventId: f.eventId }))?.bookingMongoId).toBe(ticket.body.booking.id);
  await client.close();
  const noAccess = await api(`/api/feedback?scope=event&eventId=${f.eventId}&bookingId=${ticket.body.booking.bookingId}`);
  expect(noAccess.status).toBe(403);
});
