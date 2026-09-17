import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IEvent extends Document {
  eventName: string;
  eventType: 'conference' | 'mantram' | 'event';
  venue: string;
  description: string;
  imageUrl?: string;
  numberOfDays: number;
  startDate: Date;
  endDate: Date;
  status: 'LIVE' | 'COMPLETED' | 'UPCOMING';
  createdAt: Date;
  updatedAt: Date;
}

const EventSchema = new Schema<IEvent>(
  {
    eventName: { type: String, required: true, trim: true },
    eventType: {
      type: String,
      required: true,
      enum: ['conference', 'mantram', 'event'],
    },
    venue: { type: String, required: true },
    description: { type: String, required: true },
    imageUrl: { type: String, default: '' },
    numberOfDays: { type: Number, required: true, min: 1, max: 10 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['LIVE', 'COMPLETED', 'UPCOMING'],
      default: 'UPCOMING',
      required: true,
    },
  },
  { timestamps: true }
);

export const Event: Model<IEvent> =
  mongoose.models.Event || mongoose.model<IEvent>('Event', EventSchema);