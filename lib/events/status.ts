import { calendarDate, zonedDate, slotInstant, DEFAULT_TIME_ZONE } from '@/lib/events/dates';

export function getEventStatus(startDate: Date | string, endDate: Date | string, now = new Date(), timeZone = DEFAULT_TIME_ZONE, storedStatus?: string) {
  if (storedStatus === 'CANCELLED') return 'CANCELLED' as const;
  const today = zonedDate(now, timeZone);
  if (today > calendarDate(endDate)) return 'COMPLETED' as const;
  if (today >= calendarDate(startDate)) return 'LIVE' as const;
  return 'UPCOMING' as const;
}

export function hasSlotEnded(scheduleDate: Date | string, endTime: string, now = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  const end = slotInstant(scheduleDate, endTime, timeZone).getTime();
  // Invalid schedules must not advertise bookable tickets.
  return !Number.isFinite(end) || now.getTime() >= end;
}

export function withCurrentEventStatus<T extends { startDate?: Date | string; endDate?: Date | string; status?: string; timeZone?: string }>(event: T): T {
  return event.startDate && event.endDate
    ? { ...event, status: getEventStatus(event.startDate, event.endDate, new Date(), event.timeZone, event.status) }
    : event;
}
