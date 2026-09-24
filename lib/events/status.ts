export function getEventStatus(
  startDate: Date,
  endDate: Date,
  now = new Date(),
) {
  const today = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    ),
  );
  const start = new Date(
    Date.UTC(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth(),
      startDate.getUTCDate(),
    ),
  );
  const end = new Date(
    Date.UTC(
      endDate.getUTCFullYear(),
      endDate.getUTCMonth(),
      endDate.getUTCDate(),
    ),
  );

  if (today > end) return 'COMPLETED' as const;
  if (today >= start) return 'LIVE' as const;
  return 'UPCOMING' as const;
}

/*
 * Schedule dates are stored as UTC midnight and slot times
 * are India (IST) wall-clock times.
 */
export function hasSlotEnded(
  scheduleDate: Date | string,
  endTime: string,
  now = new Date(),
) {
  const date = new Date(scheduleDate);
  if (Number.isNaN(date.getTime()) || !/^\d{2}:\d{2}$/.test(endTime)) {
    return false;
  }
  const day = date.toISOString().slice(0, 10);
  return now.getTime() > new Date(`${day}T${endTime}:00+05:30`).getTime();
}
