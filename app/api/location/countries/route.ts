import { NextResponse } from 'next/server';

type CountryCodeRecord = {
  name?: string;
  code?: string;
  dial_code?: string;
};

type FlagRecord = {
  name?: string;
  unicodeFlag?: string;
  iso2?: string;
};

type CountryOption = {
  name: string;
  iso2: string;
  callingCode: string;
  flag: string;
};

const BASE_URL =
  'https://countriesnow.space/api/v0.1/countries';

export async function GET() {
  try {
    const [
      codesResponse,
      flagsResponse,
    ] = await Promise.all([
      fetch(
        `${BASE_URL}/codes`,
        {
          method: 'GET',

          next: {
            revalidate:
              60 * 60 * 24,
          },
        },
      ),

      fetch(
        `${BASE_URL}/flag/unicode`,
        {
          method: 'GET',

          next: {
            revalidate:
              60 * 60 * 24,
          },
        },
      ),
    ]);

    if (
      !codesResponse.ok ||
      !flagsResponse.ok
    ) {
      throw new Error(
        'Country service is unavailable.',
      );
    }

    const codesJson =
      await codesResponse.json();

    const flagsJson =
      await flagsResponse.json();

    const codes =
      Array.isArray(
        codesJson?.data,
      )
        ? (codesJson.data as CountryCodeRecord[])
        : [];

    const flags =
      Array.isArray(
        flagsJson?.data,
      )
        ? (flagsJson.data as FlagRecord[])
        : [];

    const flagByName =
      new Map<
        string,
        FlagRecord
      >();

    for (
      const item of flags
    ) {
      if (!item.name) {
        continue;
      }

      flagByName.set(
        item.name
          .trim()
          .toLowerCase(),
        item,
      );
    }

    const countries:
      CountryOption[] = [];

    for (
      const country of
        codes
    ) {
      const name =
        country.name?.trim();

      const iso2 =
        country.code
          ?.trim()
          .toUpperCase();

      const callingCode =
        country.dial_code
          ?.trim();

      if (
        !name ||
        !iso2 ||
        !callingCode
      ) {
        continue;
      }

      const flagRecord =
        flagByName.get(
          name.toLowerCase(),
        );

      countries.push({
        name,
        iso2,
        callingCode,
        flag:
          flagRecord?.unicodeFlag ||
          isoToFlag(iso2),
      });
    }

    countries.sort(
      (a, b) =>
        a.name.localeCompare(
          b.name,
        ),
    );

    return NextResponse.json({
      success: true,
      countries,
    });
  } catch (error: unknown) {
    console.error(
      'Failed to load countries:',
      error,
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : 'Failed to load countries.',
      },
      {
        status: 500,
      },
    );
  }
}

function isoToFlag(
  iso2: string,
) {
  if (
    iso2.length !== 2
  ) {
    return '🌐';
  }

  return iso2
    .toUpperCase()
    .split('')
    .map((character) =>
      String.fromCodePoint(
        127397 +
          character.charCodeAt(
            0,
          ),
      ),
    )
    .join('');
}