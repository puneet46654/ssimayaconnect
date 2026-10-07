import { getEventStatus } from '@/lib/events/status';
import { schedulesByLocalDate } from '@/lib/events/date-queries';
import { calendarDate, DAY_MS, eventTimeZone, formatSlotTime, isCalendarDate, isTimeZone, zonedDayStart } from '@/lib/events/dates';
import {
  NextRequest,
  NextResponse,
} from 'next/server';

import mongoose from 'mongoose';

import {
  connectDB,
} from '@/lib/db';

import { adminAccessError } from '@/lib/admin-api-auth';

import {
  Booking,
} from '@/models/Booking';

import {
  Event,
} from '@/models/Event';

import { PendingBooking } from '@/models/PendingBooking';

/*
 * Import Slot so the Mongoose model
 * is registered before populate().
 */
import { Slot } from '@/models/Slot';
import { DaySchedule } from '@/models/DaySchedule';

// Attendee detail fields that can be filtered by exact value (case-insensitive).
const DETAIL_FILTERS = ['specialty', 'designation', 'country', 'state', 'city'] as const;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

    const denied = await adminAccessError('bookings');
    if (denied) return denied;

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

    const status = searchParams.get('status') || '';
    const attendance = searchParams.get('attendance') || '';
    const dayScheduleId = searchParams.get('dayScheduleId') || '';
    const slotId = searchParams.get('slotId') || '';
    const sort = searchParams.get('sort') || 'newest';
    const bookedFrom = searchParams.get('bookedFrom') || '';
    const bookedTo = searchParams.get('bookedTo') || '';
    const requestedZone = searchParams.get('timeZone');
    const filterTimeZone = isTimeZone(requestedZone) ? requestedZone : 'Asia/Kolkata';

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
        { 'details.hospitalName': regex },
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
      const matchingDays = await schedulesByLocalDate(dateFilter);

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

    if (attendance === 'present') filter.attendanceStatus = 'PRESENT';
    if (attendance === 'not_present') filter.attendanceStatus = { $ne: 'PRESENT' };
    if (mongoose.Types.ObjectId.isValid(slotId)) filter.slotId = new mongoose.Types.ObjectId(slotId);
    const hasDay = mongoose.Types.ObjectId.isValid(dayScheduleId);
    if (hasDay) {
      const day = new mongoose.Types.ObjectId(dayScheduleId);
      const range = filter.dayScheduleId as { $in: mongoose.Types.ObjectId[] } | undefined;
      filter.dayScheduleId = range ? { $in: range.$in.filter(id => id.equals(day)) } : day;
    }

    // Detail and booked-on filters apply to pending registrations too.
    const sharedFilter: Record<string, unknown> = {};
    for (const key of DETAIL_FILTERS) {
      const value = (searchParams.get(key) || '').trim();
      if (value) sharedFilter[`details.${key}`] = new RegExp(`^${escapeRegex(value)}$`, 'i');
    }
    const createdAt: Record<string, Date> = {};
    if (isCalendarDate(bookedFrom)) createdAt.$gte = zonedDayStart(bookedFrom, filterTimeZone);
    if (isCalendarDate(bookedTo)) {
      createdAt.$lt = zonedDayStart(calendarDate(new Date(Date.parse(`${bookedTo}T00:00:00Z`) + DAY_MS)), filterTimeZone);
    }
    if (Object.keys(createdAt).length) sharedFilter.createdAt = createdAt;
    Object.assign(filter, sharedFilter);

    // Slot, day and attendance only exist on confirmed bookings.
    const excludePending = status === 'confirmed' || dateFilter === 'past' || !!attendance || !!filter.slotId || hasDay;
    const excludeBookings = status === 'pending';
    const sortOrder: Record<string, 1 | -1> = sort === 'oldest' ? { createdAt: 1 }
      : sort === 'name' ? { 'details.fullName': 1 } : { createdAt: -1 };

    /* ========================================================
       QUERY
    ======================================================== */

    const skip =
      (page - 1) *
      limit;

    /*
     * Pending registrations (details entered, slot never chosen) are listed
     * first, then confirmed bookings, so one page can span both collections.
     * They belong to events that have not ended, so "past" never shows them.
     */
    const pendingFilter: Record<string, unknown> = { expiresAt: { $gt: new Date() }, ...sharedFilter };
    if (filter.eventId) pendingFilter.eventId = filter.eventId;
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      pendingFilter.$or = [{ 'details.fullName': regex }, { 'details.email': regex }, { 'details.mobile': regex }, { 'details.hospitalName': regex }];
    }
    const pendingMatches = excludePending ? 0 : await PendingBooking.countDocuments(pendingFilter);
    const pendingRows = skip < pendingMatches
      ? await PendingBooking.find(pendingFilter).sort(sort === 'newest' ? { updatedAt: -1 } : sortOrder).skip(skip).limit(limit)
        .populate({ path: 'eventId', select: 'eventName venue status startDate endDate timeZone' }).lean()
      : [];
    const bookingSkip = Math.max(0, skip - pendingMatches);
    const bookingLimit = limit - pendingRows.length;

    const [
      bookings,
      bookingMatches,
      eventOptions,
    ] =
      await Promise.all([
        bookingLimit <= 0 || excludeBookings ? Promise.resolve([]) : Booking.find(
          filter,
        )
          .sort(sortOrder)
          .skip(
            bookingSkip,
          )
          .limit(
            bookingLimit,
          )
          .populate({
            path:
              'eventId',

            select:
              'eventName venue status startDate endDate timeZone',
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

        excludeBookings ? Promise.resolve(0) : Booking.countDocuments(
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

    const [upcomingDays, pastDays] = await Promise.all([
      schedulesByLocalDate('upcoming'), schedulesByLocalDate('past'),
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

    const pendingTotal = await PendingBooking.countDocuments({ expiresAt: { $gt: new Date() } });

    // Dropdown choices: values that actually occur, plus the selected event's days and slots.
    const detailValues = await Promise.all(DETAIL_FILTERS.map(key => Booking.distinct(`details.${key}`)));
    const filterOptions: Record<string, unknown> = Object.fromEntries(DETAIL_FILTERS.map((key, index) => {
      const unique = new Map<string, string>();
      for (const value of detailValues[index] as unknown[]) {
        if (typeof value === 'string' && value.trim()) unique.set(value.trim().toLowerCase(), value.trim());
      }
      return [key, [...unique.values()].sort((a, b) => a.localeCompare(b))];
    }));
    filterOptions.days = [];
    filterOptions.slots = [];
    if (filter.eventId) {
      const [days, slots] = await Promise.all([
        DaySchedule.find({ eventId: filter.eventId }).sort({ date: 1 }).select('_id date').lean(),
        Slot.find({ eventId: filter.eventId }).sort({ startTime: 1 }).select('_id dayScheduleId startTime endTime').lean(),
      ]);
      filterOptions.days = days.map(day => ({ _id: String(day._id), label: calendarDate(day.date) }));
      filterOptions.slots = slots.map(slot => ({
        _id: String(slot._id), dayScheduleId: String(slot.dayScheduleId),
        label: `${formatSlotTime(slot.startTime)} – ${formatSlotTime(slot.endTime)}`,
      }));
    }
    const total = bookingMatches + pendingMatches;

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
                startDate: Date;
                endDate: Date;
                timeZone?: string;
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
                      getEventStatus(raw.eventId.startDate, raw.eventId.endDate, new Date(), raw.eventId.timeZone, raw.eventId.status),
                    timeZone: eventTimeZone(raw.eventId.timeZone),
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

    const pendingBookings = pendingRows.map(row => {
      const details = (row.details || {}) as Record<string, unknown>;
      const event = row.eventId as unknown as {
        _id: mongoose.Types.ObjectId; eventName?: string; venue?: string; status?: string;
        startDate: Date; endDate: Date; timeZone?: string;
      } | null;
      const text = (value: unknown) => typeof value === 'string' ? value : '';
      return {
        _id: String(row._id),
        bookingId: '',
        pending: true,
        attendee: { fullName: text(details.fullName) || 'Unknown attendee', email: text(details.email), mobile: text(details.mobile) },
        event: event ? {
          _id: String(event._id), eventName: event.eventName || '', venue: event.venue || '',
          status: getEventStatus(event.startDate, event.endDate, new Date(), event.timeZone, event.status),
          timeZone: eventTimeZone(event.timeZone),
        } : null,
        slot: null,
        daySchedule: null,
        createdAt: new Date(row.updatedAt).toISOString(),
      };
    });

    return NextResponse.json(
      {
        success:
          true,

        bookings:
          [...pendingBookings, ...normalizedBookings],

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

        filterOptions,

        stats:
          {
            total:
              totalBookings,

            upcoming:
              upcomingBookings,

            past:
              pastBookings,

            pending:
              pendingTotal,
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