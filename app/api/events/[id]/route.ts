import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';

import { connectDB } from '@/lib/db';
import { uploadImageToS3 } from '@/lib/s3';

import { Event } from '@/models/Event';
import { DaySchedule } from '@/models/DaySchedule';
import { Slot } from '@/models/Slot';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

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

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Internal Server Error';
}

function getEventStatus(
  startDate: Date,
  endDate: Date,
  now = new Date(),
) {
  const today = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    ),
  );

  const start = new Date(
    Date.UTC(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth(),
      startDate.getUTCDate(),
    ),
  );

  const end = new Date(
    Date.UTC(
      endDate.getUTCFullYear(),
      endDate.getUTCMonth(),
      endDate.getUTCDate(),
    ),
  );

  if (today > end) {
    return 'COMPLETED' as const;
  }

  if (today >= start) {
    return 'LIVE' as const;
  }

  return 'UPCOMING' as const;
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value
    .split(':')
    .map(Number);

  return hours * 60 + minutes;
}

function formatTime(totalMinutes: number) {
  const hours = Math.floor(
    totalMinutes / 60,
  );

  const minutes =
    totalMinutes % 60;

  return `${String(hours).padStart(
    2,
    '0',
  )}:${String(minutes).padStart(
    2,
    '0',
  )}`;
}

function generateSlotTimes(
  startTime: string,
  endTime: string,
  durationStr: string,
  gapStr: string,
  lunchEnabled: boolean,
  lunchStartStr: string,
  lunchEndStr: string,
) {
  const start =
    timeToMinutes(startTime);

  const end =
    timeToMinutes(endTime);

  const duration =
    Number(durationStr);

  const gap =
    Number(gapStr);

  const lunchStart =
    lunchEnabled
      ? timeToMinutes(lunchStartStr)
      : 0;

  const lunchEnd =
    lunchEnabled
      ? timeToMinutes(lunchEndStr)
      : 0;

  const slots: {
    startTime: string;
    endTime: string;
  }[] = [];

  let cursor = start;

  while (
    cursor + duration <= end
  ) {
    const slotEnd =
      cursor + duration;

    const overlapsLunch =
      lunchEnabled &&
      cursor < lunchEnd &&
      slotEnd > lunchStart;

    if (overlapsLunch) {
      cursor = lunchEnd;
      continue;
    }

    slots.push({
      startTime:
        formatTime(cursor),

      endTime:
        formatTime(slotEnd),
    });

    cursor =
      slotEnd + gap;
  }

  return slots;
}

function validateSchedule(
  schedule: DayScheduleInput,
  index: number,
) {
  const start =
    timeToMinutes(
      schedule.startTime,
    );

  const end =
    timeToMinutes(
      schedule.endTime,
    );

  const capacity =
    Number(schedule.capacity);

  const duration =
    Number(
      schedule.slotDuration,
    );

  const gap =
    Number(schedule.slotGap);

  if (
    !schedule.date ||
    !schedule.startTime ||
    !schedule.endTime
  ) {
    return `Day ${
      index + 1
    }: schedule information is incomplete.`;
  }

  if (end <= start) {
    return `Day ${
      index + 1
    }: end time must be later than start time.`;
  }

  if (
    !duration ||
    duration <= 0
  ) {
    return `Day ${
      index + 1
    }: slot duration is invalid.`;
  }

  if (
    Number.isNaN(gap) ||
    gap < 0
  ) {
    return `Day ${
      index + 1
    }: slot gap is invalid.`;
  }

  if (
    capacity < 1 ||
    capacity > 20
  ) {
    return `Day ${
      index + 1
    }: capacity must be between 1 and 20.`;
  }

  if (
    schedule.lunchEnabled
  ) {
    const lunchStart =
      timeToMinutes(
        schedule.lunchStart,
      );

    const lunchEnd =
      timeToMinutes(
        schedule.lunchEnd,
      );

    if (
      !schedule.lunchStart ||
      !schedule.lunchEnd ||
      lunchStart < start ||
      lunchEnd > end ||
      lunchEnd <= lunchStart
    ) {
      return `Day ${
        index + 1
      }: lunch must fall within the event schedule.`;
    }
  }

  const slots =
    generateSlotTimes(
      schedule.startTime,
      schedule.endTime,
      schedule.slotDuration,
      schedule.slotGap,
      schedule.lunchEnabled,
      schedule.lunchStart,
      schedule.lunchEnd,
    );

  if (!slots.length) {
    return `Day ${
      index + 1
    }: schedule does not generate any slots.`;
  }

  return '';
}

