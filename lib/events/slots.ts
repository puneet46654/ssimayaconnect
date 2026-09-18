export function timeToMinutes(value: string) {
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
