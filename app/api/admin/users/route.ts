import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import {
  getAdminSession,
  hashPassword,
  logAdminActivity,
  seedDefaultAdminsIfEmpty,
} from '@/lib/admin-server-auth';
import {
  AdminUser,
  type AdminPermission,
  type AdminRole,
  ADMIN_PERMISSIONS,
} from '@/models/AdminUser';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* ============================================================
   GET  —  List all Admin Users
============================================================ */

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized.' },
      { status: 401 },
    );
  }

  if (session.role !== 'superadmin' && !session.permissions.includes('auth')) {
    return NextResponse.json(
      { success: false, error: 'Forbidden. User management permission required.' },
      { status: 403 },
    );
  }

  await seedDefaultAdminsIfEmpty();
  await connectDB();

  const users = await AdminUser.find({})
    .select('-passwordHash -passwordSalt')
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({
    success: true,
    users,
  });
}

/* ============================================================
   POST  —  Create a new Admin User
============================================================ */

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized.' },
      { status: 401 },
    );
  }

  if (session.role !== 'superadmin' && !session.permissions.includes('auth')) {
    return NextResponse.json(
      { success: false, error: 'Forbidden. User management permission required.' },
      { status: 403 },
    );
  }

  if (session.role !== 'superadmin' && !session.canCreate) {
    return NextResponse.json(
      { success: false, error: 'Forbidden. You have View-Only access and cannot create users.' },
      { status: 403 },
    );
  }

  try {
    const body = await request.json().catch(() => null);
    const username = typeof body?.username === 'string' ? body.username.trim().toLowerCase() : '';
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const role = (body?.role as AdminRole) || 'admin';
    const permissions = Array.isArray(body?.permissions)
      ? (body.permissions.filter((p: unknown) =>
          ADMIN_PERMISSIONS.includes(p as AdminPermission),
        ) as AdminPermission[])
      : (['dashboard'] as AdminPermission[]);

    // Default to false (view-only) unless explicitly enabled or role is superadmin
    const isSuper = role === 'superadmin';
    const canCreate = isSuper ? true : Boolean(body?.canCreate);
    const canDelete = isSuper ? true : Boolean(body?.canDelete);
    const isActive = body?.isActive !== false;

    if (!username || username.length < 3) {
      return NextResponse.json(
        { success: false, error: 'Username must be at least 3 characters.' },
        { status: 400 },
      );
    }

    if (!/^[a-z0-9_.-]+$/.test(username)) {
      return NextResponse.json(
        { success: false, error: 'Username can only contain letters, numbers, dots, hyphens, and underscores.' },
        { status: 400 },
      );
    }

    if (!name || name.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Full name is required.' },
        { status: 400 },
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters long.' },
        { status: 400 },
      );
    }

    if (!['superadmin', 'admin', 'staff'].includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Invalid user role.' },
        { status: 400 },
      );
    }

    // Only superadmin can create another superadmin
    if (role === 'superadmin' && session.role !== 'superadmin') {
      return NextResponse.json(
        { success: false, error: 'Only superadmins can create another superadmin account.' },
        { status: 403 },
      );
    }

    await seedDefaultAdminsIfEmpty();
    await connectDB();

    const existing = await AdminUser.findOne({ username }).lean();
    if (existing) {
      return NextResponse.json(
        { success: false, error: `Username "${username}" is already taken.` },
        { status: 409 },
      );
    }

    const { hash, salt } = hashPassword(password);

    const newUser = await AdminUser.create({
      username,
      name,
      passwordHash: hash,
      passwordSalt: salt,
      role,
      permissions: isSuper ? [...ADMIN_PERMISSIONS] : permissions,
      canCreate,
      canDelete,
      isActive,
      createdBy: session.username,
    });

    await logAdminActivity({
      action: 'create',
      resource: 'admin_user',
      resourceId: newUser._id.toString(),
      admin: session.username,
      details: {
        username: newUser.username,
        role: newUser.role,
        permissions: newUser.permissions,
        canCreate: newUser.canCreate,
        canDelete: newUser.canDelete,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        _id: newUser._id,
        username: newUser.username,
        name: newUser.name,
        role: newUser.role,
        permissions: newUser.permissions,
        canCreate: newUser.canCreate,
        canDelete: newUser.canDelete,
        isActive: newUser.isActive,
        createdBy: newUser.createdBy,
        createdAt: newUser.createdAt,
      },
    });
  } catch (error) {
    console.error('Error creating admin user:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create user.' },
      { status: 500 },
    );
  }
}
