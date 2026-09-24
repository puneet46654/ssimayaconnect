import mongoose, {
  Document,
  Model,
  Schema,
} from 'mongoose';

export type FeedbackScope =
  | 'application'
  | 'event';

export interface IFeedback
  extends Document {
  sessionId: string;
  scope: FeedbackScope;
  eventId?: string | null;
  rating: number;
  message?: string;
  suggestedFeature?: string;
  bookingId?: string;
  bookingMongoId?: string;
  submittedAt: Date;
}

const FeedbackSchema =
  new Schema<IFeedback>(
    {
      sessionId: {
        type: String,
        required: true,
        index: true,
      },
      scope: {
        type: String,
        required: true,
        enum: [
          'application',
          'event',
        ],
      },
      eventId: {
        type: String,
        trim: true,
        sparse: true,
      },
      rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
      },
      message: {
        type: String,
        trim: true,
        maxlength: 500,
      },
      suggestedFeature: {
        type: String,
        trim: true,
        maxlength: 200,
      },
      bookingId: {
        type: String,
        trim: true,
      },
      bookingMongoId: {
        type: String,
        trim: true,
      },
      submittedAt: {
        type: Date,
        required: true,
        default: Date.now,
      },
    },
    {
      timestamps: true,
    },
  );

/*
 * Application Feedback: one per user (sessionId).
 * Enforced by unique index on sessionId where scope = 'application'.
 *
 * Event Feedback: one per user per event (sessionId + eventId).
 * Enforced by unique compound index on sessionId + eventId where scope = 'event'.
 *
 * We use a single compound index: sessionId + scope + eventId.
 * - For application feedback, eventId is null so uniqueness is sessionId + 'application' + null.
 * - For event feedback, uniqueness is sessionId + 'event' + eventId.
 */
FeedbackSchema.index(
  {
    sessionId: 1,
    scope: 1,
    eventId: 1,
  },
  {
    unique: true,
  },
);

export const Feedback: Model<IFeedback> =
  mongoose.models.Feedback ||
  mongoose.model<IFeedback>(
    'Feedback',
    FeedbackSchema,
  );
