import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Liveness check for the load balancer and container health checks.
export function GET() {
  return NextResponse.json(
    { ok: true, pid: process.pid, uptime: Math.round(process.uptime()) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
