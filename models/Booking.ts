import mongoose, {
  Document,
  Model,
  Schema,
} from 'mongoose';

/* ============================================================
   TYPES
============================================================ */

export type AttendanceStatus =
  | 'NOT_PRESENT'
  | 'PRESENT';

export type CheckInMethod =
  | 'QR'
  | 'MANUAL';

export interface IBookingDetails {
  fullName: string;
  email: string;
  mobile: string;

  [key: string]: string;
}

export interface IBooking
  extends Document {
  bookingId: string;

  eventId:
    mongoose.Types.ObjectId;

  slotId:
    mongoose.Types.ObjectId;

  dayScheduleId:
    mongoose.Types.ObjectId;

  details:
    IBookingDetails;

  attendanceStatus:
    AttendanceStatus;

  checkedInAt?:
    Date | null;

  checkedInBy?:
    string;

  checkInMethod?:
    CheckInMethod;

  createdAt:
    Date;

  updatedAt:
    Date;
}

/* ============================================================
   SCHEMA
============================================================ */

const BookingSchema =
  new Schema<IBooking>(
    {
      bookingId: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true,
      },

      eventId: {
        type:
          Schema.Types
            .ObjectId,

        ref:
          'Event',

        required:
          true,

        index:
          true,
      },

      slotId: {
        type:
          Schema.Types
            .ObjectId,

        ref:
          'Slot',

        required:
          true,

        index:
          true,
      },

      dayScheduleId: {
        type:
          Schema.Types
            .ObjectId,

        ref:
          'DaySchedule',

        required:
          true,

        index:
          true,
      },

      details: {
        type:
          Schema.Types
            .Mixed,

        required:
          true,
      },

      /* ======================================================
         ATTENDANCE
      ====================================================== */

      attendanceStatus: {
        type:
          String,

        enum: [
          'NOT_PRESENT',
          'PRESENT',
        ],

        default:
          'NOT_PRESENT',

        index:
          true,
      },

      checkedInAt: {
        type:
          Date,

        default:
          null,
      },

      checkedInBy: {
        type:
          String,

        default:
          '',
      },

      checkInMethod: {
        type:
          String,

        enum: [
          'QR',
          'MANUAL',
        ],

        default:
          undefined,
      },
    },
    {
      timestamps:
        true,
    },
  );

/* ============================================================
   INDEXES
============================================================ */

BookingSchema.index({
  eventId: 1,
  slotId: 1,
});

BookingSchema.index({
  eventId: 1,
  attendanceStatus: 1,
});

BookingSchema.index({
  eventId: 1,
  checkedInAt: -1,
});

/* ============================================================
   MODEL
============================================================ */

export const Booking:
  Model<IBooking> =
  mongoose.models.Booking ||
  mongoose.model<IBooking>(
    'Booking',
    BookingSchema,
  );