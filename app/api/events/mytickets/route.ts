import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { isValidPhone, normalizePhone, phoneIdentity } from '@/lib/phone';
import { hasBookingAccess, withBookingAccess } from '@/lib/bookings/access';
import { loadPublicBooking } from '@/lib/bookings/public-booking';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Reopening a ticket requires its browser grant; contact details are never sufficient. */
export async function GET(request: NextRequest) {
  const bookingId = request.nextUrl.searchParams.get('bookingId')?.trim().toUpperCase();
  if (!bookingId || !hasBookingAccess(request, bookingId)) {
    return NextResponse.json({ success: false, message: 'Enter your booking reference and full mobile number to recover a ticket.' }, { status: 403 });
  }
  try {
    await connectDB();
    const ticket = await loadPublicBooking(bookingId);
    if (!ticket) return NextResponse.json({ success: false, message: 'Booking not found.' }, { status: 404 });
    return NextResponse.json({ success: true, tickets: [ticket] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Ticket lookup failed:', error);
    return NextResponse.json({ success: false, message: 'Unable to fetch your ticket. Please retry.' }, { status: 500 });
  }
}

/** Reference/contact matching does not independently verify ownership of a phone. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const bookingId = typeof body?.bookingId === 'string' ? body.bookingId.trim().toUpperCase() : '';
    const mobile = typeof body?.mobile === 'string' ? body.mobile.trim() : '';
    if (!bookingId || !isValidPhone(mobile)) {
      return NextResponse.json({ success: false, message: 'Enter your booking reference and full mobile number, including country code.' }, { status: 400 });
    }
    await connectDB();
    const booking = await Booking.findOne({ bookingId }).select('details').lean();
    if (!booking || phoneIdentity(booking.details.mobile || booking.details.phone, booking.details.countryCode) !== normalizePhone(mobile)) {
      return NextResponse.json({ success: false, message: 'No ticket matches that reference and mobile number. Check both details or contact event staff.' }, { status: 404 });
    }
    const ticket = await loadPublicBooking(bookingId);
    if (!ticket) return NextResponse.json({ success: false, message: 'Booking not found.' }, { status: 404 });
    return withBookingAccess(NextResponse.json({ success: true, tickets: [ticket] }, { headers: { 'Cache-Control': 'no-store' } }), bookingId);
  } catch (error) {
    console.error('Ticket recovery failed:', error);
    return NextResponse.json({ success: false, message: 'Unable to recover your ticket. Please retry.' }, { status: 500 });
  }
}
