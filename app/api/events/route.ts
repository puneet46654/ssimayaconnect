import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { uploadImageToS3 } from '@/lib/s3';
import { Event } from '@/models/Event';
import { DaySchedule } from '@/models/DaySchedule';
import { Slot } from '@/models/Slot';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Internal Server Error';
}

function getEventStatus(startDate: Date, endDate: Date, now = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
  const end = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));

  if (today > end) return 'COMPLETED' as const;
  if (today >= start) return 'LIVE' as const;
  return 'UPCOMING' as const;
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function generateSlotTimes(
  startTime: string,
  endTime: string,
  durationStr: string,
  gapStr: string,
  lunchEnabled: boolean,
  lunchStartStr: string,
  lunchEndStr: string
) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  const duration = Number(durationStr);
  const gap = Number(gapStr);

  const lunchStart = lunchEnabled ? timeToMinutes(lunchStartStr) : 0;
  const lunchEnd = lunchEnabled ? timeToMinutes(lunchEndStr) : 0;

  const slots: { startTime: string; endTime: string }[] = [];
  let cursor = start;

  while (cursor + duration <= end) {
    const slotEnd = cursor + duration;
    const overlapsLunch = lunchEnabled && cursor < lunchEnd && slotEnd > lunchStart;

    if (overlapsLunch) {
      cursor = lunchEnd;
      continue;
    }

    slots.push({
      startTime: formatTime(cursor),
      endTime: formatTime(slotEnd),
    });

    cursor = slotEnd + gap;
  }

  return slots;
}

export async function GET() {
  try {
    await connectDB();

    const events = await Event.find().sort({ startDate: 1 }).lean();
    const eventIds = events.map((event) => event._id);
    const slotTotals = await Slot.aggregate([
      { $match: { eventId: { $in: eventIds } } },
      {
        $group: {
          _id: '$eventId',
          totalSlots: { $sum: '$capacity' },
          bookedSlots: { $sum: '$bookedCount' },
        },
      },
    ]);
    const totalsByEventId = new Map(
      slotTotals.map((total) => [total._id.toString(), total])
    );
    const now = new Date();

    const responseEvents = events.map((event) => {
      const totals = totalsByEventId.get(event._id.toString()) || {
        totalSlots: 0,
        bookedSlots: 0,
      };
      const status = getEventStatus(event.startDate, event.endDate, now);

      return {
        _id: event._id.toString(),
        eventName: event.eventName,
        eventType: event.eventType,
        venue: event.venue,
        startDate: event.startDate,
        endDate: event.endDate,
        description: event.description,
        imageUrl: event.imageUrl
          ? `/api/events/${event._id.toString()}/image`
          : '',
        totalSlots: totals.totalSlots,
        bookedSlots: totals.bookedSlots,
        status,
      };
    });

    await Event.bulkWrite(
      responseEvents.map((event) => ({
        updateOne: {
          filter: { _id: event._id },
          update: { $set: { status: event.status } },
        },
      }))
    );

    return NextResponse.json({ success: true, events: responseEvents });
  } catch (error: unknown) {
    console.error('Failed to fetch events:', error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const formData = await req.formData();

    const eventName = formData.get('eventName') as string;
    const eventType = formData.get('eventType') as 'conference' | 'mantram' | 'event';
    const venue = formData.get('venue') as string;
    const description = formData.get('description') as string;
    const numberOfDays = Number(formData.get('numberOfDays'));
    const startDate = formData.get('startDate') as string;
    const endDate = formData.get('endDate') as string;

    const thumbnailFile = formData.get('thumbnail') as File | null;
    let imageUrl = '';

    if (thumbnailFile && thumbnailFile.size > 0) {
      imageUrl = await uploadImageToS3(thumbnailFile, 'thumbnails');
    }

    const daysJson = formData.get('daySchedules') as string;
    const daySchedulesInput = JSON.parse(daysJson || '[]');

    // 1. Create Parent Event Document
    const newEvent = new Event({
      eventName,
      eventType,
      venue,
      description,
      imageUrl,
      numberOfDays,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status: getEventStatus(new Date(startDate), new Date(endDate)),
    });
    await newEvent.save();

    // 2. Process Relational DaySchedules and Slots
    for (let index = 0; index < numberOfDays; index++) {
      const scheduleData = daySchedulesInput[index];

      const createdDaySchedule = new DaySchedule({
        eventId: newEvent._id,
        dayNumber: index + 1,
        date: new Date(scheduleData.date),
        startTime: scheduleData.startTime,
        endTime: scheduleData.endTime,
        lunchEnabled: scheduleData.lunchEnabled,
        lunchStart: scheduleData.lunchStart || '',
        lunchEnd: scheduleData.lunchEnd || '',
        slotDuration: Number(scheduleData.slotDuration),
        slotGap: Number(scheduleData.slotGap),
        capacity: Number(scheduleData.capacity),
        sameAsDay1: scheduleData.sameAsDay1 || false,
      });
      await createdDaySchedule.save();

      // 3. Generate Relational Slots linked to both Event and DaySchedule
      const generatedSlots = generateSlotTimes(
        scheduleData.startTime,
        scheduleData.endTime,
        scheduleData.slotDuration,
        scheduleData.slotGap,
        scheduleData.lunchEnabled,
        scheduleData.lunchStart,
        scheduleData.lunchEnd
      );

      const slotDocs = generatedSlots.map((slot) => ({
        eventId: newEvent._id,
        dayScheduleId: createdDaySchedule._id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        capacity: Number(scheduleData.capacity),
        bookedCount: 0,
      }));

      if (slotDocs.length > 0) {
        await Slot.insertMany(slotDocs);
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Event and relational schedules created successfully',
        eventId: newEvent._id,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error('Failed to create event:', error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await connectDB();

    const eventId = req.nextUrl.searchParams.get('id');
    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'Event ID is required.' },
        { status: 400 }
      );
    }

    const deletedEvent = await Event.findByIdAndDelete(eventId);
    if (!deletedEvent) {
      return NextResponse.json(
        { success: false, error: 'Event not found.' },
        { status: 404 }
      );
    }

    await Promise.all([
      DaySchedule.deleteMany({ eventId: deletedEvent._id }),
      Slot.deleteMany({ eventId: deletedEvent._id }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Failed to delete event:', error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}