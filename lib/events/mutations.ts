import mongoose, { type ClientSession } from 'mongoose';
import { Event, type IEvent } from '@/models/Event';
import { DaySchedule } from '@/models/DaySchedule';
import { Slot } from '@/models/Slot';
import { Booking } from '@/models/Booking';
import { BookingError, lockBookingEvent } from '@/lib/bookings/mutations';
import { calendarDate, eventTimeZone } from './dates';
import { getEventStatus } from './status';
import { generateSlotTimes } from './slots';
import { validateEventSchedules, type ScheduleInput } from './schedule-validation';

export function readEventForm(form: FormData, existing?: Pick<IEvent, 'timeZone' | 'bookingFormTemplate'>) {
  const value = (key: string, fallback = '') => String(form.get(key) ?? fallback).trim();
  const eventName = value('eventName'), venue = value('venue'), description = value('description');
  const eventType = value('eventType');
  const bookingFormTemplate = value('bookingFormTemplate', existing?.bookingFormTemplate || 'practitioner-institutional');
  const timeZone = value('timeZone', eventTimeZone(existing?.timeZone));
  const start = value('startDate'), end = value('endDate'), numberOfDays = Number(value('numberOfDays'));
  if (!eventName || !venue || !description) throw new BookingError(400, 'Required event information is missing.');
  if (!['conference', 'mantram', 'event'].includes(eventType)) throw new BookingError(400, 'Invalid event type.');
  if (!['practitioner-institutional', 'template-2', 'template-3'].includes(bookingFormTemplate)) throw new BookingError(400, 'Invalid registration form template.');
  let schedules: ScheduleInput[];
  try { schedules = JSON.parse(value('daySchedules', '[]')); }
  catch { throw new BookingError(400, 'Invalid day schedule data.'); }
  const invalid = validateEventSchedules(start, end, numberOfDays, schedules, timeZone);
  if (invalid) throw new BookingError(400, invalid);
  for (const schedule of schedules) {
    if (typeof schedule.lunchEnabled !== 'boolean' || schedule.sameAsDay1 !== undefined && typeof schedule.sameAsDay1 !== 'boolean') {
      throw new BookingError(400, 'Invalid schedule options.');
    }
  }
  return { fields: { eventName, venue, description, eventType, bookingFormTemplate, timeZone,
    startDate: new Date(start), endDate: new Date(end), numberOfDays,
    status: getEventStatus(start, end, new Date(), timeZone) }, schedules };
}

type EventInput = ReturnType<typeof readEventForm>;
const slotKey = (slot: { startTime: string; endTime: string }) => `${slot.startTime}|${slot.endTime}`;
const slotsFor = (schedule: ScheduleInput) => generateSlotTimes(schedule.startTime, schedule.endTime,
  schedule.slotDuration, schedule.slotGap, schedule.lunchEnabled, schedule.lunchStart, schedule.lunchEnd);

function scheduleFields(input: ScheduleInput, index: number) {
  return { dayNumber: index + 1, date: new Date(input.date), startTime: input.startTime, endTime: input.endTime,
    lunchEnabled: input.lunchEnabled, lunchStart: input.lunchStart || '', lunchEnd: input.lunchEnd || '',
    slotDuration: Number(input.slotDuration), slotGap: Number(input.slotGap), capacity: Number(input.capacity), sameAsDay1: !!input.sameAsDay1 };
}

