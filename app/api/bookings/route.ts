import { createHash, randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { Slot } from '@/models/Slot';
import { DaySchedule } from '@/models/DaySchedule';
import { Event } from '@/models/Event';
import { zonedDate } from '@/lib/events/dates';
import { getEventStatus, hasSlotEnded } from '@/lib/events/status';
import { hasBookingAccess, withBookingAccess } from '@/lib/bookings/access';
import { BookingError } from '@/lib/bookings/mutations';
import { bookingRequestData } from '@/lib/bookings/identity';
import { loadPublicBooking } from '@/lib/bookings/public-booking';
import { readBookingDetails } from '@/lib/bookings/details';
import { clearPendingBookings } from '@/lib/bookings/pending';
import { cancelOwnBooking, rescheduleOwnBooking } from '@/lib/bookings/self-service';
import { emitRealtimeChange } from '@/lib/realtime';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

function failure(error: unknown, fallback: string) {
  if (!(error instanceof BookingError)) console.error(fallback, error);
  return NextResponse.json({ success: false, error: error instanceof BookingError ? error.message : fallback },
    { status: error instanceof BookingError ? error.status : 500 });
}

export async function GET(request: NextRequest) {
  try {
    const bookingId = request.nextUrl.searchParams.get('bookingId')?.trim();
    if (!bookingId) throw new BookingError(400, 'Booking reference is required.');
    if (!hasBookingAccess(request, bookingId)) throw new BookingError(403, 'Open My Tickets and enter your booking reference and full mobile number.');
    await connectDB();
    const booking = await loadPublicBooking(bookingId);
    if (!booking) throw new BookingError(404, 'Booking not found.');
    return withBookingAccess(NextResponse.json({ success: true, booking }, { headers: { 'Cache-Control': 'no-store' } }), bookingId);
  } catch (error) { return failure(error, 'Unable to retrieve booking.'); }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const eventId = typeof body?.eventId === 'string' ? body.eventId.trim() : '';
    const slotId = typeof body?.slotId === 'string' ? body.slotId.trim() : '';
    const dayScheduleId = typeof body?.dayScheduleId === 'string' ? body.dayScheduleId.trim() : '';
    if (![eventId, slotId, dayScheduleId].every(id => mongoose.Types.ObjectId.isValid(id))) {
      throw new BookingError(400, 'Valid event, schedule and slot references are required.');
    }
    if (typeof body.idempotencyKey !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.idempotencyKey)) {
      throw new BookingError(400, 'A valid booking retry key is required. Reopen the booking form.');
    }
    const details = readBookingDetails(body.details);
    const requestKeyHash = hash(body.idempotencyKey);
    const requestFingerprint = hash(bookingRequestData(eventId, dayScheduleId, slotId, details));
    await connectDB();
    await Booking.init();

    // Only the chosen slot is written, so bookings in different slots never contend with each other.
    const result = await mongoose.connection.transaction(async session => {
      const event = await Event.findById(eventId).session(session);
      if (!event) throw new BookingError(404, 'Event not found.');
      const existing = await Booking.findOne({ eventId, requestKeyHash }).session(session);
      if (existing) {
        if (existing.requestFingerprint !== requestFingerprint) throw new BookingError(409, 'This retry key belongs to different booking details. Start a new booking.');
        return { bookingId: existing.bookingId, existing: true };
      }
      if (event.status === 'CANCELLED') throw new BookingError(409, 'This event has been cancelled. Tickets are not valid for admission.');
      if (getEventStatus(event.startDate, event.endDate, new Date(), event.timeZone, event.status) === 'COMPLETED') {
        throw new BookingError(409, 'This event is not currently accepting bookings.');
      }
      const schedule = await DaySchedule.findOne({ _id: dayScheduleId, eventId }).session(session);
      const slot = await Slot.findOne({ _id: slotId, eventId, dayScheduleId }).session(session);
      if (!schedule || !slot) throw new BookingError(400, 'Selected schedule or slot is invalid.');
      if (hasSlotEnded(schedule.date, slot.endTime, new Date(), event.timeZone)) throw new BookingError(409, 'This time slot has already ended. Please choose another slot.');
      // Atomically claim a seat only while one is left; concurrent requests cannot overbook.
      const claimed = await Slot.findOneAndUpdate(
        { _id: slotId, eventId, dayScheduleId, $expr: { $lt: ['$bookedCount', '$capacity'] } },
        { $inc: { bookedCount: 1 } }, { session, new: true },
      );
      if (!claimed) throw new BookingError(409, 'This slot is no longer available.');
      const bookingId = `SSI-MC-${zonedDate(new Date(), event.timeZone).slice(0, 4)}-${randomBytes(6).toString('hex').toUpperCase()}`;
      await Booking.create([{ bookingId, eventId, slotId, dayScheduleId, details, requestKeyHash, requestFingerprint,
        attendanceStatus: 'NOT_PRESENT', checkedInAt: null }], { session });
      return { bookingId, existing: false };
    });

    const booking = await loadPublicBooking(result.bookingId);
    if (!booking) throw new BookingError(409, 'This booking is no longer available. Contact event staff.');
    if (!result.existing) {
      try { await clearPendingBookings(eventId, details); }
      catch (error) { console.error('Pending booking cleanup failed:', error); }
      emitRealtimeChange({ resource: 'bookings', action: 'created', id: eventId });
    }
    return withBookingAccess(NextResponse.json({ success: true, existing: result.existing, booking },
      { status: result.existing ? 200 : 201, headers: { 'Cache-Control': 'no-store' } }), booking.bookingId);
  } catch (error) { return failure(error, 'Unable to complete the booking. Please retry.'); }
}

/** Attendee self-service: only the browser that made the booking holds its access cookie. */
function managedBookingId(request: NextRequest, value: unknown) {
  const bookingId = typeof value === 'string' ? value.trim() : '';
  if (!bookingId) throw new BookingError(400, 'Booking reference is required.');
  if (!hasBookingAccess(request, bookingId)) {
    throw new BookingError(403, 'For your security, bookings can only be changed on the device used to book. Please contact event staff.');
  }
  return bookingId;
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const bookingId = managedBookingId(request, body?.bookingId);
    await connectDB();
    const eventId = await rescheduleOwnBooking(bookingId,
      typeof body?.dayScheduleId === 'string' ? body.dayScheduleId : '', typeof body?.slotId === 'string' ? body.slotId : '');
    emitRealtimeChange({ resource: 'bookings', action: 'updated', id: eventId });
    const booking = await loadPublicBooking(bookingId);
    return NextResponse.json({ success: true, booking }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error, 'Unable to change the time slot. Please retry.'); }
}

export async function DELETE(request: NextRequest) {
  try {
    const bookingId = managedBookingId(request, request.nextUrl.searchParams.get('bookingId'));
    await connectDB();
    const eventId = await cancelOwnBooking(bookingId);
    emitRealtimeChange({ resource: 'bookings', action: 'deleted', id: eventId });
    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error, 'Unable to cancel the booking. Please retry.'); }
}
