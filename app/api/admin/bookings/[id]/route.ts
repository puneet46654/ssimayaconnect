import {
  NextRequest,
  NextResponse,
} from 'next/server';

import mongoose from 'mongoose';

import {
  connectDB,
} from '@/lib/db';

import {
  requireAdminSession,
} from '@/lib/admin-server-auth';

import {
  Booking,
} from '@/models/Booking';

import {
  Slot,
} from '@/models/Slot';

import '@/models/Event';
import '@/models/DaySchedule';

/* ============================================================
   PARAM TYPE
============================================================ */

type RouteContext = {
  params:
    Promise<{
      id: string;
    }>;
};

/* ============================================================
   AUTH
============================================================ */

async function authorize() {
  return await requireAdminSession();
}

/* ============================================================
   GET
============================================================ */

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    if (
      !(await authorize())
    ) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            'Unauthorized.',
        },
        {
          status:
            401,
        },
      );
    }

    const {
      id,
    } =
      await context.params;

    if (
      !mongoose.Types.ObjectId.isValid(
        id,
      )
    ) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            'Invalid booking ID.',
        },
        {
          status:
            400,
        },
      );
    }

    await connectDB();

    const booking =
      await getBooking(
        id,
      );

    if (!booking) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            'Booking not found.',
        },
        {
          status:
            404,
        },
      );
    }

    return NextResponse.json(
      {
        success:
          true,

        booking:
          serialize(
            booking,
          ),
      },
    );
  } catch (error) {
    console.error(
      'Booking GET failed:',
      error,
    );

    return NextResponse.json(
      {
        success:
          false,

        message:
          'Unable to load booking.',
      },
      {
        status:
          500,
      },
    );
  }
}

/* ============================================================
   PATCH
============================================================ */

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    if (
      !(await authorize())
    ) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            'Unauthorized.',
        },
        {
          status:
            401,
        },
      );
    }

    const {
      id,
    } =
      await context.params;

    if (
      !mongoose.Types.ObjectId.isValid(
        id,
      )
    ) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            'Invalid booking ID.',
        },
        {
          status:
            400,
        },
      );
    }

    const body =
      await request.json();

    if (
      !body ||
      typeof body !==
        'object' ||
      !body.details ||
      typeof body.details !==
        'object' ||
      Array.isArray(
        body.details,
      )
    ) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            'Valid booking details are required.',
        },
        {
          status:
            400,
        },
      );
    }

    const details =
      sanitizeDetails(
        body.details as Record<
          string,
          unknown
        >,
      );

    if (
      !details.fullName?.trim()
    ) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            'Full name cannot be empty.',
        },
        {
          status:
            400,
        },
      );
    }

    if (
      !details.email?.trim()
    ) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            'Email cannot be empty.',
        },
        {
          status:
            400,
        },
      );
    }

    if (
      !details.mobile?.trim()
    ) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            'Mobile cannot be empty.',
        },
        {
          status:
            400,
        },
      );
    }

    await connectDB();

    const booking =
      await Booking.findById(
        id,
      );

    if (!booking) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            'Booking not found.',
        },
        {
          status:
            404,
        },
      );
    }

    /*
     * Merge instead of replacing blindly.
     * Existing unknown fields stay safe.
     */
    booking.details = {
      ...(booking.details ||
        {}),
      ...details,
    };

    await booking.save();

    const updated =
      await getBooking(
        id,
      );

    return NextResponse.json(
      {
        success:
          true,

        message:
          'Booking updated successfully.',

        booking:
          serialize(
            updated,
          ),
      },
    );
  } catch (error) {
    console.error(
      'Booking PATCH failed:',
      error,
    );

    return NextResponse.json(
      {
        success:
          false,

        message:
          'Unable to update booking.',
      },
      {
        status:
          500,
      },
    );
  }
}

/* ============================================================
   DELETE
============================================================ */

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    if (
      !(await authorize())
    ) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            'Unauthorized.',
        },
        {
          status:
            401,
        },
      );
    }

    const {
      id,
    } =
      await context.params;

    if (
      !mongoose.Types.ObjectId.isValid(
        id,
      )
    ) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            'Invalid booking ID.',
        },
        {
          status:
            400,
        },
      );
    }

    await connectDB();

    const booking =
      await Booking.findById(
        id,
      );

    if (!booking) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            'Booking not found.',
        },
        {
          status:
            404,
        },
      );
    }

    const slotId =
      booking.slotId;

    await Booking.deleteOne({
      _id:
        booking._id,
    });

    /*
     * Return one capacity unit to the slot.
     * Never allow bookedCount below zero.
     */
    if (
      slotId &&
      mongoose.Types.ObjectId.isValid(
        String(
          slotId,
        ),
      )
    ) {
      await Slot.updateOne(
        {
          _id:
            slotId,

          bookedCount: {
            $gt:
              0,
          },
        },
        {
          $inc: {
            bookedCount:
              -1,
          },
        },
      );
    }

    return NextResponse.json(
      {
        success:
          true,

        message:
          'Booking deleted successfully.',
      },
    );
  } catch (error) {
    console.error(
      'Booking DELETE failed:',
      error,
    );

    return NextResponse.json(
      {
        success:
          false,

        message:
          'Unable to delete booking.',
      },
      {
        status:
          500,
      },
    );
  }
}

/* ============================================================
   BOOKING QUERY
============================================================ */

async function getBooking(
  id: string,
) {
  return Booking.findById(
    id,
  )
    .populate({
      path:
        'eventId',
    })
    .populate({
      path:
        'slotId',
    })
    .populate({
      path:
        'dayScheduleId',
    })
    .lean();
}

/* ============================================================
   SANITIZE DETAILS
============================================================ */

function sanitizeDetails(
  input:
    Record<
      string,
      unknown
    >,
) {
  const output:
    Record<
      string,
      string
    > = {};

  for (
    const [
      rawKey,
      value,
    ] of Object.entries(
      input,
    )
  ) {
    const key =
      rawKey.trim();

    /*
     * Prevent unsafe Mongo object keys.
     */
    if (
      !key ||
      key.startsWith(
        '$',
      ) ||
      key.includes(
        '.',
      ) ||
      key ===
        '__proto__' ||
      key ===
        'constructor' ||
      key ===
        'prototype'
    ) {
      continue;
    }

    /*
     * Booking model expects details values
     * to be strings.
     */
    if (
      typeof value ===
      'string'
    ) {
      output[key] =
        value.trim();
    } else if (
      value ===
        null ||
      value ===
        undefined
    ) {
      output[key] =
        '';
    } else {
      output[key] =
        String(
          value,
        );
    }
  }

  return output;
}

/* ============================================================
   SERIALIZE
============================================================ */

function serialize(
  value: unknown,
): unknown {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return value;
  }

  if (
    value instanceof
    Date
  ) {
    return value.toISOString();
  }

  if (
    value instanceof
    mongoose.Types.ObjectId
  ) {
    return value.toString();
  }

  if (
    Array.isArray(
      value,
    )
  ) {
    return value.map(
      serialize,
    );
  }

  if (
    typeof value ===
    'object'
  ) {
    const result:
      Record<
        string,
        unknown
      > = {};

    for (
      const [
        key,
        item,
      ] of Object.entries(
        value as Record<
          string,
          unknown
        >,
      )
    ) {
      result[key] =
        serialize(
          item,
        );
    }

    return result;
  }

  return value;
}
