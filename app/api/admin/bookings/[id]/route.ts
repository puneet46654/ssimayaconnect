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
  requireAdminWriteSession,
  requireAdminDeleteSession,
  logAdminActivity,
} from '@/lib/admin-server-auth';

import {
  Booking,
} from '@/models/Booking';

import {
  Slot,
} from '@/models/Slot';

import { Feedback } from '@/models/Feedback';

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

async function authorizeWrite() {
  const isAuth = await requireAdminSession();
  if (!isAuth) return false;
  return await requireAdminWriteSession();
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
      await getBookingFeedbackCategories(
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

    if (
      !(await authorizeWrite())
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            'Forbidden. You have View-Only access and cannot modify bookings.',
        },
        {
          status: 403,
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

    await logAdminActivity({
      action: 'update',
      resource: 'booking',
      resourceId: booking._id.toString(),
      details: {
        bookingId: booking.bookingId,
        fields: Object.keys(details),
      },
    });

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
      await getBookingFeedbackCategories(
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

    if (!(await requireAdminDeleteSession())) {
      return NextResponse.json(
        {
          success: false,
          message: 'Forbidden. You do not have permission to delete bookings.',
        },
        { status: 403 },
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

    await logAdminActivity({
      action: 'delete',
      resource: 'booking',
      resourceId: booking._id.toString(),
      details: { bookingId: booking.bookingId },
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

   Feedback is read from the Feedback collection by booking,
   so feedback from a different attendee is not mixed in.
============================================================ */

async function getBookingFeedbackCategories(
  booking: unknown,
) {
  const [
    event,
    application,
  ] = await Promise.all([
    getBookingFeedback(
      booking,
      'event',
    ),
    getBookingFeedback(
      booking,
      'application',
    ),
  ]);

  return {
    event,
    application,
  };
}

async function getBookingFeedback(
  booking: unknown,
  scope:
    | 'event'
    | 'application',
): Promise<BookingFeedback> {
  const emptyFeedback: BookingFeedback = {
    status: 'NONE',
    rating: null,
    message: '',
    suggestedFeature: '',
    submittedAt: null,
  };

  if (!isRecord(booking)) {
    return emptyFeedback;
  }

  const bookingId = stringValue(booking.bookingId);
  const bookingMongoId = referenceId(booking._id);

  if (!bookingId && !bookingMongoId) {
    return emptyFeedback;
  }

  const references: GenericRecord[] = [];
  if (bookingId) references.push({ bookingId });
  if (bookingMongoId) references.push({ bookingMongoId });

  // Latest feedback for this booking wins.
  const feedback = await Feedback.findOne({
    scope,
    $or: references,
  })
    .sort({ submittedAt: -1 })
    .lean();

  if (!feedback) {
    return emptyFeedback;
  }

  return {
    status: 'SUBMITTED',
    rating: ratingValue(feedback.rating),
    message: stringValue(feedback.message),
    suggestedFeature: stringValue(feedback.suggestedFeature),
    submittedAt: dateIsoValue(feedback.submittedAt),
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