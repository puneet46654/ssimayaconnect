import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { adminAccessError } from '@/lib/admin-api-auth';
import { connectDB } from '@/lib/db';
import { AnalyticsEvent } from '@/models/AnalyticsEvent';
import { AnalyticsPresence } from '@/models/AnalyticsPresence';
import { Event } from '@/models/Event';

export const dynamic = 'force-dynamic';

// A tab that has not reported for this long is treated as closed.
const ONLINE_WINDOW_MS = 45000;
const MINUTES = 30;

/** Who is on the site right now, what they are viewing, and the latest activity. Polled every few seconds. */
export async function GET() {
  try {
    const denied = await adminAccessError('reports');
    if (denied) return denied;
    await connectDB();
    const now = Date.now();

    const [online, recent, perMinute] = await Promise.all([
      AnalyticsPresence.find({ lastSeen: { $gte: new Date(now - ONLINE_WINDOW_MS) } }).select('visitorId path eventId city country device').lean(),
      AnalyticsEvent.find({ kind: 'pageview', ts: { $gte: new Date(now - 60 * 60e3) } })
        .sort({ ts: -1 }).limit(20).select('ts path eventId city country device browser').lean(),
      AnalyticsEvent.aggregate([
        { $match: { kind: 'pageview', ts: { $gte: new Date(now - MINUTES * 60e3) } } },
        { $group: { _id: { $dateTrunc: { date: '$ts', unit: 'minute' } }, views: { $sum: 1 } } },
      ]),
    ]);

    const ids = [...new Set([...online, ...recent].map(row => row.eventId).filter((id): id is string => !!id && mongoose.Types.ObjectId.isValid(id)))];
    const names = new Map((await Event.find({ _id: { $in: ids } }).select('eventName').lean()).map(event => [String(event._id), event.eventName as string]));
    const label = (path: string, eventId?: string) => {
      const name = eventId ? names.get(eventId) || 'Event' : '';
      if (path === '/events') return 'Events list';
      if (path === '/events/mytickets') return 'My Tickets';
      if (path === '/events/:id') return name;
      if (path === '/events/:id/book') return `${name} · registration form`;
      if (path === '/events/:id/book/slots') return `${name} · choosing a slot`;
      if (path === '/events/:id/book/feedback') return `${name} · feedback`;
      return path;
    };

    const pages = new Map<string, number>();
    for (const row of online) pages.set(label(row.path, row.eventId), (pages.get(label(row.path, row.eventId)) || 0) + 1);
    const counts = new Map(perMinute.map((row: { _id: Date; views: number }) => [new Date(row._id).getTime(), row.views]));
    const thisMinute = Math.floor(now / 60e3) * 60e3;

    return NextResponse.json({
      success: true,
      at: new Date(now).toISOString(),
      online: new Set(online.map(row => row.visitorId)).size,
      onlineTabs: online.length,
      pagesNow: [...pages].map(([page, count]) => ({ page, count })).sort((a, b) => b.count - a.count).slice(0, 10),
      devicesNow: ['Mobile', 'Desktop', 'Tablet'].map(device => ({ device, count: online.filter(row => row.device === device).length })),
      recent: recent.map(row => ({ ts: row.ts, page: label(row.path, row.eventId), city: row.city, country: row.country, device: row.device, browser: row.browser })),
      perMinute: Array.from({ length: MINUTES }, (_, index) => {
        const t = thisMinute - (MINUTES - 1 - index) * 60e3;
        return { t: new Date(t).toISOString(), views: counts.get(t) || 0 };
      }),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('GET /api/admin/analytics/live failed:', error);
    return NextResponse.json({ success: false, message: 'Unable to load live analytics.' }, { status: 500 });
  }
}
