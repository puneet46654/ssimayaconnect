import { randomInt } from 'node:crypto';

import mongoose from 'mongoose';

import {
  NextRequest,
  NextResponse,
} from 'next/server';

import { connectDB } from '@/lib/db';

import { Booking } from '@/models/Booking';
import { Event } from '@/models/Event';
import { Slot } from '@/models/Slot';
import { DaySchedule } from '@/models/DaySchedule';

export const dynamic =
  'force-dynamic';

export const revalidate =
  0;

/* ============================================================
   TYPES
============================================================ */

type BookingDetailsInput =
  Record<
    string,
    unknown
  >;

/* ============================================================
   RESPONSE HELPER
============================================================ */

function normalizeBookingResponse(
  booking: {
    _id: unknown;
    bookingId: string;
    eventId: unknown;
    attendanceStatus?: string;
    checkedInAt?: Date | string | null;
  },
) {
  return {
    id:
      String(
        booking._id,
      ),

    bookingId:
      booking.bookingId,

    eventId:
      String(
        booking.eventId,
      ),

    attendanceStatus:
      booking.attendanceStatus ||
      'NOT_PRESENT',

    checkedInAt:
      booking.checkedInAt
        ? new Date(
            booking.checkedInAt,
          ).toISOString()
        : null,
  };
}

/* ============================================================
   GET BOOKING

   Used by:
   - confirmation page restore
   - attendance polling
============================================================ */

export async function GET(
  request:
    NextRequest,
) {
  try {
    const bookingId =
      request.nextUrl
        .searchParams
        .get(
          'bookingId',
        )
        ?.trim();

    if (!bookingId) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            'Booking ID is required.',
        },
        {
          status:
            400,
        },
      );
    }

    await connectDB();

    const booking =
      await Booking.findOne({
        bookingId,
      })
        .select({
          _id: 1,
          bookingId: 1,
          eventId: 1,
          attendanceStatus:
            1,
          checkedInAt:
            1,
        })
        .lean();

    if (!booking) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            'Booking not found.',
        },
        {
          status:
            404,
        },
      );
    }

    return NextResponse.json(
      {
        success:
          true,

        booking:
          normalizeBookingResponse(
            booking,
          ),
      },
      {
        status:
          200,
      },
    );
  } catch (error) {
    console.error(
      'GET /api/bookings failed:',
      error,
    );

    return NextResponse.json(
      {
        success:
          false,

        message:
          'Unable to retrieve booking.',
      },
      {
        status:
          500,
      },
    );
  }
}

/* ============================================================
   POST BOOKING
============================================================ */

