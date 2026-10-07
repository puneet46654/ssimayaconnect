import mongoose, { Document, Model, Schema } from 'mongoose';

/** One page view or one API call seen by a visitor's browser. No IP addresses are stored. */
export interface IAnalyticsEvent extends Document {
  kind: 'pageview' | 'api';
  ts: Date;
  visitorId: string;
  sessionId: string;
  path: string;
  eventId?: string;
  referrer?: string;
  country?: string;
  city?: string;
  device?: string;
  browser?: string;
  os?: string;
  method?: string;
  status?: number;
  ms?: number;
}

const AnalyticsEventSchema = new Schema<IAnalyticsEvent>(
  {
    kind: { type: String, enum: ['pageview', 'api'], required: true },
    ts: { type: Date, required: true },
    visitorId: { type: String, required: true },
    sessionId: { type: String, required: true },
    path: { type: String, required: true },
    eventId: String,
    referrer: String,
    country: String,
    city: String,
    device: String,
    browser: String,
    os: String,
    method: String,
    status: Number,
    ms: Number,
  },
  { versionKey: false },
);

AnalyticsEventSchema.index({ kind: 1, ts: -1 });
// Raw events are kept for 90 days.
AnalyticsEventSchema.index({ ts: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const AnalyticsEvent: Model<IAnalyticsEvent> =
  mongoose.models.AnalyticsEvent || mongoose.model<IAnalyticsEvent>('AnalyticsEvent', AnalyticsEventSchema);
