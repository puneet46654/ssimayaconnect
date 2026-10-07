import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { AnalyticsEvent, type IAnalyticsEvent } from '@/models/AnalyticsEvent';
import { AnalyticsPresence } from '@/models/AnalyticsPresence';
import { describeAgent, eventIdFromPath, isBot, normalizePath, referrerHost } from '@/lib/analytics';

export const dynamic = 'force-dynamic';

const MAX_EVENTS = 50;
const ID = /^[a-z0-9-]{8,64}$/i;
const HOUR_MS = 60 * 60 * 1000;

/** Receives batched page views and API timings from visitors' browsers. Always answers 204. */
export async function POST(request: NextRequest) {
  const done = new NextResponse(null, { status: 204 });
  try {
    const userAgent = request.headers.get('user-agent') || '';
    if (isBot(userAgent)) return done;
    const body = await request.json().catch(() => null);
    const visitorId = typeof body?.visitorId === 'string' && ID.test(body.visitorId) ? body.visitorId : '';
    const sessionId = typeof body?.sessionId === 'string' && ID.test(body.sessionId) ? body.sessionId : '';
    if (!visitorId || !sessionId) return done;
    const events: unknown[] = Array.isArray(body.events) ? body.events : [];

    const now = Date.now();
    const agent = describeAgent(userAgent);
    const country = request.headers.get('x-vercel-ip-country') || undefined;
    const rawCity = request.headers.get('x-vercel-ip-city');
    let city: string | undefined;
    try { city = rawCity ? decodeURIComponent(rawCity) : undefined; } catch { city = rawCity || undefined; }
    const ownHost = request.nextUrl.hostname;

    const docs = events.slice(0, MAX_EVENTS).flatMap((raw): Partial<IAnalyticsEvent>[] => {
      const item = raw as Record<string, unknown>;
      const kind: IAnalyticsEvent['kind'] | null = item?.kind === 'api' ? 'api' : item?.kind === 'pageview' ? 'pageview' : null;
      const path = typeof item?.path === 'string' && item.path.startsWith('/') ? item.path : '';
      if (!kind || !path || path.startsWith('/admin') || path.startsWith('/api/admin')) return [];
      const ts = typeof item.ts === 'number' && Math.abs(item.ts - now) < HOUR_MS ? new Date(item.ts) : new Date(now);
      const base = { kind, ts, visitorId, sessionId, path: normalizePath(path), eventId: eventIdFromPath(path), country, city, ...agent };
      if (kind === 'pageview') return [{ ...base, referrer: referrerHost(item.referrer, ownHost) }];
      const status = Number(item.status), ms = Number(item.ms);
      return [{ ...base, method: typeof item.method === 'string' ? item.method.toUpperCase().slice(0, 8) : 'GET',
        status: Number.isInteger(status) ? status : 0, ms: Number.isFinite(ms) && ms >= 0 ? Math.min(Math.round(ms), 120000) : undefined }];
    });
    // Presence: which page this open tab is on right now.
    const livePath = typeof body.presence?.path === 'string' && body.presence.path.startsWith('/') && !body.presence.path.startsWith('/admin')
      ? body.presence.path : '';
    if (!docs.length && !livePath) return done;

    await connectDB();
    await Promise.all([
      docs.length ? AnalyticsEvent.insertMany(docs, { ordered: false }) : null,
      livePath ? AnalyticsPresence.updateOne({ _id: sessionId }, { $set: { visitorId, path: normalizePath(livePath),
        eventId: eventIdFromPath(livePath), lastSeen: new Date(now), country, city, device: agent.device } }, { upsert: true }) : null,
    ]);
  } catch (error) {
    console.error('Analytics collect failed:', error);
  }
  return done;
}
