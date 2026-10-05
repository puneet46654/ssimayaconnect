import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ObjectId, type Db, type MongoClient } from 'mongodb';
import { api, createTestAdmin, signTestAdminCookie, testDatabase } from '../helpers/test-app';
import { bookingFixture, bookingPayload, removeBookingFixtures, submitBooking } from '../helpers/booking-fixture';
import { zonedDate } from '../../lib/events/dates';

let db: Db, client: MongoClient;
const admins: string[] = [], events: string[] = [];
before(async () => { ({ db, client } = await testDatabase()); });
after(async () => {
  await removeBookingFixtures(db, events);
  await db.collection('adminusers').deleteMany({ username: { $in: admins } });
  await db.collection('adminactivitylogs').deleteMany({ admin: { $in: admins } });
  await client.close();
});
async function admin(...args: Parameters<typeof createTestAdmin>) { const result = await createTestAdmin(...args); admins.push(result.username); return result; }
async function fixture() { const f = await bookingFixture(db); events.push(f.eventId); return f; }
function request(path: string, cookie = '', method = 'GET', body?: unknown) {
  return api(path, { method, headers: { Cookie: cookie, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
}

test('every protected module rejects missing access even when write and delete flags are true', async () => {
  const restricted = await admin([]);
  const id = new ObjectId();
  const targets = [
    ['/api/admin/dashboard', 'GET'], ['/api/admin/bookings', 'GET'], [`/api/admin/bookings/${id}`, 'GET'],
    [`/api/admin/bookings/${id}`, 'PATCH'], [`/api/admin/bookings/${id}`, 'DELETE'], ['/api/admin/reports', 'GET'],
    ['/api/events', 'POST'], [`/api/events/${id}`, 'PUT'], [`/api/events/${id}`, 'DELETE'],
    ['/api/admin/attendance', 'GET'], ['/api/admin/attendance', 'POST'], ['/api/admin/users', 'GET'],
    ['/api/admin/users', 'POST'], [`/api/admin/users/${id}`, 'PUT'], [`/api/admin/users/${id}`, 'DELETE'], ['/api/admin/activity', 'GET'],
  ];
  for (const [path, method] of targets) {
    assert.equal((await request(path, '', method, method === 'GET' ? undefined : {})).status, 401, `${method} ${path} requires a session`);
    assert.equal((await request(path, restricted.cookie, method, method === 'GET' ? undefined : {})).status, 403, `${method} ${path} requires module access`);
  }
});

test('view-only users can read their modules but cannot mutate or delete', async () => {
  const viewer = await admin(['bookings', 'events', 'reports'], { canCreate: false, canDelete: false });
  const f = await fixture(); const booking = await submitBooking(bookingPayload(f));
  assert.equal((await request(`/api/admin/bookings/${booking.body.booking.id}`, viewer.cookie)).status, 200);
  assert.equal((await request('/api/admin/reports', viewer.cookie)).status, 200);
  assert.equal((await request('/api/admin/dashboard', viewer.cookie)).status, 403);
  for (const [path, method] of [[`/api/admin/bookings/${booking.body.booking.id}`, 'PATCH'], [`/api/admin/bookings/${booking.body.booking.id}`, 'DELETE'], ['/api/events', 'POST'], [`/api/events/${f.eventId}`, 'PUT'], [`/api/events/${f.eventId}`, 'DELETE']]) {
    assert.equal((await request(path, viewer.cookie, method, {})).status, 403);
  }
  assert.equal(await db.collection('bookings').countDocuments({ eventId: new ObjectId(f.eventId) }), 1);
  // Access changes apply to an already issued cookie.
  await db.collection('adminusers').updateOne({ username: viewer.username }, { $set: { permissions: ['dashboard'] } });
  assert.equal((await request('/api/admin/reports', viewer.cookie)).status, 403);
  assert.equal((await request('/api/admin/dashboard', viewer.cookie)).status, 200);
  const session = await (await request('/api/admin/session', viewer.cookie)).json();
  assert.deepEqual(session.user.permissions, ['dashboard']);
  assert.equal(session.user.credentialVersion, undefined);
});

test('check-in staff retain attendance access without event or booking write privileges', async () => {
  const staff = await admin(['check-in'], { role: 'staff', canCreate: false, canDelete: false });
  const f = await fixture(); const booking = await submitBooking(bookingPayload(f));
  const date = new Date(zonedDate(new Date(), 'Asia/Kolkata'));
  await db.collection('events').updateOne({ _id: new ObjectId(f.eventId) }, { $set: { startDate: date, endDate: date } });
  await db.collection('dayschedules').updateOne({ _id: new ObjectId(f.dayScheduleId) }, { $set: { date } });
  await db.collection('slots').updateOne({ _id: new ObjectId(f.slotId) }, { $set: { startTime: '00:00', endTime: '23:59' } });
  assert.equal((await request('/api/admin/attendance', staff.cookie)).status, 200);
  const checked = await request('/api/admin/attendance', staff.cookie, 'POST', { eventId: f.eventId, bookingId: booking.body.booking.bookingId, method: 'MANUAL' });
  assert.equal(checked.status, 200, await checked.text());
  assert.equal((await request('/api/admin/bookings', staff.cookie)).status, 403);
});

test('password resets revoke all prior admin sessions and preserve public tickets', async () => {
  const user = await admin(['bookings']);
  const secondLogin = await request('/api/admin/login', '', 'POST', { username: user.username, password: user.password });
  const secondCookie = secondLogin.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  const stored = await db.collection('adminusers').findOne({ username: user.username }); assert.ok(stored);
  const f = await fixture(); const ticket = await submitBooking(bookingPayload(f));
  const rootCookie = signTestAdminCookie({ username: 'puneet', role: 'superadmin', permissions: [], loggedInAt: Date.now() });
  const reset = await request(`/api/admin/users/${stored._id}`, rootCookie, 'PUT', { password: 'Synthetic-reset-password-42' });
  assert.equal(reset.status, 200, await reset.text());
  for (const cookie of [user.cookie, secondCookie]) {
    assert.equal((await request('/api/admin/bookings', cookie)).status, 401);
    assert.equal((await request('/api/admin/session', cookie)).status, 401);
  }
  assert.equal((await request('/api/admin/login', '', 'POST', { username: user.username, password: user.password })).status, 401);
  const next = await request('/api/admin/login', '', 'POST', { username: user.username, password: 'Synthetic-reset-password-42' });
  assert.equal(next.status, 200);
  assert.equal((await request(`/api/bookings?bookingId=${ticket.body.booking.bookingId}`, ticket.cookie)).status, 200);
  assert.equal(await db.collection('bookings').countDocuments({ eventId: new ObjectId(f.eventId) }), 1);
  await db.collection('adminactivitylogs').deleteMany({ resourceId: String(stored._id), admin: 'puneet' });
});

test('expired and tampered cookies are rejected and logout clears the cookie', async () => {
  const user = await admin(['dashboard']);
  const raw = user.cookie.split('=')[1].split('.')[0];
  const payload = JSON.parse(Buffer.from(raw, 'base64url').toString());
  for (const loggedInAt of [Date.now() - 9 * 3600000, Date.now() + 3600000]) {
    assert.equal((await request('/api/admin/session', signTestAdminCookie({ ...payload, loggedInAt }))).status, 401);
  }
  assert.equal((await request('/api/admin/session', user.cookie + 'invalid')).status, 401);
  const logout = await request('/api/admin/logout', user.cookie, 'POST');
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie') || '', /ssi_admin_session=;/);
});
