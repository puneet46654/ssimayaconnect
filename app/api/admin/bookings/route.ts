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
  DaySchedule,
} from '@/models/DaySchedule';

/*
 * Import Slot so the Mongoose model
 * is registered before populate().
 */
import '@/models/Slot';

/* ============================================================
   HELPERS
============================================================ */

function escapeRegex(
  value: string,
) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  );
}

function parsePositiveInteger(
  value: string | null,
  fallback: number,
  maximum: number,
) {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(
      parsed,
    ) ||
    parsed < 1
  ) {
    return fallback;
  }

  return Math.min(
    Math.floor(
      parsed,
    ),
    maximum,
  );
}

function getToday() {
  const today =
    new Date();

  today.setHours(
    0,
    0,
    0,
    0,
  );

  return today;
}

/* ============================================================
   GET
============================================================ */

export async function GET(
  request: NextRequest,
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

    /* ========================================================
       DATABASE
    ======================================================== */

    await connectDB();

    /* ========================================================
       QUERY PARAMS
    ======================================================== */

    const {
      searchParams,
    } =
      new URL(
        request.url,
      );

    const page =
      parsePositiveInteger(
        searchParams.get(
          'page',
        ),
        1,
        100000,
      );

    const limit =
      parsePositiveInteger(
        searchParams.get(
          'limit',
        ),
        10,
        100,
      );

    const search =
      (
        searchParams.get(
          'search',
        ) || ''
      ).trim();

    const eventId =
      (
        searchParams.get(
          'eventId',
        ) || ''
      ).trim();

    const dateFilter =
      (
        searchParams.get(
          'dateFilter',
        ) || 'all'
      ).trim();

    /* ========================================================
       BOOKING FILTER
    ======================================================== */

    const filter:
      Record<
        string,
        unknown
      > = {};

    if (
      eventId &&
      mongoose.Types.ObjectId.isValid(
        eventId,
      )
    ) {
      filter.eventId =
        new mongoose.Types.ObjectId(
          eventId,
        );
    }

    if (search) {
      const regex =
        new RegExp(
          escapeRegex(
            search,
          ),
          'i',
        );

      filter.$or = [
        {
          bookingId:
            regex,
        },

        {
          'details.fullName':
            regex,
        },

        {
          'details.email':
            regex,
        },

        {
          'details.mobile':
            regex,
        },
      ];
    }

    /* ========================================================
       DATE FILTER

       Booking itself has no date field.
       Date belongs to DaySchedule.
    ======================================================== */

    if (
      dateFilter ===
        'upcoming' ||
      dateFilter ===
        'past'
    ) {
      const today =
        getToday();

      const dayFilter =
        dateFilter ===
        'upcoming'
          ? {
              date: {
                $gte:
                  today,
              },
            }
          : {
              date: {
                $lt:
                  today,
              },
            };

      const matchingDays =
        await DaySchedule.find(
          dayFilter,
        )
          .select(
            '_id',
          )
          .lean();

      filter.dayScheduleId =
        {
          $in:
            matchingDays.map(
              (
                day,
              ) =>
                day._id,
            ),
        };
    }

    /* ========================================================
       QUERY
    ======================================================== */

    const skip =
      (page - 1) *
      limit;

    const [
      bookings,
      total,
      eventOptions,
    ] =
      await Promise.all([
        Booking.find(
          filter,
        )
          .sort({
            createdAt:
              -1,
          })
          .skip(
            skip,
          )
          .limit(
            limit,
          )
          .populate({
            path:
              'eventId',

            select:
              'eventName venue status',
          })
          .populate({
            path:
              'slotId',

            select:
              'startTime endTime',
          })
          .populate({
            path:
              'dayScheduleId',

            select:
              'date',
          })
          .lean(),

        Booking.countDocuments(
          filter,
        ),

        Event.find({})
          .sort({
            startDate:
              -1,
          })
          .select(
            '_id eventName',
          )
          .lean(),
      ]);

    /* ========================================================
       SUMMARY STATS

       Current Booking model does not yet contain
       attendance/check-in fields, so first version uses
       scheduled date to separate upcoming and past.
    ======================================================== */

    const today =
      getToday();

    const [
      upcomingDays,
      pastDays,
    ] =
      await Promise.all([
        DaySchedule.find({
          date: {
            $gte:
              today,
          },
        })
          .select(
            '_id',
          )
          .lean(),

        DaySchedule.find({
          date: {
            $lt:
              today,
          },
        })
          .select(
            '_id',
          )
          .lean(),
      ]);

    const [
      totalBookings,
      upcomingBookings,
      pastBookings,
    ] =
      await Promise.all([
        Booking.countDocuments(
          {},
        ),

        Booking.countDocuments(
          {
            dayScheduleId:
              {
                $in:
                  upcomingDays.map(
                    (
                      day,
                    ) =>
                      day._id,
                  ),
              },
          },
        ),

        Booking.countDocuments(
          {
            dayScheduleId:
              {
                $in:
                  pastDays.map(
                    (
                      day,
                    ) =>
                      day._id,
                  ),
              },
          },
        ),
      ]);

    /* ========================================================
       NORMALIZE RESPONSE
    ======================================================== */

    const normalizedBookings =
      bookings.map(
        (
          booking,
        ) => {
          const raw =
            booking as unknown as {
              _id:
                mongoose.Types.ObjectId;

              bookingId:
                string;

              details?:
                Record<
                  string,
                  unknown
                >;

              eventId?: {
                _id:
                  mongoose.Types.ObjectId;

                eventName?:
                  string;

                venue?:
                  string;

                status?:
                  string;
              } | null;

              slotId?: {
                _id:
                  mongoose.Types.ObjectId;

                startTime?:
                  string;

                endTime?:
                  string;
              } | null;

              dayScheduleId?: {
                _id:
                  mongoose.Types.ObjectId;

                date?:
                  Date;
              } | null;

              createdAt:
                Date;
            };

          const details =
            raw.details ||
            {};

          const fullName =
            typeof details.fullName ===
            'string'
              ? details.fullName
              : 'Unknown attendee';

          const email =
            typeof details.email ===
            'string'
              ? details.email
              : '';

          const mobile =
            typeof details.mobile ===
            'string'
              ? details.mobile
              : '';

          return {
            _id:
              String(
                raw._id,
              ),

            bookingId:
              raw.bookingId,

            attendee:
              {
                fullName,
                email,
                mobile,
              },

            event:
              raw.eventId
                ? {
                    _id:
                      String(
                        raw
                          .eventId
                          ._id,
                      ),

                    eventName:
                      raw
                        .eventId
                        .eventName ||
                      '',

                    venue:
                      raw
                        .eventId
                        .venue ||
                      '',

                    status:
                      raw
                        .eventId
                        .status ||
                      '',
                  }
                : null,

            slot:
              raw.slotId
                ? {
                    _id:
                      String(
                        raw
                          .slotId
                          ._id,
                      ),

                    startTime:
                      raw
                        .slotId
                        .startTime ||
                      '',

                    endTime:
                      raw
                        .slotId
                        .endTime ||
                      '',
                  }
                : null,

            daySchedule:
              raw.dayScheduleId
                ? {
                    _id:
                      String(
                        raw
                          .dayScheduleId
                          ._id,
                      ),

                    date:
                      raw
                        .dayScheduleId
                        .date
                        ? new Date(
                            raw
                              .dayScheduleId
                              .date,
                          ).toISOString()
                        : '',
                  }
                : null,

            createdAt:
              new Date(
                raw.createdAt,
              ).toISOString(),
          };
        },
      );

    return NextResponse.json(
      {
        success:
          true,

        bookings:
          normalizedBookings,

        events:
          eventOptions.map(
            (
              event,
            ) => ({
              _id:
                String(
                  event._id,
                ),

              eventName:
                event.eventName,
            }),
          ),

        stats:
          {
            total:
              totalBookings,

            upcoming:
              upcomingBookings,

            past:
              pastBookings,
          },

        pagination:
          {
            page,

            limit,

            total,

            pages:
              Math.max(
                Math.ceil(
                  total /
                    limit,
                ),
                1,
              ),
          },
      },
      {
        status:
          200,
      },
    );
  } catch (error) {
    console.error(
      'GET /api/admin/bookings failed:',
      error,
    );

    return NextResponse.json(
      {
        success:
          false,

        message:
          'Unable to load bookings.',
      },
      {
        status:
          500,
      },
    );
  }
}