import { NextResponse } from 'next/server';
import { clearAdminServerSession } from '@/lib/admin-server-auth';

export async function POST() {
  await clearAdminServerSession();
  return NextResponse.json({ success: true });
}
