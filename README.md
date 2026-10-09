# SSI Maya Connect

Event registration, appointment slots, QR tickets and admin check-in for SSI. Built with Next.js 16, React 19, TypeScript, Tailwind CSS, MongoDB/Mongoose, S3 and Socket.IO. The custom Node server runs both Next.js and Socket.IO.

## What the app does

- Public event catalogue, event details, two registration templates, multi-day slots and downloadable tickets.
- Browser drafts preserve attendee details, independent residence/phone countries, event schedules and selected images.
- Booking requests use persistent retry IDs and MongoDB transactions to prevent duplicate submissions and overselling. Retrying a lost response returns the confirmed booking.
- My Tickets supports multiple tickets. Recovery requires the booking reference and full mobile number; people without their reference must contact event staff. Matching these values does not verify phone ownership. Email alone never grants ticket access.
- Event feedback requires access to a matching booked ticket. General application feedback is separate.
- Admin permissions control pages and API actions. Password resets sign out previous sessions for that database-admin account; public tickets remain valid.
- Event edits preserve booked slot identities and reject changes that would invalidate bookings. Removing an event with bookings cancels it and retains history; an empty event can be deleted.
- QR/manual check-in accepts the booked date and interval in the event timezone: start inclusive, end exclusive, without an early/late grace period. Cancelled events reject admission. Repeated valid scans do not duplicate attendance.
- Reports provide CSV, Excel and browser Print/PDF. Exports use the displayed filter snapshot and timezone. Printing includes every filtered booking, even when the screen is paginated. CSV text that could be interpreted as a formula is prefixed with an apostrophe.
- Realtime notifications and fallback polling refresh bookings, attendance, event availability, dashboards and reports. Temporary request failures expose retry controls.
- Forms have associated labels; modal dialogs support keyboard focus, Escape and focus restoration.

## Dates, countries and timezones

The app supports events worldwide, with India as the primary market and fallback. New forms use the device's IANA timezone, with manual correction available. No geolocation request or location-permission prompt is used. Country and dialing-code defaults come from the device timezone where a mapping is available; they are independent editable choices and do not overwrite restored drafts.

Each event stores its timezone. Schedule dates represent calendar dates, not UTC appointment instants. Event status, slot expiry and check-in use the event timezone regardless of the viewer's timezone. Legacy events without a timezone use `Asia/Kolkata`. Skipped or ambiguous daylight-saving clock times are rejected rather than silently shifting a booking. Overnight schedules are not supported; daytime schedules are not restricted to Indian business hours.

A single-event report uses the event timezone. Cross-event reports use the explicitly selected reporting timezone. Export metadata records the timezone and filters used.

## Local setup

Use Node.js 24 or newer to satisfy the installed QR decoder's engine declaration, and npm. The October bug-fix checks also ran on Node 22.21. MongoDB must support transactions: use Atlas or a replica set, including a single-node replica set for local work. A standalone MongoDB server cannot support the booking/event transaction workflows.

```powershell
npm ci
```

Set local application configuration in `.env.local` (ignored by Git):

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/ssimaya?replicaSet=rs0
ADMIN_SESSION_SECRET=replace-with-a-long-random-value
BOOKING_ACCESS_SECRET=replace-with-another-long-random-value
```

The database URI must point at your own configured replica set. Keep secrets stable across restarts to preserve signed access.

| Variable | Use |
| --- | --- |
| `MONGODB_URI` | Required MongoDB connection string. |
| `ADMIN_SESSION_SECRET` | Signs admin cookies; required in production. Development has a fallback. |
| `BOOKING_ACCESS_SECRET` | Signs public ticket grants. Set explicitly; current compatibility fallback uses `MONGODB_URI`. Changing it invalidates existing grants, but tickets remain recoverable. |
| `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET_NAME` | Existing S3 overrides. The existing hardcoded fallback configuration is intentionally unchanged by this bug-fix work. |
| `PORT`, `HOSTNAME` | Custom server address, read from the process environment before Next loads local configuration. Set these in the shell. |
| `CLUSTER_WORKERS` | Worker processes for `server.mjs`. Defaults to one per CPU in production and 1 in development. |
| `REDIS_URL` | Optional. Shares realtime pushes across servers behind a load balancer. |
| `NODE_ENV` | `development` for development; `production` for a built server. |

Redis is optional: it is only needed to share realtime pushes when several servers run behind a load balancer. There is no mandatory email/OTP service.

### Development

Use a free port. These commands explicitly use 3101 and leave the other project's port 3000 alone.

```powershell
$env:PORT='3101'
$env:HOSTNAME='127.0.0.1'
npm run dev
```

Open `http://127.0.0.1:3101/events` or `/admin/login`. The existing root-account arrangement is unchanged; credentials are not repeated here. Manage additional accounts through the root user's authentication page.

