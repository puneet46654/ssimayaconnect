import { NextRequest, NextResponse } from 'next/server';
import mongoose, { type PipelineStage } from 'mongoose';
import { adminAccessError } from '@/lib/admin-api-auth';
import { connectDB } from '@/lib/db';
import { AnalyticsEvent } from '@/models/AnalyticsEvent';
import { Booking } from '@/models/Booking';
import { PendingBooking } from '@/models/PendingBooking';
import { Event } from '@/models/Event';

export const dynamic = 'force-dynamic';

const RANGES = { '24h': { ms: 24 * 3600e3, unit: 'hour' }, '7d': { ms: 7 * 86400e3, unit: 'day' }, '30d': { ms: 30 * 86400e3, unit: 'day' } } as const;
const TIME_ZONE = 'Asia/Kolkata';
const FUNNEL = [
  ['Events list', '/events'],
  ['Event page', '/events/:id'],
  ['Registration form', '/events/:id/book'],
  ['Slot selection', '/events/:id/book/slots'],
] as const;

type Count = { _id: string | null; count: number };
const top = (field: string, limit = 10): PipelineStage.FacetPipelineStage[] => [
  { $match: { kind: 'pageview' } },
  { $group: { _id: `$${field}`, count: { $sum: 1 } } },
  { $sort: { count: -1 } },
  { $limit: limit },
];
const named = (rows: Count[], fallback = 'Unknown') => rows.map(row => ({ name: row._id || fallback, count: row.count }));

export async function GET(request: NextRequest) {
  try {
    const denied = await adminAccessError('reports');
    if (denied) return denied;

    const rangeKey = (request.nextUrl.searchParams.get('range') || '24h') as keyof typeof RANGES;
    const range = RANGES[rangeKey] || RANGES['24h'];
    const since = new Date(Date.now() - range.ms);
    await connectDB();

    const [facets] = await AnalyticsEvent.aggregate([
      { $match: { ts: { $gte: since } } },
      { $facet: {
        totals: [
          { $match: { kind: 'pageview' } },
          { $group: { _id: null, views: { $sum: 1 }, visitors: { $addToSet: '$visitorId' }, sessions: { $addToSet: '$sessionId' } } },
          { $project: { _id: 0, views: 1, visitors: { $size: '$visitors' }, sessions: { $size: '$sessions' } } },
        ],
        live: [
          { $match: { ts: { $gte: new Date(Date.now() - 5 * 60e3) } } },
          { $group: { _id: '$visitorId' } },
          { $count: 'count' },
        ],
        series: [
          { $match: { kind: 'pageview' } },
          { $group: { _id: { $dateTrunc: { date: '$ts', unit: range.unit, timezone: TIME_ZONE } },
            views: { $sum: 1 }, visitors: { $addToSet: '$visitorId' } } },
          { $project: { _id: 0, t: '$_id', views: 1, visitors: { $size: '$visitors' } } },
          { $sort: { t: 1 } },
        ],
        paths: [
          { $match: { kind: 'pageview' } },
          { $group: { _id: '$path', views: { $sum: 1 }, sessions: { $addToSet: '$sessionId' } } },
          { $project: { views: 1, sessions: { $size: '$sessions' } } },
          { $sort: { views: -1 } },
        ],
        events: [
          { $match: { kind: 'pageview', eventId: { $exists: true } } },
          { $group: { _id: '$eventId', views: { $sum: 1 }, visitors: { $addToSet: '$visitorId' } } },
          { $project: { views: 1, visitors: { $size: '$visitors' } } },
          { $sort: { views: -1 } },
          { $limit: 10 },
        ],
        referrers: top('referrer'),
        countries: top('country'),
        cities: top('city'),
        devices: top('device', 5),
        browsers: top('browser', 8),
        os: top('os', 8),
        api: [
          { $match: { kind: 'api' } },
          { $group: { _id: { path: '$path', method: '$method' }, count: { $sum: 1 },
            errors: { $sum: { $cond: [{ $or: [{ $gte: ['$status', 500] }, { $eq: ['$status', 0] }] }, 1, 0] } },
            pct: { $percentile: { input: '$ms', p: [0.5, 0.95], method: 'approximate' } }, max: { $max: '$ms' } } },
          { $sort: { count: -1 } },
          { $limit: 25 },
        ],
        // Bookings are created from the slot page, so a successful POST marks a confirmed session.
        booked: [
          { $match: { kind: 'api', path: '/api/bookings', method: 'POST', status: 201 } },
          { $group: { _id: '$sessionId' } },
          { $count: 'count' },
        ],
        statuses: [
          { $match: { kind: 'api' } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ],
      } },
    ]);

    const [bookings, pending] = await Promise.all([
      Booking.countDocuments({ createdAt: { $gte: since } }),
      PendingBooking.countDocuments({ createdAt: { $gte: since } }),
    ]);

    const eventIds = (facets.events as { _id: string }[]).map(row => row._id).filter(id => mongoose.Types.ObjectId.isValid(id));
    const eventNames = new Map((await Event.find({ _id: { $in: eventIds } }).select('eventName').lean())
      .map(event => [String(event._id), event.eventName as string]));

    const totals = facets.totals[0] || { views: 0, visitors: 0, sessions: 0 };
    const pathRows = facets.paths as { _id: string; views: number; sessions: number }[];
    const confirmedSessions = (facets.booked as { count: number }[])[0]?.count || 0;

    return NextResponse.json({
      success: true,
      range: rangeKey in RANGES ? rangeKey : '24h',
      unit: range.unit,
      totals: {
        ...totals,
        live: facets.live[0]?.count || 0,
        bookings,
        pendingRegistrations: pending,
        // Both sides come from tracked visits, so the rate is meaningful even while tracking is new.
        conversion: totals.sessions ? Math.round((confirmedSessions / totals.sessions) * 1000) / 10 : 0,
      },
      series: facets.series,
      funnel: [
        ...FUNNEL.map(([step, path]) => ({ step, sessions: pathRows.find(row => row._id === path)?.sessions || 0 })),
        { step: 'Booking confirmed', sessions: confirmedSessions },
      ],
      topPages: pathRows.slice(0, 10).map(row => ({ path: row._id, views: row.views, sessions: row.sessions })),
      topEvents: (facets.events as { _id: string; views: number; visitors: number }[])
        .map(row => ({ eventId: row._id, name: eventNames.get(row._id) || 'Deleted event', views: row.views, visitors: row.visitors })),
      referrers: named(facets.referrers, 'Direct / none'),
      countries: named(facets.countries),
      cities: named(facets.cities),
      devices: named(facets.devices),
      browsers: named(facets.browsers),
      os: named(facets.os),
      api: (facets.api as { _id: { path: string; method: string }; count: number; errors: number; pct: number[]; max: number }[])
        .map(row => ({ endpoint: row._id.path, method: row._id.method, count: row.count, errors: row.errors,
          errorRate: Math.round((row.errors / row.count) * 1000) / 10,
          p50: Math.round(row.pct?.[0] || 0), p95: Math.round(row.pct?.[1] || 0), max: Math.round(row.max || 0) })),
      statuses: (facets.statuses as { _id: number; count: number }[]).map(row => ({ status: row._id || 'Network error', count: row.count })),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('GET /api/admin/analytics failed:', error);
    return NextResponse.json({ success: false, message: 'Unable to load analytics.' }, { status: 500 });
  }
}
