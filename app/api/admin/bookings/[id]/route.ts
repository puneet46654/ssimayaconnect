import { adminAccessError } from '@/lib/admin-api-auth';
import { getAdminSession } from '@/lib/admin-server-auth';
import { BookingError, lockBookingEvent, contactConflict, deleteBooking } from '@/lib/bookings/mutations';
import { emitRealtimeChange } from '@/lib/realtime';
import { getEventStatus } from '@/lib/events/status';
import { isValidEmail, isValidPhone, normalizeEmail, normalizePhone, phoneIdentity } from '@/lib/phone';
import {
  NextRequest,
  NextResponse,
} from 'next/server';

import mongoose from 'mongoose';

import {
  connectDB,
} from '@/lib/db';

import {
  logAdminActivity,
} from '@/lib/admin-server-auth';

import {
  Booking,
} from '@/models/Booking';

import '@/models/Slot';

import { Feedback } from '@/models/Feedback';
import { PendingBooking } from '@/models/PendingBooking';

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

/* ============================================================
   GET
============================================================ */

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const denied = await adminAccessError('bookings', 'read');
    if (denied) return denied;

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
      const pending = await getPendingBooking(id);
      if (pending) return NextResponse.json({ success: true, booking: serialize(pending), feedback: emptyFeedbackCategories() });
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
    const denied = await adminAccessError('bookings', 'write');
    if (denied) return denied;

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
      !isValidEmail(details.email)
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            'Enter a valid email address.',
        },
        {
          status: 400,
        },
      );
    }

    // Admins may correct attendance at any time, unlike scanning which is limited to the live check-in window.
    const attendanceStatus = body.attendanceStatus === 'PRESENT' || body.attendanceStatus === 'NOT_PRESENT' ? body.attendanceStatus : null;
    if (body.attendanceStatus !== undefined && !attendanceStatus) {
      return NextResponse.json({ success: false, message: 'Invalid attendance status.' }, { status: 400 });
    }
    if (attendanceStatus) {
      const checkInDenied = await adminAccessError('check-in');
      if (checkInDenied) return checkInDenied;
    }
    const adminName = attendanceStatus ? (await getAdminSession())?.username || '' : '';

    await connectDB();

    const booking =
      await Booking.findById(
        id,
      );

    if (!booking) {
      const pending = await PendingBooking.findById(id);
      if (!pending) {
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
      // Pending rows hold no slot or ticket, so only the contact details can change.
      const merged = { ...pending.details, ...details };
      if (!isValidPhone(merged.mobile, merged.countryCode)) throw new BookingError(400, 'Enter a valid full mobile number.');
      merged.email = normalizeEmail(merged.email);
      merged.mobile = (merged.mobile.trim().startsWith('+') ? '+' : '') + normalizePhone(merged.mobile);
      pending.details = merged;
      pending.markModified('details');
      await pending.save();
      emitRealtimeChange({ resource: 'bookings', action: 'updated', id: String(pending.eventId) });
      await logAdminActivity({ action: 'update', resource: 'booking', resourceId: id, details: { pending: true, fields: Object.keys(details) } });
      return NextResponse.json({
        success: true, message: 'Pending booking updated successfully.',
        booking: serialize(await getPendingBooking(id)), feedback: emptyFeedbackCategories(),
      });
    }

    let attendanceChanged = false;
    await mongoose.connection.transaction(async session => {
      await lockBookingEvent(String(booking.eventId), session);
      const current = await Booking.findById(id).session(session);
      if (!current) throw new BookingError(404, 'Booking not found.');
      const merged = { ...current.details, ...details };
      if (!isValidPhone(merged.mobile, merged.countryCode)) throw new BookingError(400, 'Enter a valid full mobile number.');
      merged.email = normalizeEmail(merged.email);
      merged.mobile = (merged.mobile.trim().startsWith('+') ? '+' : '') + normalizePhone(merged.mobile);
      const contactChanged = merged.email !== normalizeEmail(current.details.email)
        || phoneIdentity(merged.mobile, merged.countryCode) !== phoneIdentity(current.details.mobile, current.details.countryCode);
      if (contactChanged && await contactConflict(String(current.eventId), merged, session, id)) {
        throw new BookingError(409, 'Another booking for this event uses that email or mobile number.');
      }
      current.details = merged;
      attendanceChanged = !!attendanceStatus && attendanceStatus !== (current.attendanceStatus || 'NOT_PRESENT');
      if (attendanceChanged && attendanceStatus === 'PRESENT') {
        current.attendanceStatus = 'PRESENT';
        current.checkedInAt = new Date();
        current.checkedInBy = adminName;
        current.checkInMethod = 'MANUAL';
      } else if (attendanceChanged) {
        current.attendanceStatus = 'NOT_PRESENT';
        current.checkedInAt = null;
        current.checkedInBy = '';
        current.checkInMethod = undefined;
      }
      await current.save({ session });
    });
    emitRealtimeChange({ resource: 'bookings', action: 'updated', id: String(booking.eventId) });
    if (attendanceChanged) emitRealtimeChange({ resource: 'attendance', action: 'updated', id: String(booking.eventId) });

    await logAdminActivity({
      action: 'update',
      resource: 'booking',
      resourceId: booking._id.toString(),
      details: {
        bookingId: booking.bookingId,
        fields: Object.keys(details),
        ...(attendanceChanged ? { attendanceStatus } : {}),
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
          error instanceof BookingError ? error.message : 'Unable to update booking.',
      },
      {
        status: error instanceof BookingError ? error.status : 500,
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
    const denied = await adminAccessError('bookings', 'delete');
    if (denied) return denied;

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

    const booking = await deleteBooking(id);
    if (booking) {
      emitRealtimeChange({ resource: 'bookings', action: 'deleted', id: String(booking.eventId) });
      await logAdminActivity({ action: 'delete', resource: 'booking', resourceId: String(booking._id), details: { bookingId: booking.bookingId } });
    } else {
      const pending = await PendingBooking.findByIdAndDelete(id).select('eventId').lean();
      if (pending) {
        emitRealtimeChange({ resource: 'bookings', action: 'deleted', id: String(pending.eventId) });
        await logAdminActivity({ action: 'delete', resource: 'booking', resourceId: id, details: { pending: true } });
      }
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
  const booking = await Booking.findById(
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
  if (booking && isRecord(booking.eventId)) {
    const event = booking.eventId;
    if (event.startDate && event.endDate) event.status = getEventStatus(new Date(String(event.startDate)), new Date(String(event.endDate)), new Date(), String(event.timeZone || 'Asia/Kolkata'), String(event.status));
  }
  return booking;
}

/** A pending registration in the booking shape, with no slot, schedule or ticket. */
async function getPendingBooking(id: string) {
  const pending = await PendingBooking.findById(id).populate({ path: 'eventId' }).lean();
  if (!pending) return null;
  const event = isRecord(pending.eventId) ? pending.eventId : null;
  if (event?.startDate && event.endDate) {
    event.status = getEventStatus(new Date(String(event.startDate)), new Date(String(event.endDate)), new Date(),
      String(event.timeZone || 'Asia/Kolkata'), String(event.status));
  }
  return {
    _id: pending._id, bookingId: '', pending: true, details: pending.details, eventId: event,
    slotId: null, dayScheduleId: null, attendanceStatus: 'NOT_PRESENT',
    createdAt: pending.createdAt, updatedAt: pending.updatedAt,
  };
}

function emptyFeedbackCategories() {
  const none: BookingFeedback = { status: 'NONE', rating: null, message: '', suggestedFeature: '', submittedAt: null };
  return { event: none, application: { ...none } };
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
