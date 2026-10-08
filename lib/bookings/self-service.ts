import mongoose, { type ClientSession } from 'mongoose';
import { Booking } from '@/models/Booking';
import { DaySchedule } from '@/models/DaySchedule';
import { Event } from '@/models/Event';
import { Slot } from '@/models/Slot';
import { slotInstant } from '@/lib/events/dates';
import { hasSlotEnded } from '@/lib/events/status';
import { BookingError, deleteBooking } from '@/lib/bookings/mutations';

/** Attendees may change or cancel a ticket only before its slot starts and before they are checked in. */
async function manageableBooking(bookingId: string, session?: ClientSession) {
  const booking = await Booking.findOne({ bookingId }).session(session ?? null);
  if (!booking) throw new BookingError(404, 'Booking not found.');
  const event = await Event.findById(booking.eventId).session(session ?? null);
  if (!event || event.status === 'CANCELLED') throw new BookingError(409, 'This event has been cancelled.');
  if (booking.attendanceStatus === 'PRESENT') throw new BookingError(409, 'You have already checked in for this booking.');
  const [day, slot] = await Promise.all([
    DaySchedule.findById(booking.dayScheduleId).select('date').session(session ?? null).lean(),
    Slot.findById(booking.slotId).select('startTime').session(session ?? null).lean(),
  ]);
  if (!day || !slot || !(slotInstant(day.date, slot.startTime, event.timeZone).getTime() > Date.now())) {
    throw new BookingError(409, 'This time slot has already started, so the booking can no longer be changed.');
  }
  return { booking, event };
}

export async function rescheduleOwnBooking(bookingId: string, dayScheduleId: string, slotId: string) {
  if (![dayScheduleId, slotId].every(id => mongoose.Types.ObjectId.isValid(id))) {
    throw new BookingError(400, 'Choose a valid time slot.');
  }
  return mongoose.connection.transaction(async session => {
    const { booking, event } = await manageableBooking(bookingId, session);
    if (String(booking.slotId) === slotId) throw new BookingError(409, 'You are already booked in this time slot.');
    const eventId = booking.eventId;
    const schedule = await DaySchedule.findOne({ _id: dayScheduleId, eventId }).session(session);
    const slot = await Slot.findOne({ _id: slotId, eventId, dayScheduleId }).session(session);
    if (!schedule || !slot) throw new BookingError(400, 'Selected schedule or slot is invalid.');
    if (hasSlotEnded(schedule.date, slot.endTime, new Date(), event.timeZone)) {
      throw new BookingError(409, 'This time slot has already ended. Please choose another slot.');
    }
    // Claim the new seat atomically before releasing the old one, exactly like a new booking.
    const claimed = await Slot.findOneAndUpdate(
      { _id: slotId, eventId, dayScheduleId, $expr: { $lt: ['$bookedCount', '$capacity'] } },
      { $inc: { bookedCount: 1 } }, { session, new: true },
    );
    if (!claimed) throw new BookingError(409, 'This slot is no longer available.');
    await Slot.updateOne({ _id: booking.slotId, bookedCount: { $gt: 0 } }, { $inc: { bookedCount: -1 } }, { session });
    booking.slotId = slot._id;
    booking.dayScheduleId = schedule._id;
    await booking.save({ session });
    return String(eventId);
  });
}

export async function cancelOwnBooking(bookingId: string) {
  const { booking } = await manageableBooking(bookingId);
  const deleted = await deleteBooking(String(booking._id));
  if (!deleted) throw new BookingError(404, 'Booking not found.');
  return String(deleted.eventId);
}