The `dev` and `start` npm scripts use Windows `set` syntax. On macOS/Linux, use `NODE_ENV=development PORT=3101 HOSTNAME=127.0.0.1 node server.mjs` instead.

### Build and run

```powershell
npm run build
$env:PORT='3101'
$env:HOSTNAME='127.0.0.1'
npm start
```

Run `server.mjs` for Socket.IO support; `next start` alone does not run the custom realtime server. Production cookies are secure and require HTTPS when using a deployed production server.

## Scaling and load balancing

In production `server.mjs` forks one worker per CPU (Node cluster) and restarts any worker that crashes; set `CLUSTER_WORKERS` to change the count. Realtime changes are relayed to every worker, or to every server through Redis when `REDIS_URL` is set. Socket.IO clients use websocket only, so no sticky sessions are needed.

For a self-hosted, load-balanced stack (requires Docker), `docker compose up --build` starts nginx on port 8080 in front of 3 app containers (2 workers each) plus Redis. Scale with `APP_REPLICAS=5 docker compose up --build`. The app containers read `.env.local`.

On Vercel, `server.mjs` is not used; Vercel already load-balances and autoscales serverless functions, and clients fall back to polling for live updates.

## Images

The server accepts genuine static JPG, PNG and WebP files up to 5 MiB and 25 megapixels. It checks the declared type and actual bytes, fully decodes and re-encodes content, and strips metadata before upload. SVG, animated images, damaged data and type mismatches are rejected. The browser may compress a large selected image before sending it.

The public image handler also validates stored bytes, serves the normalized MIME type and sets `nosniff` and a restrictive content-security policy. Unsupported legacy objects return an image error and should be replaced with a supported raster file.

## Verification

Fast checks:

