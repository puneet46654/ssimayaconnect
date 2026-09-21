import mongoose, {
  Document,
  Model,
  Schema,
} from 'mongoose';

export type UserActivityStatus =
  | 'viewed'
  | 'filling'
  | 'registered';

export type UserActivityAction =
  | 'page_view'
  | 'form_started'
  | 'form_submitted'
  | 'slot_selected'
  | 'confirmation_viewed'
  | 'booking_completed'
  | 'feedback_submitted'
  | 'feedback_skipped';

export interface IUserActivityEntry {
  action: UserActivityAction;
  eventId?: string;
  path: string;
  metadata?: Record<string, unknown>;
  occurredAt: Date;
}

export interface IUserEventState {
  eventId: string;
  status: UserActivityStatus;
  bookingId?: string;
  startedAt: Date;
  lastSeenAt: Date;
  bookingDetails?: Record<string, unknown>;
  slotSelection?: Record<string, unknown>;
}

export interface IUserActivity
  extends Document {
  sessionId: string;
  status: UserActivityStatus;
  currentEventId?: string;
  lastSeenAt: Date;
  registeredAt?: Date;
  events: IUserEventState[];
  activities: IUserActivityEntry[];
}

const ActivityEntrySchema =
  new Schema<IUserActivityEntry>(
    {
      action: {
        type: String,
        required: true,
        enum: [
          'page_view',
          'form_started',
          'form_submitted',
          'slot_selected',
          'confirmation_viewed',
          'booking_completed',
          'feedback_submitted',
          'feedback_skipped',
        ],
      },
      eventId: {
        type: String,
        trim: true,
      },
      path: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500,
      },
      metadata: {
        type: Schema.Types.Mixed,
      },
      occurredAt: {
        type: Date,
        required: true,
        default: Date.now,
      },
    },
    {
      _id: false,
    },
  );

const EventStateSchema =
  new Schema<IUserEventState>(
    {
      eventId: {
        type: String,
        required: true,
        trim: true,
      },
      status: {
        type: String,
        required: true,
        enum: [
          'viewed',
          'filling',
          'registered',
        ],
        default: 'viewed',
      },
      bookingId: {
        type: String,
        trim: true,
      },
      startedAt: {
        type: Date,
        required: true,
        default: Date.now,
      },
      lastSeenAt: {
        type: Date,
        required: true,
        default: Date.now,
      },
      bookingDetails: {
        type: Schema.Types.Mixed,
      },
      slotSelection: {
        type: Schema.Types.Mixed,
      },
    },
    {
      _id: false,
    },
  );

const UserActivitySchema =
  new Schema<IUserActivity>(
    {
      sessionId: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },
      status: {
        type: String,
        required: true,
        enum: [
          'viewed',
          'filling',
          'registered',
        ],
        default: 'viewed',
      },
      currentEventId: {
        type: String,
        trim: true,
      },
      lastSeenAt: {
        type: Date,
        required: true,
        default: Date.now,
      },
      registeredAt: Date,
      events: {
        type: [EventStateSchema],
        default: [],
      },
      activities: {
        type: [ActivityEntrySchema],
        default: [],
      },
    },
    {
      timestamps: true,
    },
  );

UserActivitySchema.index({
  lastSeenAt: -1,
});
UserActivitySchema.index({
  'events.eventId': 1,
  'events.status': 1,
});

export const UserActivity: Model<IUserActivity> =
  mongoose.models.UserActivity ||
  mongoose.model<IUserActivity>(
    'UserActivity',
    UserActivitySchema,
  );
