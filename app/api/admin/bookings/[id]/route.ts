import {
  NextRequest,
  NextResponse,
} from 'next/server';

import mongoose from 'mongoose';

import {
  connectDB,
} from '@/lib/db';

import {
  requireAdminSession,
} from '@/lib/admin-server-auth';

import {
  Booking,
} from '@/models/Booking';

import {
  Slot,
} from '@/models/Slot';

import {
  UserActivity,
} from '@/models/UserActivity';

import '@/models/Event';
import '@/models/DaySchedule';

export const dynamic =
  'force-dynamic';

export const revalidate =
  0;

/* ============================================================
   TYPES
============================================================ */

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type GenericRecord =
  Record<
    string,
    unknown
  >;

type FeedbackStatus =
  | 'SUBMITTED'
  | 'SKIPPED'
  | 'NONE';

type BookingFeedback = {
  status:
    FeedbackStatus;

  rating:
    number | null;

  message:
    string;

  suggestedFeature:
    string;

  submittedAt:
    string | null;
};

/* ============================================================
   AUTH
============================================================ */

async function authorize() {
  return await requireAdminSession();
}

/* ============================================================
   GET
============================================================ */

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    if (
      !(await authorize())
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Unauthorized.',
        },
        {
          status: 401,
        },
      );
    }

    const {
      id,
    } =
      await context.params;

    if (
      !mongoose.Types.ObjectId.isValid(
        id,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Invalid booking ID.',
        },
        {
          status: 400,
        },
      );
    }

    await connectDB();

    const booking =
      await getBooking(
        id,
      );

    if (!booking) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Booking not found.',
        },
        {
          status: 404,
        },
      );
    }

    const feedback =
      await getBookingFeedback(
        booking,
      );

    return NextResponse.json(
      {
        success: true,

        booking:
          serialize(
            booking,
          ),

        feedback,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error(
      'Booking GET failed:',
      error,
    );

    return NextResponse.json(
      {
        success: false,

        message:
          'Unable to load booking.',
      },
      {
        status: 500,
      },
    );
  }
}

/* ============================================================
   PATCH
============================================================ */

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    if (
      !(await authorize())
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            'Unauthorized.',
        },
        {
          status: 401,
        },
      );
    }

    const {
      id,
    } =
      await context.params;

    if (
      !mongoose.Types.ObjectId.isValid(
        id,
      )
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            'Invalid booking ID.',
        },
        {
          status: 400,
        },
      );
    }

    const body =
      await request.json();

    if (
      !body ||
      typeof body !==
        'object' ||
      !body.details ||
      typeof body.details !==
        'object' ||
      Array.isArray(
        body.details,
      )
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            'Valid booking details are required.',
        },
        {
          status: 400,
        },
      );
    }

    const details =
      sanitizeDetails(
        body.details as Record<
          string,
          unknown
        >,
      );

    if (
      !details.fullName?.trim()
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            'Full name cannot be empty.',
        },
        {
          status: 400,
        },
      );
    }

    if (
      !details.email?.trim()
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            'Email cannot be empty.',
        },
        {
          status: 400,
        },
      );
    }

    if (
      !details.mobile?.trim()
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            'Mobile cannot be empty.',
        },
        {
          status: 400,
        },
      );
    }

    await connectDB();

    const booking =
      await Booking.findById(
        id,
      );

    if (!booking) {
      return NextResponse.json(
        {
          success: false,

          message:
            'Booking not found.',
        },
        {
          status: 404,
        },
      );
    }

    booking.details = {
      ...(booking.details ||
        {}),
      ...details,
    };

    await booking.save();

    const updated =
      await getBooking(
        id,
      );

    if (!updated) {
      return NextResponse.json(
        {
          success: false,

          message:
            'Updated booking could not be reloaded.',
        },
        {
          status: 500,
        },
      );
    }

    const feedback =
      await getBookingFeedback(
        updated,
      );

    return NextResponse.json(
      {
        success: true,

        message:
          'Booking updated successfully.',

        booking:
          serialize(
            updated,
          ),

        feedback,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error(
      'Booking PATCH failed:',
      error,
    );

    return NextResponse.json(
      {
        success: false,

        message:
          'Unable to update booking.',
      },
      {
        status: 500,
      },
    );
  }
}

