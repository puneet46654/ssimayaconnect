import {
  NextRequest,
  NextResponse,
} from 'next/server';

import crypto from 'node:crypto';

import { connectDB } from '@/lib/db';

import {
  UserActivity,
  type UserActivityAction,
  type UserActivityStatus,
} from '@/models/UserActivity';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SESSION_COOKIE = 'ssimaya_session_id';
const MAX_METADATA_KEYS = 30;
const MAX_ACTIVITY_COUNT = 500;

const ACTIONS: UserActivityAction[] = [
  'page_view',
  'form_started',
  'form_submitted',
  'slot_selected',
  'confirmation_viewed',
  'booking_completed',
  'feedback_submitted',
  'feedback_skipped',
];

type ActivityRequest = {
  action?: unknown;
  eventId?: unknown;
  path?: unknown;
  metadata?: unknown;
};

function getSessionId(request: NextRequest) {
  return (
    request.cookies.get(SESSION_COOKIE)?.value ||
    crypto.randomUUID()
  );
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function sanitizeMetadata(
  value: unknown,
  depth = 0,
): Record<string, unknown> | undefined {
  if (
    !isRecord(value) ||
    depth > 2
  ) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(value)
      .slice(0, MAX_METADATA_KEYS)
      .map(([key, item]) => {
        if (isRecord(item)) {
          return [
            key.slice(0, 80),
            sanitizeMetadata(item, depth + 1),
          ];
        }

        return [
          key.slice(0, 80),
          typeof item === 'string'
            ? item.slice(0, 1000)
            : typeof item === 'number' ||
                typeof item === 'boolean' ||
                item === null
              ? item
              : String(item).slice(0, 1000),
        ];
      }),
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

export async function POST(
  request: NextRequest,
) {
  const sessionId = getSessionId(request);

  try {
    const body =
      (await request.json()) as ActivityRequest;

    const action = String(
      body.action || '',
    ) as UserActivityAction;
    const path = String(
      body.path || '',
    ).trim();
    const eventId = body.eventId
      ? String(body.eventId).trim()
      : undefined;

    if (
      !ACTIONS.includes(action) ||
      !path ||
      path.length > 500
    ) {
      return applyCookie(
        NextResponse.json(
          {
            success: false,
            error: 'Invalid activity payload.',
          },
          { status: 400 },
        ),
        sessionId,
      );
    }

    await connectDB();

    const now = new Date();
    const metadata = sanitizeMetadata(
      body.metadata,
    );
    const activity = {
      action,
      eventId,
      path,
      metadata,
      occurredAt: now,
    };

    const session =
      await UserActivity.findOneAndUpdate(
        {
          sessionId,
        },
        {
          $setOnInsert: {
            sessionId,
            status:
              'viewed' satisfies UserActivityStatus,
            lastSeenAt: now,
            events: [],
            activities: [],
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      );

    session.lastSeenAt = now;
    session.currentEventId = eventId;
    session.activities.push(activity);

    if (
      session.activities.length >
      MAX_ACTIVITY_COUNT
    ) {
      session.activities.splice(
        0,
        session.activities.length -
          MAX_ACTIVITY_COUNT,
      );
    }

    if (eventId) {
      let eventState =
        session.events.find(
          (item) =>
            item.eventId === eventId,
        );

      if (!eventState) {
        eventState = {
          eventId,
          status: 'viewed',
          startedAt: now,
          lastSeenAt: now,
        };
        session.events.push(eventState);
      }

      eventState.lastSeenAt = now;

      if (
        action === 'form_submitted'
      ) {
        eventState.status = 'filling';
        eventState.bookingDetails =
          metadata;
      }

      if (
        action === 'slot_selected' &&
        metadata
      ) {
        eventState.status =
          eventState.status ===
          'registered'
            ? 'registered'
            : 'filling';
        eventState.slotSelection =
          metadata;
      }

      if (
        action === 'booking_completed'
      ) {
        eventState.status = 'registered';
        eventState.bookingId =
          typeof metadata?.bookingId ===
          'string'
            ? metadata.bookingId
            : undefined;
        session.status = 'registered';
        session.registeredAt =
          session.registeredAt || now;
      } else if (
        eventState.status === 'filling' &&
        session.status !== 'registered'
      ) {
        session.status = 'filling';
      }
    }

    await session.save();

    return applyCookie(
      NextResponse.json({
        success: true,
        sessionId,
        status: session.status,
      }),
      sessionId,
    );
  } catch (error) {
    console.error(
      'Failed to record user activity:',
      error,
    );

    return applyCookie(
      NextResponse.json(
        {
          success: false,
          error:
            'Unable to record user activity.',
        },
        { status: 500 },
      ),
      sessionId,
    );
  }
}

export async function GET(
  request: NextRequest,
) {
  const sessionId = getSessionId(request);

  try {
    await connectDB();

    const session =
      await UserActivity.findOne({
        sessionId,
      })
        .select(
          '-_id sessionId status currentEventId lastSeenAt registeredAt events activities createdAt updatedAt',
        )
        .lean();

    return applyCookie(
      NextResponse.json({
        success: true,
        session,
      }),
      sessionId,
    );
  } catch (error) {
    console.error(
      'Failed to load user activity:',
      error,
    );

    return applyCookie(
      NextResponse.json(
        {
          success: false,
          error:
            'Unable to load user activity.',
        },
        { status: 500 },
      ),
      sessionId,
    );
  }
}
