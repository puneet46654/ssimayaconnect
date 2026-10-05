import type { Server as SocketIOServer } from 'socket.io';
import mongoose, { Schema } from 'mongoose';
import { after } from 'next/server';
import { connectDB } from '@/lib/db';

declare global {
  // Set by server.mjs when the application is running with Socket.IO.
  var realtimeIO: SocketIOServer | undefined;
  var eventsListCache: { at: number; body: unknown } | undefined;
}

export type RealtimeChange = {
  resource:
    | 'events'
    | 'bookings'
    | 'attendance';
  action: 'created' | 'updated' | 'deleted';
  id?: string;
};

export const REALTIME_RESOURCES = ['events', 'bookings', 'attendance'] as const;

/*
 * One tiny document holding an atomic revision counter per resource.
 * Clients poll /api/realtime (CDN-cached) and refresh when a revision moves,
 * so live updates work on Vercel without a third-party socket service.
 */
const RealtimeVersion =
  mongoose.models.RealtimeVersion ||
  mongoose.model(
    'RealtimeVersion',
    new Schema(
      {
        _id: String,
        events: Number,
        bookings: Number,
        attendance: Number,
      },
      { versionKey: false },
    ),
  );

export async function getRealtimeVersions() {
  await connectDB();
  const doc = await RealtimeVersion.findById('global').lean<Record<string, number>>();
  return Object.fromEntries(
    REALTIME_RESOURCES.map((resource) => [resource, doc?.[resource] || 0]),
  ) as Record<RealtimeChange['resource'], number>;
}

export function emitRealtimeChange(change: RealtimeChange) {
  // Drop the in-process public event list so the next read is fresh.
  globalThis.eventsListCache = undefined;
  // Instant push when running under server.mjs (local dev / self-hosted).
  globalThis.realtimeIO?.emit('data.changed', change);

  const bump = connectDB()
    .then(() =>
      RealtimeVersion.updateOne(
        { _id: 'global' },
        { $inc: { [change.resource]: 1 } },
        { upsert: true },
      ),
    )
    .catch((error: unknown) => {
      console.error('Failed to record realtime change:', error);
    });

  // Runs after the response is sent, without being cut off on serverless.
  try {
    after(bump);
  } catch {
    void bump; // called outside a request scope
  }
}
