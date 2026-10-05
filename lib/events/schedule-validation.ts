import {
  generateSlotTimes,
  timeToMinutes,
} from '@/lib/events/slots';
import { isCalendarDate, isTimeZone, slotInstant, DEFAULT_TIME_ZONE } from '@/lib/events/dates';

export type ScheduleInput = {
  date: string;
  startTime: string;
  endTime: string;
  lunchEnabled: boolean;
  lunchStart: string;
  lunchEnd: string;
  slotDuration: string;
  slotGap: string;
  capacity: string;
  sameAsDay1: boolean;
};

export function validateSchedule(
  schedule: ScheduleInput,
  index: number,
) {
  if (!schedule || typeof schedule !== 'object') return `Day ${index + 1}: invalid schedule.`;
  const start = timeToMinutes(schedule.startTime);
  const end = timeToMinutes(schedule.endTime);
  const capacity = Number(schedule.capacity);
  const duration = Number(schedule.slotDuration);
  const gap = Number(schedule.slotGap);

  if (!isCalendarDate(schedule.date) || !Number.isFinite(start) || !Number.isFinite(end)) {
    return `Day ${index + 1}: schedule information is incomplete.`;
  }
  if (end <= start) {
    return `Day ${index + 1}: end time must be later than start time.`;
  }
  if (!Number.isInteger(duration) || duration < 1 || duration > 1440) {
    return `Day ${index + 1}: slot duration is invalid.`;
  }
  if (!Number.isInteger(gap) || gap < 0 || gap > 1440) {
    return `Day ${index + 1}: slot gap is invalid.`;
  }
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 20) {
    return `Day ${index + 1}: capacity must be between 1 and 20.`;
  }
  if (schedule.lunchEnabled) {
    const lunchStart = timeToMinutes(schedule.lunchStart);
    const lunchEnd = timeToMinutes(schedule.lunchEnd);
    if (
      !Number.isFinite(lunchStart) ||
      !Number.isFinite(lunchEnd) ||
      lunchStart < start ||
      lunchEnd > end ||
      lunchEnd <= lunchStart
    ) {
      return `Day ${index + 1}: lunch must fall within the event schedule.`;
    }
  }
  if (
    !generateSlotTimes(
      schedule.startTime,
      schedule.endTime,
      schedule.slotDuration,
      schedule.slotGap,
      schedule.lunchEnabled,
      schedule.lunchStart,
      schedule.lunchEnd,
    ).length
  ) {
    return `Day ${index + 1}: schedule does not generate any slots.`;
  }
  return '';
}

export function validateEventSchedules(start: string, end: string, count: number, schedules: unknown, timeZone = DEFAULT_TIME_ZONE): string {
  if (!isTimeZone(timeZone)) return 'Select a valid event timezone.';
  if (!isCalendarDate(start) || !isCalendarDate(end) || end < start) return 'Enter valid event dates with the end on or after the start.';
  if (!Number.isInteger(count) || count < 1 || count > 10) return 'Number of event days must be between 1 and 10.';
  if (!Array.isArray(schedules) || schedules.length !== count) return 'Day schedule count does not match the number of event days.';
  let previousDate = '';
  for (let index = 0; index < schedules.length; index++) {
    const schedule = schedules[index] as ScheduleInput;
    const error = validateSchedule(schedule, index);
    if (error) return error;
    const slots = generateSlotTimes(schedule.startTime, schedule.endTime, schedule.slotDuration, schedule.slotGap, schedule.lunchEnabled, schedule.lunchStart, schedule.lunchEnd);
    const times = [schedule.startTime, schedule.endTime, ...slots.flatMap(slot => [slot.startTime, slot.endTime])];
    if (times.some(time => !Number.isFinite(slotInstant(schedule.date, time, timeZone).getTime()))) {
      return `Day ${index + 1}: a time is skipped or repeated by a clock change in ${timeZone}. Choose times outside that transition.`;
    }
    if (schedule.date < start || schedule.date > end) return `Day ${index + 1}: date must fall within the event dates.`;
    if (schedule.date <= previousDate) return 'Schedule dates must be distinct and in ascending order.';
    previousDate = schedule.date;
  }
  return '';
}
