import mongoose, {
  Schema,
  Document,
  Model,
} from 'mongoose';

export type EventType =
  | 'conference'
  | 'mantram'
  | 'event';

export type BookingFormTemplate =
  | 'practitioner-institutional'
  | 'template-2'
  | 'template-3';

export type EventStatus =
  | 'LIVE'
  | 'COMPLETED'
  | 'UPCOMING';

export interface IEvent
  extends Document {
  eventName: string;

  eventType: EventType;

  bookingFormTemplate:
    BookingFormTemplate;

  venue: string;

  description: string;

  imageUrl?: string;

  numberOfDays: number;

  startDate: Date;

  endDate: Date;

  status: EventStatus;

  createdAt: Date;

  updatedAt: Date;
}

const EventSchema =
  new Schema<IEvent>(
    {
      eventName: {
        type: String,
        required: true,
        trim: true,
      },

      eventType: {
        type: String,
        required: true,
        enum: [
          'conference',
          'mantram',
          'event',
        ],
      },

      bookingFormTemplate: {
        type: String,
        required: true,
        enum: [
          'practitioner-institutional',
          'template-2',
          'template-3',
        ],
        default:
          'practitioner-institutional',
      },

      venue: {
        type: String,
        required: true,
        trim: true,
      },

      description: {
        type: String,
        required: true,
        trim: true,
      },

      imageUrl: {
        type: String,
        default: '',
      },

      numberOfDays: {
        type: Number,
        required: true,
        min: 1,
        max: 10,
      },

      startDate: {
        type: Date,
        required: true,
      },

      endDate: {
        type: Date,
        required: true,
      },

      status: {
        type: String,
        enum: [
          'LIVE',
          'COMPLETED',
          'UPCOMING',
        ],
        default: 'UPCOMING',
        required: true,
      },
    },
    {
      timestamps: true,
    },
  );

EventSchema.index({
  startDate: 1,
});
EventSchema.index({
  eventType: 1,
  startDate: 1,
});

export const Event: Model<IEvent> =
  mongoose.models.Event ||
  mongoose.model<IEvent>(
    'Event',
    EventSchema,
  );