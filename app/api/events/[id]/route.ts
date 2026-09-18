import {
  NextRequest,
  NextResponse,
} from 'next/server';

import mongoose from 'mongoose';

import { connectDB } from '@/lib/db';

import {
  uploadImageToS3,
} from '@/lib/s3';

import {
  getEventStatus,
} from '@/lib/events/status';

import {
  generateSlotTimes,
} from '@/lib/events/slots';
import {
  validateSchedule,
} from '@/lib/events/schedule-validation';

import { Event } from '@/models/Event';

import {
  DaySchedule,
} from '@/models/DaySchedule';

import { Slot } from '@/models/Slot';

import {
  emitRealtimeChange,
} from '@/lib/realtime';
import { requireAdminSession } from '@/lib/admin-server-auth';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type BookingFormTemplate =
  | 'practitioner-institutional'
  | 'template-2'
  | 'template-3';

type DayScheduleInput = {
  date: string;

  startTime: string;

  endTime: string;

  lunchEnabled: boolean;

  lunchStart: string;

  lunchEnd: string;

  slotDuration: string;

  slotGap: string;

  capacity: string;

  sameAsDay1: boolean;
};

const BOOKING_FORM_TEMPLATES:
  BookingFormTemplate[] = [
    'practitioner-institutional',
    'template-2',
    'template-3',
  ];

function getErrorMessage(
  error: unknown,
) {
  return error instanceof Error
    ? error.message
    : 'Internal Server Error';
}

function isBookingFormTemplate(
  value: string,
): value is BookingFormTemplate {
  return BOOKING_FORM_TEMPLATES.includes(
    value as BookingFormTemplate,
  );
}

function getPublicImageUrl(
  eventId: string,
  updatedAt:
    | Date
    | string
    | undefined,
) {
  const version =
    updatedAt
      ? new Date(
          updatedAt,
        ).getTime()
      : Date.now();

  return `/api/events/${eventId}/image?v=${version}`;
}

/* ============================================================
   GET EVENT
============================================================ */

export async function GET(
  _req: NextRequest,
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
        },
      );
    }

    const event =
      await Event.findById(
        id,
      ).lean();

    if (!event) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Event not found.',
        },
        {
          status: 404,
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

    const slotTotals =
      await Slot.aggregate([
        {
          $match: {
            eventId:
              event._id,
          },
        },

        {
          $group: {
            _id: null,

            totalSlots: {
              $sum:
                '$capacity',
            },

            bookedSlots: {
              $sum:
                '$bookedCount',
            },
          },
        },
      ]);

    const totals =
      slotTotals[0] || {
        totalSlots: 0,
        bookedSlots: 0,
      };

    const status =
      getEventStatus(
        event.startDate,
        event.endDate,
      );

    if (
      event.status !==
      status
    ) {
      await Event.updateOne(
        {
          _id:
            event._id,
        },
        {
          $set: {
            status,
          },
        },
      );
    }

    return NextResponse.json(
      {
        success: true,

        event: {
          _id:
            event._id.toString(),

          eventName:
            event.eventName,

          eventType:
            event.eventType,

          bookingFormTemplate:
            event.bookingFormTemplate ||
            'practitioner-institutional',

          venue:
            event.venue,

          description:
            event.description,

          imageUrl:
            event.imageUrl
              ? getPublicImageUrl(
                  event._id.toString(),
                  event.updatedAt,
                )
              : '',

          numberOfDays:
            event.numberOfDays,

          startDate:
            event.startDate,

          endDate:
            event.endDate,

          status,

          totalSlots:
            totals.totalSlots,

          bookedSlots:
            totals.bookedSlots,

          createdAt:
            event.createdAt,

          updatedAt:
            event.updatedAt,

          daySchedules:
            daySchedules.map(
              (schedule) => ({
                _id:
                  schedule._id.toString(),

                dayNumber:
                  schedule.dayNumber,

                date:
                  schedule.date,

                startTime:
                  schedule.startTime,

                endTime:
                  schedule.endTime,

                lunchEnabled:
                  schedule.lunchEnabled,

                lunchStart:
                  schedule.lunchStart ||
                  '',

                lunchEnd:
                  schedule.lunchEnd ||
                  '',

                slotDuration:
                  String(
                    schedule.slotDuration,
                  ),

                slotGap:
                  String(
                    schedule.slotGap,
                  ),

                capacity:
                  String(
                    schedule.capacity,
                  ),

                sameAsDay1:
                  schedule.sameAsDay1,
              }),
            ),
        },
      },
      {
        headers: {
          'Cache-Control':
            'no-store, no-cache, must-revalidate',
        },
      },
    );
  } catch (
    error: unknown
  ) {
    console.error(
      'Failed to fetch event:',
      error,
    );

    return NextResponse.json(
      {
        success: false,

        error:
          getErrorMessage(
            error,
          ),
      },
      {
        status: 500,
      },
    );
  }
}

