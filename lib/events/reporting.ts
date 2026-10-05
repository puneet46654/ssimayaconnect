import { DAY_MS, calendarDateFormatter, zonedDate, DEFAULT_TIME_ZONE } from '@/lib/events/dates';

export function buildRegistrationTrend(
  bookings: Array<{ createdAt: string; attendanceStatus: string }>,
  requestedStart: Date | null,
  requestedEndExclusive: Date | null,
  now = new Date(),
  timeZone = DEFAULT_TIME_ZONE,
) {
  const dates = bookings.map(booking => zonedDate(booking.createdAt, timeZone)).filter(Boolean).sort();
  const endKey = requestedEndExclusive
    ? zonedDate(new Date(requestedEndExclusive.getTime() - 1), timeZone)
    : dates.at(-1) || zonedDate(now, timeZone);
  const startKey = requestedStart ? zonedDate(requestedStart, timeZone)
    : dates[0] || new Date(new Date(endKey).getTime() - 6 * DAY_MS).toISOString().slice(0, 10);
  const start = new Date(startKey);
  const end = new Date(endKey);
  const monthly = (end.getTime() - start.getTime()) / DAY_MS + 1 > 62;
  const buckets = new Map<string, { period: string; registered: number; present: number }>();
  const cursor = new Date(monthly ? `${startKey.slice(0, 7)}-01` : startKey);
  const formatter = calendarDateFormatter('en-GB', monthly
    ? { month: 'short', year: 'numeric' }
    : { day: '2-digit', month: 'short' });
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, monthly ? 7 : 10);
    buckets.set(key, { period: formatter.format(cursor), registered: 0, present: 0 });
    if (monthly) cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    else cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  for (const booking of bookings) {
    const key = zonedDate(booking.createdAt, timeZone).slice(0, monthly ? 7 : 10);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.registered++;
    if (booking.attendanceStatus === 'PRESENT') bucket.present++;
  }
  return [...buckets.values()];
}
