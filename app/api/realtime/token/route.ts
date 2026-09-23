import Ably from 'ably';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  const apiKey = process.env.ABLY_API_KEY?.trim();

  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error: 'Realtime service is not configured.',
      },
      { status: 503 },
    );
  }

  try {
    const ably = new Ably.Rest(apiKey);
    const tokenRequest = await ably.auth.createTokenRequest({
      clientId: 'ssimaya-web',
    });

    return NextResponse.json(tokenRequest, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    console.error(
      'Failed to create Ably token request:',
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: 'Unable to connect to realtime service.',
      },
      { status: 500 },
    );
  }
}