/* ============================================================
   UPDATE EVENT
============================================================ */

export async function PUT(
  req: NextRequest,
  context: RouteContext,
) {
  if (!(await requireAdminSession())) {
    return NextResponse.json(
      { success: false, error: 'Authentication required.' },
      { status: 401 },
    );
  }

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
        },
      );
    }

    const existingEvent =
      await Event.findById(
        id,
      );

    if (!existingEvent) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Event not found.',
        },
        {
          status: 404,
        },
      );
    }

    const formData =
      await req.formData();

    const eventName =
      String(
        formData.get(
          'eventName',
        ) || '',
      ).trim();

    const eventType =
      String(
        formData.get(
          'eventType',
        ) || '',
      ) as
        | 'conference'
        | 'mantram'
        | 'event';

    const rawBookingFormTemplate =
      String(
        formData.get(
          'bookingFormTemplate',
        ) || '',
      ).trim();

    const bookingFormTemplate:
      BookingFormTemplate =
        isBookingFormTemplate(
          rawBookingFormTemplate,
        )
          ? rawBookingFormTemplate
          : existingEvent.bookingFormTemplate ||
            'practitioner-institutional';

    const venue =
      String(
        formData.get(
          'venue',
        ) || '',
      ).trim();

    const description =
      String(
        formData.get(
          'description',
        ) || '',
      ).trim();

    const numberOfDays =
      Number(
        formData.get(
          'numberOfDays',
        ),
      );

    const startDateValue =
      String(
        formData.get(
          'startDate',
        ) || '',
      );

    const endDateValue =
      String(
        formData.get(
          'endDate',
        ) || '',
      );

    if (
      !eventName ||
      !venue ||
      !description ||
      !startDateValue ||
      !endDateValue
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Required event information is missing.',
        },
        {
          status: 400,
        },
      );
    }

    if (
      ![
        'conference',
        'mantram',
        'event',
      ].includes(
        eventType,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Invalid event type.',
        },
        {
          status: 400,
        },
      );
    }

    if (
      !isBookingFormTemplate(
        bookingFormTemplate,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Invalid registration form template.',
        },
        {
          status: 400,
        },
      );
    }

    if (
      !Number.isInteger(
        numberOfDays,
      ) ||
      numberOfDays < 1 ||
      numberOfDays > 10
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Number of days must be between 1 and 10.',
        },
        {
          status: 400,
        },
      );
    }

    const startDate =
      new Date(
        startDateValue,
      );

    const endDate =
      new Date(
        endDateValue,
      );

    if (
      Number.isNaN(
        startDate.getTime(),
      ) ||
      Number.isNaN(
        endDate.getTime(),
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Invalid event dates.',
        },
        {
          status: 400,
        },
      );
    }

    const daysJson =
      String(
        formData.get(
          'daySchedules',
        ) || '[]',
      );

    let daySchedulesInput:
      DayScheduleInput[];

    try {
      daySchedulesInput =
        JSON.parse(
          daysJson,
        );
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            'Invalid day schedule data.',
        },
        {
          status: 400,
        },
      );
    }

    if (
      !Array.isArray(
        daySchedulesInput,
      ) ||
      daySchedulesInput.length !==
        numberOfDays
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Day schedule count does not match the number of event days.',
        },
        {
          status: 400,
        },
      );
    }

    for (
      let index = 0;
      index <
      daySchedulesInput.length;
      index += 1
    ) {
      const error =
        validateSchedule(
          daySchedulesInput[
            index
          ],
          index,
        );

      if (error) {
        return NextResponse.json(
          {
            success: false,
            error,
          },
          {
            status: 400,
          },
        );
      }
    }

    const existingSchedules =
      await DaySchedule.find({
        eventId:
          existingEvent._id,
      }).sort({
        dayNumber: 1,
      });

    const existingSlots =
      await Slot.find({
        eventId:
          existingEvent._id,
      });

    const schedulesByDay =
      new Map(
        existingSchedules.map(
          (schedule) => [
            schedule.dayNumber,
            schedule,
          ],
        ),
      );

    const slotsBySchedule =
      new Map<
        string,
        typeof existingSlots
      >();

    for (
      const slot of
      existingSlots
    ) {
      const scheduleId =
        slot.dayScheduleId.toString();

      const collection =
        slotsBySchedule.get(
          scheduleId,
        ) || [];

      collection.push(
        slot,
      );

      slotsBySchedule.set(
        scheduleId,
        collection,
      );
    }

    /* ========================================================
       BOOKING PROTECTION
    ======================================================== */

    for (
      let index = 0;
      index <
      numberOfDays;
      index += 1
    ) {
      const dayNumber =
        index + 1;

      const input =
        daySchedulesInput[
          index
        ];

      const existingSchedule =
        schedulesByDay.get(
          dayNumber,
        );

      if (
        !existingSchedule
      ) {
        continue;
      }

      const oldSlots =
        slotsBySchedule.get(
          existingSchedule._id.toString(),
        ) || [];

      const newSlots =
        generateSlotTimes(
          input.startTime,
          input.endTime,
          input.slotDuration,
          input.slotGap,
          input.lunchEnabled,
          input.lunchStart,
          input.lunchEnd,
        );

      const newSlotKeys =
        new Set(
          newSlots.map(
            (slot) =>
              `${slot.startTime}|${slot.endTime}`,
          ),
        );

      for (
        const oldSlot of
        oldSlots
      ) {
        const key =
          `${oldSlot.startTime}|${oldSlot.endTime}`;

        if (
          oldSlot.bookedCount >
            0 &&
          !newSlotKeys.has(
            key,
          )
        ) {
          return NextResponse.json(
            {
              success: false,

              error:
                `Day ${dayNumber}: ${oldSlot.startTime} – ${oldSlot.endTime} already has ${oldSlot.bookedCount} booking(s). You cannot remove or change this booked slot.`,
            },
            {
              status: 409,
            },
          );
        }

        if (
          oldSlot.bookedCount >
          Number(
            input.capacity,
          )
        ) {
          return NextResponse.json(
            {
              success: false,

              error:
                `Day ${dayNumber}: capacity cannot be lower than the existing ${oldSlot.bookedCount} booking(s).`,
            },
            {
              status: 409,
            },
          );
        }
      }
    }

    for (
      const schedule of
      existingSchedules
    ) {
      if (
        schedule.dayNumber <=
        numberOfDays
      ) {
        continue;
      }

      const oldSlots =
        slotsBySchedule.get(
          schedule._id.toString(),
        ) || [];

      const bookedCount =
        oldSlots.reduce(
          (
            total,
            slot,
          ) =>
            total +
            slot.bookedCount,
          0,
        );

      if (
        bookedCount > 0
      ) {
        return NextResponse.json(
          {
            success: false,

            error:
              `Day ${schedule.dayNumber} has ${bookedCount} existing booking(s). Reduce the number of days only after those bookings are handled.`,
          },
          {
            status: 409,
          },
        );
      }
    }

    /* ========================================================
       IMAGE
    ======================================================== */

    const thumbnailEntry =
      formData.get(
        'thumbnail',
      );

    let imageUrl =
      existingEvent.imageUrl ||
      '';

    if (
      thumbnailEntry instanceof
        File &&
      thumbnailEntry.size > 0
    ) {
      imageUrl =
        await uploadImageToS3(
          thumbnailEntry,
          'thumbnails',
        );
    }

    /* ========================================================
       EXPLICIT EVENT UPDATE
    ======================================================== */

    const updatedEvent =
      await Event.findByIdAndUpdate(
        existingEvent._id,
        {
          $set: {
            eventName,

            eventType,

            bookingFormTemplate,

            venue,

            description,

            imageUrl,

            numberOfDays,

            startDate,

            endDate,

            status:
              getEventStatus(
                startDate,
                endDate,
              ),
          },
        },
        {
          new: true,

          runValidators: true,
        },
      );

    if (!updatedEvent) {
      return NextResponse.json(
        {
          success: false,

          error:
            'Event update failed.',
        },
        {
          status: 500,
        },
      );
    }

    if (
      updatedEvent.bookingFormTemplate !==
      bookingFormTemplate
    ) {
      console.error(
        'Template persistence mismatch:',
        {
          requested:
            bookingFormTemplate,

          saved:
            updatedEvent.bookingFormTemplate,

          eventId:
            updatedEvent._id.toString(),
        },
      );

      return NextResponse.json(
        {
          success: false,

          error:
            'Registration form template could not be saved.',
        },
        {
          status: 500,
        },
      );
    }

    /* ========================================================
       UPDATE SCHEDULES
    ======================================================== */

    for (
      let index = 0;
      index <
      numberOfDays;
      index += 1
    ) {
      const dayNumber =
        index + 1;

      const scheduleData =
        daySchedulesInput[
          index
        ];

      let schedule =
        schedulesByDay.get(
          dayNumber,
        );

      if (!schedule) {
        schedule =
          new DaySchedule({
            eventId:
              updatedEvent._id,

            dayNumber,

            date:
              new Date(
                scheduleData.date,
              ),

            startTime:
              scheduleData.startTime,

            endTime:
              scheduleData.endTime,

            lunchEnabled:
              scheduleData.lunchEnabled,

            lunchStart:
              scheduleData.lunchStart ||
              '',

            lunchEnd:
              scheduleData.lunchEnd ||
              '',

            slotDuration:
              Number(
                scheduleData.slotDuration,
              ),

            slotGap:
              Number(
                scheduleData.slotGap,
              ),

            capacity:
              Number(
                scheduleData.capacity,
              ),

            sameAsDay1:
              scheduleData.sameAsDay1 ||
              false,
          });

        await schedule.save();
      } else {
        schedule.date =
          new Date(
            scheduleData.date,
          );

        schedule.startTime =
          scheduleData.startTime;

        schedule.endTime =
          scheduleData.endTime;

        schedule.lunchEnabled =
          scheduleData.lunchEnabled;

        schedule.lunchStart =
          scheduleData.lunchStart ||
          '';

        schedule.lunchEnd =
          scheduleData.lunchEnd ||
          '';

        schedule.slotDuration =
          Number(
            scheduleData.slotDuration,
          );

        schedule.slotGap =
          Number(
            scheduleData.slotGap,
          );

        schedule.capacity =
          Number(
            scheduleData.capacity,
          );

        schedule.sameAsDay1 =
          scheduleData.sameAsDay1 ||
          false;

        await schedule.save();
      }

      const oldSlots =
        await Slot.find({
          eventId:
            updatedEvent._id,

          dayScheduleId:
            schedule._id,
        });

      const oldSlotsByTime =
        new Map(
          oldSlots.map(
            (slot) => [
              `${slot.startTime}|${slot.endTime}`,
              slot,
            ],
          ),
        );

      const generatedSlots =
        generateSlotTimes(
          scheduleData.startTime,
          scheduleData.endTime,
          scheduleData.slotDuration,
          scheduleData.slotGap,
          scheduleData.lunchEnabled,
          scheduleData.lunchStart,
          scheduleData.lunchEnd,
        );

      const desiredKeys =
        new Set<string>();

      for (
        const generatedSlot of
        generatedSlots
      ) {
        const key =
          `${generatedSlot.startTime}|${generatedSlot.endTime}`;

        desiredKeys.add(
          key,
        );

        const existingSlot =
          oldSlotsByTime.get(
            key,
          );

        if (
          existingSlot
        ) {
          existingSlot.capacity =
            Number(
              scheduleData.capacity,
            );

          await existingSlot.save();
        } else {
          await Slot.create({
            eventId:
              updatedEvent._id,

            dayScheduleId:
              schedule._id,

            startTime:
              generatedSlot.startTime,

            endTime:
              generatedSlot.endTime,

            capacity:
              Number(
                scheduleData.capacity,
              ),

            bookedCount:
              0,
          });
        }
      }

      const removableIds =
        oldSlots
          .filter(
            (slot) =>
              !desiredKeys.has(
                `${slot.startTime}|${slot.endTime}`,
              ) &&
              slot.bookedCount ===
                0,
          )
          .map(
            (slot) =>
              slot._id,
          );

      if (
        removableIds.length >
        0
      ) {
        await Slot.deleteMany({
          _id: {
            $in:
              removableIds,
          },
        });
      }
    }

    const removedSchedules =
      existingSchedules.filter(
        (schedule) =>
          schedule.dayNumber >
          numberOfDays,
      );

    if (
      removedSchedules.length >
      0
    ) {
      const ids =
        removedSchedules.map(
          (schedule) =>
            schedule._id,
        );

      await Slot.deleteMany({
        dayScheduleId: {
          $in:
            ids,
        },
      });

      await DaySchedule.deleteMany(
        {
          _id: {
            $in:
              ids,
          },
        },
      );
    }

    emitRealtimeChange({
      resource:
        'events',

      action:
        'updated',

      id:
        updatedEvent._id.toString(),
    });

    return NextResponse.json(
      {
        success: true,

        message:
          'Event updated successfully.',

        eventId:
          updatedEvent._id.toString(),

        bookingFormTemplate:
          updatedEvent.bookingFormTemplate,

        imageUrl:
          updatedEvent.imageUrl
            ? getPublicImageUrl(
                updatedEvent._id.toString(),
                updatedEvent.updatedAt,
              )
            : '',

        updatedAt:
          updatedEvent.updatedAt,
      },
      {
        headers: {
          'Cache-Control':
            'no-store, no-cache, must-revalidate',
        },
      },
    );
  } catch (
    error: unknown
  ) {
    console.error(
      'Failed to update event:',
      error,
    );

    return NextResponse.json(
      {
        success: false,

        error:
          getErrorMessage(
            error,
          ),
      },
      {
        status: 500,
      },
    );
  }
}

