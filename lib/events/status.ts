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
