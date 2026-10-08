import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { type Db, type MongoClient } from 'mongodb';
import { api, testDatabase } from '../helpers/test-app';

let db: Db, client: MongoClient;
const sessions: string[] = [];
before(async () => { ({ db, client } = await testDatabase()); });
after(async () => {
  if (!db) return;
  await db.collection('feedbacks').deleteMany({ sessionId: { $in: sessions } });
  await client.close();
});
const cookies = (response: Response) => response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
async function post(body: Record<string, unknown>, cookie = '') {
  const response = await api('/api/feedback', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const session = /ssimaya_session_id=([^;]+)/.exec(cookies(response))?.[1]; if (session) sessions.push(session);
  return { response, data: await response.json(), cookie: cookies(response) };
}

test('app feedback stores a star rating and optional comment without attendee identity', async () => {
  const first = await post({ rating: 4, message: '  Easy to book  ', eventId: 'forged', bookingId: 'SSI-FORGED' });
  assert.equal(first.response.status, 200, JSON.stringify(first.data));
  const session = /ssimaya_session_id=([^;]+)/.exec(first.cookie)?.[1];
  const saved = await db.collection('feedbacks').findOne({ sessionId: session });
  assert.equal(saved?.scope, 'application');
  assert.equal(saved?.rating, 4);
  assert.equal(saved?.message, 'Easy to book');
  assert.equal(saved?.eventId, undefined);
  assert.equal(saved?.bookingId, undefined);

  const noComment = await post({ rating: 5 });
  assert.equal(noComment.response.status, 200);
});

test('ratings must be whole stars from 1 to 5', async () => {
  for (const rating of [0, 6, 3.5, 'five', undefined]) {
    assert.equal((await post({ rating })).response.status, 400, `rating ${String(rating)}`);
  }
});

test('one rating per browser, including concurrent submissions, and status reflects it', async () => {
  const first = await post({ rating: 3 });
  const status = async () => (await (await api('/api/feedback', { headers: { Cookie: first.cookie } })).json()).submitted;
  assert.equal(await status(), true);
  const repeats = await Promise.all(Array.from({ length: 4 }, () => post({ rating: 1 }, first.cookie)));
  assert.ok(repeats.every(r => r.response.status === 409 && r.data.duplicate));
  const session = /ssimaya_session_id=([^;]+)/.exec(first.cookie)?.[1];
  assert.equal(await db.collection('feedbacks').countDocuments({ sessionId: session }), 1);
  assert.equal((await (await api('/api/feedback')).json()).submitted, false, 'a new browser has not rated yet');
});
