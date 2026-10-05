import { test, expect, type BrowserContext } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { ObjectId } from 'mongodb';
import { baseURL, createTestAdmin, testDatabase } from '../helpers/test-app';
import { bookingFixture, bookingPayload, removeBookingFixtures } from '../helpers/booking-fixture';

let admin: Awaited<ReturnType<typeof createTestAdmin>>;
const events: string[] = [];
test.beforeAll(async () => { admin = await createTestAdmin(['reports']); });
test.afterAll(async () => { const { db, client } = await testDatabase(); await removeBookingFixtures(db, events);
  await db.collection('adminusers').deleteOne({ username: admin.username }); await client.close(); });
async function authenticate(context: BrowserContext) {
  await context.addCookies(admin.cookie.split('; ').map(pair => { const at = pair.indexOf('='); return { name: pair.slice(0, at), value: pair.slice(at + 1), url: baseURL }; }));
}
async function fixture(count = 20) {
  const { db, client } = await testDatabase(); const f = await bookingFixture(db, 20); events.push(f.eventId);
  await db.collection('events').updateOne({ _id: new ObjectId(f.eventId) }, { $set: { eventName: `Report ${f.eventId}`, timeZone: 'America/New_York' } });
  await db.collection('bookings').insertMany(Array.from({ length: count }, (_, index) => ({
    bookingId: `REPORT-${f.eventId}-${index}`, eventId: new ObjectId(f.eventId), slotId: new ObjectId(f.slotId), dayScheduleId: new ObjectId(f.dayScheduleId),
    details: { ...bookingPayload(f, String(index + 1)).details, fullName: index === 0 ? '=1+1' : `Report Attendee ${index}`, hospital: '@SUM(A1)' },
    attendanceStatus: 'NOT_PRESENT', createdAt: new Date(), updatedAt: new Date(),
  })));
  await db.collection('slots').updateOne({ _id: new ObjectId(f.slotId) }, { $set: { bookedCount: count } });
  await client.close(); return f;
}
test('printing includes every filtered booking and CSV uses the displayed snapshot and safe text', async ({ page, context }) => {
  const f = await fixture(); await authenticate(context); await page.goto('/admin/reports');
  await page.getByLabel('Event', { exact: true }).selectOption(f.eventId);
  await page.getByRole('button', { name: 'Apply Filters', exact: true }).click();
  await expect(page.getByTestId('report-filter-summary')).toContainText(`Report ${f.eventId}`);
  // Applying the same selection again must refresh rather than remain loading.
  await page.getByRole('button', { name: 'Apply Filters', exact: true }).click();
  await expect(page.getByRole('button', { name: 'CSV', exact: true })).toBeEnabled();
  const table = page.getByRole('table', { name: 'Booking ledger' });
  // Desktop pagination is 15 rows; print media must expose the full filtered set.
  await page.setViewportSize({ width: 1600, height: 1000 });
  await expect(table.locator('tbody tr:visible')).toHaveCount(15);
  await page.emulateMedia({ media: 'print' });
  await expect(table.locator('tbody tr:visible')).toHaveCount(20);
  await expect(page.getByTestId('report-filter-summary')).toContainText('America/New_York');
  expect(await table.evaluate(element => element.getBoundingClientRect().width <= document.documentElement.clientWidth)).toBe(true);
  await page.pdf({ path: `test-results/report-${f.eventId}.pdf`, preferCSSPageSize: true });
  await page.emulateMedia({ media: 'screen' });
  // Editing draft controls does not alter the already-loaded export's identity.
  await page.getByLabel('Registered From').fill('2020-01-01');
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'CSV', exact: true }).click();
  const file = await download; const content = await readFile((await file.path())!, 'utf8');
  expect(content).toContain('"\'=1+1"'); expect(content).toContain('"\'@SUM(A1)"');
  expect(content).toContain('America/New_York'); expect(content).not.toContain('2020-01-01');
  expect(content.match(/REPORT-/g)).toHaveLength(20);
  expect(file.suggestedFilename()).toContain(f.eventId);
});
test('late report results cannot replace a newer filter selection, and pending exports are disabled', async ({ page, context }) => {
  const first = await fixture(1), second = await fixture(2); await authenticate(context); await page.goto('/admin/reports');
  await expect(page.getByRole('button', { name: 'CSV', exact: true })).toBeEnabled();
  let release: (() => void) | undefined;
  await page.route('**/api/admin/reports?*', async route => {
    if (new URL(route.request().url()).searchParams.get('eventId') !== first.eventId) return route.continue();
    const response = await route.fetch(); await new Promise<void>(resolve => { release = resolve; }); await route.fulfill({ response });
  });
  await page.getByLabel('Event', { exact: true }).selectOption(first.eventId);
  await page.getByRole('button', { name: 'Apply Filters', exact: true }).click();
  await expect.poll(() => !!release).toBe(true);
  await expect(page.getByRole('button', { name: 'CSV', exact: true })).toBeDisabled();
  await page.getByLabel('Event', { exact: true }).selectOption(second.eventId);
  await page.getByRole('button', { name: 'Apply Filters', exact: true }).click();
  await expect(page.getByTestId('report-filter-summary')).toContainText(`Report ${second.eventId}`); release!();
  await expect(page.getByRole('button', { name: 'CSV', exact: true })).toBeEnabled();
  await expect(page.getByTestId('report-filter-summary')).toContainText(`Report ${second.eventId}`);
  await expect(page.getByRole('table', { name: 'Booking ledger' }).locator('tbody tr')).toHaveCount(2);
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    await expect(page.getByRole('button', { name: 'CSV', exact: true })).toBeEnabled();
    await expect(page.getByTestId('report-filter-summary')).toContainText('All events');
  }
});
