import { test, expect } from '@playwright/test';
import { ObjectId } from 'mongodb';
import { baseURL, createTestAdmin, testDatabase } from '../helpers/test-app';

const eventId = new ObjectId();
const scheduleId = new ObjectId();
const globalEventId = new ObjectId();
let admin: Awaited<ReturnType<typeof createTestAdmin>>;

test.beforeAll(async () => {
  const { client, db } = await testDatabase();
  await db.collection('events').insertOne({
    _id: eventId, eventName: 'Calendar boundary browser test', eventType: 'conference',
    bookingFormTemplate: 'practitioner-institutional', venue: 'Test venue', description: 'Test event',
    numberOfDays: 1, startDate: new Date('2027-11-20'), endDate: new Date('2027-11-20'),
    status: 'UPCOMING', imageUrl: '', createdAt: new Date(), updatedAt: new Date(),
  });
  await db.collection('dayschedules').insertOne({
    _id: scheduleId, eventId, dayNumber: 1, date: new Date('2027-11-20'), startTime: '08:00', endTime: '18:00',
    slotDuration: 30, slotGap: 10, capacity: 5, lunchEnabled: false,
  });
  await db.collection('slots').insertOne({ eventId, dayScheduleId: scheduleId, startTime: '08:00', endTime: '08:30', capacity: 5, bookedCount: 0 });
  const original = await db.collection('events').findOne({ _id: eventId });
  await db.collection('events').insertOne({ ...original, _id: globalEventId, eventName: 'New York event', timeZone: 'America/New_York' });
  await db.collection('dayschedules').insertOne({ eventId: globalEventId, dayNumber: 1, date: new Date('2027-11-20'), startTime: '08:00', endTime: '18:00', slotDuration: 30, slotGap: 10, capacity: 5, lunchEnabled: false });
  await client.close();
  admin = await createTestAdmin();
});

test.afterAll(async () => {
  const { client, db } = await testDatabase();
  await db.collection('slots').deleteMany({ eventId });
  await db.collection('dayschedules').deleteOne({ _id: scheduleId });
  await db.collection('events').deleteOne({ _id: eventId });
  await db.collection('dayschedules').deleteMany({ eventId: globalEventId });
  await db.collection('events').deleteOne({ _id: globalEventId });
  if (admin) {
    await db.collection('adminusers').deleteOne({ username: admin.username });
    await db.collection('adminactivitylogs').deleteMany({ admin: admin.username });
  }
  await client.close();
});

for (const timezoneId of ['Asia/Kolkata', 'America/Los_Angeles', 'Pacific/Auckland']) {
  test(`event date and slot clock stay in IST for a browser in ${timezoneId}`, async ({ browser }) => {
    const context = await browser.newContext({ timezoneId });
    const page = await context.newPage();
    await page.goto(`${baseURL}/events/${eventId}`);
    await expect(page.getByRole('heading', { name: 'Calendar boundary browser test' })).toBeVisible();
    await expect(page.locator('body')).toContainText(/20 Nov/);
    await expect(page.locator('body')).not.toContainText(/19 Nov/);
    await expect(page.locator('body')).toContainText(/8:00\s*am/i);
    await expect(page.getByText('All event times: Asia/Kolkata')).toBeVisible();
    await page.goto(`${baseURL}/events/${globalEventId}`);
    await expect(page.getByText('All event times: America/New_York')).toBeVisible();
    await expect(page.locator('body')).toContainText(/20 Nov/);
    await expect(page.locator('body')).toContainText(/8:00\s*am/i);
    await context.close();
  });
}

test('new events auto-select device timezone and allow correction; edit preserves saved timezone', async ({ browser }) => {
  const context = await browser.newContext({ timezoneId: 'America/Los_Angeles' });
  const page = await context.newPage();
  await page.goto(`${baseURL}/admin/login`);
  await page.getByLabel('Login ID').fill(admin.username);
  await page.getByLabel('Password', { exact: true }).fill(admin.password);
  await page.locator('button[type=submit]').click();
  await page.waitForURL('**/admin/landing');
  await page.goto(`${baseURL}/admin/eventmanagement/new`);
  const timezone = page.getByLabel('Timezone', { exact: true });
  await expect(timezone).toHaveValue('America/Los_Angeles');
  await timezone.selectOption('Europe/London');
  await page.getByPlaceholder('Enter event name').fill('Timezone override test');
  await expect(timezone).toHaveValue('Europe/London');
  await page.goto(`${baseURL}/admin/eventmanagement/${globalEventId}/edit`);
  await expect(timezone).toHaveValue('America/New_York');
  await page.goto(`${baseURL}/admin/reports`);
  await expect(timezone).toHaveValue('America/Los_Angeles');
  await timezone.selectOption('Europe/London');
  await page.getByRole('button', { name: 'Apply Filters', exact: true }).click();
  await expect(page.getByText('Displayed report timezone: Europe/London')).toBeVisible();
  await context.close();
});
