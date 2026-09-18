import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDaySchedule extends Document {
  eventId: mongoose.Types.ObjectId;
  dayNumber: number;
  date: Date;
  startTime: string;
  endTime: string;
  lunchEnabled: boolean;
  lunchStart?: string;
  lunchEnd?: string;
  slotDuration: number;
  slotGap: number;
  capacity: number;
  sameAsDay1: boolean;
}

const DayScheduleSchema = new Schema<IDaySchedule>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    dayNumber: { type: Number, required: true },
    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    lunchEnabled: { type: Boolean, default: false },
    lunchStart: { type: String, default: '' },
    lunchEnd: { type: String, default: '' },
    slotDuration: { type: Number, required: true },
    slotGap: { type: Number, required: true },
    capacity: { type: Number, required: true, min: 1, max: 20 },
    sameAsDay1: { type: Boolean, default: false },
  },
  { timestamps: true }
);

DayScheduleSchema.index({
  eventId: 1,
  dayNumber: 1,
});

export const DaySchedule: Model<IDaySchedule> =
  mongoose.models.DaySchedule || mongoose.model<IDaySchedule>('DaySchedule', DayScheduleSchema);
  