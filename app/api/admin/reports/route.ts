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
  Event,
} from '@/models/Event';

import {
  Slot,
} from '@/models/Slot';

import {
  DaySchedule,
} from '@/models/DaySchedule';

export const dynamic =
  'force-dynamic';

export const revalidate = 0;

/* ============================================================
   TYPES
============================================================ */

type AttendanceFilter =
  | 'all'
  | 'present'
  | 'not_present';

type PopulatedBooking = {
  _id: mongoose.Types.ObjectId;

  bookingId: string;

  details?: Record<
    string,
    unknown
  >;

  attendanceStatus?:
    | 'PRESENT'
    | 'NOT_PRESENT';

  checkedInAt?:
    Date | null;

  checkedInBy?: string;

  checkInMethod?:
    | 'QR'
    | 'MANUAL';

  createdAt: Date;

  eventId?: {
    _id:
      mongoose.Types.ObjectId;

    eventName?: string;

    eventType?: string;

    venue?: string;

    status?: string;

    startDate?: Date;

    endDate?: Date;
  } | null;

  slotId?: {
    _id:
      mongoose.Types.ObjectId;

    startTime?: string;

    endTime?: string;

    capacity?: number;

    bookedCount?: number;
  } | null;

  dayScheduleId?: {
    _id:
      mongoose.Types.ObjectId;

    dayNumber?: number;

    date?: Date;
  } | null;
};

/* ============================================================
   GET
============================================================ */

