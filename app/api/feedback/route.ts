import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { Feedback, type FeedbackScope } from '@/models/Feedback';
import { Booking } from '@/models/Booking';
import { Event } from '@/models/Event';
import { hasBookingAccess } from '@/lib/bookings/access';
import { BookingError } from '@/lib/bookings/mutations';
import { emitRealtimeChange } from '@/lib/realtime';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const SESSION_COOKIE = 'ssimaya_session_id';
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
function sessionId(request: NextRequest) { return request.cookies.get(SESSION_COOKIE)?.value || randomUUID(); }
function reply(session: string, body: Record<string, unknown>, status = 200) {
  const response = NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  response.cookies.set(SESSION_COOKIE, session, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 2592000 });
  return response;
}
async function identity(request: NextRequest, input: Record<string, unknown>) {
  const scope = text(input.scope) as FeedbackScope;
  if (scope !== 'application' && scope !== 'event') throw new BookingError(400, 'Invalid feedback scope.');
  if (scope === 'application') return { scope }; // General app feedback never identifies an attendee.
  const eventId = text(input.eventId), bookingId = text(input.bookingId).toUpperCase();
  if (!mongoose.Types.ObjectId.isValid(eventId) || !bookingId) throw new BookingError(400, 'Select a ticket in My Tickets before leaving event feedback.');
  if (!hasBookingAccess(request, bookingId)) throw new BookingError(403, 'Recover this ticket in My Tickets before leaving event feedback.');
  const booking = await Booking.findOne({ bookingId, eventId }).select('_id eventId bookingId').lean();
  if (!booking || !await Event.exists({ _id: eventId })) throw new BookingError(404, 'The ticket does not belong to this event or is no longer available.');
  if (input.bookingMongoId && text(input.bookingMongoId) !== String(booking._id)) throw new BookingError(400, 'The booking identifiers do not match.');
  return { scope, eventId, bookingId: booking.bookingId, bookingMongoId: String(booking._id) };
}
function duplicateMessage(scope: FeedbackScope) {
  return scope === 'application' ? 'You have already submitted application feedback.' : 'You have already submitted feedback for this event.';
}
export async function POST(request: NextRequest) {
  const session = sessionId(request);
  try {
    const input = await request.json();
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BookingError(400, 'Invalid feedback request.');
    const rating = Number(input.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new BookingError(400, 'Rating must be an integer between 1 and 5.');
    await connectDB();
    const verified = await identity(request, input);
    const query = { sessionId: session, scope: verified.scope, ...(verified.eventId ? { eventId: verified.eventId } : {}) };
    if (await Feedback.exists(query)) return reply(session, { success: false, duplicate: true, error: duplicateMessage(verified.scope) }, 409);
    try {
      await Feedback.create({ sessionId: session, ...verified, rating, message: text(input.message).slice(0, 500),
        suggestedFeature: text(input.suggestedFeature).slice(0, 200), submittedAt: new Date() });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        return reply(session, { success: false, duplicate: true, error: duplicateMessage(verified.scope) }, 409);
      }
      throw error;
    }
    emitRealtimeChange({ resource: 'bookings', action: 'updated', id: verified.eventId });
    return reply(session, { success: true });
  } catch (error) {
    if (!(error instanceof BookingError)) console.error('Feedback submission failed:', error);
    return reply(session, { success: false, error: error instanceof BookingError ? error.message : 'Unable to submit feedback. Please retry.' }, error instanceof BookingError ? error.status : 500);
  }
}
export async function GET(request: NextRequest) {
  const session = sessionId(request);
  try {
    await connectDB();
    const verified = await identity(request, Object.fromEntries(request.nextUrl.searchParams));
    const submitted = await Feedback.exists({ sessionId: session, scope: verified.scope, ...(verified.eventId ? { eventId: verified.eventId } : {}) });
    return reply(session, { success: true, submitted: Boolean(submitted) });
  } catch (error) {
    if (!(error instanceof BookingError)) console.error('Feedback status failed:', error);
    return reply(session, { success: false, error: error instanceof BookingError ? error.message : 'Unable to check feedback status. Please retry.' }, error instanceof BookingError ? error.status : 500);
  }
}
