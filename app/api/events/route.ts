import {
  NextRequest,
  NextResponse,
} from 'next/server';

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

import { Event } from '@/models/Event';

import {
  DaySchedule,
} from '@/models/DaySchedule';

import { Slot } from '@/models/Slot';

import {
  emitRealtimeChange,
} from '@/lib/realtime';

type EventType =
  | 'conference'
  | 'mantram'
  | 'event';

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

const BOOKING_TEMPLATES:
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

function isBookingTemplate(
  value: string,
): value is BookingFormTemplate {
  return BOOKING_TEMPLATES.includes(
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
   GET ALL EVENTS
============================================================ */

export async function GET() {
  try {
    await connectDB();

    const events =
      await Event.find()
        .sort({
          startDate: 1,
        })
        .lean();

    const eventIds =
      events.map(
        (event) =>
          event._id,
      );

    const slotTotals =
      eventIds.length > 0
        ? await Slot.aggregate([
            {
              $match: {
                eventId: {
                  $in:
                    eventIds,
                },
              },
            },

            {
              $group: {
                _id:
                  '$eventId',

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
          ])
        : [];

    const totalsByEventId =
      new Map(
        slotTotals.map(
          (total) => [
            total._id.toString(),
            total,
          ],
        ),
      );

    const now =
      new Date();

    const responseEvents =
      events.map(
        (event) => {
          const eventId =
            event._id.toString();

          const totals =
            totalsByEventId.get(
              eventId,
            ) || {
              totalSlots: 0,
              bookedSlots: 0,
            };

          const status =
            getEventStatus(
              event.startDate,
              event.endDate,
              now,
            );

          return {
            _id:
              eventId,

            eventName:
              event.eventName,

            eventType:
              event.eventType,

            bookingFormTemplate:
              event.bookingFormTemplate ||
              'practitioner-institutional',

            venue:
              event.venue,

            startDate:
              event.startDate,

            endDate:
              event.endDate,

            description:
              event.description,

            imageUrl:
              event.imageUrl
                ? getPublicImageUrl(
                    eventId,
                    event.updatedAt,
                  )
                : '',

            totalSlots:
              totals.totalSlots,

            bookedSlots:
              totals.bookedSlots,

            status,

            createdAt:
              event.createdAt,

            updatedAt:
              event.updatedAt,
          };
        },
      );

    const changedStatuses =
      responseEvents.filter(
        (
          responseEvent,
        ) => {
          const storedEvent =
            events.find(
              (candidate) =>
                candidate._id.toString() ===
                responseEvent._id,
            );

          return (
            storedEvent &&
            storedEvent.status !==
              responseEvent.status
          );
        },
      );

    if (
      changedStatuses.length >
      0
    ) {
      await Event.bulkWrite(
        changedStatuses.map(
          (event) => ({
            updateOne: {
              filter: {
                _id:
                  event._id,
              },

              update: {
                $set: {
                  status:
                    event.status,
                },
              },
            },
          }),
        ),
      );

      changedStatuses.forEach(
        (event) => {
          emitRealtimeChange({
            resource:
              'events',

            action:
              'updated',

            id:
              event._id,
          });
        },
      );
    }

    return NextResponse.json(
      {
        success: true,

        events:
          responseEvents,
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
      'Failed to fetch events:',
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
   CREATE EVENT
============================================================ */

export async function POST(
  req: NextRequest,
) {
  try {
    await connectDB();

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
      ) as EventType;

    const bookingTemplateValue =
      String(
        formData.get(
          'bookingFormTemplate',
        ) ||
          'practitioner-institutional',
      );

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
      !isBookingTemplate(
        bookingTemplateValue,
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

    const thumbnailEntry =
      formData.get(
        'thumbnail',
      );

    let imageUrl = '';

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

    const newEvent =
      new Event({
        eventName,

        eventType,

        bookingFormTemplate:
          bookingTemplateValue,

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
      });

    await newEvent.save();

    try {
      for (
        let index = 0;
        index <
        numberOfDays;
        index += 1
      ) {
        const scheduleData =
          daySchedulesInput[
            index
          ];

        const createdDaySchedule =
          new DaySchedule({
            eventId:
              newEvent._id,

            dayNumber:
              index + 1,

            date:
              new Date(
                scheduleData.date,
              ),

            startTime:
              scheduleData.startTime,

            endTime:
              scheduleData.endTime,

            lunchEnabled:
              Boolean(
                scheduleData.lunchEnabled,
              ),

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
              Boolean(
                scheduleData.sameAsDay1,
              ),
          });

        await createdDaySchedule.save();

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

        const slotDocs =
          generatedSlots.map(
            (slot) => ({
              eventId:
                newEvent._id,

              dayScheduleId:
                createdDaySchedule._id,

              startTime:
                slot.startTime,

              endTime:
                slot.endTime,

              capacity:
                Number(
                  scheduleData.capacity,
                ),

              bookedCount:
                0,
            }),
          );

        if (
          slotDocs.length >
          0
        ) {
          await Slot.insertMany(
            slotDocs,
          );
        }
      }
    } catch (error) {
      await Promise.all([
        Slot.deleteMany({
          eventId:
            newEvent._id,
        }),

        DaySchedule.deleteMany(
          {
            eventId:
              newEvent._id,
          },
        ),

        Event.deleteOne({
          _id:
            newEvent._id,
        }),
      ]);

      throw error;
    }

    emitRealtimeChange({
      resource:
        'events',

      action:
        'created',

      id:
        newEvent._id.toString(),
    });

    return NextResponse.json(
      {
        success: true,

        message:
          'Event and relational schedules created successfully',

        eventId:
          newEvent._id.toString(),

        bookingFormTemplate:
          newEvent.bookingFormTemplate,

        imageUrl:
          newEvent.imageUrl
            ? getPublicImageUrl(
                newEvent._id.toString(),
                newEvent.updatedAt,
              )
            : '',
      },
      {
        status: 201,

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
      'Failed to create event:',
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