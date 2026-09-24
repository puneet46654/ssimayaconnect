import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { getAdminSession, isRootAdmin } from '@/lib/admin-server-auth';
import {
  AdminActivityLog,
  ADMIN_ACTIVITY_ACTIONS,
  type AdminActivityAction,
} from '@/models/AdminActivityLog';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* ============================================================
   GET  —  List admin activity logs (filters: admin, action, from, to)
============================================================ */

export async function GET(request: NextRequest) {
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

  const params = request.nextUrl.searchParams;
  const admin = params.get('admin')?.trim().toLowerCase();
  const action = params.get('action');
  const from = params.get('from');
  const to = params.get('to');

  const query: Record<string, unknown> = {};
  if (admin) query.admin = admin;
  if (action && ADMIN_ACTIVITY_ACTIONS.includes(action as AdminActivityAction)) {
    query.action = action;
  }

  const createdAt: Record<string, Date> = {};
  // `from` / `to` are ISO timestamps computed by the client from its local day boundaries.
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  if (fromDate && !Number.isNaN(fromDate.getTime())) createdAt.$gte = fromDate;
  if (toDate && !Number.isNaN(toDate.getTime())) createdAt.$lte = toDate;
  if (Object.keys(createdAt).length) query.createdAt = createdAt;

  try {
    await connectDB();
    const logs = await AdminActivityLog.find(query)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return NextResponse.json({ success: true, logs });
  } catch (error) {
    console.error('Error fetching admin activity logs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch activity logs.' },
      { status: 500 },
    );
  }
}
