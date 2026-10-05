import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { ObjectId, type Db, type MongoClient } from 'mongodb';
import { api, testDatabase } from '../helpers/test-app';
import { bookingFixture, bookingPayload, removeBookingFixtures, submitBooking } from '../helpers/booking-fixture';

let db: Db, client: MongoClient;
const events: string[] = [], sessions: string[] = [];
before(async () => { ({ db, client } = await testDatabase()); });
after(async () => {
  if (!db) return;
  await db.collection('feedbacks').deleteMany({ $or: [{ eventId: { $in: events } }, { sessionId: { $in: sessions } }] });
  await removeBookingFixtures(db, events); await client.close();
});
async function fixture() { const f = await bookingFixture(db); events.push(f.eventId); return f; }
const cookies = (response: Response) => response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
async function post(body: Record<string, unknown>, cookie = '') {
  const response = await api('/api/feedback', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const session = /ssimaya_session_id=([^;]+)/.exec(cookies(response))?.[1]; if (session) sessions.push(session);
  return { response, data: await response.json() };
}
test('event feedback requires a signed ticket grant and matching server booking/event identifiers', async () => {
  const f = await fixture(), other = await fixture(), ticket = await submitBooking(bookingPayload(f));
  const body = { scope: 'event', eventId: f.eventId, bookingId: ticket.body.booking.bookingId, rating: 4, message: 'Synthetic feedback' };
  assert.equal((await post(body)).response.status, 403);
  assert.equal((await post({ ...body, eventId: other.eventId }, ticket.cookie)).response.status, 404);
  assert.equal((await post({ ...body, bookingMongoId: String(new ObjectId()) }, ticket.cookie)).response.status, 400);
  assert.equal((await post({ ...body, bookingId: '' }, ticket.cookie)).response.status, 400);
  const params = new URLSearchParams({ scope: 'event', eventId: f.eventId, bookingId: body.bookingId });
  assert.equal((await api(`/api/feedback?${params}`)).status, 403);
  const result = await post(body, ticket.cookie); assert.equal(result.response.status, 200, JSON.stringify(result.data));
  const saved = await db.collection('feedbacks').findOne({ eventId: f.eventId });
  assert.equal(saved?.bookingId, body.bookingId); assert.equal(saved?.bookingMongoId, ticket.body.booking.id);
});
test('general application feedback cannot attach forged attendee or event identities', async () => {
  const f = await fixture();
  const result = await post({ scope: 'application', eventId: f.eventId, bookingId: 'FORGED-REFERENCE', bookingMongoId: String(new ObjectId()), rating: 5, message: `App ${f.eventId}` });
  assert.equal(result.response.status, 200);
  const saved = await db.collection('feedbacks').findOne({ message: `App ${f.eventId}` });
  assert.ok(saved); assert.equal(saved.eventId, undefined); assert.equal(saved.bookingId, undefined); assert.equal(saved.bookingMongoId, undefined);
});
test('feedback duplicate prevention survives concurrent submissions and status checks require ticket access', async () => {
  const f = await fixture(), ticket = await submitBooking(bookingPayload(f));
  const params = new URLSearchParams({ scope: 'event', eventId: f.eventId, bookingId: ticket.body.booking.bookingId });
  const initial = await api(`/api/feedback?${params}`, { headers: { Cookie: ticket.cookie } });
  assert.equal(initial.status, 200); assert.equal((await initial.json()).submitted, false);
  const cookie = `${ticket.cookie}; ${cookies(initial)}`;
  const results = await Promise.all(Array.from({ length: 4 }, () => post({ scope: 'event', eventId: f.eventId, bookingId: ticket.body.booking.bookingId, rating: 4 }, cookie)));
  assert.equal(results.filter(result => result.response.status === 200).length, 1);
  assert.equal(results.filter(result => result.response.status === 409).length, 3);
  assert.equal(await db.collection('feedbacks').countDocuments({ eventId: f.eventId }), 1);
  const checked = await api(`/api/feedback?${params}`, { headers: { Cookie: cookie } });
  assert.equal((await checked.json()).submitted, true);
});