export async function GET(
  request:
    NextRequest,
) {
  try {
    /* ========================================================
       AUTH
    ======================================================== */

    const authenticated =
      await requireAdminSession();

    if (!authenticated) {
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
       QUERY
    ======================================================== */

    const params =
      request.nextUrl
        .searchParams;

    const eventId =
      params
        .get(
          'eventId',
        )
        ?.trim() ||
      '';

    const from =
      params
        .get(
          'from',
        )
        ?.trim() ||
      '';

    const to =
      params
        .get(
          'to',
        )
        ?.trim() ||
      '';

    const attendanceRaw =
      params
        .get(
          'attendance',
        )
        ?.trim() ||
      'all';

    const attendance:
      AttendanceFilter =
      attendanceRaw ===
        'present' ||
      attendanceRaw ===
        'not_present'
        ? attendanceRaw
        : 'all';

    /* ========================================================
       BOOKING MATCH
    ======================================================== */

    const bookingMatch:
      Record<
        string,
        unknown
      > = {};

    let selectedEventObjectId:
      mongoose.Types.ObjectId | null =
      null;

    if (eventId) {
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
              'Invalid event filter.',
          },
          {
            status:
              400,
          },
        );
      }

      selectedEventObjectId =
        new mongoose.Types.ObjectId(
          eventId,
        );

      bookingMatch.eventId =
        selectedEventObjectId;
    }

    if (
      attendance ===
      'present'
    ) {
      bookingMatch.attendanceStatus =
        'PRESENT';
    }

    if (
      attendance ===
      'not_present'
    ) {
      bookingMatch.attendanceStatus =
        'NOT_PRESENT';
    }

    /* ========================================================
       REGISTRATION DATE RANGE

       Report date range = Booking.createdAt
    ======================================================== */

    const createdAt:
      Record<
        string,
        Date
      > = {};

    const fromDate =
      parseDateStart(
        from,
      );

    const toExclusive =
      parseDateEndExclusive(
        to,
      );

    if (fromDate) {
      createdAt.$gte =
        fromDate;
    }

    if (toExclusive) {
      createdAt.$lt =
        toExclusive;
    }

    if (
      Object.keys(
        createdAt,
      ).length
    ) {
      bookingMatch.createdAt =
        createdAt;
    }

    /* ========================================================
       FETCH EVENTS
    ======================================================== */

    const eventFilter =
      selectedEventObjectId
        ? {
            _id:
              selectedEventObjectId,
          }
        : {};

    const events =
      await Event.find(
        eventFilter,
      )
        .select({
          _id: 1,
          eventName: 1,
          eventType: 1,
          venue: 1,
          status: 1,
          startDate: 1,
          endDate: 1,
        })
        .sort({
          startDate:
            1,
        })
        .lean();

    const eventIds =
      events.map(
        (
          event,
        ) =>
          event._id,
      );

    /* ========================================================
       BOOKINGS
    ======================================================== */

    const rawBookings =
      await Booking.find(
        bookingMatch,
      )
        .sort({
          createdAt:
            1,
        })
        .populate({
          path:
            'eventId',

          select:
            'eventName eventType venue status startDate endDate',
        })
        .populate({
          path:
            'slotId',

          select:
            'startTime endTime capacity bookedCount',
        })
        .populate({
          path:
            'dayScheduleId',

          select:
            'dayNumber date',
        })
        .lean();

    const bookings =
      rawBookings as unknown as
        PopulatedBooking[];

    /* ========================================================
       SLOT DATA

       Capacity is scoped to selected event if an event filter
       is active. Otherwise all events are included.
    ======================================================== */

    const slotMatch:
      Record<
        string,
        unknown
      > = {};

    if (
      selectedEventObjectId
    ) {
      slotMatch.eventId =
        selectedEventObjectId;
    } else if (
      eventIds.length
    ) {
      slotMatch.eventId = {
        $in:
          eventIds,
      };
    }

    const slots =
      await Slot.find(
        slotMatch,
      )
        .select({
          _id: 1,
          eventId: 1,
          capacity: 1,
          bookedCount: 1,
        })
        .lean();

    /* ========================================================
       EVENT OPTIONS

       Dropdown should always contain every event, even when
       current report is filtered to one event.
    ======================================================== */

    const allEventOptions =
      await Event.find({})
        .select({
          _id: 1,
          eventName: 1,
          status: 1,
        })
        .sort({
          startDate:
            -1,
        })
        .lean();

    /* ========================================================
       NORMALIZED LEDGER
    ======================================================== */

    const ledger =
      bookings.map(
        (
          booking,
        ) => {
          const details =
            booking.details ??
            {};

          return {
            id:
              String(
                booking._id,
              ),

            bookingId:
              booking.bookingId,

            fullName:
              getString(
                details.fullName,
              ) ||
              'Unknown attendee',

            email:
              getString(
                details.email,
              ),

            mobile:
              getString(
                details.mobile,
              ),

            designation:
              getString(
                details.designation,
              ),

            specialty:
              getString(
                details.specialty,
              ),

            hospital:
              getString(
                details.hospitalName,
              ) ||
              getString(
                details.hospital,
              ) ||
              getString(
                details.institution,
              ) ||
              getString(
                details.institutionName,
              ),

            city:
              getString(
                details.city,
              ),

            state:
              getString(
                details.state,
              ),

            country:
              getString(
                details.country,
              ),

            eventId:
              booking.eventId
                ? String(
                    booking
                      .eventId
                      ._id,
                  )
                : '',

            eventName:
              booking.eventId
                ?.eventName ||
              'Unknown event',

            eventType:
              booking.eventId
                ?.eventType ||
              '',

            venue:
              booking.eventId
                ?.venue ||
              '',

            eventStatus:
              booking.eventId
                ?.status ||
              '',

            scheduledDate:
              booking
                .dayScheduleId
                ?.date
                ? new Date(
                    booking
                      .dayScheduleId
                      .date,
                  ).toISOString()
                : null,

            dayNumber:
              booking
                .dayScheduleId
                ?.dayNumber ??
              null,

            startTime:
              booking.slotId
                ?.startTime ||
              '',

            endTime:
              booking.slotId
                ?.endTime ||
              '',

            attendanceStatus:
              booking.attendanceStatus ||
              'NOT_PRESENT',

            checkInMethod:
              booking.checkInMethod ||
              '',

            checkedInAt:
              booking.checkedInAt
                ? new Date(
                    booking.checkedInAt,
                  ).toISOString()
                : null,

            checkedInBy:
              booking.checkedInBy ||
              '',

            createdAt:
              new Date(
                booking.createdAt,
              ).toISOString(),
          };
        },
      );

    /* ========================================================
       SUMMARY
    ======================================================== */

    const totalBookings =
      ledger.length;

    const present =
      ledger.filter(
        (
          booking,
        ) =>
          booking.attendanceStatus ===
          'PRESENT',
      ).length;

    const notPresent =
      totalBookings -
      present;

    const attendanceRate =
      totalBookings >
      0
        ? round(
            (present /
              totalBookings) *
              100,
          )
        : 0;

    const qrCheckIns =
      ledger.filter(
        (
          booking,
        ) =>
          booking.checkInMethod ===
          'QR',
      ).length;

    const manualCheckIns =
      ledger.filter(
        (
          booking,
        ) =>
          booking.checkInMethod ===
          'MANUAL',
      ).length;

    const totalCapacity =
      slots.reduce(
        (
          total,
          slot,
        ) =>
          total +
          Number(
            slot.capacity ||
              0,
          ),
        0,
      );

    const reservedCapacity =
      slots.reduce(
        (
          total,
          slot,
        ) =>
          total +
          Number(
            slot.bookedCount ||
              0,
          ),
        0,
      );

    const remainingCapacity =
      Math.max(
        totalCapacity -
          reservedCapacity,
        0,
      );

    const slotUtilization =
      totalCapacity >
      0
        ? round(
            (reservedCapacity /
              totalCapacity) *
              100,
          )
        : 0;

    const liveEvents =
      events.filter(
        (
          event,
        ) =>
          event.status ===
          'LIVE',
      ).length;

    /* ========================================================
       SLOT TOTALS BY EVENT
    ======================================================== */

    const slotTotals =
      new Map<
        string,
        {
          capacity: number;
          booked: number;
        }
      >();

    for (
      const slot of slots
    ) {
      const key =
        String(
          slot.eventId,
        );

      const previous =
        slotTotals.get(
          key,
        ) ?? {
          capacity:
            0,

          booked:
            0,
        };

      previous.capacity +=
        Number(
          slot.capacity ||
            0,
        );

      previous.booked +=
        Number(
          slot.bookedCount ||
            0,
        );

      slotTotals.set(
        key,
        previous,
      );
    }

    /* ========================================================
       BOOKING TOTALS BY EVENT
    ======================================================== */

    const bookingTotals =
      new Map<
        string,
        {
          total: number;
          present: number;
          notPresent: number;
        }
      >();

    for (
      const booking of ledger
    ) {
      const key =
        booking.eventId;

      if (!key) {
        continue;
      }

      const previous =
        bookingTotals.get(
          key,
        ) ?? {
          total:
            0,

          present:
            0,

          notPresent:
            0,
        };

      previous.total +=
        1;

      if (
        booking.attendanceStatus ===
        'PRESENT'
      ) {
        previous.present +=
          1;
      } else {
        previous.notPresent +=
          1;
      }

      bookingTotals.set(
        key,
        previous,
      );
    }

    /* ========================================================
       EVENT PERFORMANCE
    ======================================================== */

    const eventPerformance =
      events.map(
        (
          event,
        ) => {
          const id =
            String(
              event._id,
            );

          const bookingsForEvent =
            bookingTotals.get(
              id,
            ) ?? {
              total:
                0,

              present:
                0,

              notPresent:
                0,
            };

          const slotsForEvent =
            slotTotals.get(
              id,
            ) ?? {
              capacity:
                0,

              booked:
                0,
            };

          const eventAttendanceRate =
            bookingsForEvent.total >
            0
              ? round(
                  (bookingsForEvent.present /
                    bookingsForEvent.total) *
                    100,
                )
              : 0;

          const utilization =
            slotsForEvent.capacity >
            0
              ? round(
                  (slotsForEvent.booked /
                    slotsForEvent.capacity) *
                    100,
                )
              : 0;

          return {
            id,

            eventName:
              event.eventName,

            eventType:
              event.eventType,

            venue:
              event.venue,

            status:
              event.status,

            startDate:
              event.startDate
                ? new Date(
                    event.startDate,
                  ).toISOString()
                : null,

            endDate:
              event.endDate
                ? new Date(
                    event.endDate,
                  ).toISOString()
                : null,

            registrations:
              bookingsForEvent.total,

            present:
              bookingsForEvent.present,

            notPresent:
              bookingsForEvent.notPresent,

            attendanceRate:
              eventAttendanceRate,

            capacity:
              slotsForEvent.capacity,

            bookedCapacity:
              slotsForEvent.booked,

            utilization,
          };
        },
      );

    /* ========================================================
       REGISTRATION TREND
    ======================================================== */

    const registrationTrend =
      buildRegistrationTrend(
        ledger,
        fromDate,
        toExclusive,
      );

    /* ========================================================
       EVENT ATTENDANCE CHART
    ======================================================== */

    const attendanceByEvent =
      [...eventPerformance]
        .filter(
          (
            event,
          ) =>
            event.registrations >
            0,
        )
        .sort(
          (
            a,
            b,
          ) =>
            b.registrations -
            a.registrations,
        )
        .slice(
          0,
          10,
        )
        .map(
          (
            event,
          ) => ({
            event:
              shorten(
                event.eventName,
                28,
              ),

            fullEventName:
              event.eventName,

            present:
              event.present,

            notPresent:
              event.notPresent,
          }),
        );

    /* ========================================================
       SLOT UTILIZATION CHART
    ======================================================== */

    const utilizationByEvent =
      [...eventPerformance]
        .filter(
          (
            event,
          ) =>
            event.capacity >
            0,
        )
        .sort(
          (
            a,
            b,
          ) =>
            b.utilization -
            a.utilization,
        )
        .slice(
          0,
          10,
        )
        .map(
          (
            event,
          ) => ({
            event:
              shorten(
                event.eventName,
                28,
              ),

            fullEventName:
              event.eventName,

            utilization:
              event.utilization,

            booked:
              event.bookedCapacity,

            capacity:
              event.capacity,
          }),
        );

    /* ========================================================
       RESPONSE
    ======================================================== */

    return NextResponse.json(
      {
        success:
          true,

        generatedAt:
          new Date()
            .toISOString(),

        filters: {
          eventId,
          from,
          to,
          attendance,
        },

        eventOptions:
          allEventOptions.map(
            (
              event,
            ) => ({
              id:
                String(
                  event._id,
                ),

              eventName:
                event.eventName,

              status:
                event.status,
            }),
          ),

        summary: {
          totalBookings,

          present,

          notPresent,

          attendanceRate,

          qrCheckIns,

          manualCheckIns,

          totalCapacity,

          reservedCapacity,

          remainingCapacity,

          slotUtilization,

          events:
            events.length,

          liveEvents,
        },

        charts: {
          registrationTrend,

          attendanceByEvent,

          utilizationByEvent,

          attendanceStatus: [
            {
              name:
                'Present',

              value:
                present,
            },

            {
              name:
                'Not Present',

              value:
                notPresent,
            },
          ],

          checkInMethods: [
            {
              name:
                'QR',

              value:
                qrCheckIns,
            },

            {
              name:
                'Manual',

              value:
                manualCheckIns,
            },
          ],
        },

        eventPerformance,

        bookings:
          [...ledger]
            .sort(
              (
                a,
                b,
              ) =>
                new Date(
                  b.createdAt,
                ).getTime() -
                new Date(
                  a.createdAt,
                ).getTime(),
            ),
      },
      {
        status:
          200,
      },
    );
  } catch (error) {
    console.error(
      'GET /api/admin/reports failed:',
      error,
    );

    return NextResponse.json(
      {
        success:
          false,

        message:
          'Unable to generate report.',
      },
      {
        status:
          500,
      },
    );
  }
}

