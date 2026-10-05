import { Temporal } from '@js-temporal/polyfill';

export const DEFAULT_TIME_ZONE = 'Asia/Kolkata';
export const DAY_MS = 86_400_000;

export function isTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || !value || /^[+-]/.test(value)) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; }
}

export function eventTimeZone(value?: string): string {
  return isTimeZone(value) ? value : DEFAULT_TIME_ZONE;
}

export function deviceTimeZone(): string {
  try { return eventTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone); }
  catch { return DEFAULT_TIME_ZONE; }
}

export function eventDateFormatter(locales: string, options: Intl.DateTimeFormatOptions = {}, timeZone = deviceTimeZone()) {
  return new Intl.DateTimeFormat(locales, {
    ...(options.hour || options.minute ? { timeZoneName: 'short' as const } : {}),
    ...options, timeZone: eventTimeZone(timeZone),
  });
}

/** Date-only values are calendar labels, never viewer-dependent instants. */
export function calendarDateFormatter(locales: string, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat(locales, { ...options, timeZone: 'UTC' });
}

/** Calendar dates are persisted as UTC midnight, not as appointment instants. */
export function calendarDate(value: Date | string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

export function isCalendarDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && calendarDate(value) === value;
}

/** Convert an actual instant to its business calendar date. */
export function zonedDate(value: Date | string = new Date(), timeZone = DEFAULT_TIME_ZONE): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: eventTimeZone(timeZone), year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

export function todayCalendarDate(now = new Date(), timeZone = DEFAULT_TIME_ZONE): Date {
  return new Date(`${zonedDate(now, timeZone)}T00:00:00.000Z`);
}

export function zonedDayStart(value: string, timeZone = DEFAULT_TIME_ZONE): Date {
  try {
    return new Date(Temporal.PlainDate.from(value).toZonedDateTime(eventTimeZone(timeZone)).epochMilliseconds);
  } catch { return new Date(NaN); }
}

/** Reject skipped or repeated clock times instead of silently moving a reservation. */
export function slotInstant(date: Date | string, time: string, timeZone = DEFAULT_TIME_ZONE): Date {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return new Date(NaN);
  try {
    const local = Temporal.PlainDateTime.from(`${calendarDate(date)}T${time}:00`);
    return new Date(local.toZonedDateTime(eventTimeZone(timeZone), { disambiguation: 'reject' }).epochMilliseconds);
  } catch { return new Date(NaN); }
}

export function formatSlotTime(value: string): string {
  const instant = slotInstant('2000-01-01', value, 'UTC');
  return Number.isNaN(instant.getTime()) ? value : new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(instant);
}
