import {
  NextRequest,
  NextResponse,
} from 'next/server';

import crypto from 'node:crypto';

import { connectDB } from '@/lib/db';

import {
  Feedback,
  type FeedbackScope,
} from '@/models/Feedback';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SESSION_COOKIE = 'ssimaya_session_id';

type FeedbackRequest = {
  scope?: unknown;
  eventId?: unknown;
  rating?: unknown;
  message?: unknown;
  suggestedFeature?: unknown;
  bookingId?: unknown;
  bookingMongoId?: unknown;
};

function getSessionId(request: NextRequest) {
  return (
    request.cookies.get(SESSION_COOKIE)?.value ||
    crypto.randomUUID()
  );
}

function applyCookie(
  response: NextResponse,
  sessionId: string,
) {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: sessionId,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}

/* ============================================================
   POST  —  Submit feedback
============================================================ */

export async function POST(
  request: NextRequest,
) {
  const sessionId = getSessionId(request);

  try {
    const body =
      (await request.json()) as FeedbackRequest;

    /* ---- Validate scope ---- */

    const scope = String(
      body.scope || '',
    ) as FeedbackScope;

    if (
      scope !== 'application' &&
      scope !== 'event'
    ) {
      return applyCookie(
        NextResponse.json(
          {
            success: false,
            error: 'Invalid feedback scope.',
          },
          { status: 400 },
        ),
        sessionId,
      );
    }

    /* ---- Validate rating ---- */

    const rating = Number(body.rating);

    if (
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5
    ) {
      return applyCookie(
        NextResponse.json(
          {
            success: false,
            error:
              'Rating must be an integer between 1 and 5.',
          },
          { status: 400 },
        ),
        sessionId,
      );
    }

    /* ---- Validate eventId for event scope ---- */

    const eventId = body.eventId
      ? String(body.eventId).trim()
      : undefined;

    if (scope === 'event' && !eventId) {
      return applyCookie(
        NextResponse.json(
          {
            success: false,
            error:
              'Event ID is required for event feedback.',
          },
          { status: 400 },
        ),
        sessionId,
      );
    }

    /* ---- Optional fields ---- */

    const message =
      typeof body.message === 'string'
        ? body.message.trim().slice(0, 500)
        : undefined;

    const suggestedFeature =
      typeof body.suggestedFeature === 'string'
        ? body.suggestedFeature
            .trim()
            .slice(0, 200)
        : undefined;

    const bookingId =
      typeof body.bookingId === 'string'
        ? body.bookingId.trim()
        : undefined;

    const bookingMongoId =
      typeof body.bookingMongoId === 'string'
        ? body.bookingMongoId.trim()
        : undefined;

    await connectDB();

    /* ---- Pre-check for duplicate submission ---- */

    const existing = await Feedback.findOne({
      sessionId,
      scope,
      ...(scope === 'event' ? { eventId } : {}),
    })
      .select({ _id: 1 })
      .lean();

    if (existing) {
      return applyCookie(
        NextResponse.json(
          {
            success: false,
            duplicate: true,
            error:
              scope === 'application'
                ? 'You have already submitted application feedback.'
                : 'You have already submitted feedback for this event.',
          },
          { status: 409 },
        ),
        sessionId,
      );
    }

    /* ---- Insert with duplicate prevention via index ---- */

    try {
      await Feedback.create({
        sessionId,
        scope,
        eventId:
          scope === 'event'
            ? eventId
            : undefined,
        rating,
        message,
        suggestedFeature,
        bookingId,
        bookingMongoId,
        submittedAt: new Date(),
      });
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 11000
      ) {
        return applyCookie(
          NextResponse.json(
            {
              success: false,
              duplicate: true,
              error:
                scope === 'application'
                  ? 'You have already submitted application feedback.'
                  : 'You have already submitted feedback for this event.',
            },
            { status: 409 },
          ),
          sessionId,
        );
      }

      throw error;
    }

    return applyCookie(
      NextResponse.json({
        success: true,
        sessionId,
      }),
      sessionId,
    );
  } catch (error) {
    console.error(
      'Failed to submit feedback:',
      error,
    );

    return applyCookie(
      NextResponse.json(
        {
          success: false,
          error:
            'Unable to submit feedback.',
        },
        { status: 500 },
      ),
      sessionId,
    );
  }
}

/* ============================================================
   GET  —  Check if feedback already submitted
============================================================ */

export async function GET(
  request: NextRequest,
) {
  const sessionId = getSessionId(request);

  try {
    const url = new URL(request.url);
    const scope = url.searchParams.get(
      'scope',
    ) as FeedbackScope | null;
    const eventId =
      url.searchParams.get('eventId');

    if (
      scope !== 'application' &&
      scope !== 'event'
    ) {
      return applyCookie(
        NextResponse.json(
          {
            success: false,
            error: 'Invalid scope.',
          },
          { status: 400 },
        ),
        sessionId,
      );
    }

    if (scope === 'event' && !eventId) {
      return applyCookie(
        NextResponse.json(
          {
            success: false,
            error:
              'Event ID is required for event feedback.',
          },
          { status: 400 },
        ),
        sessionId,
      );
    }

    await connectDB();

    const query: Record<string, unknown> =
      {
        sessionId,
        scope,
      };

    if (scope === 'event') {
      query.eventId = eventId;
    }

    const existing =
      await Feedback.findOne(query)
        .select({ _id: 1 })
        .lean();

    return applyCookie(
      NextResponse.json({
        success: true,
        submitted: Boolean(existing),
      }),
      sessionId,
    );
  } catch (error) {
    console.error(
      'Failed to check feedback status:',
      error,
    );

    return applyCookie(
      NextResponse.json(
        {
          success: false,
          error:
            'Unable to check feedback status.',
        },
        { status: 500 },
      ),
      sessionId,
    );
  }
}
