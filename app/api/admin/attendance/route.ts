import mongoose from 'mongoose';

import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  connectDB,
} from '@/lib/db';

import {
  getAdminSession,
} from '@/lib/admin-server-auth';

import {
  Booking,
} from '@/models/Booking';

import {
  Event,
} from '@/models/Event';
import { emitRealtimeChange } from '@/lib/realtime';

/* ============================================================
   QR
============================================================ */

type AttendanceQrPayload = {
  type?: string;

  doctorId?: string;

  bookingId?: string;

  eventId?: string;

  slotId?: string;

  dayScheduleId?: string;

  eventName?: string;
};

/* ============================================================
   GET
============================================================ */

export async function GET(
  request:
    NextRequest,
) {
  try {
    const admin =
      await getAdminSession();

    if (!admin) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            'Unauthorized.',
        },
        {
          status:
            401,
        },
      );
    }

    await connectDB();

    /* ========================================================
       LIVE EVENTS
    ======================================================== */

    const liveEvents =
      await Event.find({
        status:
          'LIVE',
      })
        .select({
          _id: 1,
          eventName: 1,
          venue: 1,
          startDate: 1,
          endDate: 1,
        })
        .sort({
          startDate:
            1,
        })
        .lean();

    const events =
      liveEvents.map(
        (
          event,
        ) => ({
          id:
            String(
              event._id,
            ),

          eventName:
            event.eventName,

          venue:
            event.venue,

          startDate:
            event.startDate,

          endDate:
            event.endDate,
        }),
      );

    const eventId =
      request.nextUrl
        .searchParams
        .get(
          'eventId',
        )
        ?.trim();

    if (!eventId) {
      return NextResponse.json(
        {
          success:
            true,

          events,

          stats: {
            total:
              0,

            present:
              0,

            remaining:
              0,

            percentage:
              0,
          },

          recent:
            [],
        },
      );
    }

    if (
      !mongoose.Types
        .ObjectId
        .isValid(
          eventId,
        )
    ) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            'Invalid event.',
        },
        {
          status:
            400,
        },
      );
    }

    const selectedEvent =
      await Event.findOne({
        _id:
          eventId,

        status:
          'LIVE',
      })
        .select(
          '_id eventName',
        )
        .lean();

    if (
      !selectedEvent
    ) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            'Selected event is not currently live.',
        },
        {
          status:
            400,
        },
      );
    }

    /* ========================================================
       STATS
    ======================================================== */

    const [
      total,
      present,
      recentBookings,
    ] =
      await Promise.all([
        Booking.countDocuments({
          eventId,
        }),

        Booking.countDocuments({
          eventId,

          attendanceStatus:
            'PRESENT',
        }),

        Booking.find({
          eventId,

          attendanceStatus:
            'PRESENT',
        })
          .select({
            bookingId:
              1,

            details:
              1,

            checkedInAt:
              1,

            checkedInBy:
              1,

            checkInMethod:
              1,
          })
          .sort({
            checkedInAt:
              -1,
          })
          .limit(
            10,
          )
          .lean(),
      ]);

    const percentage =
      total > 0
        ? Math.round(
            (present /
              total) *
              100,
          )
        : 0;

    return NextResponse.json(
      {
        success:
          true,

        events,

        stats: {
          total,

          present,

          remaining:
            Math.max(
              total -
                present,
              0,
            ),

          percentage,
        },

        recent:
          recentBookings.map(
            (
              booking,
            ) => ({
              id:
                String(
                  booking._id,
                ),

              bookingId:
                booking.bookingId,

              fullName:
                booking
                  .details
                  ?.fullName ||
                'Attendee',

              checkedInAt:
                booking.checkedInAt
                  ? new Date(
                      booking.checkedInAt,
                    ).toISOString()
                  : null,

              checkedInBy:
                booking.checkedInBy ||
                '',

              method:
                booking.checkInMethod ||
                'QR',
            }),
          ),
      },
    );
  } catch (error) {
    console.error(
      'Attendance GET failed:',
      error,
    );

    return NextResponse.json(
      {
        success:
          false,

        message:
          'Unable to load attendance information.',
      },
      {
        status:
          500,
      },
    );
  }
}

/* ============================================================
   POST
============================================================ */

