import {
  NextRequest,
  NextResponse,
} from 'next/server';

import mongoose from 'mongoose';

import { connectDB } from '@/lib/db';

import {
  downloadImageFromS3,
} from '@/lib/s3';

import { Event } from '@/models/Event';

export const dynamic =
  'force-dynamic';

export const revalidate = 0;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    await connectDB();

    const { id } =
      await context.params;

    if (
      !mongoose.Types.ObjectId.isValid(
        id,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Invalid event ID.',
        },
        {
          status: 400,
          headers: {
            'Cache-Control':
              'no-store',
          },
        },
      );
    }

    const event =
      await Event.findById(id)
        .select('imageUrl')
        .lean();

    if (
      !event ||
      !event.imageUrl
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Event image not found.',
        },
        {
          status: 404,

          headers: {
            'Cache-Control':
              'no-store, no-cache, must-revalidate',
          },
        },
      );
    }

    const image =
      await downloadImageFromS3(
        event.imageUrl,
      );

    return new NextResponse(
      image.body,
      {
        status: 200,

        headers: {
          'Content-Type':
            image.contentType ||
            'application/octet-stream',

          'Cache-Control':
            'no-store, no-cache, must-revalidate, proxy-revalidate',

          Pragma:
            'no-cache',

          Expires:
            '0',
        },
      },
    );
  } catch (error) {
    console.error(
      'Failed to fetch event image:',
      error,
    );

    return NextResponse.json(
      {
        success: false,

        error:
          'Failed to fetch event image.',
      },
      {
        status: 500,

        headers: {
          'Cache-Control':
            'no-store',
        },
      },
    );
  }
}