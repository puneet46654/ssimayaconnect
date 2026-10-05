import { test, expect, type BrowserContext } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { ObjectId } from 'mongodb';
import sharp from 'sharp';
import { BinaryBitmap, HybridBinarizer, QRCodeReader, RGBLuminanceSource } from '@zxing/library';
import { baseURL, createTestAdmin, testDatabase } from '../helpers/test-app';
import { bookingFixture, removeBookingFixtures } from '../helpers/booking-fixture';

test.use({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Kolkata' });

const events: string[] = [];
let admin: Awaited<ReturnType<typeof createTestAdmin>>;
test.beforeAll(async () => { admin = await createTestAdmin(['check-in']); });
test.afterAll(async () => {
  const { db, client } = await testDatabase();
  await db.collection('feedbacks').deleteMany({ eventId: { $in: events } });
  await removeBookingFixtures(db, events);
  await db.collection('adminusers').deleteOne({ username: admin.username });
  await db.collection('adminactivitylogs').deleteMany({ admin: admin.username }); await client.close();
});
async function authenticate(context: BrowserContext) {
  await context.addCookies(admin.cookie.split('; ').map(pair => { const at = pair.indexOf('=');
    return { name: pair.slice(0, at), value: pair.slice(at + 1), url: baseURL }; }));
}

for (const template of ['practitioner-institutional', 'template-2']) {
  test(`${template}: mobile form through slot, downloadable ticket, recovery and feedback`, async ({ browser, context, page }) => {
    test.setTimeout(120000);
    const { db, client } = await testDatabase(); const f = await bookingFixture(db); events.push(f.eventId);
    await db.collection('events').updateOne({ _id: new ObjectId(f.eventId) }, { $set: { bookingFormTemplate: template } });
    await client.close();
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${baseURL}/events/${f.eventId}/book`);
    await expect(page.locator('[name="fullName"]')).toBeVisible();
    // Enter through the real form and slot controls; do not seed sessionStorage or mock the booking response.
    for (const name of ['title', 'designation']) {
      const select = page.locator(`select[name="${name}"]`); if (await select.count()) await select.selectOption(name === 'title' ? 'Dr.' : 'Delegate');
    }
    for (const [name, value] of Object.entries({ fullName: 'Event Day Attendee', specialty: 'Cardiology', mobile: '9876543210',
      email: `journey-${f.eventId}@example.test`, hospitalName: 'Test Hospital', city: 'Mumbai' })) {
      await page.locator(`[name="${name}"]`).fill(value);
    }
    await expect(page.getByRole('button', { name: /^Country: India/ })).toBeEnabled({ timeout: 20000 });
    const state = page.locator('[name="state"]');
    await expect(state).toBeEnabled({ timeout: 20000 });
    if (await state.evaluate(element => element.tagName === 'SELECT')) await state.selectOption({ label: 'Maharashtra' });
    else await state.fill('Maharashtra');
    await page.getByRole('button', { name: 'Continue to Time Slots', exact: true }).click();
    await page.waitForURL('**/book/slots');
    await page.getByRole('button', { name: /08:00.*08:30/ }).click();
    const created = page.waitForResponse(response => response.url().endsWith('/api/bookings') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Continue', exact: true }).filter({ visible: true }).click();
    const response = await created; expect(response.status()).toBe(201); const data = await response.json();
    expect(data.booking.details.fullName).toBe('Event Day Attendee');
    await expect(page.getByText('Dr. Event Day Attendee', { exact: true })).toBeVisible();
    await expect(page.getByText('Ready for Venue Scan')).toBeVisible();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download Confirmation', exact: true }).filter({ visible: true }).click();
    const file = await download; expect(file.suggestedFilename()).toBe(`${data.booking.bookingId}.png`);
    const pixels = await readFile((await file.path())!); const metadata = await sharp(pixels).metadata();
    await test.info().attach('downloaded-ticket', { body: pixels, contentType: 'image/png' });
    expect(metadata.format).toBe('png'); expect(metadata.width).toBeGreaterThan(300);
    // Decode the exported image itself: a nonempty PNG can still contain an unreadable, faded QR.
    // Finder detection is sensitive to pixel scale; inspect the saved image at native
    // and half resolution, as a camera sees it at different distances. Never regenerate the QR.
    let decoded: string | undefined;
    for (const width of [metadata.width!, Math.floor(metadata.width! / 2)]) {
      const { data: luminance, info } = await sharp(pixels).resize(width).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true });
      try {
        decoded = new QRCodeReader().decode(new BinaryBitmap(new HybridBinarizer(
          new RGBLuminanceSource(new Uint8ClampedArray(luminance), info.width, info.height),
        ))).getText();
        break;
      } catch (error) { if (width === Math.floor(metadata.width! / 2)) throw error; }
    }
    expect(JSON.parse(decoded!)).toMatchObject({ bookingId: data.booking.bookingId, eventId: f.eventId });
    expect((await sharp(pixels).stats()).channels.some(channel => channel.min < 50)).toBe(true);
    await file.saveAs(test.info().outputPath('ticket.png'));
    // Capture the actual QR pixels rendered by the ticket, for the real decoder check below.
    const qr = await page.getByRole('img', { name: 'Ticket QR code', exact: true }).screenshot();
    await test.info().attach('screen-qr', { body: qr, contentType: 'image/png' });
    await context.clearCookies(); await page.evaluate(() => sessionStorage.clear());
    let release!: () => void;
    const scriptsReady = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/_next/static/**/*.js', async route => { await scriptsReady; await route.continue(); });
    try {
      await page.goto(`${baseURL}/events/mytickets`, { waitUntil: 'commit' });
      await expect(page.getByLabel('Booking reference')).toBeDisabled();
      await expect(page.getByLabel('Registered mobile number')).toBeDisabled();
      await expect(page.getByRole('button', { name: 'View Tickets', exact: true })).toBeDisabled();
    } finally { release(); }
    await page.getByLabel('Booking reference').fill(data.booking.bookingId);
    await page.getByLabel('Registered mobile number').fill('+919876543210');
    await page.getByRole('button', { name: 'View Tickets', exact: true }).click();
    await expect(page.getByText(data.booking.bookingId, { exact: true }).first()).toBeVisible();
    await page.goto(`${baseURL}/events/${f.eventId}/book/feedback?bookingId=${data.booking.bookingId}`);
    await page.getByRole('button', { name: '5 stars', exact: true }).click();
    await page.getByPlaceholder('Tell us anything that could make your experience better...').fill(`Event-day journey ${f.eventId}`);
    const feedback = page.waitForResponse(response => response.url().endsWith('/api/feedback') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Submit Feedback', exact: true }).click(); expect((await feedback).status()).toBe(200);
    expect(errors).toEqual([]); await context.close();

    if (template === 'practitioner-institutional' && browser.browserType().name() === 'chromium') {
      // Move only this synthetic reservation into today's admission window.
      const { db, client } = await testDatabase(); const date = new Date(new Date().toISOString().slice(0, 10));
      await db.collection('events').updateOne({ _id: new ObjectId(f.eventId) }, { $set: { startDate: date, endDate: date, timeZone: 'UTC' } });
      await db.collection('dayschedules').updateOne({ _id: new ObjectId(f.dayScheduleId) }, { $set: { date } });
      await db.collection('slots').updateOne({ _id: new ObjectId(f.slotId) }, { $set: { startTime: '00:00', endTime: '23:59' } });
      const staffContext = await browser.newContext({ ignoreHTTPSErrors: baseURL.startsWith('https:') }); await authenticate(staffContext);
      await staffContext.addInitScript(qrData => {
        Object.defineProperty(window, 'BarcodeDetector', { value: undefined, configurable: true });
        Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => {
          const image = new Image(); image.src = qrData; await image.decode();
          const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480;
          const paint = canvas.getContext('2d')!; paint.fillStyle = 'white'; paint.fillRect(0, 0, 640, 480);
          paint.imageSmoothingEnabled = false; paint.drawImage(image, 150, 70, 340, 340);
          const stream = canvas.captureStream(10);
          const timer = setInterval(() => { paint.drawImage(image, 150, 70, 340, 340); }, 100);
          stream.getVideoTracks()[0].addEventListener('ended', () => clearInterval(timer));
          return stream;
        } });
      }, `data:image/png;base64,${qr.toString('base64')}`);
      const staff = await staffContext.newPage(); await staff.goto(`${baseURL}/admin/check-in`);
      await staff.getByLabel('Live Event').selectOption(f.eventId);
      await expect(staff.getByText('Marked Present: Event Day Attendee', { exact: true })).toBeVisible({ timeout: 20000 });
      const booking = await db.collection('bookings').findOne({ _id: new ObjectId(data.booking.id) });
      expect(booking?.attendanceStatus).toBe('PRESENT'); expect(booking?.checkInMethod).toBe('QR');
      await staffContext.close(); await client.close();
    }
  });
}