/*
|--------------------------------------------------------------------------
| GET ONE EVENT FOR EDIT PAGE
|--------------------------------------------------------------------------
*/

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
        { status: 400 },
      );
    }

    const event =
      await Event.findById(id)
        .lean();

    if (!event) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Event not found.',
        },
        { status: 404 },
      );
    }

    const daySchedules =
      await DaySchedule.find({
        eventId: event._id,
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
              $sum: '$capacity',
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
      event.status !== status
    ) {
      await Event.updateOne(
        {
          _id: event._id,
        },
        {
          $set: {
            status,
          },
        },
      );
    }

    return NextResponse.json({
      success: true,

      event: {
        _id:
          event._id.toString(),

        eventName:
          event.eventName,

        eventType:
          event.eventType,

        venue:
          event.venue,

        description:
          event.description,

        imageUrl:
          event.imageUrl
            ? `/api/events/${event._id.toString()}/image`
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
    });
  } catch (error: unknown) {
    console.error(
      'Failed to fetch event:',
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}

/*
|--------------------------------------------------------------------------
| UPDATE EVENT
|--------------------------------------------------------------------------
*/

export async function PUT(
  req: NextRequest,
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
        { status: 400 },
      );
    }

    const existingEvent =
      await Event.findById(id);

    if (!existingEvent) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Event not found.',
        },
        { status: 404 },
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
        { status: 400 },
      );
    }

    if (
      ![
        'conference',
        'mantram',
        'event',
      ].includes(eventType)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Invalid event type.',
        },
        { status: 400 },
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
        { status: 400 },
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
        { status: 400 },
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
        JSON.parse(daysJson);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            'Invalid day schedule data.',
        },
        { status: 400 },
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
        { status: 400 },
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
          { status: 400 },
        );
      }
    }

    /*
     * Load current schedule + slots before modifying anything.
     */
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
      new Map<string, typeof existingSlots>();

    for (
      const slot of existingSlots
    ) {
      const scheduleId =
        slot.dayScheduleId.toString();

      const collection =
        slotsBySchedule.get(
          scheduleId,
        ) || [];

      collection.push(slot);

      slotsBySchedule.set(
        scheduleId,
        collection,
      );
    }

    /*
     * Validate booking safety before changing DB.
     *
     * - capacity cannot become lower than bookedCount
     * - a booked slot cannot disappear
     * - a booked day cannot be removed
     */
    for (
      let index = 0;
      index < numberOfDays;
      index += 1
    ) {
      const dayNumber =
        index + 1;

      const input =
        daySchedulesInput[index];

      const existingSchedule =
        schedulesByDay.get(
          dayNumber,
        );

      if (!existingSchedule) {
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
        const oldSlot of oldSlots
      ) {
        const key =
          `${oldSlot.startTime}|${oldSlot.endTime}`;

        if (
          oldSlot.bookedCount >
            0 &&
          !newSlotKeys.has(key)
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                `Day ${dayNumber}: ${oldSlot.startTime} – ${oldSlot.endTime} already has ${oldSlot.bookedCount} booking(s). You cannot remove or change this booked slot.`,
            },
            { status: 409 },
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
            { status: 409 },
          );
        }
      }
    }

    /*
     * Check removed days.
     */
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
          (total, slot) =>
            total +
            slot.bookedCount,
          0,
        );

      if (bookedCount > 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              `Day ${schedule.dayNumber} has ${bookedCount} existing booking(s). Reduce the number of days only after those bookings are handled.`,
          },
          { status: 409 },
        );
      }
    }

    /*
     * Upload replacement image only when user selected one.
     * Otherwise keep the current S3 URL.
     */
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

    /*
     * Update event document.
     */
    existingEvent.eventName =
      eventName;

    existingEvent.eventType =
      eventType;

    existingEvent.venue =
      venue;

    existingEvent.description =
      description;

    existingEvent.imageUrl =
      imageUrl;

    existingEvent.numberOfDays =
      numberOfDays;

    existingEvent.startDate =
      startDate;

    existingEvent.endDate =
      endDate;

    existingEvent.status =
      getEventStatus(
        startDate,
        endDate,
      );

    await existingEvent.save();

    /*
     * Update/create each day.
     */
    for (
      let index = 0;
      index < numberOfDays;
      index += 1
    ) {
      const dayNumber =
        index + 1;

      const scheduleData =
        daySchedulesInput[index];

      let schedule =
        schedulesByDay.get(
          dayNumber,
        );

      if (!schedule) {
        schedule =
          new DaySchedule({
            eventId:
              existingEvent._id,

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

      /*
       * Synchronize slots while retaining bookedCount
       * for unchanged time ranges.
       */
      const oldSlots =
        await Slot.find({
          eventId:
            existingEvent._id,

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

        desiredKeys.add(key);

        const existingSlot =
          oldSlotsByTime.get(key);

        if (existingSlot) {
          existingSlot.capacity =
            Number(
              scheduleData.capacity,
            );

          await existingSlot.save();
        } else {
          await Slot.create({
            eventId:
              existingEvent._id,

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

            bookedCount: 0,
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
            (slot) => slot._id,
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

    /*
     * Remove old unused days above the new numberOfDays.
     */
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
          $in: ids,
        },
      });

      await DaySchedule.deleteMany(
        {
          _id: {
            $in: ids,
          },
        },
      );
    }

    return NextResponse.json({
      success: true,

      message:
        'Event updated successfully.',

      eventId:
        existingEvent._id.toString(),

      imageUrl,
    });
  } catch (error: unknown) {
    console.error(
      'Failed to update event:',
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}

/*
|--------------------------------------------------------------------------
| DELETE SINGLE EVENT
|--------------------------------------------------------------------------
|
| You can use this from the management page instead of ?id= if desired.
|
*/

export async function DELETE(
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
        { status: 400 },
      );
    }

    const event =
      await Event.findById(id);

    if (!event) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Event not found.',
        },
        { status: 404 },
      );
    }

    await Promise.all([
      Slot.deleteMany({
        eventId: event._id,
      }),

      DaySchedule.deleteMany({
        eventId: event._id,
      }),
    ]);

    await Event.deleteOne({
      _id: event._id,
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error: unknown) {
    console.error(
      'Failed to delete event:',
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}