import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import {
  getAdminSession,
  hashPassword,
  isRootAdmin,
  logAdminActivity,
} from '@/lib/admin-server-auth';
import {
  AdminUser,
  type AdminPermission,
  type AdminRole,
  ADMIN_PERMISSIONS,
} from '@/models/AdminUser';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

/* ============================================================
   PUT  —  Update User (permissions, role, status, password, capabilities)
============================================================ */

export async function PUT(
  request: NextRequest,
  context: RouteContext,
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized.' },
      { status: 401 },
    );
  }

  if (!isRootAdmin(session.username)) {
    return NextResponse.json(
      { success: false, error: 'Forbidden. User management permission required.' },
      { status: 403 },
    );
  }

  if (session.role !== 'superadmin' && !session.canCreate) {
    return NextResponse.json(
      { success: false, error: 'Forbidden. You have View-Only access and cannot modify users.' },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      { success: false, error: 'Invalid user ID.' },
      { status: 400 },
    );
  }

  try {
    await connectDB();
    const user = await AdminUser.findById(id);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found.' },
        { status: 404 },
      );
    }

    const body = await request.json().catch(() => null);

    const before = {
      name: user.name,
      role: user.role,
      permissions: [...user.permissions],
      canCreate: user.canCreate,
      canDelete: user.canDelete,
      isActive: user.isActive,
    };

    // If changing role to non-superadmin or deactivating, verify we don't deactivate the last superadmin
    const targetRole = body?.role !== undefined ? (body.role as AdminRole) : user.role;
    const targetActive = body?.isActive !== undefined ? Boolean(body.isActive) : user.isActive;

    if (user.role === 'superadmin' && (targetRole !== 'superadmin' || !targetActive)) {
      const activeSuperadminsCount = await AdminUser.countDocuments({
        _id: { $ne: user._id },
        role: 'superadmin',
        isActive: true,
      });

      if (activeSuperadminsCount === 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Cannot deactivate or demote the only remaining active Superadmin.',
          },
          { status: 400 },
        );
      }
    }

    // Only superadmin can promote someone to superadmin
    if (targetRole === 'superadmin' && session.role !== 'superadmin' && user.role !== 'superadmin') {
      return NextResponse.json(
        { success: false, error: 'Only superadmins can assign the Superadmin role.' },
        { status: 403 },
      );
    }

    if (typeof body?.name === 'string' && body.name.trim().length >= 2) {
      user.name = body.name.trim();
    }

    if (body?.role && ['admin', 'staff'].includes(body.role)) {
      user.role = body.role as AdminRole;
    }

    if (Array.isArray(body?.permissions)) {
      const filtered = body.permissions.filter((p: unknown) =>
        p !== 'auth' && ADMIN_PERMISSIONS.includes(p as AdminPermission),
      ) as AdminPermission[];
      user.permissions = user.role === 'superadmin' ? [...ADMIN_PERMISSIONS] : filtered;
    } else if (user.role === 'superadmin') {
      user.permissions = [...ADMIN_PERMISSIONS];
    }

    if (user.role === 'superadmin') {
      user.canCreate = true;
      user.canDelete = true;
    } else {
      if (body?.canCreate !== undefined) {
        user.canCreate = Boolean(body.canCreate);
      }
      if (body?.canDelete !== undefined) {
        user.canDelete = Boolean(body.canDelete);
      }
    }

    if (body?.isActive !== undefined) {
      user.isActive = Boolean(body.isActive);
    }

    // Optional password reset
    if (typeof body?.password === 'string' && body.password.length > 0) {
      if (body.password.length < 6) {
        return NextResponse.json(
          { success: false, error: 'Password must be at least 6 characters long.' },
          { status: 400 },
        );
      }
      const { hash, salt } = hashPassword(body.password);
      user.passwordHash = hash;
      user.passwordSalt = salt;
    }

    await user.save();

    const after = {
      name: user.name,
      role: user.role,
      permissions: [...user.permissions],
      canCreate: user.canCreate,
      canDelete: user.canDelete,
      isActive: user.isActive,
    };
    const changes = Object.fromEntries(
      (Object.keys(after) as (keyof typeof after)[])
        .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
        .map((key) => [key, { from: before[key], to: after[key] }]),
    );
    const isAccessChange = ['role', 'permissions', 'canCreate', 'canDelete'].some(
      (key) => key in changes,
    );
    const passwordReset = typeof body?.password === 'string' && body.password.length > 0;

    if (Object.keys(changes).length > 0 || passwordReset) {
      await logAdminActivity({
        action: isAccessChange ? 'role_change' : 'update',
        resource: 'admin_user',
        resourceId: user._id.toString(),
        admin: session.username,
        details: { username: user.username, changes, ...(passwordReset && { credentialReset: true }) },
      });
    }

    return NextResponse.json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        name: user.name,
        role: user.role,
        permissions: user.permissions,
        canCreate: user.canCreate,
        canDelete: user.canDelete,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update user.' },
      { status: 500 },
    );
  }
}

/* ============================================================
   DELETE  —  Remove User
============================================================ */

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized.' },
      { status: 401 },
    );
  }

  if (!isRootAdmin(session.username)) {
    return NextResponse.json(
      { success: false, error: 'Forbidden. User management permission required.' },
      { status: 403 },
    );
  }

  if (session.role !== 'superadmin' && !session.canDelete) {
    return NextResponse.json(
      { success: false, error: 'Forbidden. You do not have permission to delete users.' },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      { success: false, error: 'Invalid user ID.' },
      { status: 400 },
    );
  }

  try {
    await connectDB();
    const user = await AdminUser.findById(id);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found.' },
        { status: 404 },
      );
    }

    if (user.username === session.username) {
      return NextResponse.json(
        { success: false, error: 'You cannot delete your own account.' },
        { status: 400 },
      );
    }

    if (user.role === 'superadmin') {
      const otherSuperadmins = await AdminUser.countDocuments({
        _id: { $ne: user._id },
        role: 'superadmin',
        isActive: true,
      });

      if (otherSuperadmins === 0) {
        return NextResponse.json(
          { success: false, error: 'Cannot delete the only remaining active Superadmin.' },
          { status: 400 },
        );
      }
    }

    await AdminUser.deleteOne({ _id: user._id });

    await logAdminActivity({
      action: 'delete',
      resource: 'admin_user',
      resourceId: user._id.toString(),
      admin: session.username,
      details: { username: user.username, role: user.role },
    });

    return NextResponse.json({
      success: true,
      message: `User @${user.username} deleted successfully.`,
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete user.' },
      { status: 500 },
    );
  }
}
