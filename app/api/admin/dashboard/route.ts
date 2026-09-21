import {
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
  Event,
} from '@/models/Event';

import {
  Booking,
} from '@/models/Booking';

import {
  Slot,
} from '@/models/Slot';

import {
  DaySchedule,
} from '@/models/DaySchedule';

export const dynamic =
  'force-dynamic';

export const revalidate =
  0;

/* ============================================================
   GET DASHBOARD
============================================================ */

export async function GET() {
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
       DATE RANGE
    ======================================================== */

    const todayStart =
      new Date();

    todayStart.setHours(
      0,
      0,
      0,
      0,
    );

    const tomorrowStart =
      new Date(
        todayStart,
      );

    tomorrowStart.setDate(
      tomorrowStart.getDate() +
        1,
    );

    /* ========================================================
       EVENTS
    ======================================================== */

    const events =
      await Event.find({})
        .select({
          _id: 1,
          eventName: 1,
          venue: 1,
          startDate: 1,
          endDate: 1,
          status: 1,
        })
        .sort({
          startDate:
            1,
        })
        .lean();

    const totalEvents =
      events.length;

    const liveEvents =
      events.filter(
        (
          event,
        ) =>
          event.status ===
          'LIVE',
      );

    const liveToday =
      liveEvents.length;

    /* ========================================================
       BOOKINGS
    ======================================================== */

    const totalBookings =
      await Booking.countDocuments(
        {},
      );

    /* ========================================================
       TODAY SCHEDULE IDS
    ======================================================== */

    const todaySchedules =
      await DaySchedule.find({
        date: {
          $gte:
            todayStart,

          $lt:
            tomorrowStart,
        },
      })
        .select({
          _id: 1,
        })
        .lean();

    const todayScheduleIds =
      todaySchedules.map(
        (
          schedule,
        ) =>
          schedule._id,
      );

    /* ========================================================
       TODAY ATTENDANCE
    ======================================================== */

    const todayAttendance =
      todayScheduleIds.length >
      0
        ? await Booking.countDocuments(
            {
              dayScheduleId: {
                $in:
                  todayScheduleIds,
              },

              attendanceStatus:
                'PRESENT',
            },
          )
        : 0;

    /* ========================================================
       FUTURE SCHEDULES
    ======================================================== */

    const futureSchedules =
      await DaySchedule.find({
        date: {
          $gte:
            todayStart,
        },
      })
        .select({
          _id: 1,
        })
        .lean();

    const futureScheduleIds =
      futureSchedules.map(
        (
          schedule,
        ) =>
          schedule._id,
      );

    /* ========================================================
       AVAILABLE SLOT CAPACITY

       Capacity remaining across all upcoming slots.
    ======================================================== */

    const futureSlots =
      futureScheduleIds.length >
      0
        ? await Slot.find({
            dayScheduleId: {
              $in:
                futureScheduleIds,
            },
          })
            .select({
              capacity:
                1,

              bookedCount:
                1,
            })
            .lean()
        : [];

    const availableSlots =
      futureSlots.reduce(
        (
          total,
          slot,
        ) => {
          const capacity =
            Number(
              slot.capacity ||
                0,
            );

          const booked =
            Number(
              slot.bookedCount ||
                0,
            );

          return (
            total +
            Math.max(
              capacity -
                booked,
              0,
            )
          );
        },
        0,
      );

    /* ========================================================
       RECENT BOOKINGS
    ======================================================== */

    const recentBookingsRaw =
      await Booking.find({})
        .sort({
          createdAt:
            -1,
        })
        .limit(
          5,
        )
        .populate({
          path:
            'eventId',

          select:
            'eventName',
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
        .lean();

    const recentBookings =
      recentBookingsRaw.map(
        (
          item,
        ) => {
          const booking =
            item as unknown as {
              _id:
                mongoose.Types.ObjectId;

              bookingId:
                string;

              details?: {
                fullName?: string;
              };

              attendanceStatus?:
                string;

              eventId?: {
                eventName?: string;
              } | null;

              slotId?: {
                startTime?: string;
                endTime?: string;
              } | null;

              dayScheduleId?: {
                date?: Date;
              } | null;
            };

          return {
            id:
              String(
                booking._id,
              ),

            bookingId:
              booking.bookingId,

            fullName:
              booking.details
                ?.fullName ||
              'Unknown Attendee',

            eventName:
              booking.eventId
                ?.eventName ||
              '—',

            date:
              booking.dayScheduleId
                ?.date
                ? new Date(
                    booking.dayScheduleId.date,
                  ).toISOString()
                : null,

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
          };
        },
      );

    /* ========================================================
       UPCOMING EVENTS

       Include LIVE + UPCOMING events that have not ended.
    ======================================================== */

    const upcomingEvents =
      events
        .filter(
          (
            event,
          ) => {
            if (
              event.status ===
              'COMPLETED'
            ) {
              return false;
            }

            if (
              !event.endDate
            ) {
              return true;
            }

            return (
              new Date(
                event.endDate,
              ).getTime() >=
              todayStart.getTime()
            );
          },
        )
        .slice(
          0,
          3,
        );

    /* ========================================================
       CAPACITY FOR UPCOMING EVENTS
    ======================================================== */

    const upcomingEventData =
      await Promise.all(
        upcomingEvents.map(
          async (
            event,
          ) => {
            const eventId =
              event._id;

            const slots =
              await Slot.find({
                eventId,
              })
                .select({
                  capacity:
                    1,

                  bookedCount:
                    1,
                })
                .lean();

            const capacity =
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

            const booked =
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

            const percentage =
              capacity >
              0
                ? Math.min(
                    Math.round(
                      (booked /
                        capacity) *
                        100,
                    ),
                    100,
                  )
                : 0;

            return {
              id:
                String(
                  event._id,
                ),

              eventName:
                event.eventName,

              venue:
                event.venue ||
                '',

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

              status:
                event.status,

              booked,

              capacity,

              percentage,
            };
          },
        ),
      );

    /* ========================================================
       RESPONSE
    ======================================================== */

    return NextResponse.json(
      {
        success:
          true,

        stats: {
          totalEvents,

          liveToday,

          totalBookings,

          todayAttendance,

          availableSlots,
        },

        recentBookings,

        upcomingEvents:
          upcomingEventData,
      },
      {
        status:
          200,
      },
    );
  } catch (error) {
    console.error(
      'GET /api/admin/dashboard failed:',
      error,
    );

    return NextResponse.json(
      {
        success:
          false,

        message:
          'Unable to load dashboard.',
      },
      {
        status:
          500,
      },
    );
  }
}