import { phoneIdentity } from '@/lib/phone';
import { type BookingApiResponse, type BookingDetails, type ServerBooking, bookingStorage, ticketStorage } from '@/lib/booking-contracts';
import { bookingRequestData } from '@/lib/bookings/identity';
import { clearPendingBooking } from '@/lib/pending-booking';

type BookingIntent = { key: string; fingerprint: string; bookingId?: string };
export type SlotChoice = { dayScheduleId: string; slotId: string };

/** One retry key per exact request (details + slot), so double taps and retries never create two bookings. */
function readBookingIntent(eventId: string, fingerprint: string): BookingIntent {
  try {
    const saved = JSON.parse(sessionStorage.getItem(bookingStorage.intent(eventId)) || 'null') as BookingIntent | null;
    if (saved?.fingerprint === fingerprint && saved.key) return saved;
  } catch { /* Invalid caches are not proof of a booking. */ }
  const intent = { key: crypto.randomUUID(), fingerprint };
  sessionStorage.setItem(bookingStorage.intent(eventId), JSON.stringify(intent));
  return intent;
}

export function readBookingDetails(eventId: string): BookingDetails | null {
  try {
    const details = JSON.parse(sessionStorage.getItem(bookingStorage.details(eventId)) || 'null') as BookingDetails | null;
    return details?.fullName && details.email && details.mobile ? details : null;
  } catch { return null; }
}

/** Creates (or, on retry, re-reads) the booking for the details entered on this device. */
export async function confirmBooking(eventId: string, slot: SlotChoice): Promise<ServerBooking> {
  const details = readBookingDetails(eventId);
  if (!details) throw new Error('Your details could not be found. Please fill in the registration form again.');
  const intent = readBookingIntent(eventId, bookingRequestData(eventId, slot.dayScheduleId, slot.slotId, details));

  let booking: ServerBooking | undefined;
  if (intent.bookingId) {
    const response = await fetch(`/api/bookings?bookingId=${encodeURIComponent(intent.bookingId)}`, { cache: 'no-store' });
    const data: BookingApiResponse = await response.json().catch(() => ({}));
    if (response.ok && data.booking?.slotId === slot.slotId) booking = data.booking;
  }
  if (!booking) {
    const response = await fetch('/api/bookings', {
      method: 'POST', credentials: 'include', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, ...slot, details, idempotencyKey: intent.key }),
    });
    const data: BookingApiResponse = await response.json().catch(() => ({}));
    if (!response.ok || !data.success || !data.booking) throw new Error(data.error || data.message || 'Unable to confirm booking. Please retry.');
    booking = data.booking;
  }

  try {
    sessionStorage.setItem(bookingStorage.intent(eventId), JSON.stringify({ ...intent, bookingId: booking.bookingId }));
    sessionStorage.removeItem(bookingStorage.draft(eventId));
    sessionStorage.removeItem(bookingStorage.country(eventId));
    clearPendingBooking(eventId);
    // My Tickets shows this booking automatically until its slot ends.
    const mobile = phoneIdentity(booking.details?.mobile, booking.details?.countryCode);
    if (mobile) localStorage.setItem(ticketStorage.mobile, mobile);
  } catch { /* Cache failure must not hide a confirmed booking. */ }
  return booking;
}
