# SSI Maya Connect

Event registration, appointment slots, QR tickets and admin check-in for SSI.

Built with Next.js 16, React 19, TypeScript, Tailwind CSS, MongoDB/Mongoose, Amazon S3 and Socket.IO. A custom Node server (`server.mjs`) runs Next.js and Socket.IO together. It can run as a multi-worker cluster behind an nginx load balancer, with an append-only backup copy of the database in a separate MongoDB cluster.

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [npm scripts](#npm-scripts)
- [Deployment](#deployment)
- [Scaling and load balancing](#scaling-and-load-balancing)
- [Backup cluster](#backup-cluster)
- [Performance](#performance)
- [Dates, countries and timezones](#dates-countries-and-timezones)
- [Images](#images)
- [Testing and verification](#testing-and-verification)
- [Project structure](#project-structure)

## Features

**Attendees**
- Public event catalogue, event details, two registration templates, multi-day slots and downloadable QR tickets.
- Browser drafts preserve attendee details, independent residence/phone countries, event schedules and selected images.
- Booking requests use persistent retry IDs and MongoDB transactions to prevent duplicate submissions and overselling. Retrying a lost response returns the confirmed booking.
- My Tickets supports multiple tickets. Recovery requires the booking reference and full mobile number. People without their reference must contact event staff. Matching these values does not verify phone ownership, and email alone never grants ticket access.
- Event feedback requires access to a matching booked ticket. General application feedback is separate.

**Admins**
- Permissions control both pages and API actions. A password reset signs out that database-admin account's previous sessions. Public tickets remain valid.
- Event edits keep booked slot identities and reject changes that would invalidate bookings. Removing an event with bookings cancels it and keeps its history. An empty event can be deleted.
- QR/manual check-in accepts the booked date and interval in the event timezone (start inclusive, end exclusive, no grace period). Cancelled events reject admission. Repeated valid scans do not duplicate attendance.
- Reports provide CSV, Excel and browser Print/PDF, using the displayed filter snapshot and timezone. Printing includes every filtered booking, even when the screen is paginated. CSV text that could be read as a formula is prefixed with an apostrophe.

**Platform**
- Realtime notifications, with polling as a fallback, refresh bookings, attendance, event availability, dashboards and reports. Temporary request failures show retry controls.
- Forms have associated labels. Modal dialogs support keyboard focus, Escape and focus restoration.

## Architecture

Self-hosted production layout (`docker-compose.yml`):

```
                         ┌──────────────────────────────┐
  Browsers ──HTTP/WS──▶  │ nginx load balancer (:8080)  │  gzip, static/image cache
                         └──────────────┬───────────────┘
                     least connections  │  failover between clusters
                 ┌──────────────────────┴──────────────────────┐
     ┌───────────▼───────────┐                     ┌───────────▼───────────┐
     │ App cluster A         │                     │ App cluster B         │
     │ N containers × M      │                     │ N containers × M      │
     │ Node workers each     │                     │ Node workers each     │
     └───────────┬───────────┘                     └───────────┬───────────┘
                 │        Redis: realtime pushes shared         │
                 └──────────────────────┬───────────────────────┘
                                        ▼
                         ┌──────────────────────────────┐
                         │ Primary MongoDB cluster      │  all reads and writes
                         └──────────────┬───────────────┘
                                        │ change stream
                         ┌──────────────▼───────────────┐
                         │ backup-sync service          │  past + future data
                         └──────────────┬───────────────┘
                                        ▼
                         ┌──────────────────────────────┐
                         │ Backup MongoDB cluster       │  append-only, never deletes
                         └──────────────────────────────┘
```

- **App clusters A and B** run the same image. nginx sends each request to the least busy app process across both clusters. If a container fails, nginx retries the request on another one.
- **Within a container**, `server.mjs` forks `CLUSTER_WORKERS` Node workers that share the port round-robin. Crashed workers restart automatically.
- **Realtime:** a change made in any worker is published through Redis, and every worker pushes it to its Socket.IO clients. Clients use WebSocket only, so no sticky sessions are needed.
- **Backup:** the `backup-sync` service copies all existing data, then streams every later insert and edit into the backup cluster. See [Backup cluster](#backup-cluster).

On Vercel, `server.mjs`, nginx and Redis are not used. Vercel load-balances and autoscales the app itself, and clients use polling for live updates. Run the backup service on any always-on host (see [Deployment](#deployment)).

## Getting started

Requirements:
- Node.js 24 or newer (required by the QR decoder's engine declaration).
- npm.
- A MongoDB deployment that supports transactions: Atlas or a replica set (a single-node replica set works locally). A standalone MongoDB server cannot run the booking/event transaction workflows.

```powershell
npm ci
```

Create `.env.local` (ignored by Git):

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/ssimaya?replicaSet=rs0
ADMIN_SESSION_SECRET=replace-with-a-long-random-value
BOOKING_ACCESS_SECRET=replace-with-another-long-random-value
```

### Development

Use a free port. These commands use 3101 and leave port 3000 for other projects.

```powershell
$env:PORT='3101'
$env:HOSTNAME='127.0.0.1'
npm run dev
```

Open `http://127.0.0.1:3101/events` or `/admin/login`. The existing root-account arrangement is unchanged, and credentials are not repeated here. Manage additional accounts from the root user's authentication page.

The `dev` and `start` scripts use Windows `set` syntax. On macOS/Linux use `NODE_ENV=development PORT=3101 HOSTNAME=127.0.0.1 node server.mjs`.

### Production build (single machine)

```powershell
npm run build
$env:PORT='3101'
$env:HOSTNAME='127.0.0.1'
npm start
```

Run the app through `server.mjs`. `next start` alone does not start the realtime server or the worker cluster. Production cookies are secure, so a deployed server must be served over HTTPS.

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | Yes | Primary MongoDB connection string. |
| `ADMIN_SESSION_SECRET` | In production | Signs admin cookies (min. 32 characters). Development has a fallback. |
| `BOOKING_ACCESS_SECRET` | Recommended | Signs public ticket grants. The compatibility fallback uses `MONGODB_URI`. Changing it invalidates existing grants, but tickets remain recoverable. |
| `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET_NAME` | No | S3 overrides. The existing hardcoded fallback configuration is unchanged. |
| `TRACKING_HASH_SECRET` | No | Analytics hashing secret. |
| `RESEND_API_KEY` | No | Optional email delivery. There is no mandatory email/OTP service. |
| `PORT`, `HOSTNAME` | No | Server address. Read from the process environment before Next loads `.env.local`, so set these in the shell. |
| `NODE_ENV` | No | `development` or `production`. |
| `CLUSTER_WORKERS` | No | Node worker processes per server. Defaults to one per CPU in production and 1 in development. |
| `REDIS_URL` | No | Shares realtime pushes between servers behind the load balancer. Set automatically by Docker Compose. |
| `BACKUP_MONGODB_URI` | For backup | Connection string of the backup MongoDB cluster. |
| `BACKUP_DB_NAME` | No | Backup database name. Defaults to the primary database name. |

Keep secrets stable across restarts so that signed access keeps working.

## npm scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server (Next.js + Socket.IO). |
| `npm run build` | Production build. |
| `npm start` | Production server, clustered across CPUs. |
| `npm run lint` | ESLint. |
| `npm test` | Unit tests. |
| `npm run test:integration` | Live API tests (isolated test database only). |
| `npm run test:browser` | Playwright browser tests. |
| `npm run test:scenario` | Event-day load scenario. |
| `npm run test:backup` | Backup sync end-to-end tests on disposable local replica sets. Needs a `mongod` binary (`MONGOD_BIN`, or the mongodb-memory-server cache). |
| `npm run backup:sync` | Run the backup sync continuously. Copies everything first if needed. |
| `npm run backup:full` | Copy all data again (additive), then keep syncing. |
| `npm run backup:verify` | Check that every primary document exists in the backup. |

## Deployment

### Self-hosted (Docker Compose)

Requires Docker and a `.env.local` that includes `MONGODB_URI` and `BACKUP_MONGODB_URI`.

```powershell
docker compose up -d --build
```

This starts:

| Service | Default | Role |
| --- | --- | --- |
| `nginx` | port 8080 | Load balancer across both app clusters, with gzip and static caching. |
| `app_a` | 2 containers × 2 workers | App cluster A. |
| `app_b` | 2 containers × 2 workers | App cluster B. |
| `redis` | n/a | Realtime fan-out between all app processes. |
| `backup-sync` | 1 container | Mirrors the primary database into the backup cluster. |

Tune it with environment variables, for example:

```powershell
$env:CLUSTER_A_REPLICAS='3'; $env:CLUSTER_B_REPLICAS='3'; $env:CLUSTER_WORKERS='4'; $env:LB_PORT='80'
docker compose up -d --build
```

Health checks: `GET /api/health` (each app process, used by Docker) and `GET /lb-health` (nginx). Put TLS in front of nginx (for example a cloud load balancer or certbot), because production cookies require HTTPS.

### Vercel

The app deploys to Vercel as-is (`vercel.json`, region `bom1`). Vercel handles load balancing and scaling. Long-running processes cannot run there, so run the backup service on any always-on machine or VM:

```powershell
npm ci
npm run backup:sync
```

## Scaling and load balancing

- **Workers:** in production, `server.mjs` forks `CLUSTER_WORKERS` workers (default: one per CPU) and distributes connections round-robin on every OS. A crashed worker is replaced immediately.
- **Two app clusters:** `app_a` and `app_b` are independent groups of containers. nginx uses least-connections balancing across every container in both. Failed requests (`502/503/504`, timeouts) are retried once on another container. Scaled replicas join automatically through Docker DNS.
- **Shared state:** realtime changes go through Redis (`REDIS_URL`), or through the cluster primary when there is no Redis. Every worker clears its short-lived event-list cache and notifies its clients. Data lives in MongoDB, so any worker can serve any request.
- **Database connections:** each worker keeps a pool of up to 10 MongoDB connections. Total connections ≈ containers × workers × 10. Keep this under your Atlas tier's connection limit.

## Backup cluster

The backup is a separate MongoDB cluster (for example a second Atlas cluster, ideally in another project or region) kept up to date by `scripts/backup-sync.mjs`.

**How it works**
1. Opens a MongoDB change stream on the primary *before* copying, so nothing written during the copy is missed.
2. Copies every existing document and index from every collection (the past data).
3. Applies every later insert, edit and replace as it happens (the future data).
4. Saves its position in the backup (`_backupSync`) every few seconds. After a restart it continues where it stopped. If the primary's oplog no longer reaches that point, it automatically copies everything again.

**Append-only: data is never deleted from the backup**
- A document deleted on the primary (from the admin panel, the user side, TTL expiry or a dropped collection) **stays in the backup** with its last known contents. The deletion is recorded in the backup's `_deletedOnPrimary` collection (collection, document id, time).
- Edits are applied, so the backup always holds the latest version of every document that exists or has existed.
- Backup indexes are copied without `unique` and TTL (`expireAfterSeconds`) options. Retained documents can never expire, and a new primary document can never be blocked by an old one with the same unique value.
- Nothing in the application writes to or deletes from the backup. Only `backup-sync` writes to it, and only with inserts and replacements.

**Setup**
1. Create a second MongoDB cluster (Atlas → *Create cluster*) and a database user for it. Allow network access from the host that runs the sync.
2. Add its connection string to `.env.local`:
   ```dotenv
   BACKUP_MONGODB_URI=mongodb+srv://<user>:<password>@<backup-cluster>/ssimayaconnect
   ```
3. Start it with `docker compose up -d` (the `backup-sync` service) or `npm run backup:sync`.
4. Check it at any time:
   ```powershell
   npm run backup:verify
   ```
   The check lists each collection with primary/backup counts, missing documents and documents kept after a primary delete. It exits non-zero if anything is missing.

**Restoring:** point a `mongodump`/`mongorestore`, or a script, at the backup cluster and copy the needed documents back. Use `_deletedOnPrimary` to find what was deleted and when.

The backup covers MongoDB data. Uploaded images live in S3. Enable S3 versioning or replication on the bucket if images also need a backup.

## Performance

- Workers on every CPU core, spread across two load-balanced app clusters.
- nginx gzip compression and keep-alive connections to the app.
- Hashed `/_next/static` files are cached by nginx and browsers for a year (`immutable`). Optimized `/_next/image` responses are cached by nginx for 7 days.
- The public event list is cached in memory for 5 seconds and on CDNs (`s-maxage=5, stale-while-revalidate=30`). Every write clears it immediately on all workers.
- Realtime updates use WebSockets with connection-state recovery, so clients refetch only when data changes.
- The backup runs as a separate service on its own cluster and does not slow down user requests.

## Dates, countries and timezones

The app supports events worldwide, with India as the primary market and fallback. New forms use the device's IANA timezone, with manual correction available. The app never asks for geolocation or location permission. Country and dialing-code defaults come from the device timezone where a mapping exists. They are independent, editable choices and do not overwrite restored drafts.

Each event stores its timezone. Schedule dates are calendar dates, not UTC appointment instants. Event status, slot expiry and check-in use the event timezone regardless of the viewer's timezone. Legacy events without a timezone use `Asia/Kolkata`. Clock times that daylight saving skips or repeats are rejected rather than silently shifting a booking. Overnight schedules are not supported, and daytime schedules are not limited to Indian business hours.

A single-event report uses the event timezone. Cross-event reports use the selected reporting timezone. Export metadata records the timezone and filters used.

## Images

The server accepts genuine static JPG, PNG and WebP files up to 5 MiB and 25 megapixels. It checks the declared type against the actual bytes, fully decodes and re-encodes the content, and strips metadata before upload. SVG, animated images, damaged data and type mismatches are rejected. The browser may compress a large image before sending it.

The public image handler also validates stored bytes, serves the normalized MIME type, and sets `nosniff` and a restrictive content-security policy. Unsupported legacy objects return an image error and should be replaced with a supported raster file.

## Testing and verification

Fast checks:

```powershell
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Integration and browser tests require a separate running server and an isolated MongoDB. The helpers refuse application port 3000 and any database other than `127.0.0.1:27027/ssimaya_oct01_test` (or localhost). They create synthetic fixtures and remove their own records. **Never point these tests at a real event database.**

1. Start a local MongoDB replica set on port 27027, named `ssimayaTest`, using a disposable data directory outside this repository (create the directory first):

   ```powershell
   mongod --dbpath C:\temp\ssimaya-test-mongo --port 27027 --bind_ip 127.0.0.1 --replSet ssimayaTest
   ```

   Initialize it once with `mongosh`:

   ```javascript
   // mongosh mongodb://127.0.0.1:27027
   rs.initiate({ _id: 'ssimayaTest', members: [{ _id: 0, host: '127.0.0.1:27027' }] })
   ```

2. Start the isolated app with these **test-only** values. They match the synthetic cookie helpers and must never be used for a real deployment. Leave Resend unset.

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

`TEST_BASE_URL` and `TEST_MONGODB_URI` override the defaults, within the same safety restrictions. Browser runs use one worker. Traces and generated print PDFs are written under the ignored `test-results/` folder.

Coverage includes:
- international dates/DST and phone normalization
- concurrent capacity and retry handling
- authorization and session revocation
- event rollback and cancellation
- drafts, ticket recovery and feedback
- check-in windows and the camera lifecycle
- stale requests and the realtime fallback
- report printing and exports
- image validation and keyboard accessibility

S3 image reads in the image-handler tests are mocked, and invalid upload tests stop before S3, so these checks do not verify live AWS writes or optional Resend delivery. Camera lifecycle tests use controlled browser streams and decoders. The event-day journey also decodes the downloaded ticket PNG and feeds the rendered QR pixels through the real fallback scanner in Chromium. Test a physical camera on the intended check-in device before an event.

### Event-day scenario

The opt-in scenario uses three synthetic events in `Europe/Madrid`, `Asia/Colombo` and `Asia/Jakarta`, each with three days of 60 slots. Attendees who miss out retry the next day alongside 100 or 120 new arrivals per event. The scenario:
- runs 30 concurrent booking requests;
- checks capacity against stored reservations and reports;
- rejects premature admission;
- checks in 180 attendees and sends 180 duplicate check-in requests.

Only its own fixtures are moved into a current admission window, and they are removed afterwards.

```powershell
$env:TEST_BASE_URL='http://127.0.0.1:3101'
$env:SCENARIO_ARRIVALS='100' # Repeat with 120 for the higher estimate.
npm run test:scenario
npx playwright install chromium firefox webkit
npx playwright test tests/browser/admin-auth.spec.ts tests/browser/dates.spec.ts tests/browser/event-day.spec.ts tests/browser/overflow.spec.ts --browser=all
```

Results are written to the ignored `playwright-report/event-day-load-100.json` (or `120.json`). These are local measurements, not a hosting-capacity guarantee.

For production-mode browser verification, build and start the isolated app with the same test database and secrets on a free port, then put a local HTTPS proxy in front of it. Set `TEST_BASE_URL` to that loopback HTTPS address and `NODE_EXTRA_CA_CERTS` to the test certificate. The browser config accepts local test certificates, and the helpers still reject non-loopback addresses and port 3000.

**5 October 2026 run** (production build, Node 24.21.0, isolated MongoDB):
- 22 unit tests, 34 API tests and 65 production browser checks passed. The browser checks were all 41 browser cases in Chromium plus 12 key journeys each in Firefox and WebKit.
- Lint, TypeScript and the production build passed.

| New attendees per event/day | Booking attempts incl. retries | Confirmed (3 events × 3 days) | Booking p95 / slowest | Check-in requests / newly present / duplicates |
| --- | --- | --- | --- | --- |
| 100 | 1,260 | 540 | 1.621 s / 5.165 s | 360 / 180 / 180 |
| 120 | 1,620 | 540 | 1.454 s / 6.762 s | 360 / 180 / 180 |

Both runs used 30 requests in flight and returned the expected capacity conflicts for overflow. Database counters and reports stayed consistent, with no overbooking. The measurements came from a local machine that was also running browser checks. They do not cover physical cameras, venue networks, deployed hosting capacity, live AWS writes or email delivery.

**9 October 2026: clustering and backup**
- **Workers:** a production build ran with 2 and 3 workers on one port and served HTTP and Socket.IO handshakes.
- **Backup sync, tested on two in-memory replica sets:**
  - copied 2,500+ existing documents and their indexes;
  - applied later inserts and edits live;
  - resumed after a restart and caught up on changes made while stopped;
  - kept documents deleted on the primary, including a dropped collection;
  - accepted a new document reusing a deleted document's unique value;
  - copied no TTL indexes;
  - passed `--verify`.
- **Not run:** Docker Compose was not run on the test machine.

**9 October 2026: backup test suite and live backup**
- `npm run test:backup`: 23/23 passed, twice (MongoDB 5.0.19 locally). It starts three throwaway replica sets and runs the real script. It covers startup guards, the initial copy (all BSON types, indexes without `unique`/TTL, empty collections, views skipped), writes during the copy, live inserts/updates/replaces/upserts, a 5,000-insert burst, committed and aborted transactions, deletes, TTL expiry, dropped and renamed collections, `dropDatabase`, a crash mid-copy, a restart, a backup outage, lost change-stream history after an oplog rollover, `--full`, `--verify` and `BACKUP_DB_NAME`.
- Fixed: an empty collection on the primary was not created in the backup.
- Live Atlas backup (`BackupCluster`, MongoDB 8.0): the full copy and `--verify` passed, with every collection matching. Indexes matched, and the latest 20 documents of every collection were identical. Round trip is about 25 ms per write, so live sync applies roughly 30–40 changes per second. Bursts larger than that catch up after a short delay.

## Project structure

| Path | Contents |
| --- | --- |
| `app/events/` | Catalogue, registration, slots, tickets, My Tickets and feedback. |
| `app/admin/` | Event and user management, bookings, check-in, attendance, analytics and reports. |
| `app/api/` | Public and protected API endpoints, including `/api/health`. |
| `components/` | Admin, user, realtime and performance components. |
| `lib/bookings/` | Booking validation, access grants and transactions. |
| `lib/events/` | Calendar/timezone rules, schedule validation, check-in and reporting helpers. |
| `lib/realtime.ts` | Realtime change broadcast and polling revisions. |
| `lib/use-dialog.ts`, `lib/field-control.tsx` | Shared keyboard and label behavior. |
| `lib/image-validation.ts`, `lib/csv.ts` | Normalized raster images and safe CSV cells. |
| `models/` | Mongoose models. |
| `server.mjs` | HTTP + Socket.IO server, worker cluster and realtime fan-out. |
| `scripts/backup-sync.mjs` | Append-only backup sync to the backup cluster. |
| `Dockerfile`, `docker-compose.yml`, `deploy/nginx.conf` | Container image, two-cluster stack and load balancer. |
| `tests/` | Unit, live API, Playwright and scenario suites. |