/* ============================================================
   REGISTRATION TREND
============================================================ */

function buildRegistrationTrend(
  bookings: Array<{
    createdAt: string;

    attendanceStatus:
      string;
  }>,

  requestedStart:
    Date | null,

  requestedEndExclusive:
    Date | null,
) {
  const today =
    new Date();

  let start =
    requestedStart;

  let end =
    requestedEndExclusive
      ? new Date(
          requestedEndExclusive.getTime() -
            1,
        )
      : null;

  if (
    !start &&
    bookings.length
  ) {
    start =
      new Date(
        bookings[
          bookings.length -
            1
        ].createdAt,
      );

    for (
      const booking of bookings
    ) {
      const current =
        new Date(
          booking.createdAt,
        );

      if (
        current <
        start
      ) {
        start =
          current;
      }
    }
  }

  if (
    !end &&
    bookings.length
  ) {
    end =
      new Date(
        bookings[0].createdAt,
      );

    for (
      const booking of bookings
    ) {
      const current =
        new Date(
          booking.createdAt,
        );

      if (
        current >
        end
      ) {
        end =
          current;
      }
    }
  }

  if (!start) {
    start =
      new Date(
        today,
      );

    start.setUTCDate(
      start.getUTCDate() -
        6,
    );
  }

  if (!end) {
    end =
      today;
  }

  start =
    startOfUtcDay(
      start,
    );

  end =
    endOfUtcDay(
      end,
    );

  const spanDays =
    Math.max(
      Math.ceil(
        (end.getTime() -
          start.getTime()) /
          86400000,
      ),
      1,
    );

  const monthly =
    spanDays >
    62;

  const buckets =
    new Map<
      string,
      {
        key: string;
        label: string;
        registered: number;
        present: number;
        timestamp: number;
      }
    >();

  if (monthly) {
    let cursor =
      new Date(
        Date.UTC(
          start.getUTCFullYear(),
          start.getUTCMonth(),
          1,
        ),
      );

    const last =
      new Date(
        Date.UTC(
          end.getUTCFullYear(),
          end.getUTCMonth(),
          1,
        ),
      );

    while (
      cursor <=
      last
    ) {
      const key =
        `${cursor.getUTCFullYear()}-${String(
          cursor.getUTCMonth() +
            1,
        ).padStart(
          2,
          '0',
        )}`;

      buckets.set(
        key,
        {
          key,

          label:
            new Intl.DateTimeFormat(
              'en-GB',
              {
                month:
                  'short',

                year:
                  'numeric',

                timeZone:
                  'UTC',
              },
            ).format(
              cursor,
            ),

          registered:
            0,

          present:
            0,

          timestamp:
            cursor.getTime(),
        },
      );

      cursor =
        new Date(
          Date.UTC(
            cursor.getUTCFullYear(),
            cursor.getUTCMonth() +
              1,
            1,
          ),
        );
    }
  } else {
    let cursor =
      startOfUtcDay(
        start,
      );

    const last =
      startOfUtcDay(
        end,
      );

    while (
      cursor <=
      last
    ) {
      const key =
        cursor
          .toISOString()
          .slice(
            0,
            10,
          );

      buckets.set(
        key,
        {
          key,

          label:
            new Intl.DateTimeFormat(
              'en-GB',
              {
                day:
                  '2-digit',

                month:
                  'short',

                timeZone:
                  'UTC',
              },
            ).format(
              cursor,
            ),

          registered:
            0,

          present:
            0,

          timestamp:
            cursor.getTime(),
        },
      );

      cursor =
        new Date(
          cursor.getTime() +
            86400000,
        );
    }
  }

  for (
    const booking of bookings
  ) {
    const date =
      new Date(
        booking.createdAt,
      );

    const key =
      monthly
        ? `${date.getUTCFullYear()}-${String(
            date.getUTCMonth() +
              1,
          ).padStart(
            2,
            '0',
          )}`
        : date
            .toISOString()
            .slice(
              0,
              10,
            );

    const bucket =
      buckets.get(
        key,
      );

    if (!bucket) {
      continue;
    }

    bucket.registered +=
      1;

    if (
      booking.attendanceStatus ===
      'PRESENT'
    ) {
      bucket.present +=
        1;
    }
  }

  return [
    ...buckets.values(),
  ]
    .sort(
      (
        a,
        b,
      ) =>
        a.timestamp -
        b.timestamp,
    )
    .map(
      ({
        label,
        registered,
        present,
      }) => ({
        period:
          label,

        registered,

        present,
      }),
    );
}

/* ============================================================
   HELPERS
============================================================ */

function getString(
  value:
    unknown,
) {
  return typeof value ===
    'string'
    ? value
    : '';
}

function parseDateStart(
  value:
    string,
) {
  if (!value) {
    return null;
  }

  const date =
    new Date(
      `${value}T00:00:00.000Z`,
    );

  return Number.isNaN(
    date.getTime(),
  )
    ? null
    : date;
}

function parseDateEndExclusive(
  value:
    string,
) {
  const start =
    parseDateStart(
      value,
    );

  if (!start) {
    return null;
  }

  return new Date(
    start.getTime() +
      86400000,
  );
}

function startOfUtcDay(
  date:
    Date,
) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    ),
  );
}

function endOfUtcDay(
  date:
    Date,
) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
}

function round(
  value:
    number,
) {
  return Math.round(
    value *
      100,
  ) / 100;
}

function shorten(
  value:
    string,
  max:
    number,
) {
  if (
    value.length <=
    max
  ) {
    return value;
  }

  return `${value.slice(
    0,
    max - 1,
  )}…`;
}