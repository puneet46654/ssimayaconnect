import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  connectDB,
} from '@/lib/db';

import {
  Booking,
} from '@/models/Booking';

import '@/models/Event';
import '@/models/Slot';
import '@/models/DaySchedule';

export const dynamic =
  'force-dynamic';

export const revalidate =
  0;


/* ============================================================
   TYPES
============================================================ */

type TicketStatus =
  | 'ACTIVE'
  | 'EXPIRED'
  | 'ATTENDED';



/* ============================================================
   GET MY TICKETS
============================================================ */

export async function GET(
  request: NextRequest,
) {

  try {

    await connectDB();



    const {
      searchParams,
    } =
      new URL(
        request.url,
      );



    const mobile =
      searchParams
        .get('mobile')
        ?.trim();



    if (!mobile) {

      return NextResponse.json(
        {
          success:
            false,

          message:
            'Mobile number is required.',
        },
        {
          status:
            400,
        },
      );

    }



    const normalizedMobile =
      normalizeMobile(
        mobile,
      );

    const email =
      searchParams.get('email')?.trim().toLowerCase() || '';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return NextResponse.json(
        { success: false, message: 'Enter the email address used for booking.' },
        { status: 400 },
      );
    }

    if (normalizedMobile.length < 7) {
      return NextResponse.json(
        { success: false, message: 'Enter your full mobile number.' },
        { status: 400 },
      );
    }

    // Full-number match only: a partial match would expose other people's tickets.
    const mobilePattern = `${normalizedMobile.split('').join('\\D*')}$`;



    const bookings =
      await Booking.find(
        {
          'details.email':
            email,

          $or: [

            {
              'details.mobile':
                {
                  $regex:
                    mobilePattern,
                },
            },


            {
              'details.phone':
                {
                  $regex:
                    mobilePattern,
                },
            },

          ],
        },
      )
      .populate(
        {
          path:
            'eventId',

          select:
            'eventName venue imageUrl updatedAt startDate endDate status',
        },
      )
      .populate(
        {
          path:
            'slotId',

          select:
            'startTime endTime',
        },
      )
      .populate(
        {
          path:
            'dayScheduleId',

          select:
            'date',
        },
      )
      .sort(
        {
          createdAt:
            -1,
        },
      )
      .lean();



    const tickets =
      bookings.map(
        (
          booking,
        ) => {


          const event =
            getObject(
              booking.eventId,
            );


          const slot =
            getObject(
              booking.slotId,
            );


          const schedule =
            getObject(
              booking.dayScheduleId,
            );



          const status =
            calculateTicketStatus(
              booking,
              slot,
              schedule,
            );



          return {

            bookingId:
              booking.bookingId,


            eventId:
              String(
                event._id ||
                booking.eventId ||
                '',
              ),


            eventName:
              String(
                event.eventName ||
                'Event',
              ),


            venue:
              String(
                event.venue ||
                '',
              ),


            imageUrl:
              event.imageUrl
                ? `/api/events/${String(
                    event._id ||
                    booking.eventId ||
                    '',
                  )}/image?v=${new Date(
                    event.updatedAt ||
                    Date.now(),
                  ).getTime()}`
                : '',


            date:
              (schedule.date || event.startDate ? new Date(schedule.date || event.startDate).toISOString() : ''),


            startTime:
              String(
                slot.startTime ||
                '',
              ),


            endTime:
              String(
                slot.endTime ||
                '',
              ),


            status,


            attendanceStatus:
              booking.attendanceStatus ||
              'NOT_PRESENT',


            checkedInAt:
              booking.checkedInAt ||
              null,


            checkedInBy:
              booking.checkedInBy ||
              '',


            checkInMethod:
              booking.checkInMethod ||
              '',



            qrData:
              JSON.stringify(
                {
                  type:
                    'SSI_MAYA_CONNECT_ATTENDANCE',

                  doctorId:
                    String(
                      booking._id ||
                      '',
                    ),

                  bookingId:
                    booking.bookingId,

                  eventId:
                    String(
                      event._id ||
                      booking.eventId ||
                      '',
                    ),
                },
              ),


          };

        },
      );



    return NextResponse.json(
      {
        success:
          true,

        tickets,
      },
      {
        status:
          200,
      },
    );


  } catch (
    error
  ) {


    console.error(
      'My tickets API error:',
      error,
    );



    return NextResponse.json(
      {
        success:
          false,

        message:
          'Unable to fetch tickets.',
      },
      {
        status:
          500,
      },
    );

  }

}



/* ============================================================
   STATUS CALCULATION
============================================================ */


function calculateTicketStatus(
  booking:
    any,

  slot:
    any,

  schedule:
    any,

): TicketStatus {


  /*
    Admin scan completed
  */

  if (
    booking.attendanceStatus ===
    'PRESENT'
  ) {

    return 'ATTENDED';

  }



  if (
    !schedule.date ||
    !slot.endTime
  ) {

    return 'ACTIVE';

  }



  const expiry =
    new Date(
      `${formatDate(
        schedule.date,
      )}T${slot.endTime}:00+05:30`,
    );



  if (
    Number.isNaN(
      expiry.getTime(),
    )
  ) {

    return 'ACTIVE';

  }



  if (
    Date.now() >
    expiry.getTime()
  ) {

    return 'EXPIRED';

  }



  return 'ACTIVE';

}



/* ============================================================
   MOBILE
============================================================ */


function normalizeMobile(
  value:
    string,
) {

  return value
    .replace(
      /\D/g,
      '',
    )
    .slice(
      -10,
    );

}



/* ============================================================
   DATE
============================================================ */


function formatDate(
  value:
    string,
) {

  const date =
    new Date(
      value,
    );



  const year =
    date.getUTCFullYear();



  const month =
    String(
      date.getUTCMonth()+1,
    )
    .padStart(
      2,
      '0',
    );



  const day =
    String(
      date.getUTCDate(),
    )
    .padStart(
      2,
      '0',
    );



  return `${year}-${month}-${day}`;

}



/* ============================================================
   OBJECT
============================================================ */


function getObject(
  value:
    unknown,
) {


  if (
    typeof value ===
    'object' &&
    value !==
    null
  ) {

    return value as Record<
      string,
      any
    >;

  }


  return {};

}