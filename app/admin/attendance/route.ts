import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: 'Attendance tracking is not available yet.',
    },
    {
      status: 501,
    },
  );
}