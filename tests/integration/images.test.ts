import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { ObjectId, type Db, type MongoClient } from 'mongodb';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import sharp from 'sharp';
import { api, createTestAdmin, testDatabase, testMongoUri } from '../helpers/test-app';
import { bookingFixture, removeBookingFixtures } from '../helpers/booking-fixture';

let db: Db, client: MongoClient, admin: Awaited<ReturnType<typeof createTestAdmin>>;
const events: string[] = [];
before(async () => { ({ db, client } = await testDatabase()); admin = await createTestAdmin(['events']); });
after(async () => {
  if (!db) return;
  await removeBookingFixtures(db, events); await db.collection('adminusers').deleteOne({ username: admin?.username });
  await client.close(); await mongoose.disconnect();
});
async function fixture() { const f = await bookingFixture(db); events.push(f.eventId); return f; }
function form(f: Awaited<ReturnType<typeof fixture>>, file: File) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ eventName: `Image test ${f.eventId}`, eventType: 'conference', venue: 'Test venue', description: 'Synthetic',
    numberOfDays: '1', startDate: f.date.slice(0, 10), endDate: f.date.slice(0, 10), timeZone: 'Asia/Kolkata',
    daySchedules: JSON.stringify([{ date: f.date.slice(0, 10), startTime: '08:00', endTime: '09:00', slotDuration: 30, slotGap: 0, capacity: 10, lunchEnabled: false }]) })) data.set(key, value);
  data.set('thumbnail', file); return data;
}
test('create and edit APIs reject forged image content without writing event changes', async () => {
  const f = await fixture(); const original = await db.collection('events').findOne({ _id: new ObjectId(f.eventId) });
  for (const file of [new File(['<svg><script>alert(1)</script></svg>'], 'bad.png', { type: 'image/png' }),
    new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'huge.jpg', { type: 'image/jpeg' }),
    new File(['broken jpeg'], 'bad.jpg', { type: 'image/jpeg' })]) {
    for (const [path, method] of [['/api/events', 'POST'], [`/api/events/${f.eventId}`, 'PUT']]) {
      const response = await api(path, { method, headers: { Cookie: admin.cookie }, body: form(f, file) });
      assert.equal(response.status, 400, await response.text());
    }
  }
  assert.deepEqual(await db.collection('events').findOne({ _id: new ObjectId(f.eventId) }), original);
  assert.equal(await db.collection('events').countDocuments({ eventName: `Image test ${f.eventId}` }), 0);
});
test('public image handler serves normalized raster bytes and rejects stored active content regardless of S3 MIME', async context => {
  const f = await fixture();
  await db.collection('events').updateOne({ _id: new ObjectId(f.eventId) }, { $set: { imageUrl: 'https://example.test/synthetic-image' } });
  process.env.MONGODB_URI = testMongoUri;
  let bytes = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#ffffff' } }).png().toBuffer();
  context.mock.method(S3Client.prototype, 'send', async (command: unknown) => {
    assert.ok(command instanceof GetObjectCommand); assert.equal(command.input.Key, 'synthetic-image');
    return { Body: { transformToByteArray: async () => bytes }, ContentType: 'text/html' };
  });
  const { GET } = await import('../../app/api/events/[id]/image/route');
  const request = new NextRequest(`http://127.0.0.1:3101/api/events/${f.eventId}/image`);
  const valid = await GET(request, { params: Promise.resolve({ id: f.eventId }) });
  assert.equal(valid.status, 200); assert.equal(valid.headers.get('Content-Type'), 'image/png');
  assert.equal(valid.headers.get('X-Content-Type-Options'), 'nosniff'); assert.match(valid.headers.get('Content-Security-Policy') || '', /sandbox/);
  assert.equal((await sharp(Buffer.from(await valid.arrayBuffer())).metadata()).format, 'png');
  bytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  const invalid = await GET(request, { params: Promise.resolve({ id: f.eventId }) }); assert.equal(invalid.status, 415);
  assert.match(invalid.headers.get('Content-Type') || '', /application\/json/);
});
