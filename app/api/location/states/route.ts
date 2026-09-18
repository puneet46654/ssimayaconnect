import {
  NextRequest,
  NextResponse,
} from 'next/server';

type StateRecord = {
  name?: string;
  state_code?: string;
};

const STATES_URL =
  'https://countriesnow.space/api/v0.1/countries/states';

export async function GET(
  request: NextRequest,
) {
  try {
    const country =
      request.nextUrl.searchParams
        .get('country')
        ?.trim();

    if (!country) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Country is required.',
        },
        {
          status: 400,
        },
      );
    }

    const response =
      await fetch(
        STATES_URL,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            country,
          }),

          cache: 'no-store',
        },
      );

    if (!response.ok) {
      throw new Error(
        'State service is unavailable.',
      );
    }

    const data =
      await response.json();

    const states =
      Array.isArray(
        data?.data?.states,
      )
        ? (
            data.data
              .states as StateRecord[]
          )
            .filter(
              (state) =>
                Boolean(
                  state.name,
                ),
            )
            .map(
              (state) => ({
                name:
                  state.name!.trim(),

                code:
                  state.state_code ||
                  '',
              }),
            )
            .sort(
              (a, b) =>
                a.name.localeCompare(
                  b.name,
                ),
            )
        : [];

    return NextResponse.json({
      success: true,
      states,
    });
  } catch (error: unknown) {
    console.error(
      'Failed to load states:',
      error,
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : 'Failed to load states.',
      },
      {
        status: 500,
      },
    );
  }
}