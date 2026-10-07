import mongoose, { Document, Model, Schema } from 'mongoose';

/** One row per open browser session, refreshed while the tab is visible. Removed shortly after it goes quiet. */
export interface IAnalyticsPresence extends Omit<Document, '_id'> {
  _id: string;
  visitorId: string;
  path: string;
  eventId?: string;
  lastSeen: Date;
  country?: string;
  city?: string;
  device?: string;
}

const AnalyticsPresenceSchema = new Schema<IAnalyticsPresence>(
  {
    _id: { type: String, required: true },
    visitorId: { type: String, required: true },
    path: { type: String, required: true },
    eventId: String,
    lastSeen: { type: Date, required: true },
    country: String,
    city: String,
    device: String,
  },
  { versionKey: false },
);

AnalyticsPresenceSchema.index({ lastSeen: 1 }, { expireAfterSeconds: 300 });

export const AnalyticsPresence: Model<IAnalyticsPresence> =
  mongoose.models.AnalyticsPresence || mongoose.model<IAnalyticsPresence>('AnalyticsPresence', AnalyticsPresenceSchema);
