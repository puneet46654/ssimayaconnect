import { validatedThumbnail, ImageValidationError } from '@/lib/image-validation';
import { readEventForm, createEvent } from '@/lib/events/mutations';
import { BookingError } from '@/lib/bookings/mutations';
import { adminAccessError } from '@/lib/admin-api-auth';
import { eventTimeZone } from '@/lib/events/dates';
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


import { Event } from '@/models/Event';


import { Slot } from '@/models/Slot';

import {
  emitRealtimeChange,
} from '@/lib/realtime';
import { logAdminActivity } from '@/lib/admin-server-auth';

function getErrorMessage(
  error: unknown,
) {
  return error instanceof Error
    ? error.message
    : 'Internal Server Error';
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
        .select(
          'eventName eventType bookingFormTemplate venue timeZone startDate endDate description imageUrl status createdAt updatedAt',
        )
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
              new Date(), event.timeZone, event.status,
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
            timeZone: eventTimeZone(event.timeZone),

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

    return NextResponse.json(
      {
        success: true,

        events:
          responseEvents,
      },
      {
        headers: {
          'Cache-Control':
            'public, max-age=0, s-maxage=5, stale-while-revalidate=30',
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

export async function POST(req: NextRequest) {
  const denied = await adminAccessError('events', 'write');
  if (denied) return denied;
  try {
    const form = await req.formData();
    const input = readEventForm(form);
    const thumbnail = await validatedThumbnail(form.get('thumbnail'));
    const imageUrl = thumbnail ? await uploadImageToS3(thumbnail, 'thumbnails') : '';
    await connectDB();
    const event = await createEvent(input, imageUrl);
    const id = String(event._id);
    emitRealtimeChange({ resource: 'events', action: 'created', id });
    await logAdminActivity({ action: 'create', resource: 'event', resourceId: id, details: { eventName: event.eventName } });
    return NextResponse.json({ success: true, message: 'Event created successfully.', eventId: id,
      bookingFormTemplate: event.bookingFormTemplate, imageUrl: event.imageUrl ? getPublicImageUrl(id, event.updatedAt) : '' },
      { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (!(error instanceof BookingError || error instanceof ImageValidationError)) console.error('Event creation failed:', error);
    return NextResponse.json({ success: false, error: (error instanceof BookingError || error instanceof ImageValidationError) ? error.message : 'Unable to create the event. Please retry.' },
      { status: error instanceof BookingError ? error.status : error instanceof ImageValidationError ? 400 : 500 });
  }
}
