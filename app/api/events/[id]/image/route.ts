import { sanitizeImage, ImageValidationError } from '@/lib/image-validation';
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

type CachedImage = { body: Uint8Array; contentType: string; at: number };
const IMAGE_CACHE = new Map<string, CachedImage>();
const IMAGE_CACHE_MAX = 60;
const IMAGE_TTL_MS = 60 * 60 * 1000;
const IMAGE_HEADERS = (contentType: string) => ({
  'Content-Type': contentType,
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; sandbox",
  'Content-Disposition': 'inline',
  'Cache-Control': 'public, max-age=31536000, immutable',
});

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id } =
      await context.params;
    const version = request.nextUrl.searchParams.get('v') || '';
    const cacheKey = `${id}:${version}`;
    const hit = version ? IMAGE_CACHE.get(cacheKey) : undefined;
    if (hit && Date.now() - hit.at < IMAGE_TTL_MS) {
      return new NextResponse(Buffer.from(hit.body), { status: 200, headers: IMAGE_HEADERS(hit.contentType) });
    }
    await connectDB();

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

    const safe = await sanitizeImage(image.body);
    if (version) {
      if (IMAGE_CACHE.size >= IMAGE_CACHE_MAX) IMAGE_CACHE.delete(IMAGE_CACHE.keys().next().value as string);
      IMAGE_CACHE.set(cacheKey, { body: new Uint8Array(safe.body), contentType: safe.contentType, at: Date.now() });
    }
    return new NextResponse(
      new Uint8Array(safe.body),
      {
        status: 200,

        headers: {
          'Content-Type':
            safe.contentType,
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'none'; sandbox",
          'Content-Disposition': 'inline',

          'Cache-Control':
            'public, max-age=31536000, immutable',
        },
      },
    );
  } catch (error) {
    if (error instanceof ImageValidationError) return NextResponse.json({ success: false, error: 'This event image is not a supported raster image.' }, { status: 415, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
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