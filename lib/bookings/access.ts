import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';

const COOKIE_PREFIX = 'ssimaya_ticket_';
const LEGACY_COOKIE = 'ssimaya_booking_access';
const ACCESS_SECONDS = 60 * 60 * 24 * 30;

function sign(value: string) {
  const secret = process.env.BOOKING_ACCESS_SECRET || process.env.MONGODB_URI || 'ssimaya-development-secret';
  return createHmac('sha256', secret).update(value).digest('hex');
}

function equal(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function cookieName(bookingId: string) {
  return COOKIE_PREFIX + createHash('sha256').update(bookingId).digest('hex').slice(0, 24);
}

export function hasBookingAccess(request: NextRequest, bookingId: string) {
  const token = request.cookies.get(cookieName(bookingId))?.value || '';
  const [expires, signature] = token.split('.');
  if (/^\d+$/.test(expires || '') && Number(expires) > Date.now() && signature
    && equal(signature, sign(`${bookingId}:${expires}`))) return true;
  // Keep the last ticket accessible to browsers using the previous app version.
  const legacy = request.cookies.get(LEGACY_COOKIE)?.value;
  return !!legacy && equal(legacy, sign(bookingId));
}

/** Separate grants prevent simultaneous bookings from replacing each other's access. */
export function withBookingAccess(response: NextResponse, bookingId: string) {
  const expires = Date.now() + ACCESS_SECONDS * 1000;
  response.cookies.set(cookieName(bookingId), `${expires}.${sign(`${bookingId}:${expires}`)}`, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    path: '/', maxAge: ACCESS_SECONDS,
  });
  return response;
}
