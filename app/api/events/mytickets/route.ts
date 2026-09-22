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



    const bookings =
      await Booking.find(
        {
          $or: [

            {
              'details.mobile':
                {
                  $regex:
                    normalizedMobile,

                  $options:
                    'i',
                },
            },


            {
              'details.phone':
                {
                  $regex:
                    normalizedMobile,

                  $options:
                    'i',
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
            'eventName venue imageUrl startDate endDate status',
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
              String(
                event.imageUrl ||
                '',
              ),


            date:
              String(
                schedule.date ||
                event.startDate ||
                '',
              ),


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
                  bookingId:
                    booking.bookingId,

                  eventId:
                    String(
                      event._id ||
                      booking.eventId ||
                      '',
                    ),

                  slotId:
                    String(
                      booking.slotId ||
                      '',
                    ),

                  dayScheduleId:
                    String(
                      booking.dayScheduleId ||
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
      )}T${slot.endTime}`,
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
    date.getFullYear();



  const month =
    String(
      date.getMonth()+1,
    )
    .padStart(
      2,
      '0',
    );



  const day =
    String(
      date.getDate(),
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