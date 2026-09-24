import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { connectDB } from '@/lib/db';
import {
  AdminUser,
  type AdminPermission,
  type AdminRole,
  ADMIN_PERMISSIONS,
} from '@/models/AdminUser';
import {
  AdminActivityLog,
  type AdminActivityAction,
  type AdminActivityResource,
} from '@/models/AdminActivityLog';

export const ADMIN_SESSION_COOKIE = 'ssi_admin_session';
const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours

export type AdminUserProfile = {
  username: string;
  name: string;
  role: AdminRole;
  permissions: AdminPermission[];
  canCreate: boolean;
  canDelete: boolean;
};

export type AdminSessionPayload = AdminUserProfile & {
  loggedInAt: number;
};

/* ============================================================
   PASSWORD HASHING & VERIFICATION (Node.js Crypto)
============================================================ */

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const derived = scryptSync(password, salt, 64).toString('hex');
    const derivedBuf = Buffer.from(derived, 'hex');
    const hashBuf = Buffer.from(hash, 'hex');
    if (derivedBuf.length !== hashBuf.length) {
      return false;
    }
    return timingSafeEqual(derivedBuf, hashBuf);
  } catch {
    return false;
  }
}

/* ============================================================
   BUILT-IN ROOT SUPERADMIN
   Lives in code, not the database: it always works (even on an
   empty DB), always has full access, and cannot be edited or deleted.
   Only a scrypt hash of the password is stored here.
============================================================ */

export const ROOT_ADMIN_USERNAME = 'puneet';

const ROOT_ADMIN_SALT = '089b3dafcd98d874f75b152f82cf5250';
const ROOT_ADMIN_HASH =
  '8e58f7208627373610bf4d4f014d2537e4e708a43ec85b89ead5a697d7f6553c269423078f662981c7765b67bc614a22328b41a72c863fe31515b7ff1617730f';

const ROOT_ADMIN_PROFILE: AdminUserProfile = {
  username: ROOT_ADMIN_USERNAME,
  name: 'Puneet Shukla',
  role: 'superadmin',
  permissions: [...ADMIN_PERMISSIONS],
  canCreate: true,
  canDelete: true,
};

export function isRootAdmin(username: string | undefined | null) {
  return username?.trim().toLowerCase() === ROOT_ADMIN_USERNAME;
}

/* ============================================================
   AUTOMATIC DEFAULT SEEDING IF DB IS EMPTY
============================================================ */

export async function seedDefaultAdminsIfEmpty() {
  await connectDB();
  const count = await AdminUser.countDocuments();
  if (count > 0) {
    // If existing users exist without canCreate/canDelete explicitly set, ensure superadmin has them
    await AdminUser.updateMany(
      { role: 'superadmin', $or: [{ canCreate: { $exists: false } }, { canDelete: { $exists: false } }] },
      { $set: { canCreate: true, canDelete: true } },
    );
    return;
  }

  // No hardcoded accounts: the first superadmin comes from env vars (only when the DB is empty).
  const username = process.env.ADMIN_BOOTSTRAP_USERNAME?.trim().toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD || '';
  if (!username || password.length < 10) {
    console.error('No admin users exist. Set ADMIN_BOOTSTRAP_USERNAME and ADMIN_BOOTSTRAP_PASSWORD (min 10 chars).');
    return;
  }

  const { hash, salt } = hashPassword(password);
  await AdminUser.create({
    username,
    name: process.env.ADMIN_BOOTSTRAP_NAME?.trim() || username,
    passwordHash: hash,
    passwordSalt: salt,
    role: 'superadmin',
    permissions: [...ADMIN_PERMISSIONS],
    canCreate: true,
    canDelete: true,
    isActive: true,
    createdBy: 'system_bootstrap',
  });
}

/* ============================================================
   SESSION TOKEN SIGNING
============================================================ */

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'production') {
    // A guessable secret would let anyone forge an admin session.
    throw new Error('ADMIN_SESSION_SECRET must be set (min 32 chars) in production.');
  }
  return 'ssimaya-development-secret-change-me';
}

function sign(value: string) {
  return createHmac('sha256', getSecret()).update(value).digest('base64url');
}

function createSessionToken(profile: AdminUserProfile, loggedInAt: number) {
  const payloadString = JSON.stringify({
    ...profile,
    loggedInAt,
  });
  const encodedPayload = Buffer.from(payloadString, 'utf-8').toString('base64url');
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function verifySessionToken(token: string | undefined): AdminSessionPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encodedPayload, signature] = parts;
  const expectedSig = sign(encodedPayload);
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSig);

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payloadString = Buffer.from(encodedPayload, 'base64url').toString('utf-8');
    const data = JSON.parse(payloadString) as Partial<AdminSessionPayload>;

    if (
      typeof data.username !== 'string' ||
      typeof data.loggedInAt !== 'number' ||
      !Array.isArray(data.permissions)
    ) {
      return null;
    }

    if (Date.now() - data.loggedInAt > SESSION_MAX_AGE * 1000) {
      return null;
    }

    const isSuper = data.role === 'superadmin';

    return {
      username: data.username,
      name: data.name || data.username,
      role: (data.role as AdminRole) || 'admin',
      permissions: data.permissions as AdminPermission[],
      canCreate: isSuper ? true : Boolean(data.canCreate),
      canDelete: isSuper ? true : Boolean(data.canDelete),
      loggedInAt: data.loggedInAt,
    };
  } catch {
    return null;
  }
}

