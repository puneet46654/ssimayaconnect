import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Event } from '@/models/Event';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();

    const { id } = await params;
    const event = await Event.findById(id).select('imageUrl').lean();

    if (!event?.imageUrl) {
      return NextResponse.json(
        { error: 'Event image not found.' },
        { status: 404 },
      );
    }

    const imageUrl = new URL(event.imageUrl);
    const key = decodeURIComponent(imageUrl.pathname.replace(/^\/+/, ''));
    const result = await s3Client.send(
      new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME || 'ssi-studio-events',
        Key: key,
      }),
    );

    if (!result.Body) {
      return NextResponse.json(
        { error: 'Event image is empty.' },
        { status: 404 },
      );
    }

    const bytes = await result.Body.transformToByteArray();
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        'Cache-Control': 'public, max-age=3600',
        'Content-Type': result.ContentType || 'application/octet-stream',
      },
    });
  } catch (error) {
    console.error('Failed to fetch event image:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event image.' },
      { status: 500 },
    );
  }
}
