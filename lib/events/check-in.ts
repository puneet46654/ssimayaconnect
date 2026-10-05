import { eventTimeZone, formatSlotTime, calendarDate, slotInstant } from './dates';

/** Admission uses the reserved interval, including its start and excluding its end. */
export function checkInWindow(date: Date | string, startTime: string, endTime: string, timeZone?: string, now = new Date()) {
  const zone = eventTimeZone(timeZone);
  const start = slotInstant(date, startTime, zone).getTime();
  const end = slotInstant(date, endTime, zone).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return { allowed: false, message: 'This ticket has an invalid appointment time. Ask event staff for assistance.' };
  }
  return { allowed: now.getTime() >= start && now.getTime() < end,
    message: `Check-in is available on ${calendarDate(date)} from ${formatSlotTime(startTime)} to ${formatSlotTime(endTime)} (${zone}).` };
}