/* ============================================================
   DELETE
============================================================ */

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    if (
      !(await authorize())
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            'Unauthorized.',
        },
        {
          status: 401,
        },
      );
    }

    const {
      id,
    } =
      await context.params;

    if (
      !mongoose.Types.ObjectId.isValid(
        id,
      )
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            'Invalid booking ID.',
        },
        {
          status: 400,
        },
      );
    }

    await connectDB();

    const booking =
      await Booking.findById(
        id,
      );

    if (!booking) {
      return NextResponse.json(
        {
          success: false,

          message:
            'Booking not found.',
        },
        {
          status: 404,
        },
      );
    }

    const slotId =
      booking.slotId;

    await Booking.deleteOne({
      _id:
        booking._id,
    });

    /*
     * Return one capacity unit
     * to the slot.
     */
    if (
      slotId &&
      mongoose.Types.ObjectId.isValid(
        String(
          slotId,
        ),
      )
    ) {
      await Slot.updateOne(
        {
          _id:
            slotId,

          bookedCount: {
            $gt: 0,
          },
        },
        {
          $inc: {
            bookedCount:
              -1,
          },
        },
      );
    }

    return NextResponse.json(
      {
        success: true,

        message:
          'Booking deleted successfully.',
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error(
      'Booking DELETE failed:',
      error,
    );

    return NextResponse.json(
      {
        success: false,

        message:
          'Unable to delete booking.',
      },
      {
        status: 500,
      },
    );
  }
}

/* ============================================================
   BOOKING QUERY
============================================================ */

async function getBooking(
  id: string,
) {
  return Booking.findById(
    id,
  )
    .populate({
      path:
        'eventId',
    })
    .populate({
      path:
        'slotId',
    })
    .populate({
      path:
        'dayScheduleId',
    })
    .lean();
}

/* ============================================================
   FEEDBACK

   The browser activity session which created this booking is
   located using bookingId / Mongo booking ID.

   Feedback is then read from that SAME UserActivity record,
   so feedback from a different attendee is not mixed in.
============================================================ */

async function getBookingFeedback(
  booking: unknown,
): Promise<BookingFeedback> {
  const emptyFeedback:
    BookingFeedback = {
    status:
      'NONE',

    rating:
      null,

    message:
      '',

    suggestedFeature:
      '',

    submittedAt:
      null,
  };

  if (
    !isRecord(
      booking,
    )
  ) {
    return emptyFeedback;
  }

  const bookingId =
    stringValue(
      booking.bookingId,
    );

  const bookingMongoId =
    referenceId(
      booking._id,
    );

  const eventId =
    referenceId(
      booking.eventId,
    );

  const attendeeEmail =
    isRecord(
      booking.details,
    )
      ? stringValue(
          booking.details.email,
        ).toLowerCase()
      : '';

  if (!bookingId) {
    return emptyFeedback;
  }

  const exactMatchFilters:
    GenericRecord[] = [
      {
        'activities.metadata.bookingId':
          bookingId,
      },
      {
        'events.bookingId':
          bookingId,
      },
    ];

  if (
    bookingMongoId
  ) {
    exactMatchFilters.push({
      'activities.metadata.bookingMongoId':
        bookingMongoId,
    });
  }

  /*
   * Best match:
   * the exact browser activity session that
   * recorded this booking.
   */
  let activity =
    await UserActivity.findOne({
      $or:
        exactMatchFilters,
    })
      .select({
        activities: 1,
        events: 1,
      })
      .lean();

  /*
   * Legacy fallback.
   *
   * Some older booking_completed records may
   * not contain bookingMongoId.
   */
  if (
    !activity &&
    eventId &&
    attendeeEmail
  ) {
    activity =
      await UserActivity.findOne({
        $or: [
          {
            events: {
              $elemMatch: {
                eventId,

                'bookingDetails.email':
                  attendeeEmail,
              },
            },
          },
          {
            activities: {
              $elemMatch: {
                eventId,

                'metadata.bookingDetails.email':
                  attendeeEmail,
              },
            },
          },
        ],
      })
        .select({
          activities: 1,
          events: 1,
        })
        .lean();
  }

  if (
    !activity ||
    !isRecord(
      activity,
    ) ||
    !Array.isArray(
      activity.activities,
    )
  ) {
    return emptyFeedback;
  }

  /*
   * We only use feedback belonging to the
   * same event.
   *
   * Latest feedback action wins.
   */
  const feedbackEntries =
    activity.activities
      .filter(
        (
          item,
        ) => {
          if (
            !isRecord(
              item,
            )
          ) {
            return false;
          }

          const action =
            stringValue(
              item.action,
            );

          if (
            action !==
              'feedback_submitted' &&
            action !==
              'feedback_skipped'
          ) {
            return false;
          }

          const itemEventId =
            stringValue(
              item.eventId,
            );

          return (
            !eventId ||
            !itemEventId ||
            itemEventId ===
              eventId
          );
        },
      )
      .sort(
        (
          first,
          second,
        ) =>
          dateValue(
            isRecord(
              second,
            )
              ? second.occurredAt
              : undefined,
          ) -
          dateValue(
            isRecord(
              first,
            )
              ? first.occurredAt
              : undefined,
          ),
      );

  const latest =
    feedbackEntries[0];

  if (
    !latest ||
    !isRecord(
      latest,
    )
  ) {
    return emptyFeedback;
  }

  const action =
    stringValue(
      latest.action,
    );

  const occurredAt =
    dateIsoValue(
      latest.occurredAt,
    );

  if (
    action ===
    'feedback_skipped'
  ) {
    return {
      ...emptyFeedback,

      status:
        'SKIPPED',

      submittedAt:
        occurredAt,
    };
  }

  const metadata =
    isRecord(
      latest.metadata,
    )
      ? latest.metadata
      : {};

  return {
    status:
      'SUBMITTED',

    rating:
      ratingValue(
        metadata.rating,
      ),

    message:
      stringValue(
        metadata.message,
      ),

    suggestedFeature:
      stringValue(
        metadata.suggestedFeature,
      ),

    submittedAt:
      occurredAt,
  };
}

