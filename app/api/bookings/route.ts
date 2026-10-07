import { createHash, randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { Slot } from '@/models/Slot';
import { DaySchedule } from '@/models/DaySchedule';
import { eventTimeZone, zonedDate } from '@/lib/events/dates';
import { getEventStatus, hasSlotEnded } from '@/lib/events/status';
import { hasBookingAccess, withBookingAccess } from '@/lib/bookings/access';
import { BookingError, lockBookingEvent } from '@/lib/bookings/mutations';
import { bookingRequestData } from '@/lib/bookings/identity';
import { loadPublicBooking } from '@/lib/bookings/public-booking';
import { readBookingDetails } from '@/lib/bookings/details';
import { clearPendingBookings } from '@/lib/bookings/pending';
import { emitRealtimeChange } from '@/lib/realtime';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
type BookingDetailsInput = Record<string, unknown>;
const RESEND_API_URL = 'https://api.resend.com/emails';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

async function sendBookingEmail(input: {
  bookingId: string;
  eventName: string;
  timeZone: string;
  date: Date | string;
  startTime: string;
  endTime: string;
  details: BookingDetailsInput;
}) {
  // Confirmation emails are paused unless explicitly re-enabled in the environment.
  if (process.env.BOOKING_EMAILS_ENABLED !== 'true') return false;

  const apiKey =
    process.env.RESEND_API_KEY?.trim();
  const recipient =
    typeof input.details.email === 'string'
      ? input.details.email.trim().toLowerCase()
      : '';
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    'SSI Maya Connect <onboarding@resend.dev>';

  if (!apiKey || !recipient) {
    console.error(
      'Booking email skipped: Resend key or recipient is missing.',
    );
    return false;
  }

  const name =
    typeof input.details.fullName === 'string'
      ? input.details.fullName
      : 'Doctor';
  const date = new Date(input.date).toLocaleDateString(
    'en-IN',
    { dateStyle: 'long', timeZone: 'UTC' },
  );

  const response = await fetch(
    RESEND_API_URL,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`, 
        'Content-Type': 'application/json',
        'Idempotency-Key': `booking-confirmation/${input.bookingId}`,
      },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        from,
        to: [recipient],
        subject: `Booking Confirmed - ${input.eventName}`,
        html: `
          <h2>Booking Confirmed</h2>
          <p>Dear ${escapeHtml(name)}, your booking has been confirmed.</p>
          <p><strong>Booking ID:</strong> ${input.bookingId}</p>
          <p><strong>Event:</strong> ${escapeHtml(input.eventName)}</p>
          <p><strong>Date:</strong> ${date}</p>
          <p><strong>Time:</strong> ${input.startTime} - ${input.endTime} (${escapeHtml(input.timeZone)})</p>
        `,
      }),
    },
  );

  if (!response.ok) {
    const message =
      await response.text().catch(() => '');
    throw new Error(
      `Resend returned ${response.status}: ${message}`,
    );
  }

  return true;
}


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

    const result = await mongoose.connection.transaction(async session => {
      const event = await lockBookingEvent(eventId, session);
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
      const occupied = await Booking.countDocuments({ slotId }).session(session);
      if (occupied >= slot.capacity) throw new BookingError(409, 'This slot is no longer available.');
      await Slot.updateOne({ _id: slotId }, { $set: { bookedCount: occupied + 1 } }, { session });
      const bookingId = `SSI-MC-${zonedDate(new Date(), event.timeZone).slice(0, 4)}-${randomBytes(6).toString('hex').toUpperCase()}`;
      await Booking.create([{ bookingId, eventId, slotId, dayScheduleId, details, requestKeyHash, requestFingerprint,
        attendanceStatus: 'NOT_PRESENT', checkedInAt: null }], { session });
      return { bookingId, existing: false };
    });

    const booking = await loadPublicBooking(result.bookingId);
    if (!booking) throw new BookingError(409, 'This booking is no longer available. Contact event staff.');
    let emailSent = false;
    if (!result.existing) {
      try { await clearPendingBookings(eventId, details); }
      catch (error) { console.error('Pending booking cleanup failed:', error); }
      emitRealtimeChange({ resource: 'bookings', action: 'created', id: eventId });
      try {
        emailSent = await sendBookingEmail({ bookingId: booking.bookingId, eventName: booking.eventName,
          timeZone: eventTimeZone(booking.timeZone), date: booking.date, startTime: booking.startTime, endTime: booking.endTime, details });
      } catch (error) { console.error('Optional booking email failed:', error); }
    }
    return withBookingAccess(NextResponse.json({ success: true, existing: result.existing, emailSent, booking },
      { status: result.existing ? 200 : 201, headers: { 'Cache-Control': 'no-store' } }), booking.bookingId);
  } catch (error) { return failure(error, 'Unable to complete the booking. Please retry.'); }
}
