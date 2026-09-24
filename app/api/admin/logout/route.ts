import { NextResponse } from 'next/server';
import { clearAdminServerSession, logAdminActivity } from '@/lib/admin-server-auth';

export async function POST() {
  await logAdminActivity({ action: 'logout', resource: 'auth' });
  await clearAdminServerSession();
  return NextResponse.json({ success: true });
}
