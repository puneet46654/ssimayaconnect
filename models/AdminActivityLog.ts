import mongoose, {
  Document,
  Model,
  Schema,
} from 'mongoose';

export const ADMIN_ACTIVITY_ACTIONS = [
  'login',
  'logout',
  'login_failed',
  'create',
  'update',
  'delete',
  'role_change',
] as const;

export type AdminActivityAction = (typeof ADMIN_ACTIVITY_ACTIONS)[number];

export type AdminActivityResource = 'auth' | 'admin_user' | 'event' | 'booking';

export interface IAdminActivityLog extends Document {
  admin: string;
  action: AdminActivityAction;
  resource: AdminActivityResource;
  resourceId?: string;
  details?: Record<string, unknown>;
  createdAt: Date;
}

const AdminActivityLogSchema = new Schema<IAdminActivityLog>(
  {
    admin: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 80,
    },
    action: {
      type: String,
      required: true,
      enum: ADMIN_ACTIVITY_ACTIONS,
    },
    resource: {
      type: String,
      required: true,
      enum: ['auth', 'admin_user', 'event', 'booking'],
    },
    resourceId: {
      type: String,
      trim: true,
    },
    details: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

AdminActivityLogSchema.index({ createdAt: -1 });
AdminActivityLogSchema.index({ admin: 1, createdAt: -1 });
AdminActivityLogSchema.index({ action: 1, createdAt: -1 });

export const AdminActivityLog: Model<IAdminActivityLog> =
  mongoose.models.AdminActivityLog ||
  mongoose.model<IAdminActivityLog>('AdminActivityLog', AdminActivityLogSchema);
