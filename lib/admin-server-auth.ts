import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const ADMIN_SESSION_COOKIE = 'ssi_admin_session';
const SESSION_MAX_AGE = 60 * 60 * 8;

const USERS: Record<string, string> = {
  puneet: 'puneet@ssi',
  naveen: 'naveen@ssi',
  rohan: 'rohan@ssi',
  anand: 'anand@ssi',
};

function getSecret() {
  return process.env.ADMIN_SESSION_SECRET || 'ssimaya-development-secret-change-me';
}

function sign(value: string) {
  return createHmac('sha256', getSecret()).update(value).digest('base64url');
}

function createSession(username: string) {
  const payload = `${username}.${Date.now()}`;
  return `${payload}.${sign(payload)}`;
}

function verifySession(value: string | undefined) {
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 3) return null;
  const [username, issuedAt, signature] = parts;
  const expected = sign(`${username}.${issuedAt}`);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }
  const timestamp = Number(issuedAt);
  if (!Number.isFinite(timestamp) || Date.now() - timestamp > SESSION_MAX_AGE * 1000) {
    return null;
  }
  return username;
}

export function isValidAdminCredentials(username: string, password: string) {
  return USERS[username] === password;
}

export async function createAdminSession(username: string) {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, createSession(username), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
}

export async function clearAdminServerSession() {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, '', {
    httpOnly: true,
    expires: new Date(0),
    path: '/',
  });
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  return verifySession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
}

export async function requireAdminSession() {
  return Boolean(await getAdminSession());
}