```powershell
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Integration and browser tests require a separate running server and isolated MongoDB. The helpers refuse application port 3000 and databases outside `127.0.0.1:27027/ssimaya_oct01_test` (or localhost). They create synthetic fixtures and remove their own records. Never point these tests at a real event database.

1. Start a local MongoDB replica set on port 27027, named `ssimayaTest`. For example, use a disposable data directory outside this repository:

   ```powershell
   mongod --dbpath C:\temp\ssimaya-test-mongo --port 27027 --bind_ip 127.0.0.1 --replSet ssimayaTest
   ```

   Create that directory first. In another terminal, initialize it once with `mongosh`:

   ```javascript
   // mongosh mongodb://127.0.0.1:27027
   rs.initiate({ _id: 'ssimayaTest', members: [{ _id: 0, host: '127.0.0.1:27027' }] })
   ```

2. Start the isolated app with these **test-only** values. They match the synthetic cookie helpers and must never be used for a real deployment. Leave Resend unset for the test server.

   ```powershell
   $env:MONGODB_URI='mongodb://127.0.0.1:27027/ssimaya_oct01_test?replicaSet=ssimayaTest'
   $env:ADMIN_SESSION_SECRET='local-test-session-secret-for-oct01-only'
   $env:BOOKING_ACCESS_SECRET='local-test-booking-secret-for-oct01-only'
   $env:PORT='3101'
   $env:HOSTNAME='127.0.0.1'
   $env:NODE_ENV='development'
   node server.mjs
   ```

3. Run the suites from another terminal:

   ```powershell
   npx playwright install chromium
   npm run test:integration
   npm run test:browser
   ```

`TEST_BASE_URL` and `TEST_MONGODB_URI` override the defaults within the same safety restrictions. Browser runs use one worker. Traces and generated print PDFs are written under ignored `test-results/`.

Coverage includes international dates/DST and phone normalization, concurrent capacity and retry handling, authorization/session revocation, event rollback/cancellation, drafts, ticket recovery and feedback, check-in windows and camera lifecycle, stale requests/realtime fallback, report printing/exports, image validation, and keyboard accessibility.

S3 image reads in the image-handler tests are mocked, and invalid upload tests stop before S3. These checks do not verify live AWS writes or optional Resend delivery. Camera lifecycle tests use controlled browser streams/decoders. The event-day journey also decodes the actual downloaded ticket PNG and feeds rendered QR pixels through the real fallback scanner in Chromium. Test a physical camera on the intended check-in device before an event.

### Event-day verification

The opt-in scenario uses three synthetic events in `Europe/Madrid`, `Asia/Colombo` and `Asia/Jakarta` (the assumed Indonesian timezone). Each has three days of 60 slots. Unsuccessful attendees retry the next day alongside 100 or 120 new arrivals per event. It runs 30 concurrent booking requests, checks capacity against stored reservations and reports, rejects premature admission, then checks in 180 attendees with 180 duplicate requests. Only its own fixtures are moved into a current admission window and removed afterward.

```powershell
$env:TEST_BASE_URL='http://127.0.0.1:3101'
$env:SCENARIO_ARRIVALS='100' # Repeat with 120 for the higher estimate.
npm run test:scenario
npx playwright install chromium firefox webkit
npx playwright test tests/browser/admin-auth.spec.ts tests/browser/dates.spec.ts tests/browser/event-day.spec.ts tests/browser/overflow.spec.ts --browser=all
```

The scenario writes timings and counts to ignored `playwright-report/event-day-load-100.json` (or `120.json`). These are local measurements, not a hosting-capacity guarantee. Browser tests cover delayed login scripts, both mobile registration forms, ticket PNG decoding, recovery, feedback, and choosing another day after losing the final slot to another attendee.

For production-mode browser verification, build and start the isolated app with the same test database/secrets on a free port, then expose it through a local HTTPS proxy. Set `TEST_BASE_URL` to that loopback HTTPS address and `NODE_EXTRA_CA_CERTS` to the test certificate for Node's API requests. The browser config accepts local test certificates; the helpers still reject non-loopback addresses and port 3000. HTTPS is needed to exercise secure production cookies consistently across browsers.

Local verification on 5 October 2026 used a production build on Node 24.21.0 and isolated MongoDB. All 22 unit tests, 34 API tests and 65 production browser checks passed: all 41 browser cases in Chromium, plus 12 key journeys each in Firefox and WebKit. Lint, TypeScript and the production build passed. This run caught and fixed lost early input in login/ticket recovery and faded ticket downloads captured during the entrance animation.

| New attendees per event/day | Booking attempts including retries on later days | Confirmed across 3 events / 3 days | Booking p95 / slowest | Check-in requests / newly present / duplicates |
| --- | --- | --- | --- | --- |
| 100 | 1,260 | 540 | 1.621 s / 5.165 s | 360 / 180 / 180 |
| 120 | 1,620 | 540 | 1.454 s / 6.762 s | 360 / 180 / 180 |

Both runs used 30 requests in flight, returned expected capacity conflicts for overflow, and kept database counters and reports consistent without overbooking. These measurements came from the local test machine with browser checks also running. Physical phone cameras, venue lighting/mobile networks, deployed hosting capacity, live AWS writes and email delivery remain outside these results. No live event records were used.

## Relevant code

- `app/events/`: catalogue, registration, slots, tickets and feedback.
- `app/admin/`: event/user management, bookings, check-in and reports.
- `app/api/`: public and protected server endpoints.
- `lib/bookings/`: booking validation, access grants and transactions.
- `lib/events/`: calendar/timezone rules, schedule validation and reporting helpers.
- `lib/use-dialog.ts`, `lib/field-control.tsx`: shared keyboard and label behavior.
- `lib/image-validation.ts`, `lib/csv.ts`: normalized raster images and safe CSV cells.
- `models/`: MongoDB models; `server.mjs`: HTTP and Socket.IO startup.
- `tests/`: unit, live API and Playwright regression suites.

The scope is practical project fixes. Credential migration, mandatory email verification, enterprise infrastructure and unrelated dependency upgrades are intentionally outside this change.
