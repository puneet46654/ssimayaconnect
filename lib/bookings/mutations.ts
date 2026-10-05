import mongoose, { type ClientSession } from 'mongoose';
import { Event } from '@/models/Event';
import { Booking } from '@/models/Booking';
import { Slot } from '@/models/Slot';
import { sameContact } from '@/lib/bookings/identity';
import type { BookingDetails } from '@/lib/booking-contracts';

export class BookingError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Every booking writer takes this event lock before reading identities or capacity. */
export async function lockBookingEvent(eventId: string, session: ClientSession) {
  return Event.findOneAndUpdate({ _id: eventId }, { $inc: { bookingRevision: 1 } }, {
    session, returnDocument: 'after', timestamps: false,
  });
}

export async function contactConflict(eventId: string, details: BookingDetails, session: ClientSession, excludeId?: string) {
  // Compare legacy records in place: no destructive backfill or unique contact index
  // that would fail on existing duplicates. The event write lock serializes writers.
  const candidates = await Booking.find({ eventId, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })
    .select('_id details').session(session).lean();
  return candidates.some(booking => sameContact(details, booking.details));
}

export async function deleteBooking(id: string) {
  const original = await Booking.findById(id).select('eventId').lean();
  if (!original) return null;
  return mongoose.connection.transaction(async session => {
    await lockBookingEvent(String(original.eventId), session);
    const deleted = await Booking.findOneAndDelete({ _id: id }, { session });
    if (!deleted) return null;
    const remaining = await Booking.countDocuments({ slotId: deleted.slotId }).session(session);
    await Slot.updateOne({ _id: deleted.slotId }, { $set: { bookedCount: remaining } }, { session });
    return deleted;
  });
}