/** Validate the complete replacement against real reservations before changing any records. */
async function replaceSchedules(event: IEvent, input: EventInput, session: ClientSession) {
  const id = String(event._id);
  const oldSchedules = await DaySchedule.find({ eventId: id }).session(session);
  const oldSlots = await Slot.find({ eventId: id }).session(session);
  const bookings = await Booking.find({ eventId: id }).select('slotId dayScheduleId').session(session).lean();
  if (bookings.length && input.fields.timeZone !== eventTimeZone(event.timeZone)) {
    throw new BookingError(409, 'The timezone cannot change while this event has bookings.');
  }
  const schedulesById = new Map(oldSchedules.map(day => [String(day._id), day]));
  const slotsById = new Map(oldSlots.map(slot => [String(slot._id), slot]));
  const desiredByDate = new Map(input.schedules.map(day => [day.date, { day, keys: new Set(slotsFor(day).map(slotKey)) }]));
  const occupancy = new Map<string, number>();
  for (const booking of bookings) {
    const slotId = String(booking.slotId), dayId = String(booking.dayScheduleId);
    const slot = slotsById.get(slotId), day = schedulesById.get(dayId);
    if (!slot || !day || String(slot.dayScheduleId) !== dayId) throw new BookingError(409, 'An existing booking has a missing schedule or slot. Contact staff before changing this event.');
    const desired = desiredByDate.get(calendarDate(day.date));
    if (!desired || !desired.keys.has(slotKey(slot))) {
      throw new BookingError(409, `The booked date and time ${calendarDate(day.date)} ${slot.startTime}-${slot.endTime} cannot be moved or removed. Cancel the event if it cannot go ahead.`);
    }
    const count = (occupancy.get(slotId) || 0) + 1;
    occupancy.set(slotId, count);
    if (count > Number(desired.day.capacity)) throw new BookingError(409, 'Capacity cannot be lower than the existing bookings in a slot.');
  }

  // Match by date/time, not the day's display position, to keep booked IDs stable.
  const retainedDays: mongoose.Types.ObjectId[] = [], retainedSlots: mongoose.Types.ObjectId[] = [];
  for (let index = 0; index < input.schedules.length; index++) {
    const data = input.schedules[index];
    const matchingDays = oldSchedules.filter(day => calendarDate(day.date) === data.date);
    if (matchingDays.length > 1) throw new BookingError(409, 'This event has duplicate schedule dates. Contact staff before editing it.');
    const day = matchingDays[0] || new DaySchedule({ eventId: id });
    Object.assign(day, scheduleFields(data, index));
    await day.save({ session });
    retainedDays.push(day._id as mongoose.Types.ObjectId);
    for (const generated of slotsFor(data)) {
      const matchingSlots = oldSlots.filter(slot => String(slot.dayScheduleId) === String(day._id) && slotKey(slot) === slotKey(generated));
      if (matchingSlots.length > 1) throw new BookingError(409, 'This event has duplicate slot times. Contact staff before editing it.');
      const slot = matchingSlots[0] || new Slot({ eventId: id, dayScheduleId: day._id, ...generated });
      slot.capacity = Number(data.capacity);
      slot.bookedCount = occupancy.get(String(slot._id)) || 0;
      await slot.save({ session });
      retainedSlots.push(slot._id as mongoose.Types.ObjectId);
    }
  }
  await Slot.deleteMany({ eventId: id, _id: { $nin: retainedSlots } }, { session });
  await DaySchedule.deleteMany({ eventId: id, _id: { $nin: retainedDays } }, { session });
}

export async function createEvent(input: EventInput, imageUrl: string) {
  return mongoose.connection.transaction(async session => {
    const event = new Event({ ...input.fields, imageUrl });
    await event.save({ session });
    await replaceSchedules(event, input, session);
    return event;
  });
}

export async function updateEvent(id: string, input: EventInput, imageUrl?: string) {
  return mongoose.connection.transaction(async session => {
    const event = await lockBookingEvent(id, session);
    if (!event) throw new BookingError(404, 'Event not found.');
    if (event.status === 'CANCELLED') throw new BookingError(409, 'Cancelled events are kept for history and cannot be edited.');
    await replaceSchedules(event, input, session);
    Object.assign(event, input.fields, imageUrl === undefined ? {} : { imageUrl });
    await event.save({ session });
    return event;
  });
}

export async function removeOrCancelEvent(id: string) {
  return mongoose.connection.transaction(async session => {
    const event = await lockBookingEvent(id, session);
    if (!event) return { cancelled: false, eventName: '' };
    if (event.status === 'CANCELLED' || await Booking.exists({ eventId: id }).session(session)) {
      event.status = 'CANCELLED';
      await event.save({ session });
      return { cancelled: true, eventName: event.eventName };
    }
    await Slot.deleteMany({ eventId: id }, { session });
    await DaySchedule.deleteMany({ eventId: id }, { session });
    await Event.deleteOne({ _id: id }, { session });
    return { cancelled: false, eventName: event.eventName };
  });
}
