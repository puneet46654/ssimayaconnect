import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { ObjectId } from 'mongodb';
import { api, baseURL, createTestAdmin, testDatabase } from '../helpers/test-app';
import { bookingFixture, bookingPayload, removeBookingFixtures, submitBooking } from '../helpers/booking-fixture';
import { zonedDate } from '../../lib/events/dates';

let admin: Awaited<ReturnType<typeof createTestAdmin>>;
const events: string[] = [];
test.beforeAll(async () => { admin = await createTestAdmin(); });
test.afterAll(async () => {
  const { db, client } = await testDatabase(); await removeBookingFixtures(db, events);
  await db.collection('adminusers').deleteOne({ username: admin.username }); await client.close();
});
async function fixture() {
  const { db, client } = await testDatabase(); const f = await bookingFixture(db); events.push(f.eventId);
  const ticket = await submitBooking(bookingPayload(f));
  const date = new Date(zonedDate(new Date(), 'America/New_York'));
  await db.collection('events').updateOne({ _id: new ObjectId(f.eventId) }, { $set: { eventName: `Scanner ${f.eventId}`, timeZone: 'America/New_York', startDate: date, endDate: date } });
  await db.collection('dayschedules').updateOne({ _id: new ObjectId(f.dayScheduleId) }, { $set: { date } });
  await db.collection('slots').updateOne({ _id: new ObjectId(f.slotId) }, { $set: { startTime: '00:00', endTime: '23:59' } });
  await client.close(); return { ...f, booking: ticket.body.booking };
}
async function authenticate(context: BrowserContext) {
  await context.addCookies(admin.cookie.split('; ').map(pair => { const at = pair.indexOf('='); return { name: pair.slice(0, at), value: pair.slice(at + 1), url: baseURL }; }));
}
type CameraHarness = { pending: (() => void)[]; tracks: MediaStreamTrack[]; detect: ((value: { rawValue: string }[]) => void)[]; plays: (() => void)[] };
async function cameras(page: Page, native = true, pauseDecoder = false) {
  await page.addInitScript(({ native, pauseDecoder }) => {
    const harness: CameraHarness = { pending: [], tracks: [], detect: [], plays: [] };
    Object.assign(window, { cameraHarness: harness });
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (pauseDecoder && !this.isConnected) return new Promise<void>(resolve => { harness.plays.push(() => { void play.call(this).catch(() => {}); resolve(); }); });
      return play.call(this);
    };
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: () => new Promise<MediaStream>(resolve => {
      harness.pending.push(() => {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
        canvas.getContext('2d')!.fillRect(0, 0, 32, 32);
        const stream = canvas.captureStream(1); harness.tracks.push(...stream.getTracks()); resolve(stream);
      });
    }) });
    Object.defineProperty(window, 'BarcodeDetector', { configurable: true, value: native ? class {
      detect() { return new Promise(resolve => { harness.detect.push(resolve); }); }
    } : undefined });
  }, { native, pauseDecoder });
}
async function resolveCamera(page: Page) {
  await expect.poll(() => page.evaluate(() => (window as unknown as { cameraHarness: CameraHarness }).cameraHarness.pending.length)).toBeGreaterThan(0);
  await page.evaluate(() => (window as unknown as { cameraHarness: CameraHarness }).cameraHarness.pending.shift()!());
}
for (const native of [true, false]) {
  test(`${native ? 'native' : 'fallback'} camera startup releases late streams after event switch and navigation`, async ({ page, context }) => {
    const first = await fixture(), second = await fixture(); await authenticate(context); await cameras(page, native);
    await page.goto('/admin/check-in'); await page.getByLabel('Live Event').selectOption(first.eventId);
    await expect.poll(() => page.evaluate(() => (window as unknown as { cameraHarness: CameraHarness }).cameraHarness.pending.length)).toBeGreaterThan(0);
    await page.getByLabel('Live Event').selectOption(second.eventId);
    await resolveCamera(page);
    await expect.poll(() => page.evaluate(() => (window as unknown as { cameraHarness: CameraHarness }).cameraHarness.tracks[0]?.readyState)).toBe('ended');
    // The next pending startup belongs to the new event; navigation must invalidate it too.
    await expect.poll(() => page.evaluate(() => (window as unknown as { cameraHarness: CameraHarness }).cameraHarness.pending.length)).toBeGreaterThan(0);
    await page.getByRole('link', { name: 'Dashboard', exact: true }).click(); await page.waitForURL('**/admin/landing');
    await resolveCamera(page);
    await expect.poll(() => page.evaluate(() => (window as unknown as { cameraHarness: CameraHarness }).cameraHarness.tracks.every(track => track.readyState === 'ended'))).toBe(true);
  });
}
test('late native detection cannot submit a ticket for a previously selected event', async ({ page, context }) => {
  const first = await fixture(), second = await fixture(); await authenticate(context); await cameras(page);
  const posts: string[] = []; page.on('request', request => { if (request.url().endsWith('/api/admin/attendance') && request.method() === 'POST') posts.push(request.postData() || ''); });
  await page.goto('/admin/check-in'); await page.getByLabel('Live Event').selectOption(first.eventId);
  // Drain obsolete automatic starts, then resolve the current one.
  await resolveCamera(page);
  await expect.poll(() => page.evaluate(() => {
    const h = (window as unknown as { cameraHarness: CameraHarness }).cameraHarness;
    while (h.pending.length) h.pending.shift()!(); return h.detect.length;
  })).toBeGreaterThan(0);
  await page.getByLabel('Live Event').selectOption(second.eventId);
  await page.evaluate(code => {
    const h = (window as unknown as { cameraHarness: CameraHarness }).cameraHarness;
    h.detect.shift()!([{ rawValue: code }]);
  }, first.booking.qrData);
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  expect(posts).toEqual([]);
});
test('fallback decoder initialization is disposed after navigation, including its late controls', async ({ page, context }) => {
  const f = await fixture(); await authenticate(context); await cameras(page, false, true);
  await page.goto('/admin/check-in'); await page.getByLabel('Live Event').selectOption(f.eventId);
  await resolveCamera(page);
  await expect.poll(() => page.evaluate(() => {
    const h = (window as unknown as { cameraHarness: CameraHarness }).cameraHarness;
    while (h.pending.length) h.pending.shift()!(); return h.plays.length;
  })).toBeGreaterThan(0);
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click(); await page.waitForURL('**/admin/landing');
  await page.evaluate(() => { const h = (window as unknown as { cameraHarness: CameraHarness }).cameraHarness; h.plays.forEach(resolve => resolve()); });
  await expect.poll(() => page.evaluate(() => (window as unknown as { cameraHarness: CameraHarness }).cameraHarness.tracks.every(track => track.readyState === 'ended'))).toBe(true);
});
test('attendance refreshes in a second tab and retains data on a retryable failure', async ({ page, context }) => {
  const f = await fixture(); await authenticate(context);
  const other = await context.newPage();
  for (const tab of [page, other]) { await tab.goto('/admin/check-in'); await tab.getByLabel('Live Event').selectOption(f.eventId); }
  await page.getByPlaceholder('Enter Booking ID, e.g. SSI-MC-2026-04786').fill(f.booking.bookingId);
  await page.getByRole('button', { name: 'Check In', exact: true }).click();
  await expect(page.getByText('Marked Present: Test Attendee 1', { exact: true })).toBeVisible();
  await expect(other.getByText(f.booking.bookingId, { exact: true }).first()).toBeVisible({ timeout: 12000 });
  let fail = true;
  await other.route('**/api/admin/attendance?*', route => fail ? route.fulfill({ status: 503, json: { success: false, message: 'Temporary attendance failure' } }) : route.continue());
  await expect(other.getByRole('alert').filter({ hasText: 'Temporary attendance failure' })).toBeVisible({ timeout: 12000 });
  await expect(other.getByText(f.booking.bookingId, { exact: true }).first()).toBeVisible();
  fail = false; await other.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(other.getByRole('alert').filter({ hasText: 'Temporary attendance failure' })).toHaveCount(0);
  await other.close();
});
test('obsolete manual responses cannot replace a newly selected event', async ({ page, context }) => {
  const first = await fixture(), second = await fixture(); await authenticate(context);
  let release: (() => void) | undefined;
  await page.route('**/api/admin/attendance', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ json: { success: true, booking: { bookingId: 'OBSOLETE', fullName: 'Old attendee' } } });
  });
  await page.goto('/admin/check-in'); await page.getByLabel('Live Event').selectOption(first.eventId);
  await page.getByPlaceholder('Enter Booking ID, e.g. SSI-MC-2026-04786').fill(first.booking.bookingId);
  await page.getByRole('button', { name: 'Check In', exact: true }).click();
  await expect.poll(() => !!release).toBe(true);
  await page.getByLabel('Live Event').selectOption(second.eventId); release!();
  await expect(page.getByPlaceholder('Enter Booking ID, e.g. SSI-MC-2026-04786')).toHaveValue('');
  await expect(page.getByText('OBSOLETE', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Live Event')).toHaveValue(second.eventId);
});
test('a delayed attendance load is ignored after choosing another event', async ({ page, context }) => {
  const first = await fixture(), second = await fixture(); await authenticate(context);
  let release: (() => void) | undefined;
  await page.route(`**/api/admin/attendance?eventId=${first.eventId}`, async route => {
    await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ json: { success: true, stats: { total: 999, present: 999, remaining: 0, percentage: 100 },
      recent: [{ id: 'old', bookingId: 'OLD-RESPONSE', fullName: 'Old response', checkedInAt: new Date().toISOString(), method: 'QR' }] } });
  });
  await page.goto('/admin/check-in'); await page.getByLabel('Live Event').selectOption(first.eventId);
  await expect.poll(() => !!release).toBe(true);
  await page.getByLabel('Live Event').selectOption(second.eventId); release!();
  await expect(page.getByText('No check-ins yet', { exact: true })).toBeVisible();
  await expect(page.getByText('OLD-RESPONSE', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Live Event')).toHaveValue(second.eventId);
});
test('booking edits and deletion refresh another tab and release its displayed slot capacity', async ({ page, context }) => {
  const { db, client } = await testDatabase(); const f = await bookingFixture(db, 1); events.push(f.eventId); await client.close();
  const ticket = await submitBooking(bookingPayload(f)); await authenticate(context);
  const slots = await context.newPage(); await slots.goto(`/events/${f.eventId}/book/slots`);
  await page.goto('/admin/bookings');
  await expect(page.getByText(ticket.body.booking.bookingId, { exact: true }).first()).toBeVisible();
  const update = await api(`/api/admin/bookings/${ticket.body.booking.id}`, { method: 'PATCH', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ details: { ...bookingPayload(f).details, fullName: 'Updated realtime attendee' } }) });
  expect(update.status).toBe(200);
  await expect(page.getByText('Updated realtime attendee', { exact: true }).first()).toBeVisible({ timeout: 12000 });
  const refreshed = slots.waitForResponse(async response => response.url().includes(`/api/events/${f.eventId}/slots`) && response.status() === 200 && (await response.json()).days[0].slots[0].bookedCount === 0);
  const deleted = await api(`/api/admin/bookings/${ticket.body.booking.id}`, { method: 'DELETE', headers: { Cookie: admin.cookie } }); expect(deleted.status).toBe(200);
  await expect(page.getByText('Updated realtime attendee', { exact: true })).toHaveCount(0, { timeout: 12000 });
  const payload = await (await refreshed).json();
  expect(payload.days[0].slots[0].bookedCount).toBe(0);
  expect(payload.days[0].slots[0].available).toBe(true);
  const removed = await api(`/api/events/${f.eventId}`, { method: 'DELETE', headers: { Cookie: admin.cookie } }); expect(removed.status).toBe(200);
  await expect(slots.getByText('Event not found.', { exact: true })).toBeVisible({ timeout: 12000 });
  await slots.close();
});
test('public event request failures show a retry, preserve existing events, and never claim the list is empty', async ({ page }) => {
  await fixture(); let fail = true;
  await page.route('**/api/events*', route => new URL(route.request().url()).pathname === '/api/events' && fail
    ? route.fulfill({ status: 503, json: { success: false, error: 'Temporary catalogue failure' } }) : route.continue());
  await page.goto('/events');
  await expect(page.getByRole('alert').filter({ hasText: 'Temporary catalogue failure' })).toBeVisible();
  await expect(page.getByText('No events are available right now')).toHaveCount(0);
  fail = false; await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Temporary catalogue failure' })).toHaveCount(0);
  const name = `Scanner ${events.at(-1)}`; await expect(page.getByText(name).first()).toBeVisible();
  fail = true;
  await page.reload();
  await expect(page.getByRole('alert').filter({ hasText: 'Temporary catalogue failure' })).toBeVisible();
  await expect(page.getByText(name).first()).toBeVisible();
});
test('registration remains filled during a temporary event refresh failure and can retry', async ({ page }) => {
  const { db, client } = await testDatabase(); const f = await bookingFixture(db); events.push(f.eventId); await client.close();
  await page.route('**/api/location/countries', route => route.fulfill({ json: { success: true, countries: [{ name: 'India', iso2: 'IN', callingCode: '+91', flag: 'IN' }] } }));
  await page.route('**/api/location/states?*', route => route.fulfill({ json: { success: true, states: [] } }));
  let fail = false;
  await page.route(`**/api/events/${f.eventId}`, route => fail ? route.fulfill({ status: 503, json: { success: false, error: 'Temporary event failure' } }) : route.continue());
  await page.goto(`/events/${f.eventId}/book`);
  await page.locator('[name="fullName"]').fill('Unfinished attendee');
  fail = true; await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByRole('alert').filter({ hasText: 'Temporary event failure' })).toBeVisible();
  await expect(page.locator('[name="fullName"]')).toHaveValue('Unfinished attendee');
  fail = false; await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Temporary event failure' })).toHaveCount(0);
  await expect(page.locator('[name="fullName"]')).toHaveValue('Unfinished attendee');
});