/* ============================================================
   SANITIZE DETAILS
============================================================ */

function sanitizeDetails(
  input: Record<
    string,
    unknown
  >,
) {
  const output:
    Record<
      string,
      string
    > = {};

  for (
    const [
      rawKey,
      value,
    ] of Object.entries(
      input,
    )
  ) {
    const key =
      rawKey.trim();

    if (
      !key ||
      key.startsWith(
        '$',
      ) ||
      key.includes(
        '.',
      ) ||
      key ===
        '__proto__' ||
      key ===
        'constructor' ||
      key ===
        'prototype'
    ) {
      continue;
    }

    if (
      typeof value ===
      'string'
    ) {
      output[key] =
        value.trim();

      continue;
    }

    if (
      value ===
        null ||
      value ===
        undefined
    ) {
      output[key] =
        '';

      continue;
    }

    output[key] =
      String(
        value,
      );
  }

  return output;
}

/* ============================================================
   HELPERS
============================================================ */

function isRecord(
  value: unknown,
): value is GenericRecord {
  return (
    typeof value ===
      'object' &&
    value !==
      null &&
    !Array.isArray(
      value,
    )
  );
}

function stringValue(
  value: unknown,
) {
  if (
    value ===
      undefined ||
    value ===
      null
  ) {
    return '';
  }

  return String(
    value,
  ).trim();
}

function referenceId(
  value: unknown,
) {
  if (
    value instanceof
    mongoose.Types.ObjectId
  ) {
    return value.toString();
  }

  if (
    isRecord(
      value,
    )
  ) {
    return stringValue(
      value._id,
    );
  }

  return stringValue(
    value,
  );
}

function ratingValue(
  value: unknown,
): number | null {
  const number =
    Number(
      value,
    );

  if (
    !Number.isFinite(
      number,
    ) ||
    number < 1 ||
    number > 5
  ) {
    return null;
  }

  return Math.round(
    number,
  );
}

function dateValue(
  value: unknown,
) {
  if (!value) {
    return 0;
  }

  const date =
    new Date(
      String(
        value,
      ),
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return 0;
  }

  return date.getTime();
}

function dateIsoValue(
  value: unknown,
) {
  const timestamp =
    dateValue(
      value,
    );

  if (!timestamp) {
    return null;
  }

  return new Date(
    timestamp,
  ).toISOString();
}

/* ============================================================
   SERIALIZE
============================================================ */

function serialize(
  value: unknown,
): unknown {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return value;
  }

  if (
    value instanceof
    Date
  ) {
    return value.toISOString();
  }

  if (
    value instanceof
    mongoose.Types.ObjectId
  ) {
    return value.toString();
  }

  if (
    Array.isArray(
      value,
    )
  ) {
    return value.map(
      serialize,
    );
  }

  if (
    typeof value ===
    'object'
  ) {
    const result:
      Record<
        string,
        unknown
      > = {};

    for (
      const [
        key,
        item,
      ] of Object.entries(
        value as Record<
          string,
          unknown
        >,
      )
    ) {
      result[key] =
        serialize(
          item,
        );
    }

    return result;
  }

  return value;
}