import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { connectDB } from '@/lib/db';
import { Feedback } from '@/models/Feedback';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const SESSION_COOKIE = 'ssimaya_session_id';
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
function sessionId(request: NextRequest) { return request.cookies.get(SESSION_COOKIE)?.value || randomUUID(); }
function reply(session: string, body: Record<string, unknown>, status = 200) {
  const response = NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  response.cookies.set(SESSION_COOKIE, session, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 2592000 });
  return response;
}
const DUPLICATE = 'You have already shared your feedback. Thank you!';

/** App feedback: a 1-5 star rating with an optional comment, one per browser. It never identifies an attendee. */
export async function POST(request: NextRequest) {
  const session = sessionId(request);
  try {
    const input = await request.json().catch(() => null);
    const rating = Number(input?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return reply(session, { success: false, error: 'Choose a rating from 1 to 5 stars.' }, 400);
    }
    await connectDB();
    if (await Feedback.exists({ sessionId: session, scope: 'application' })) {
      return reply(session, { success: false, duplicate: true, error: DUPLICATE }, 409);
    }
    try {
      await Feedback.create({ sessionId: session, scope: 'application', rating, message: text(input?.message).slice(0, 500), submittedAt: new Date() });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        return reply(session, { success: false, duplicate: true, error: DUPLICATE }, 409);
      }
      throw error;
    }
    return reply(session, { success: true });
  } catch (error) {
    console.error('Feedback submission failed:', error);
    return reply(session, { success: false, error: 'Unable to send feedback. Please retry.' }, 500);
  }
}

export async function GET(request: NextRequest) {
  const session = sessionId(request);
  try {
    await connectDB();
    const submitted = await Feedback.exists({ sessionId: session, scope: 'application' });
    return reply(session, { success: true, submitted: Boolean(submitted) });
  } catch (error) {
    console.error('Feedback status failed:', error);
    return reply(session, { success: false, error: 'Unable to check feedback status.' }, 500);
  }
}
