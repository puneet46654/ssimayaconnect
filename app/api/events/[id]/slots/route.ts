import {
  NextRequest,
  NextResponse,
} from 'next/server';

import mongoose from 'mongoose';

import { connectDB } from '@/lib/db';

import { Event } from '@/models/Event';

import {
  DaySchedule,
} from '@/models/DaySchedule';

import { Slot } from '@/models/Slot';

export const dynamic =
  'force-dynamic';

export const revalidate = 0;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    await connectDB();

    const { id } =
      await context.params;

    if (
      !mongoose.Types.ObjectId.isValid(
        id,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Invalid event ID.',
        },
        {
          status: 400,
          headers: {
            'Cache-Control':
              'no-store',
          },
        },
      );
    }

    const event =
      await Event.findById(id)
        .select(
          [
            'eventName',
            'venue',
            'description',
            'startDate',
            'endDate',
            'status',
            'imageUrl',
          ].join(' '),
        )
        .lean();

    if (!event) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Event not found.',
        },
        {
          status: 404,
          headers: {
            'Cache-Control':
              'no-store',
          },
        },
      );
    }

    const daySchedules =
      await DaySchedule.find({
        eventId:
          event._id,
      })
        .sort({
          dayNumber: 1,
        })
        .lean();

    const slots =
      await Slot.find({
        eventId:
          event._id,
      })
        .sort({
          startTime: 1,
        })
        .lean();

    const slotsBySchedule =
      new Map<
        string,
        typeof slots
      >();

    for (
      const slot of slots
    ) {
      const key =
        slot.dayScheduleId.toString();

      const existing =
        slotsBySchedule.get(
          key,
        ) || [];

      existing.push(slot);

      slotsBySchedule.set(
        key,
        existing,
      );
    }

    const days =
      daySchedules.map(
        (schedule) => {
          const scheduleId =
            schedule._id.toString();

          const scheduleSlots =
            slotsBySchedule.get(
              scheduleId,
            ) || [];

          return {
            _id:
              scheduleId,

            dayNumber:
              schedule.dayNumber,

            date:
              schedule.date,

            startTime:
              schedule.startTime,

            endTime:
              schedule.endTime,

            slots:
              scheduleSlots.map(
                (slot) => {
                  const remaining =
                    Math.max(
                      0,
                      Number(
                        slot.capacity,
                      ) -
                        Number(
                          slot.bookedCount,
                        ),
                    );

                  return {
                    _id:
                      slot._id.toString(),

                    startTime:
                      slot.startTime,

                    endTime:
                      slot.endTime,

                    capacity:
                      slot.capacity,

                    bookedCount:
                      slot.bookedCount,

                    remaining,

                    available:
                      remaining > 0,
                  };
                },
              ),
          };
        },
      );

    return NextResponse.json(
      {
        success: true,

        event: {
          _id:
            event._id.toString(),

          eventName:
            event.eventName,

          venue:
            event.venue,

          description:
            event.description,

          startDate:
            event.startDate,

          endDate:
            event.endDate,

          status:
            event.status,
        },

        days,
      },
      {
        status: 200,

        headers: {
          'Cache-Control':
            'no-store, no-cache, must-revalidate',
        },
      },
    );
  } catch (error) {
    console.error(
      'Failed to load event slots:',
      error,
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : 'Unable to load time slots.',
      },
      {
        status: 500,

        headers: {
          'Cache-Control':
            'no-store',
        },
      },
    );
  }
}