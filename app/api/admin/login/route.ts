import { NextRequest, NextResponse } from 'next/server';
import {
  createAdminSession,
  isAdminLoginLocked,
  logAdminActivity,
  verifyAdminCredentials,
} from '@/lib/admin-server-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const username =
      typeof body?.username === 'string'
        ? body.username.trim().toLowerCase()
        : '';
    const password =
      typeof body?.password === 'string'
        ? body.password
        : '';

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Enter your login ID and password.' },
        { status: 400 },
      );
    }

    if (await isAdminLoginLocked(username)) {
      return NextResponse.json(
        { success: false, error: 'Too many failed attempts. Try again in 15 minutes.' },
        { status: 429 },
      );
    }

    const user = await verifyAdminCredentials(username, password);

    if (!user) {
      await logAdminActivity({
        action: 'login_failed',
        resource: 'auth',
        admin: username,
      });
      return NextResponse.json(
        { success: false, error: 'Invalid login ID or password.' },
        { status: 401 },
      );
    }

    const loggedInAt = await createAdminSession(user);
    await logAdminActivity({
      action: 'login',
      resource: 'auth',
      admin: user.username,
      details: { role: user.role },
    });

    return NextResponse.json({
      success: true,
      user: {
        username: user.username,
        name: user.name,
        role: user.role,
        permissions: user.permissions,
        canCreate: user.canCreate,
        canDelete: user.canDelete,
      },
      loggedInAt,
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json(
      { success: false, error: 'Authentication failed. Please try again.' },
      { status: 500 },
    );
  }
}
