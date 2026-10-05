import { normalizeEmail, phoneIdentity } from '@/lib/phone';
import type { BookingDetails } from '@/lib/booking-contracts';

export function attendeeIdentity(details: Partial<BookingDetails>) {
  return JSON.stringify([
    details.fullName?.trim().toLowerCase() || '',
    normalizeEmail(details.email),
    phoneIdentity(details.mobile || details.phone, details.countryCode),
  ]);
}

export function sameContact(left: Partial<BookingDetails>, right: Partial<BookingDetails>) {
  const email = normalizeEmail(left.email);
  const phone = phoneIdentity(left.mobile || left.phone, left.countryCode);
  return (!!email && email === normalizeEmail(right.email))
    || (!!phone && phone === phoneIdentity(right.mobile || right.phone, right.countryCode));
}

export function bookingRequestData(eventId: string, dayScheduleId: string, slotId: string, details: Partial<BookingDetails>) {
  return JSON.stringify([eventId, dayScheduleId, slotId, Object.entries(details).sort(([a], [b]) => a.localeCompare(b))]);
}
