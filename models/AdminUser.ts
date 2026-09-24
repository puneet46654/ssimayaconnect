import mongoose, {
  Document,
  Model,
  Schema,
} from 'mongoose';

export type AdminRole = 'superadmin' | 'admin' | 'staff';

export const ADMIN_PERMISSIONS = [
  'dashboard',
  'events',
  'bookings',
  'check-in',
  'reports',
  'auth',
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export interface IAdminUser extends Document {
  username: string;
  name: string;
  passwordHash: string;
  passwordSalt: string;
  role: AdminRole;
  permissions: AdminPermission[];
  canCreate: boolean; // Allows POST/PUT actions; default: false (view only)
  canDelete: boolean; // Allows DELETE actions; default: false (view only)
  isActive: boolean;
  createdBy?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AdminUserSchema = new Schema<IAdminUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 40,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    passwordSalt: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['superadmin', 'admin', 'staff'],
      default: 'admin',
    },
    permissions: {
      type: [String],
      default: ['dashboard'],
    },
    canCreate: {
      type: Boolean,
      default: false,
    },
    canDelete: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: String,
      trim: true,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

export const AdminUser: Model<IAdminUser> =
  mongoose.models.AdminUser ||
  mongoose.model<IAdminUser>('AdminUser', AdminUserSchema);
