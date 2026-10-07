import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Event } from '@/models/Event';
import { Booking } from '@/models/Booking';
import { PendingBooking } from '@/models/PendingBooking';
import { getEventStatus } from '@/lib/events/status';
import { readBookingDetails } from '@/lib/bookings/details';
import { BookingError } from '@/lib/bookings/mutations';
import { eventEndsAt } from '@/lib/bookings/pending';
import { emitRealtimeChange } from '@/lib/realtime';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const MAX_BODY_CHARS = 10_000;

/** Records attendee details as Pending until a slot is booked or the event ends. */
export async function POST(request: NextRequest) {
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_CHARS) throw new BookingError(413, 'Booking details are too large.');
    let body: { eventId?: unknown; draftId?: unknown; details?: unknown } | null = null;
    try { body = JSON.parse(raw); } catch { /* Rejected below. */ }
    const eventId = typeof body?.eventId === 'string' ? body.eventId.trim() : '';
    const draftId = typeof body?.draftId === 'string' ? body.draftId.trim() : '';
    if (!mongoose.Types.ObjectId.isValid(eventId) || !UUID.test(draftId)) throw new BookingError(400, 'Valid event and draft references are required.');
    const details = readBookingDetails(body?.details);

    await connectDB();
    const event = await Event.findById(eventId).select('startDate endDate timeZone status').lean();
    if (!event) throw new BookingError(404, 'Event not found.');
    const status = getEventStatus(event.startDate, event.endDate, new Date(), event.timeZone, event.status);
    if (status === 'COMPLETED' || status === 'CANCELLED') {
      return NextResponse.json({ success: true, saved: false, ended: true }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const expiresAt = eventEndsAt(event.endDate, event.timeZone);

    // Someone who already holds a ticket is not pending; their ticket is shown instead.
    const booked = await Booking.exists({ eventId, $or: [{ 'details.email': details.email }, { 'details.mobile': details.mobile }] });
    if (booked) {
      return NextResponse.json({ success: true, saved: false, booked: true, expiresAt: expiresAt.toISOString() },
        { headers: { 'Cache-Control': 'no-store' } });
    }

    await PendingBooking.init();
    await PendingBooking.updateOne({ eventId, draftId }, { $set: { details, expiresAt } }, { upsert: true });
    emitRealtimeChange({ resource: 'bookings', action: 'updated', id: eventId });
    return NextResponse.json({ success: true, saved: true, expiresAt: expiresAt.toISOString() },
      { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (!(error instanceof BookingError)) console.error('POST /api/bookings/pending failed:', error);
    return NextResponse.json({ success: false, error: error instanceof BookingError ? error.message : 'Unable to save booking details.' },
      { status: error instanceof BookingError ? error.status : 500 });
  }
}
