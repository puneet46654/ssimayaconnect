import { bookingStorage } from './booking-contracts';
import { readPendingBooking } from './pending-booking';

export function readBookingDraft(eventId: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (typeof window === 'undefined') return result;
  let completed = false;
  try { completed = !!JSON.parse(sessionStorage.getItem(bookingStorage.intent(eventId)) || 'null')?.bookingId; } catch { /* No completed intent. */ }
  // Lowest priority: details from an earlier visit that never reached a slot.
  if (!completed) {
    for (const [name, value] of Object.entries(readPendingBooking(eventId)?.details || {})) {
      if (typeof value === 'string') result[name] = value;
    }
  }
  for (const key of [bookingStorage.details(eventId), bookingStorage.draft(eventId)]) {
    if (completed && key === bookingStorage.details(eventId)) continue;
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) || '{}');
      if (!saved || typeof saved !== 'object' || Array.isArray(saved)) continue;
      for (const [name, entry] of Object.entries(saved)) {
        const value = typeof entry === 'string' ? entry : entry && typeof entry === 'object' && 'value' in entry ? entry.value : undefined;
        if (typeof value === 'string') result[name] = value;
      }
    } catch { /* An unusable cache must not prevent a new registration. */ }
  }
  try { Object.assign(result, JSON.parse(sessionStorage.getItem(bookingStorage.country(eventId)) || '{}')); } catch { /* Optional saved selections. */ }
  return result;
}
