import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { isValidPhone, normalizePhone, phoneIdentity } from '@/lib/phone';
import { loadPublicBooking } from '@/lib/bookings/public-booking';
import { hasBookingAccess } from '@/lib/bookings/access';
import { slotInstant } from '@/lib/events/dates';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Find tickets by registered mobile number only. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const mobile = typeof body?.mobile === 'string' ? body.mobile.trim() : '';
    if (!isValidPhone(mobile)) {
      return NextResponse.json({ success: false, message: 'Enter the mobile number you registered with.' }, { status: 400 });
    }
    const wanted = normalizePhone(mobile);
    await connectDB();
    const candidates = await Booking.find({}).select('bookingId details.mobile details.phone details.countryCode').lean();
    const ids = candidates
      .filter(b => phoneIdentity(b.details?.mobile || b.details?.phone, b.details?.countryCode) === wanted)
      .map(b => b.bookingId);
    const loaded = await Promise.all(ids.map(id => loadPublicBooking(id)));
    // Only the device that made a booking may reschedule or cancel it (a phone number alone is not proof),
    // and only before its slot starts.
    const tickets = loaded.filter((t): t is NonNullable<typeof t> => !!t)
      .map(ticket => ({ ...ticket, canManage: ticket.status === 'ACTIVE' && hasBookingAccess(request, ticket.bookingId)
        && slotInstant(ticket.date, ticket.startTime, ticket.timeZone).getTime() > Date.now() }));
    return NextResponse.json({ success: true, tickets }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Ticket lookup failed:', error);
    return NextResponse.json({ success: false, message: 'Unable to fetch your tickets. Please retry.' }, { status: 500 });
  }
}
