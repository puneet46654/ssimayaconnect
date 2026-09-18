import {
  generateSlotTimes,
  timeToMinutes,
} from '@/lib/events/slots';

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
  const start = timeToMinutes(schedule.startTime);
  const end = timeToMinutes(schedule.endTime);
  const capacity = Number(schedule.capacity);
  const duration = Number(schedule.slotDuration);
  const gap = Number(schedule.slotGap);

  if (!schedule.date || !schedule.startTime || !schedule.endTime) {
    return `Day ${index + 1}: schedule information is incomplete.`;
  }
  if (end <= start) {
    return `Day ${index + 1}: end time must be later than start time.`;
  }
  if (!duration || duration <= 0) {
    return `Day ${index + 1}: slot duration is invalid.`;
  }
  if (Number.isNaN(gap) || gap < 0) {
    return `Day ${index + 1}: slot gap is invalid.`;
  }
  if (capacity < 1 || capacity > 20) {
    return `Day ${index + 1}: capacity must be between 1 and 20.`;
  }
  if (schedule.lunchEnabled) {
    const lunchStart = timeToMinutes(schedule.lunchStart);
    const lunchEnd = timeToMinutes(schedule.lunchEnd);
    if (
      !schedule.lunchStart ||
      !schedule.lunchEnd ||
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
