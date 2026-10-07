import type { BookingDetails } from '@/lib/booking-contracts';
import mongoose, { Document, Model, Schema } from 'mongoose';

/** Attendee details submitted before a slot was chosen. Never counted as a booking. */
export interface IPendingBooking extends Document {
  eventId: mongoose.Types.ObjectId;
  draftId: string;
  details: BookingDetails;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PendingBookingSchema = new Schema<IPendingBooking>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    draftId: { type: String, required: true, trim: true },
    details: { type: Schema.Types.Mixed, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// One row per browser draft, so resubmitting the form updates instead of duplicating.
PendingBookingSchema.index({ eventId: 1, draftId: 1 }, { unique: true });
// MongoDB removes the row once the event has ended.
PendingBookingSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PendingBooking: Model<IPendingBooking> =
  mongoose.models.PendingBooking || mongoose.model<IPendingBooking>('PendingBooking', PendingBookingSchema);
