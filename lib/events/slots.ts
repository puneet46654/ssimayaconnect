export function timeToMinutes(value: string) {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return NaN;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function generateSlotTimes(
  startTime: string,
  endTime: string,
  durationStr: string,
  gapStr: string,
  lunchEnabled: boolean,
  lunchStartStr: string,
  lunchEndStr: string,
) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  const duration = Number(durationStr);
  const gap = Number(gapStr);
  const lunchStart = lunchEnabled ? timeToMinutes(lunchStartStr) : 0;
  const lunchEnd = lunchEnabled ? timeToMinutes(lunchEndStr) : 0;
  const slots: { startTime: string; endTime: string }[] = [];
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start
    || !Number.isInteger(duration) || duration < 1 || duration > 1440
    || !Number.isInteger(gap) || gap < 0 || gap > 1440) return slots;
  if (lunchEnabled && (!Number.isFinite(lunchStart) || !Number.isFinite(lunchEnd)
    || lunchStart < start || lunchEnd > end || lunchEnd <= lunchStart)) return slots;
  let cursor = start;

  while (cursor + duration <= end) {
    const slotEnd = cursor + duration;
    const overlapsLunch =
      lunchEnabled && cursor < lunchEnd && slotEnd > lunchStart;

    if (overlapsLunch) {
      cursor = lunchEnd;
      continue;
    }

    slots.push({
      startTime: formatTime(cursor),
      endTime: formatTime(slotEnd),
    });
    cursor = slotEnd + gap;
  }

  return slots;
}

export function generateSlotPreview(schedule: {
  startTime: string; endTime: string; slotDuration: string; slotGap: string;
  capacity: string; lunchEnabled: boolean; lunchStart: string; lunchEnd: string;
}) {
  const capacity = Number(schedule.capacity);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 20) return [];
  return generateSlotTimes(schedule.startTime, schedule.endTime, schedule.slotDuration,
    schedule.slotGap, schedule.lunchEnabled, schedule.lunchStart, schedule.lunchEnd)
    .map(slot => `${slot.startTime} – ${slot.endTime}`);
}
