import { NextResponse } from 'next/server';
import { getRealtimeVersions } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

/*
 * Last-change time per resource. Cached at the CDN for 2s so thousands of
 * polling clients cost roughly one database read every 2 seconds.
 */
export async function GET() {
  try {
    const versions = await getRealtimeVersions();
    return NextResponse.json(
      { success: true, versions },
      {
        headers: {
          'Cache-Control': 'public, max-age=0, s-maxage=2, stale-while-revalidate=5',
        },
      },
    );
  } catch (error) {
    console.error('Failed to read realtime versions:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to read realtime changes.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