/* ============================================================
   DELETE EVENT
============================================================ */

export async function DELETE(
  _req: NextRequest,
  context: RouteContext,
) {
  if (!(await requireAdminSession())) {
    return NextResponse.json(
      { success: false, error: 'Authentication required.' },
      { status: 401 },
    );
  }

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
        },
      );
    }

    const event =
      await Event.findById(
        id,
      );

    if (!event) {
      return NextResponse.json(
        {
          success: false,

          error:
            'Event not found.',
        },
        {
          status: 404,
        },
      );
    }

    await Promise.all([
      Slot.deleteMany({
        eventId:
          event._id,
      }),

      DaySchedule.deleteMany({
        eventId:
          event._id,
      }),
    ]);

    await Event.deleteOne({
      _id:
        event._id,
    });

    emitRealtimeChange({
      resource:
        'events',

      action:
        'deleted',

      id:
        event._id.toString(),
    });

    return NextResponse.json(
      {
        success: true,
      },
      {
        headers: {
          'Cache-Control':
            'no-store',
        },
      },
    );
  } catch (
    error: unknown
  ) {
    console.error(
      'Failed to delete event:',
      error,
    );

    return NextResponse.json(
      {
        success: false,

        error:
          getErrorMessage(
            error,
          ),
      },
      {
        status: 500,
      },
    );
  }
}