import assert from 'node:assert/strict';
import { createHmac, randomBytes, scryptSync } from 'node:crypto';
import { MongoClient } from 'mongodb';

export const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3101';
export const testMongoUri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27027/ssimaya_oct01_test?replicaSet=ssimayaTest';
const address = new URL(baseURL);
assert.ok(['127.0.0.1', 'localhost'].includes(address.hostname) && address.port !== '3000', 'Tests must use a separate local application port.');
assert.match(testMongoUri, /^mongodb:\/\/(127\.0\.0\.1|localhost):27027\/ssimaya_oct01_test(?:\?|$)/, 'Tests must use the isolated test database.');

export async function testDatabase() {
  const client = new MongoClient(testMongoUri);
  await client.connect();
  return { client, db: client.db() };
}

export async function createTestAdmin(permissions = ['dashboard', 'events', 'bookings', 'check-in', 'reports'],
  options: { canCreate?: boolean; canDelete?: boolean; role?: 'admin' | 'staff' } = {}) {
  const { client, db } = await testDatabase();
  const username = `test_${randomBytes(8).toString('hex')}`;
  const password = randomBytes(24).toString('hex');
  const salt = randomBytes(16).toString('hex');
  await db.collection('adminusers').insertOne({
    username, name: 'Local Test Admin', role: options.role || 'admin', isActive: true,
    permissions, canCreate: options.canCreate ?? true, canDelete: options.canDelete ?? true,
    passwordSalt: salt, passwordHash: scryptSync(password, salt, 64).toString('hex'),
    createdAt: new Date(), updatedAt: new Date(),
  });
  await client.close();
  const response = await fetch(`${baseURL}/api/admin/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }),
  });
  assert.equal(response.status, 200, await response.text());
  const cookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  assert.ok(cookie);
  return { username, password, cookie };
}

export async function api(path: string, options: RequestInit = {}) {
  return fetch(`${baseURL}${path}`, options);
}

/** Only the isolated server's synthetic secret; never reads deployed credentials. */
export function signTestAdminCookie(payload: Record<string, unknown>) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', 'local-test-session-secret-for-oct01-only').update(encoded).digest('base64url');
  return `ssi_admin_session=${encoded}.${signature}`;
}
