import { PendingBooking } from '@/models/PendingBooking';
import { calendarDate, DAY_MS, zonedDayStart } from '@/lib/events/dates';
import type { BookingDetails } from '@/lib/booking-contracts';

/** Matches getEventStatus: an event is COMPLETED from the start of the day after its end date. */
export function eventEndsAt(endDate: Date | string, timeZone?: string) {
  return zonedDayStart(calendarDate(new Date(new Date(endDate).getTime() + DAY_MS)), timeZone);
}

/** A confirmed booking replaces any pending registration for the same contact. */
export async function clearPendingBookings(eventId: string, details: Pick<BookingDetails, 'email' | 'mobile'>) {
  const contacts = [
    ...(details.email ? [{ 'details.email': details.email }] : []),
    ...(details.mobile ? [{ 'details.mobile': details.mobile }] : []),
  ];
  if (!contacts.length) return;
  await PendingBooking.deleteMany({ eventId, $or: contacts });
}
