import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISlot extends Document {
  eventId: mongoose.Types.ObjectId;
  dayScheduleId: mongoose.Types.ObjectId;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
}

const SlotSchema = new Schema<ISlot>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    dayScheduleId: { type: Schema.Types.ObjectId, ref: 'DaySchedule', required: true, index: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    capacity: { type: Number, required: true },
    bookedCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

SlotSchema.index({
  eventId: 1,
  dayScheduleId: 1,
});
SlotSchema.index({
  eventId: 1,
  dayScheduleId: 1,
  startTime: 1,
});

export const Slot: Model<ISlot> =
  mongoose.models.Slot || mongoose.model<ISlot>('Slot', SlotSchema);