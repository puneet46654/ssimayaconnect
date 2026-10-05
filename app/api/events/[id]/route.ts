import { validatedThumbnail, ImageValidationError } from '@/lib/image-validation';
import { readEventForm, updateEvent, removeOrCancelEvent } from '@/lib/events/mutations';
import { BookingError } from '@/lib/bookings/mutations';
import { adminAccessError } from '@/lib/admin-api-auth';
import { eventTimeZone } from '@/lib/events/dates';
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


import { Event } from '@/models/Event';

import {
  DaySchedule,
} from '@/models/DaySchedule';

import { Slot } from '@/models/Slot';

import {
  emitRealtimeChange,
} from '@/lib/realtime';
import { logAdminActivity } from '@/lib/admin-server-auth';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

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

    const [daySchedules, slotTotals] =
      await Promise.all([
        DaySchedule.find({
          eventId: event._id,
        })
          .select(
            'dayNumber date startTime endTime lunchEnabled lunchStart lunchEnd slotDuration slotGap capacity sameAsDay1',
          )
          .sort({
            dayNumber: 1,
          })
          .lean(),
        Slot.aggregate([
          {
            $match: {
              eventId: event._id,
            },
          },
          {
            $group: {
              _id: null,
              totalSlots: {
                $sum: '$capacity',
              },
              bookedSlots: {
                $sum: '$bookedCount',
              },
            },
          },
        ]),
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
        new Date(), event.timeZone, event.status,
      );

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
          timeZone: eventTimeZone(event.timeZone),

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
            'public, max-age=0, s-maxage=5, stale-while-revalidate=30',
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

export async function PUT(req: NextRequest, context: RouteContext) {
  const denied = await adminAccessError('events', 'write');
  if (denied) return denied;
  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) throw new BookingError(400, 'Invalid event ID.');
    await connectDB();
    const existing = await Event.findById(id);
    if (!existing) throw new BookingError(404, 'Event not found.');
    if (existing.status === 'CANCELLED') throw new BookingError(409, 'Cancelled events are kept for history and cannot be edited.');
    const form = await req.formData();
    const input = readEventForm(form, existing);
    const thumbnail = await validatedThumbnail(form.get('thumbnail'));
    const imageUrl = thumbnail ? await uploadImageToS3(thumbnail, 'thumbnails') : undefined;
    const event = await updateEvent(id, input, imageUrl);
    emitRealtimeChange({ resource: 'events', action: 'updated', id });
    emitRealtimeChange({ resource: 'bookings', action: 'updated', id });
    await logAdminActivity({ action: 'update', resource: 'event', resourceId: id, details: { eventName: event.eventName } });
    return NextResponse.json({ success: true, message: 'Event updated successfully.', eventId: id,
      bookingFormTemplate: event.bookingFormTemplate, imageUrl: event.imageUrl ? getPublicImageUrl(id, event.updatedAt) : '', updatedAt: event.updatedAt },
      { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (!(error instanceof BookingError || error instanceof ImageValidationError)) console.error('Event update failed:', error);
    return NextResponse.json({ success: false, error: (error instanceof BookingError || error instanceof ImageValidationError) ? error.message : 'Unable to update the event. Please retry.' },
      { status: error instanceof BookingError ? error.status : error instanceof ImageValidationError ? 400 : 500 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const denied = await adminAccessError('events', 'delete');
  if (denied) return denied;
  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) throw new BookingError(400, 'Invalid event ID.');
    await connectDB();
    const result = await removeOrCancelEvent(id);
    emitRealtimeChange({ resource: 'events', action: result.cancelled ? 'updated' : 'deleted', id });
    emitRealtimeChange({ resource: 'bookings', action: 'updated', id });
    emitRealtimeChange({ resource: 'attendance', action: 'updated', id });
    if (result.eventName) await logAdminActivity({ action: result.cancelled ? 'update' : 'delete', resource: 'event', resourceId: id,
      details: { eventName: result.eventName, cancelled: result.cancelled } });
    return NextResponse.json({ success: true, cancelled: result.cancelled,
      message: result.cancelled ? 'Event cancelled. Booking history is preserved; tickets are no longer valid for admission.' : 'Event deleted successfully.' },
      { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (!(error instanceof BookingError)) console.error('Event removal failed:', error);
    return NextResponse.json({ success: false, error: error instanceof BookingError ? error.message : 'Unable to remove the event. Please retry.' },
      { status: error instanceof BookingError ? error.status : 500 });
  }
}
