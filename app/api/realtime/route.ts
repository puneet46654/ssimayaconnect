import { NextResponse } from 'next/server';

import { connectDB } from '@/lib/db';
import { getEventStatus } from '@/lib/events/status';
import { Event } from '@/models/Event';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectDB();

    const events = await Event.find()
      .select('_id updatedAt status startDate endDate')
      .lean();

    return NextResponse.json(
      {
        success: true,
        events: events.map((event) => ({
          id: event._id.toString(),
          updatedAt: event.updatedAt,
          status: getEventStatus(
            event.startDate,
            event.endDate,
          ),
        })),
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error) {
    console.error('Failed to read realtime changes:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Unable to read realtime changes.',
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  }
}
