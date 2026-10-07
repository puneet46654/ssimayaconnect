import { isValidEmail, isValidPhone, normalizeEmail, normalizePhone } from '@/lib/phone';
import { BookingError } from '@/lib/bookings/mutations';
import type { BookingDetails } from '@/lib/booking-contracts';

/** Shared by confirmed and pending bookings so both store identical, normalized contacts. */
export function readBookingDetails(input: unknown): BookingDetails {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BookingError(400, 'Valid attendee details are required.');
  const details: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!key || key.startsWith('$') || key.includes('.') || ['__proto__', 'constructor', 'prototype'].includes(key)) continue;
    if (typeof value === 'string') details[key] = value.trim();
  }
  if (!details.fullName) throw new BookingError(400, 'Full name is required.');
  if (!isValidEmail(details.email)) throw new BookingError(400, 'Enter a valid email address.');
  if (!isValidPhone(details.mobile, details.countryCode)) throw new BookingError(400, 'Enter a valid full mobile number.');
  details.email = normalizeEmail(details.email);
  details.mobile = (details.mobile.startsWith('+') ? '+' : '') + normalizePhone(details.mobile);
  return details as BookingDetails;
}
