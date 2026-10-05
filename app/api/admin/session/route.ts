import { NextResponse } from 'next/server';
import { clearAdminServerSession, getAdminSession } from '@/lib/admin-server-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      await clearAdminServerSession();
      return NextResponse.json({ success: false, message: 'Please sign in again.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    }
    const { credentialVersion: _version, ...user } = session;
    void _version;
    return NextResponse.json({ success: true, user }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Admin session check failed:', error);
    return NextResponse.json({ success: false, message: 'Unable to check your session. Please retry.' }, { status: 503 });
  }
}