/* ============================================================
   CREDENTIAL VERIFICATION AGAINST MONGODB
============================================================ */

export async function verifyAdminCredentials(
  usernameInput: string,
  passwordInput: string,
): Promise<AdminUserProfile | null> {
  const username = usernameInput.trim().toLowerCase();
  if (!username || !passwordInput) {
    return null;
  }

  if (isRootAdmin(username)) {
    return verifyPassword(passwordInput, ROOT_ADMIN_HASH, ROOT_ADMIN_SALT)
      ? { ...ROOT_ADMIN_PROFILE }
      : null;
  }

  await seedDefaultAdminsIfEmpty();

  const user = await AdminUser.findOne({
    username,
    isActive: true,
  });

  if (!user) {
    return null;
  }

  const isMatch = verifyPassword(passwordInput, user.passwordHash, user.passwordSalt);
  if (!isMatch) {
    return null;
  }

  await AdminUser.updateOne(
    { _id: user._id },
    { $set: { lastLoginAt: new Date() } },
  );

  const isSuper = user.role === 'superadmin';

  return {
    username: user.username,
    name: user.name,
    role: user.role,
    permissions: user.permissions,
    canCreate: isSuper ? true : Boolean(user.canCreate),
    canDelete: isSuper ? true : Boolean(user.canDelete),
  };
}

/* ============================================================
   SESSION COOKIE MANAGEMENT
============================================================ */

export async function createAdminSession(profile: AdminUserProfile): Promise<number> {
  const loggedInAt = Date.now();
  const token = createSessionToken(profile, loggedInAt);
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
  return loggedInAt;
}

export async function clearAdminServerSession() {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, '', {
    httpOnly: true,
    expires: new Date(0),
    path: '/',
  });
}

export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  const cookieStore = await cookies();
  const cookieVal = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const session = verifySessionToken(cookieVal);
  if (!session) return null;

  if (isRootAdmin(session.username)) {
    return { ...ROOT_ADMIN_PROFILE, loggedInAt: session.loggedInAt };
  }

  // Re-read access from the DB so deactivation, deletion and role changes apply immediately.
  await connectDB();
  const user = await AdminUser.findOne({ username: session.username, isActive: true })
    .select('name role permissions canCreate canDelete')
    .lean();
  if (!user) return null;

  const isSuper = user.role === 'superadmin';
  return {
    ...session,
    name: user.name,
    role: user.role,
    permissions: isSuper ? [...ADMIN_PERMISSIONS] : user.permissions,
    canCreate: isSuper || Boolean(user.canCreate),
    canDelete: isSuper || Boolean(user.canDelete),
  };
}

const MAX_FAILED_LOGINS = 5;
const LOGIN_LOCK_MINUTES = 15;

export async function isAdminLoginLocked(username: string): Promise<boolean> {
  await connectDB();
  const failures = await AdminActivityLog.countDocuments({
    admin: username,
    action: 'login_failed',
    createdAt: { $gte: new Date(Date.now() - LOGIN_LOCK_MINUTES * 60 * 1000) },
  });
  return failures >= MAX_FAILED_LOGINS;
}

export async function requireAdminSession(
  requiredPermission?: AdminPermission,
): Promise<boolean> {
  const session = await getAdminSession();
  if (!session) return false;

  if (!requiredPermission) return true;
  if (session.role === 'superadmin') return true;

  return session.permissions.includes(requiredPermission);
}

export async function requireAdminWriteSession(): Promise<boolean> {
  const session = await getAdminSession();
  if (!session) return false;
  if (session.role === 'superadmin') return true;
  return Boolean(session.canCreate);
}

export async function requireAdminDeleteSession(): Promise<boolean> {
  const session = await getAdminSession();
  if (!session) return false;
  if (session.role === 'superadmin') return true;
  return Boolean(session.canDelete);
}

/* ============================================================
   ADMIN ACTIVITY LOGGING
============================================================ */

const SENSITIVE_KEY = /pass|token|secret|hash|salt|cookie|session/i;

function stripSensitive(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => stripSensitive(v, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !SENSITIVE_KEY.test(key))
      .map(([key, v]) => [key, stripSensitive(v, depth + 1)]),
  );
}

export async function logAdminActivity(entry: {
  action: AdminActivityAction;
  resource: AdminActivityResource;
  resourceId?: string;
  details?: Record<string, unknown>;
  admin?: string; // defaults to the current session's username
}) {
  try {
    const admin = entry.admin || (await getAdminSession())?.username || 'unknown';
    await connectDB();
    await AdminActivityLog.create({
      admin: admin.slice(0, 80),
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId,
      details: entry.details
        ? (stripSensitive(entry.details) as Record<string, unknown>)
        : undefined,
    });
  } catch (error) {
    // Logging must never break the request it's recording.
    console.error('Admin activity log error:', error);
  }
}