export async function POST(
  request:
    NextRequest,
) {
  try {
    const admin =
      await getAdminSession();

    if (!admin) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            'Unauthorized.',
        },
        {
          status:
            401,
        },
      );
    }

    const body =
      (await request.json()) as {
        eventId?: string;

        code?: string;

        bookingId?: string;

        method?:
          | 'QR'
          | 'MANUAL';
      };

    const eventId =
      body.eventId
        ?.trim();

    const method =
      body.method ===
      'MANUAL'
        ? 'MANUAL'
        : 'QR';

    if (
      !eventId ||
      !mongoose.Types
        .ObjectId
        .isValid(
          eventId,
        )
    ) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            'Select a valid live event first.',
        },
        {
          status:
            400,
        },
      );
    }

    await connectDB();

    /* ========================================================
       LIVE EVENT CHECK
    ======================================================== */

    const selectedEvent =
      await Event.findOne({
        _id:
          eventId,

        status:
          'LIVE',
      })
        .select({
          _id: 1,
          eventName: 1,
        })
        .lean();

    if (
      !selectedEvent
    ) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            'The selected event is not live.',
        },
        {
          status:
            409,
        },
      );
    }

    /* ========================================================
       IDENTIFY BOOKING
    ======================================================== */

    let qr:
      AttendanceQrPayload | null =
      null;

    let reference =
      '';

    let doctorId =
      '';

    if (
      method ===
      'QR'
    ) {
      const rawCode =
        body.code
          ?.trim();

      if (!rawCode) {
        return NextResponse.json(
          {
            success:
              false,

            message:
              'QR code is empty.',
          },
          {
            status:
              400,
          },
        );
      }

      try {
        qr =
          JSON.parse(
            rawCode,
          ) as AttendanceQrPayload;
      } catch {
        /*
         * Allows old/simple QR codes containing
         * only the booking ID.
         */
        reference =
          rawCode;
      }

      if (qr) {
        if (
          qr.type !==
          'SSI_MAYA_CONNECT_ATTENDANCE'
        ) {
          return NextResponse.json(
            {
              success: false,
              message:
                'Invalid attendance QR ticket.',
            },
            {
              status: 400,
            },
          );
        }

        if (
          !qr.eventId ||
          qr.eventId !== eventId
        ) {
          return NextResponse.json(
            {
              success:
                false,

              message:
                'This ticket belongs to another event.',
            },
            {
              status:
                409,
            },
          );
        }

        doctorId =
          qr.doctorId
            ?.trim() ||
          '';

        reference =
          qr.bookingId
            ?.trim() ||
          '';
      }
    } else {
      reference =
        body.bookingId
          ?.trim() ||
        '';
    }

    /* ========================================================
       QUERY
    ======================================================== */

    const query:
      Record<
        string,
        unknown
      > = {
        eventId:
          new mongoose.Types.ObjectId(
            eventId,
          ),
      };

    if (
      doctorId &&
      mongoose.Types
        .ObjectId
        .isValid(
          doctorId,
        )
    ) {
      query._id =
        new mongoose.Types.ObjectId(
          doctorId,
        );
    } else if (
      reference
    ) {
      const possibilities:
        Record<
          string,
          unknown
        >[] = [
          {
            bookingId:
              reference,
          },
        ];

      if (
        mongoose.Types
          .ObjectId
          .isValid(
            reference,
          )
      ) {
        possibilities.push({
          _id:
            new mongoose.Types.ObjectId(
              reference,
            ),
        });
      }

      query.$or =
        possibilities;
    } else {
      return NextResponse.json(
        {
          success:
            false,

          message:
            'No booking identifier was found.',
        },
        {
          status:
            400,
        },
      );
    }

    if (
      qr?.slotId &&
      mongoose.Types.ObjectId.isValid(
        qr.slotId,
      )
    ) {
      query.slotId =
        new mongoose.Types.ObjectId(
          qr.slotId,
        );
    }

    if (
      qr?.dayScheduleId &&
      mongoose.Types.ObjectId.isValid(
        qr.dayScheduleId,
      )
    ) {
      query.dayScheduleId =
        new mongoose.Types.ObjectId(
          qr.dayScheduleId,
        );
    }

    /* ========================================================
       FIND BOOKING
    ======================================================== */

    const booking =
      await Booking.findOne(
        query,
      );

    if (!booking) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            'Ticket not found for the selected event.',
        },
        {
          status:
            404,
        },
      );
    }

    /* ========================================================
       ALREADY PRESENT
    ======================================================== */

    if (
      booking.attendanceStatus ===
      'PRESENT'
    ) {
      return NextResponse.json(
        {
          success:
            true,

          alreadyPresent:
            true,

          message:
            'Attendance was already recorded.',

          booking: {
            id:
              booking._id.toString(),

            bookingId:
              booking.bookingId,

            fullName:
              booking.details
                ?.fullName ||
              'Attendee',

            attendanceStatus:
              'PRESENT',

            checkedInAt:
              booking.checkedInAt
                ? booking.checkedInAt.toISOString()
                : null,
          },
        },
      );
    }

    /* ========================================================
       MARK PRESENT
    ======================================================== */

    const now =
      new Date();

    const updatedBooking =
      await Booking.findOneAndUpdate(
        {
          _id:
            booking._id,
          eventId:
            new mongoose.Types.ObjectId(
              eventId,
            ),
          attendanceStatus: {
            $ne: 'PRESENT',
          },
        },
        {
          $set: {
            attendanceStatus:
              'PRESENT',
            checkedInAt:
              now,
            checkedInBy:
              admin,
            checkInMethod:
              method,
          },
        },
        {
          new: true,
        },
      ).lean();

    if (!updatedBooking) {
      return NextResponse.json(
        {
          success: true,
          alreadyPresent: true,
          message:
            'Attendance was already recorded.',
          booking: {
            id:
              booking._id.toString(),
            bookingId:
              booking.bookingId,
            fullName:
              booking.details
                ?.fullName ||
              'Attendee',
            attendanceStatus:
              'PRESENT',
            checkedInAt:
              booking.checkedInAt
                ? booking.checkedInAt.toISOString()
                : null,
          },
        },
      );
    }

    emitRealtimeChange({
      resource: 'attendance',
      action: 'updated',
      id: eventId,
    });

    return NextResponse.json(
      {
        success:
          true,

        alreadyPresent:
          false,

        message:
          'Attendance recorded successfully.',

        booking: {
          id:
            booking._id.toString(),

          bookingId:
            booking.bookingId,

          fullName:
            booking.details
              ?.fullName ||
            'Attendee',

          email:
            booking.details
              ?.email ||
            '',

          attendanceStatus:
            'PRESENT',

          checkedInAt:
            updatedBooking.checkedInAt
              ? new Date(
                  updatedBooking.checkedInAt,
                ).toISOString()
              : now.toISOString(),
        },
      },
    );
  } catch (error) {
    console.error(
      'Attendance POST failed:',
      error,
    );

    return NextResponse.json(
      {
        success:
          false,

        message:
          'Unable to record attendance.',
      },
      {
        status:
          500,
      },
    );
  }
}