export async function POST(
  request:
    NextRequest,
) {
  let reservedSlotId:
    mongoose.Types.ObjectId | null =
    null;

  try {
    const body =
      (await request.json()) as {
        eventId?: string;

        slotId?: string;

        dayScheduleId?: string;

        details?:
          BookingDetailsInput;
      };

    const eventId =
      body.eventId
        ?.trim();

    const slotId =
      body.slotId
        ?.trim();

    const dayScheduleId =
      body.dayScheduleId
        ?.trim();

    /* ========================================================
       BASIC VALIDATION
    ======================================================== */

    if (
      !eventId ||
      !slotId ||
      !dayScheduleId
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            'Event, schedule and slot are required.',
        },
        {
          status:
            400,
        },
      );
    }

    if (
      !mongoose.Types
        .ObjectId
        .isValid(
          eventId,
        ) ||
      !mongoose.Types
        .ObjectId
        .isValid(
          slotId,
        ) ||
      !mongoose.Types
        .ObjectId
        .isValid(
          dayScheduleId,
        )
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            'Invalid booking reference.',
        },
        {
          status:
            400,
        },
      );
    }

    const details =
      normalizeDetails(
        body.details ??
          {},
      );

    if (
      !details.fullName
        ?.trim()
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            'Full name is required.',
        },
        {
          status:
            400,
        },
      );
    }

    if (
      !details.email
        ?.trim()
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            'Email address is required.',
        },
        {
          status:
            400,
        },
      );
    }

    if (
      !details.mobile
        ?.trim()
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            'Mobile number is required.',
        },
        {
          status:
            400,
        },
      );
    }

    details.fullName =
      details.fullName
        .trim();

    details.email =
      details.email
        .trim()
        .toLowerCase();

    details.mobile =
      details.mobile
        .trim();

    await connectDB();

    /* ========================================================
       VERIFY EVENT
    ======================================================== */

    const event =
      await Event.findById(
        eventId,
      )
        .select({
          _id: 1,
          eventName: 1,
          status: 1,
        })
        .lean();

    if (!event) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            'Event not found.',
        },
        {
          status:
            404,
        },
      );
    }

    /* ========================================================
       VERIFY DAY SCHEDULE
    ======================================================== */

    const schedule =
      await DaySchedule.findOne({
        _id:
          dayScheduleId,

        eventId:
          eventId,
      })
        .select({
          _id: 1,
        })
        .lean();

    if (!schedule) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            'Selected schedule is invalid.',
        },
        {
          status:
            400,
        },
      );
    }

    /* ========================================================
       VERIFY SLOT
    ======================================================== */

    const slot =
      await Slot.findOne({
        _id:
          slotId,

        eventId:
          eventId,

        dayScheduleId:
          dayScheduleId,
      })
        .select({
          _id: 1,
          capacity: 1,
          bookedCount: 1,
        })
        .lean();

    if (!slot) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            'Selected slot is invalid.',
        },
        {
          status:
            400,
        },
      );
    }

    /* ========================================================
       EXISTING BOOKING

       Important:
       prevents confirmation page retries from creating
       duplicate MongoDB records.
    ======================================================== */

    const existing =
      await Booking.findOne({
        eventId:
          eventId,

        $or: [
          {
            'details.email':
              details.email,
          },

          {
            'details.mobile':
              details.mobile,
          },
        ],
      })
        .select({
          _id: 1,
          bookingId: 1,
          eventId: 1,
          attendanceStatus:
            1,
          checkedInAt:
            1,
        })
        .lean();

    if (existing) {
      return NextResponse.json(
        {
          success:
            true,

          existing:
            true,

          booking:
            normalizeBookingResponse(
              existing,
            ),
        },
        {
          status:
            200,
        },
      );
    }

    /* ========================================================
       RESERVE SLOT ATOMICALLY
    ======================================================== */

    const reservedSlot =
      await Slot.findOneAndUpdate(
        {
          _id:
            slotId,

          eventId:
            eventId,

          dayScheduleId:
            dayScheduleId,

          $expr: {
            $lt: [
              '$bookedCount',
              '$capacity',
            ],
          },
        },
        {
          $inc: {
            bookedCount:
              1,
          },
        },
        {
          new:
            true,
        },
      );

    if (!reservedSlot) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            'This slot is no longer available.',
        },
        {
          status:
            409,
        },
      );
    }

    reservedSlotId =
      reservedSlot._id;

    /* ========================================================
       SERVER BOOKING ID
    ======================================================== */

    const bookingId =
      await generateBookingId();

    /* ========================================================
       CREATE REAL MONGODB BOOKING
    ======================================================== */

    const booking =
      await Booking.create({
        bookingId,

        eventId,

        slotId,

        dayScheduleId,

        details,

        attendanceStatus:
          'NOT_PRESENT',

        checkedInAt:
          null,
      });

    /*
     * Slot reservation now belongs permanently
     * to this booking. Prevent rollback.
     */
    reservedSlotId =
      null;

    return NextResponse.json(
      {
        success:
          true,

        existing:
          false,

        booking: {
          id:
            booking._id.toString(),

          bookingId:
            booking.bookingId,

          eventId:
            booking.eventId.toString(),

          attendanceStatus:
            booking.attendanceStatus,

          checkedInAt:
            booking.checkedInAt
              ? booking.checkedInAt.toISOString()
              : null,
        },
      },
      {
        status:
          201,
      },
    );
  } catch (error) {
    console.error(
      'POST /api/bookings failed:',
      error,
    );

    /* ========================================================
       ROLLBACK RESERVED SLOT IF BOOKING CREATION FAILED
    ======================================================== */

    if (
      reservedSlotId
    ) {
      try {
        await Slot.updateOne(
          {
            _id:
              reservedSlotId,

            bookedCount: {
              $gt:
                0,
            },
          },
          {
            $inc: {
              bookedCount:
                -1,
            },
          },
        );
      } catch (
        rollbackError
      ) {
        console.error(
          'Booking slot rollback failed:',
          rollbackError,
        );
      }
    }

    return NextResponse.json(
      {
        success:
          false,

        error:
          'Unable to complete the booking.',
      },
      {
        status:
          500,
      },
    );
  }
}

/* ============================================================
   NORMALIZE DETAILS
============================================================ */

function normalizeDetails(
  input:
    BookingDetailsInput,
) {
  const output:
    Record<
      string,
      string
    > = {};

  for (
    const [
      rawKey,
      rawValue,
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
      rawValue ===
        undefined ||
      rawValue ===
        null
    ) {
      output[key] =
        '';

      continue;
    }

    if (
      typeof rawValue ===
      'string'
    ) {
      output[key] =
        rawValue.trim();

      continue;
    }

    output[key] =
      String(
        rawValue,
      );
  }

  return output;
}

/* ============================================================
   GENERATE BOOKING ID
============================================================ */

async function generateBookingId() {
  const year =
    new Date()
      .getFullYear();

  for (
    let attempt =
      0;
    attempt <
    30;
    attempt++
  ) {
    const number =
      randomInt(
        10000,
        100000,
      );

    const bookingId =
      `SSI-MC-${year}-${number}`;

    const exists =
      await Booking.exists({
        bookingId,
      });

    if (!exists) {
      return bookingId;
    }
  }

  throw new Error(
    'Unable to generate a unique booking ID.',
  );
}