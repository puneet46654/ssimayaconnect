import { NextRequest, NextResponse } from 'next/server';
import {
  createAdminSession,
  isValidAdminCredentials,
} from '@/lib/admin-server-auth';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const username =
    typeof body?.username === 'string'
      ? body.username.trim().toLowerCase()
      : '';
  const password =
    typeof body?.password === 'string'
      ? body.password
      : '';

  if (!isValidAdminCredentials(username, password)) {
    return NextResponse.json(
      { success: false, error: 'Invalid login ID or password.' },
      { status: 401 },
    );
  }

  await createAdminSession(username);
  return NextResponse.json({
    success: true,
    username,
    loggedInAt: Date.now(),
  });
}
