'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  useParams,
  useRouter,
  useSearchParams,
} from 'next/navigation';

import {
  motion,
} from 'framer-motion';

import {
  QRCodeSVG,
} from 'qrcode.react';

import {
  toPng,
} from 'html-to-image';

import {
  trackActivity,
} from '@/lib/activity-client';

/* ============================================================
   TYPES
============================================================ */

type BookingDetails = {
  eventId?: string;

  eventName?: string;

  template?: string;

  designation?: string;

  title?: string;

  fullName?: string;

  specialty?: string;

  mobile?: string;

  countryCode?: string;

  phoneCountry?: string;

  email?: string;

  hospitalName?: string;

  country?: string;

  countryIso2?: string;

  state?: string;

  city?: string;

  [key: string]:
    string | undefined;
};

type SlotSelection = {
  eventId?: string;

  dayScheduleId?: string;

  date?: string;

  slotId?: string;

  startTime?: string;

  endTime?: string;
};

type AttendanceStatus =
  | 'NOT_PRESENT'
  | 'PRESENT';

type BookingState =
  | 'loading'
  | 'creating'
  | 'ready'
  | 'error';

type ServerBooking = {
  id: string;

  bookingId: string;

  eventId: string;

  attendanceStatus:
    AttendanceStatus;

  checkedInAt:
    string | null;
};

type BookingApiResponse = {
  success?: boolean;

  existing?: boolean;

  error?: string;

  message?: string;

  booking?:
    ServerBooking;
};

/* ============================================================
   CONSTANTS
============================================================ */

const EASE = [
  0.22,
  1,
  0.36,
  1,
] as const;

/* ============================================================
   PAGE
============================================================ */

export default function BookingConfirmationPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const router =
    useRouter();

  const searchParams =
    useSearchParams();

  const eventId =
    params.id;

  const ticketRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const bookingStartedRef =
    useRef(false);

  /* ==========================================================
     BOOKING DATA
  ========================================================== */

  const [
    bookingDetails,
    setBookingDetails,
  ] =
    useState<BookingDetails | null>(
      null,
    );

  const [
    slotSelection,
    setSlotSelection,
  ] =
    useState<SlotSelection | null>(
      null,
    );

  const [
    dataLoaded,
    setDataLoaded,
  ] = useState(false);

  /* ==========================================================
     SERVER BOOKING
  ========================================================== */

  const [
    bookingState,
    setBookingState,
  ] =
    useState<BookingState>(
      'loading',
    );

  const [
    bookingId,
    setBookingId,
  ] = useState('');

  const [
    bookingMongoId,
    setBookingMongoId,
  ] = useState('');

  const [
    bookingError,
    setBookingError,
  ] = useState('');

  /* ==========================================================
     ATTENDANCE
  ========================================================== */

  const [
    attendanceStatus,
    setAttendanceStatus,
  ] =
    useState<AttendanceStatus>(
      'NOT_PRESENT',
    );

  const [
    checkedInAt,
    setCheckedInAt,
  ] =
    useState<string | null>(
      null,
    );

  const [
    attendanceLoaded,
    setAttendanceLoaded,
  ] = useState(false);

  /* ==========================================================
     DOWNLOAD
  ========================================================== */

  const [
    downloading,
    setDownloading,
  ] = useState(false);

  const [
    downloaded,
    setDownloaded,
  ] = useState(false);

  /* ==========================================================
     ACTIVITY
  ========================================================== */

  useEffect(() => {
    if (!eventId) {
      return;
    }

    void trackActivity(
      'confirmation_viewed',
      {
        eventId,
      },
    );
  }, [
    eventId,
  ]);

  /* ==========================================================
     LOAD BOOKING FORM DATA

     IMPORTANT:
     No fake / demo booking is used.
  ========================================================== */

  useEffect(() => {
    if (!eventId) {
      return;
    }

    try {
      const detailsRaw =
        sessionStorage.getItem(
          `ssi-booking-details:${eventId}`,
        );

      const slotRaw =
        sessionStorage.getItem(
          `ssi-booking-slot:${eventId}`,
        );

      if (
        !detailsRaw ||
        !slotRaw
      ) {
        setBookingError(
          'Booking information could not be found. Please complete the booking form again.',
        );

        setBookingState(
          'error',
        );

        setDataLoaded(
          true,
        );

        return;
      }

      const parsedDetails =
        JSON.parse(
          detailsRaw,
        ) as BookingDetails;

      const parsedSlot =
        JSON.parse(
          slotRaw,
        ) as SlotSelection;

      setBookingDetails(
        parsedDetails,
      );

      setSlotSelection(
        parsedSlot,
      );

      setDataLoaded(
        true,
      );
    } catch (error) {
      console.error(
        'Unable to restore booking data:',
        error,
      );

      setBookingError(
        'Booking information is invalid. Please complete the booking form again.',
      );

      setBookingState(
        'error',
      );

      setDataLoaded(
        true,
      );
    }
  }, [
    eventId,
  ]);

  /* ==========================================================
     APPLY SERVER BOOKING
  ========================================================== */

  const applyServerBooking =
    useCallback(
      (
        booking:
          ServerBooking,
      ) => {
        setBookingId(
          booking.bookingId,
        );

        setBookingMongoId(
          booking.id,
        );

        setAttendanceStatus(
          booking.attendanceStatus ||
            'NOT_PRESENT',
        );

        setCheckedInAt(
          booking.checkedInAt ??
            null,
        );

        setAttendanceLoaded(
          true,
        );

        setBookingState(
          'ready',
        );

        setBookingError(
          '',
        );

        sessionStorage.setItem(
          `ssi-server-booking-id:${eventId}`,
          booking.bookingId,
        );

        sessionStorage.setItem(
          `ssi-server-booking-mongo-id:${eventId}`,
          booking.id,
        );

        /*
         * Remove old booking ID generated by
         * older frontend-only versions.
         */
        sessionStorage.removeItem(
          `ssi-booking-id:${eventId}`,
        );
      },
      [
        eventId,
      ],
    );

  /* ==========================================================
     CREATE BOOKING
  ========================================================== */

  const createServerBooking =
    useCallback(
      async () => {
        if (
          !bookingDetails ||
          !slotSelection
        ) {
          throw new Error(
            'Booking details are not available.',
          );
        }

        if (
          !bookingDetails.fullName ||
          !bookingDetails.email ||
          !bookingDetails.mobile
        ) {
          throw new Error(
            'Attendee information is incomplete.',
          );
        }

        if (
          !slotSelection.slotId ||
          !slotSelection.dayScheduleId
        ) {
          throw new Error(
            'Selected booking slot is incomplete.',
          );
        }

        setBookingState(
          'creating',
        );

        setBookingError(
          '',
        );

        const response =
          await fetch(
            '/api/bookings',
            {
              method:
                'POST',

              credentials:
                'include',

              cache:
                'no-store',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body:
                JSON.stringify({
                  eventId,

                  slotId:
                    slotSelection.slotId,

                  dayScheduleId:
                    slotSelection.dayScheduleId,

                  details:
                    bookingDetails,
                }),
            },
          );

        const data =
          (await response.json()) as BookingApiResponse;

        if (
          !response.ok ||
          !data.success ||
          !data.booking
        ) {
          throw new Error(
            data.error ||
              data.message ||
              'Unable to create booking.',
          );
        }

        applyServerBooking(
          data.booking,
        );

        return data.booking;
      },
      [
        applyServerBooking,
        bookingDetails,
        eventId,
        slotSelection,
      ],
    );

  /* ==========================================================
     VERIFY EXISTING BOOKING

     This fixes the main bug.

     Browser storage is NEVER considered proof of a booking.
     MongoDB must confirm it first.
  ========================================================== */

  const restoreOrCreateBooking =
    useCallback(
      async () => {
        if (
          !dataLoaded ||
          !bookingDetails ||
          !slotSelection
        ) {
          return;
        }

        setBookingError(
          '',
        );

        setBookingState(
          'loading',
        );

        const serverBookingKey =
          `ssi-server-booking-id:${eventId}`;

        const serverMongoKey =
          `ssi-server-booking-mongo-id:${eventId}`;

        /*
         * Legacy frontend-only ID.
         *
         * Never use this as a real booking.
         */
        sessionStorage.removeItem(
          `ssi-booking-id:${eventId}`,
        );

        const storedBookingId =
          sessionStorage.getItem(
            serverBookingKey,
          );

        /* ====================================================
           NO STORED SERVER BOOKING
        ==================================================== */

        if (
          !storedBookingId
        ) {
          await createServerBooking();

          return;
        }

        /* ====================================================
           VERIFY STORED BOOKING AGAINST MONGODB
        ==================================================== */

        try {
          const response =
            await fetch(
              `/api/bookings?bookingId=${encodeURIComponent(
                storedBookingId,
              )}`,
              {
                method:
                  'GET',

                cache:
                  'no-store',
              },
            );

          /*
           * Stale browser booking.
           *
           * Mongo says it does not exist.
           */
          if (
            response.status ===
            404
          ) {
            sessionStorage.removeItem(
              serverBookingKey,
            );

            sessionStorage.removeItem(
              serverMongoKey,
            );

            setBookingId(
              '',
            );

            setBookingMongoId(
              '',
            );

            await createServerBooking();

            return;
          }

          const data =
            (await response.json()) as BookingApiResponse;

          if (
            !response.ok ||
            !data.success ||
            !data.booking
          ) {
            throw new Error(
              data.message ||
                data.error ||
                'Unable to verify booking.',
            );
          }

          /*
           * MongoDB confirmed booking.
           */
          applyServerBooking(
            data.booking,
          );
        } catch (error) {
          /*
           * Do NOT silently display stored ID when
           * database verification fails.
           */
          throw error;
        }
      },
      [
        applyServerBooking,
        bookingDetails,
        createServerBooking,
        dataLoaded,
        eventId,
        slotSelection,
      ],
    );

  /* ==========================================================
     INITIAL BOOKING SYNC
  ========================================================== */

  useEffect(() => {
    if (
      !dataLoaded ||
      !bookingDetails ||
      !slotSelection ||
      bookingStartedRef.current
    ) {
      return;
    }

    bookingStartedRef.current =
      true;

    let cancelled =
      false;

    async function start() {
      try {
        await restoreOrCreateBooking();
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error(
          'Booking confirmation failed:',
          error,
        );

        setBookingState(
          'error',
        );

        setBookingError(
          error instanceof
            Error
            ? error.message
            : 'Unable to confirm booking.',
        );
      }
    }

    void start();

    return () => {
      cancelled =
        true;
    };
  }, [
    bookingDetails,
    dataLoaded,
    restoreOrCreateBooking,
    slotSelection,
  ]);

  /* ==========================================================
     RETRY
  ========================================================== */

  async function retryBooking() {
    bookingStartedRef.current =
      true;

    try {
      await restoreOrCreateBooking();
    } catch (error) {
      console.error(
        'Booking retry failed:',
        error,
      );

      setBookingState(
        'error',
      );

      setBookingError(
        error instanceof
          Error
          ? error.message
          : 'Unable to confirm booking.',
      );
    }
  }

  /* ==========================================================
     BOOKING COMPLETE ACTIVITY

     Track only after MongoDB has confirmed it.
  ========================================================== */

  useEffect(() => {
    if (
      bookingState !==
        'ready' ||
      !bookingId ||
      !bookingMongoId
    ) {
      return;
    }

    void trackActivity(
      'booking_completed',
      {
        eventId,

        metadata: {
          bookingId,

          bookingMongoId,

          bookingDetails,

          slotSelection,
        },
      },
    );
  }, [
    bookingDetails,
    bookingId,
    bookingMongoId,
    bookingState,
    eventId,
    slotSelection,
  ]);

  /* ==========================================================
     ATTENDANCE POLLING
  ========================================================== */

  useEffect(() => {
    if (
      bookingState !==
        'ready' ||
      !bookingId
    ) {
      return;
    }

    let cancelled =
      false;

    async function checkAttendance() {
      try {
        const response =
          await fetch(
            `/api/bookings?bookingId=${encodeURIComponent(
              bookingId,
            )}`,
            {
              method:
                'GET',

              cache:
                'no-store',
            },
          );

        const data =
          (await response.json()) as BookingApiResponse;

        if (
          cancelled ||
          !response.ok ||
          !data.success ||
          !data.booking
        ) {
          return;
        }

        setBookingMongoId(
          data.booking.id,
        );

        setAttendanceStatus(
          data.booking
            .attendanceStatus ||
            'NOT_PRESENT',
        );

        setCheckedInAt(
          data.booking
            .checkedInAt ??
            null,
        );

        setAttendanceLoaded(
          true,
        );

        sessionStorage.setItem(
          `ssi-server-booking-mongo-id:${eventId}`,
          data.booking.id,
        );
      } catch {
        /*
         * Temporary network errors should not
         * destroy a confirmed ticket.
         */
      }
    }

    void checkAttendance();

    const interval =
      window.setInterval(
        () => {
          void checkAttendance();
        },
        2500,
      );

    return () => {
      cancelled =
        true;

      window.clearInterval(
        interval,
      );
    };
  }, [
    bookingId,
    bookingState,
    eventId,
  ]);

  /* ==========================================================
     FEEDBACK REDIRECT

     Only after MongoDB confirms booking.
  ========================================================== */

  useEffect(() => {
    if (
      bookingState !==
      'ready'
    ) {
      return;
    }

    const skipped =
      searchParams.get(
        'feedback',
      ) ===
      'skipped';

    if (skipped) {
      return;
    }

    const state =
      sessionStorage.getItem(
        `ssi-feedback-state:${eventId}`,
      );

    if (
      state ===
      'submitted'
    ) {
      return;
    }

    const timer =
      window.setTimeout(
        () => {
          window.location.assign(
            `/events/${eventId}/book/feedback`,
          );
        },
        3000,
      );

    return () => {
      window.clearTimeout(
        timer,
      );
    };
  }, [
    bookingState,
    eventId,
    searchParams,
  ]);

  /* ==========================================================
     COMPUTED
  ========================================================== */

  const bookingReady =
    bookingState ===
      'ready' &&
    Boolean(
      bookingId,
    ) &&
    Boolean(
      bookingMongoId,
    );

  const active =
    attendanceStatus ===
    'PRESENT';

  const displayName =
    useMemo(() => {
      const title =
        bookingDetails
          ?.title
          ?.trim() ||
        '';

      const name =
        bookingDetails
          ?.fullName
          ?.trim() ||
        '';

      if (
        title &&
        name &&
        !name
          .toLowerCase()
          .startsWith(
            title.toLowerCase(),
          )
      ) {
        return `${title} ${name}`;
      }

      return (
        name ||
        'Attendee'
      );
    }, [
      bookingDetails,
    ]);

  const formattedDate =
    useMemo(() => {
      if (
        !slotSelection
          ?.date
      ) {
        return '—';
      }

      const date =
        new Date(
          slotSelection.date,
        );

      if (
        Number.isNaN(
          date.getTime(),
        )
      ) {
        return slotSelection.date;
      }

      return new Intl.DateTimeFormat(
        'en-GB',
        {
          weekday:
            'short',

          day:
            '2-digit',

          month:
            'short',

          year:
            'numeric',
        },
      ).format(
        date,
      );
    }, [
      slotSelection,
    ]);

  const formattedTime =
    useMemo(() => {
      const start =
        slotSelection
          ?.startTime;

      const end =
        slotSelection
          ?.endTime;

      if (
        !start ||
        !end
      ) {
        return '—';
      }

      return `${start} – ${end}`;
    }, [
      slotSelection,
    ]);

  /* ==========================================================
     QR

     QR can only exist after MongoDB booking exists.
  ========================================================== */

  const qrValue =
    useMemo(() => {
      if (
        !bookingReady
      ) {
        return '';
      }

      return JSON.stringify({
        type:
          'SSI_MAYA_CONNECT_ATTENDANCE',

        doctorId:
          bookingMongoId,

        bookingId,

        eventId,

        slotId:
          slotSelection
            ?.slotId ||
          '',

        dayScheduleId:
          slotSelection
            ?.dayScheduleId ||
          '',

        eventName:
          bookingDetails
            ?.eventName ||
          '',

        name:
          displayName,

        date:
          slotSelection
            ?.date ||
          '',

        startTime:
          slotSelection
            ?.startTime ||
          '',

        endTime:
          slotSelection
            ?.endTime ||
          '',
      });
    }, [
      bookingDetails,
      bookingId,
      bookingMongoId,
      bookingReady,
      displayName,
      eventId,
      slotSelection,
    ]);

  /* ==========================================================
     DOWNLOAD
  ========================================================== */

  async function handleDownload() {
    if (
      !bookingReady ||
      !ticketRef.current ||
      downloading
    ) {
      return;
    }

    try {
      setDownloading(
        true,
      );

      const dataUrl =
        await toPng(
          ticketRef.current,
          {
            cacheBust:
              true,

            pixelRatio:
              2,

            backgroundColor:
              '#F7F9FB',

            filter:
              (
                node,
              ) => {
                if (
                  node instanceof
                    HTMLElement &&
                  node.dataset
                    .exportIgnore ===
                    'true'
                ) {
                  return false;
                }

                return true;
              },
          },
        );

      const link =
        document.createElement(
          'a',
        );

      link.download =
        `${bookingId}.png`;

      link.href =
        dataUrl;

      link.click();

      setDownloaded(
        true,
      );

      window.setTimeout(
        () => {
          setDownloaded(
            false,
          );
        },
        1600,
      );
    } catch (error) {
      console.error(
        'Unable to download confirmation:',
        error,
      );
    } finally {
      setDownloading(
        false,
      );
    }
  }

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <main
      className="
        min-h-dvh

        overflow-x-hidden

        bg-[#F7F9FB]

        px-3

        pb-[150px]
        pt-3

        sm:px-5
        sm:pt-5

        md:flex
        md:flex-col
        md:justify-center

        md:px-6
        md:py-7
      "
    >
      <div
        className="
          mx-auto

          w-full
          max-w-[980px]
        "
      >
        {/* ==================================================
            BOOKING HEADER
        ================================================== */}

        <motion.div
          initial={{
            opacity:
              0,

            y:
              8,
          }}
          animate={{
            opacity:
              1,

            y:
              0,
          }}
          className="
            flex

            items-center
            gap-3

            rounded-xl

            border
            border-gray-200

            bg-white

            px-4
            py-3.5

            shadow-sm
          "
        >
          <div
            className={`
              grid

              h-10
              w-10

              shrink-0

              place-items-center

              rounded-full

              ${
                bookingReady
                  ? `
                      bg-primary
                      text-white
                    `
                  : bookingState ===
                      'error'
                    ? `
                        bg-red-100
                        text-red-600
                      `
                    : `
                        bg-primary/10
                        text-primary
                      `
              }
            `}
          >
            {bookingReady ? (
              <CheckIcon />
            ) : bookingState ===
              'error' ? (
              <AlertIcon />
            ) : (
              <Spinner />
            )}
          </div>

          <div
            className="
              min-w-0
              flex-1
            "
          >
            <h1
              className="
                font-heading

                text-[18px]
                font-bold

                tracking-[-0.025em]

                text-secondary

                sm:text-[21px]
              "
            >
              {bookingReady
                ? 'Booking Confirmed!'
                : bookingState ===
                    'error'
                  ? 'Booking Not Confirmed'
                  : 'Confirming Booking...'}
            </h1>

            <p
              className="
                mt-0.5

                text-[10px]
                leading-4

                text-gray-500

                sm:text-[11px]
              "
            >
              {bookingReady
                ? 'Your booking has been saved successfully.'
                : bookingState ===
                    'error'
                  ? 'We could not save this booking in the database.'
                  : 'Saving your registration securely...'}
            </p>
          </div>
        </motion.div>

        {/* ==================================================
            ERROR
        ================================================== */}

        {bookingState ===
          'error' && (
          <div
            className="
              mt-3

              rounded-xl

              border
              border-red-200

              bg-red-50

              p-4
            "
          >
            <p
              className="
                text-[12px]
                font-semibold
                text-red-700
              "
            >
              {
                bookingError
              }
            </p>

            <div
              className="
                mt-3

                flex
                flex-col
                gap-2

                sm:flex-row
              "
            >
              {bookingDetails &&
                slotSelection && (
                <button
                  type="button"
                  onClick={() =>
                    void retryBooking()
                  }
                  className="
                    btn
                    btn-primary
                  "
                >
                  Retry Booking
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/events/${eventId}/book`,
                  )
                }
                className="
                  btn
                  btn-secondary
                "
              >
                Back to Booking
              </button>
            </div>
          </div>
        )}

        {/* ==================================================
            LOADING
        ================================================== */}

        {!bookingReady &&
          bookingState !==
            'error' && (
            <BookingSkeleton />
          )}

        {/* ==================================================
            REAL CONFIRMED BOOKING ONLY
        ================================================== */}

        {bookingReady &&
          bookingDetails &&
          slotSelection && (
            <>
              <AttendanceCard
                active={
                  active
                }
                loaded={
                  attendanceLoaded
                }
                checkedInAt={
                  checkedInAt
                }
              />

              <motion.div
                ref={
                  ticketRef
                }
                initial={{
                  opacity:
                    0,

                  y:
                    10,
                }}
                animate={{
                  opacity:
                    1,

                  y:
                    0,
                }}
                transition={{
                  duration:
                    0.45,

                  ease:
                    EASE,
                }}
                className={`
                  mt-3

                  overflow-hidden

                  rounded-[18px]

                  border

                  bg-white

                  shadow-[0_10px_30px_rgba(27,75,107,0.06)]

                  md:grid
                  md:grid-cols-[310px_minmax(0,1fr)]

                  ${
                    active
                      ? 'border-emerald-300'
                      : 'border-amber-200'
                  }
                `}
              >
                {/* ============================================
                    QR
                ============================================ */}

                <section
                  className={`
                    relative

                    flex
                    flex-col

                    items-center
                    justify-center

                    border-b
                    border-gray-100

                    p-5

                    text-center

                    md:border-b-0
                    md:border-r

                    ${
                      active
                        ? 'bg-emerald-50/50'
                        : 'bg-amber-50/50'
                    }
                  `}
                >
                  {active && (
                    <motion.div
                      animate={{
                        scale: [
                          0.8,
                          1.3,
                          0.8,
                        ],

                        opacity: [
                          0.1,
                          0.3,
                          0.1,
                        ],
                      }}
                      transition={{
                        duration:
                          2.2,

                        repeat:
                          Infinity,
                      }}
                      className="
                        pointer-events-none

                        absolute

                        h-[230px]
                        w-[230px]

                        rounded-full

                        bg-emerald-200

                        blur-3xl
                      "
                    />
                  )}

                  <div
                    className={`
                      relative
                      z-10

                      rounded-[16px]

                      border

                      bg-white

                      p-3

                      shadow-sm

                      ${
                        active
                          ? 'border-emerald-300'
                          : 'border-amber-200'
                      }
                    `}
                  >
                    <QRCodeSVG
                      value={
                        qrValue
                      }
                      size={
                        170
                      }
                      level="H"
                      includeMargin={
                        false
                      }
                      bgColor="#FFFFFF"
                      fgColor="#000000"
                    />
                  </div>

                  <p
                    className="
                      relative
                      z-10

                      mt-4

                      text-[9px]
                      font-bold

                      uppercase

                      tracking-[0.08em]

                      text-amber-600
                    "
                  >
                    Your Entry Pass
                  </p>

                  <p
                    className="
                      relative
                      z-10

                      mt-1

                      break-all

                      text-[13px]
                      font-semibold

                      text-secondary
                    "
                  >
                    {
                      bookingId
                    }
                  </p>

                  <span
                    className={`
                      relative
                      z-10

                      mt-2

                      inline-flex

                      items-center
                      gap-1.5

                      rounded-full

                      px-2.5
                      py-1

                      text-[9px]
                      font-semibold

                      ${
                        active
                          ? `
                              bg-emerald-100
                              text-emerald-700
                            `
                          : `
                              bg-amber-100
                              text-amber-700
                            `
                      }
                    `}
                  >
                    <span
                      className={`
                        h-1.5
                        w-1.5

                        rounded-full

                        ${
                          active
                            ? 'bg-emerald-500'
                            : 'animate-pulse bg-amber-500'
                        }
                      `}
                    />

                    {active
                      ? 'Ticket Active'
                      : 'Awaiting Venue Scan'}
                  </span>

                  <p
                    className="
                      relative
                      z-10

                      mt-3

                      max-w-[220px]

                      text-[10px]
                      leading-4

                      text-gray-500
                    "
                  >
                    {active
                      ? 'Attendance verified successfully.'
                      : 'Present this QR code at the venue for attendance verification.'}
                  </p>

                  <button
                    type="button"
                    data-export-ignore="true"
                    onClick={() =>
                      router.push(
                        `/events/${eventId}/book/feedback`,
                      )
                    }
                    className="
                      relative
                      z-10

                      mt-3

                      inline-flex

                      h-8

                      cursor-pointer

                      items-center
                      justify-center

                      rounded-lg

                      border
                      border-primary/20

                      bg-white

                      px-3

                      text-[10px]
                      font-semibold

                      text-primary

                      hover:bg-primary/[0.04]
                    "
                  >
                    Give Feedback
                  </button>
                </section>

                {/* ============================================
                    DETAILS
                ============================================ */}

                <section
                  className="
                    p-4
                    sm:p-5
                  "
                >
                  <div
                    className="
                      flex

                      items-center
                      justify-between
                      gap-3

                      border-b
                      border-gray-100

                      pb-3
                    "
                  >
                    <div
                      className="
                        min-w-0
                      "
                    >
                      <FieldLabel>
                        Booking ID
                      </FieldLabel>

                      <p
                        className="
                          mt-0.5

                          break-all

                          text-[13px]
                          font-semibold

                          text-secondary
                        "
                      >
                        {
                          bookingId
                        }
                      </p>
                    </div>

                    <span
                      className={`
                        inline-flex
                        shrink-0

                        items-center
                        gap-1.5

                        text-[10px]
                        font-medium

                        ${
                          active
                            ? 'text-emerald-600'
                            : 'text-amber-600'
                        }
                      `}
                    >
                      <span
                        className={`
                          h-1.5
                          w-1.5

                          rounded-full

                          ${
                            active
                              ? 'bg-emerald-500'
                              : 'animate-pulse bg-amber-500'
                          }
                        `}
                      />

                      {active
                        ? 'Active'
                        : 'Not Active Yet'}
                    </span>
                  </div>

                  <div
                    className="
                      mt-4

                      grid
                      grid-cols-2

                      gap-x-5
                      gap-y-4

                      sm:grid-cols-3
                    "
                  >
                    <InfoField
                      label="Conference"
                      value={
                        bookingDetails.eventName ||
                        'Event'
                      }
                    />

                    <InfoField
                      label="Date"
                      value={
                        formattedDate
                      }
                    />

                    <InfoField
                      label="Time Slot"
                      value={
                        formattedTime
                      }
                    />
                  </div>

                  <div
                    className="
                      my-4
                      h-px
                      bg-gray-100
                    "
                  />

                  <div
                    className="
                      grid
                      grid-cols-2

                      gap-x-5
                      gap-y-4

                      sm:grid-cols-3
                    "
                  >
                    <InfoField
                      label="Name"
                      value={
                        displayName
                      }
                    />

                    {bookingDetails.designation && (
                      <InfoField
                        label="Designation"
                        value={
                          bookingDetails.designation
                        }
                      />
                    )}

                    {bookingDetails.specialty && (
                      <InfoField
                        label="Specialty"
                        value={
                          bookingDetails.specialty
                        }
                      />
                    )}

                    {bookingDetails.hospitalName && (
                      <InfoField
                        label="Hospital"
                        value={
                          bookingDetails.hospitalName
                        }
                      />
                    )}

                    {bookingDetails.email && (
                      <InfoField
                        label="Email"
                        value={
                          bookingDetails.email
                        }
                      />
                    )}

                    {bookingDetails.mobile && (
                      <InfoField
                        label="Mobile"
                        value={`${bookingDetails.countryCode || ''} ${bookingDetails.mobile}`.trim()}
                      />
                    )}

                    {(
                      bookingDetails.city ||
                      bookingDetails.state ||
                      bookingDetails.country
                    ) && (
                      <InfoField
                        label="Location"
                        value={[
                          bookingDetails.city,
                          bookingDetails.state,
                          bookingDetails.country,
                        ]
                          .filter(
                            Boolean,
                          )
                          .join(
                            ', ',
                          )}
                      />
                    )}
                  </div>
                </section>
              </motion.div>

              {/* ============================================
                  DESKTOP ACTIONS
              ============================================ */}

              <div
                className="
                  mx-auto

                  mt-3

                  hidden

                  w-full
                  max-w-[460px]

                  flex-col
                  gap-2

                  md:flex
                "
              >
                <DownloadButton
                  downloading={
                    downloading
                  }
                  downloaded={
                    downloaded
                  }
                  onClick={
                    handleDownload
                  }
                />

                <BackButton
                  onClick={() =>
                    router.push(
                      '/events',
                    )
                  }
                />
              </div>

              {/* ============================================
                  MOBILE ACTIONS
              ============================================ */}

              <div
                className="
                  fixed

                  inset-x-0
                  bottom-0

                  z-50

                  border-t
                  border-gray-200/80

                  bg-white/95

                  px-3
                  py-2

                  shadow-[0_-5px_20px_rgba(27,75,107,0.06)]

                  backdrop-blur-xl

                  md:hidden
                "
              >
                <div
                  className="
                    mx-auto

                    flex

                    max-w-[520px]

                    flex-col
                    gap-2
                  "
                >
                  <DownloadButton
                    downloading={
                      downloading
                    }
                    downloaded={
                      downloaded
                    }
                    onClick={
                      handleDownload
                    }
                  />

                  <BackButton
                    onClick={() =>
                      router.push(
                        '/events',
                      )
                    }
                  />
                </div>
              </div>
            </>
          )}
      </div>
    </main>
  );
}

/* ============================================================
   ATTENDANCE CARD
============================================================ */

function AttendanceCard({
  active,
  loaded,
  checkedInAt,
}: {
  active: boolean;

  loaded: boolean;

  checkedInAt:
    string | null;
}) {
  return (
    <motion.div
      key={
        active
          ? 'active'
          : 'waiting'
      }
      initial={{
        opacity:
          0,

        y:
          5,
      }}
      animate={{
        opacity:
          1,

        y:
          0,
      }}
      className={`
        mt-3

        rounded-xl

        border

        px-4
        py-3.5

        ${
          active
            ? `
                border-emerald-300
                bg-emerald-50
              `
            : `
                border-amber-200
                bg-amber-50
              `
        }
      `}
    >
      <div
        className="
          flex
          items-center
          gap-3
        "
      >
        <motion.div
          animate={
            active
              ? {
                  scale: [
                    1,
                    1.08,
                    1,
                  ],
                }
              : undefined
          }
          transition={
            active
              ? {
                  duration:
                    1.8,

                  repeat:
                    Infinity,
                }
              : undefined
          }
          className={`
            grid

            h-10
            w-10

            shrink-0

            place-items-center

            rounded-full

            ${
              active
                ? `
                    bg-emerald-200
                    text-emerald-700
                  `
                : `
                    bg-amber-200
                    text-amber-700
                  `
            }
          `}
        >
          {active ? (
            <CheckIcon />
          ) : (
            <ClockIcon />
          )}
        </motion.div>

        <div>
          <p
            className={`
              text-[13px]
              font-semibold

              ${
                active
                  ? 'text-emerald-800'
                  : 'text-amber-800'
              }
            `}
          >
            {!loaded
              ? 'Checking Ticket Status'
              : active
                ? 'Ticket Active'
                : 'Ticket Not Active Yet'}
          </p>

          <p
            className={`
              mt-0.5

              text-[10px]
              leading-4

              ${
                active
                  ? 'text-emerald-700'
                  : 'text-amber-700'
              }
            `}
          >
            {!loaded
              ? 'Connecting to attendance system...'
              : active
                ? `Attendance verified${
                    checkedInAt
                      ? ` at ${formatAttendanceTime(
                          checkedInAt,
                        )}`
                      : ''
                  }.`
                : 'Your ticket will activate automatically after the venue team scans your QR code.'}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

/* ============================================================
   LOADING SKELETON
============================================================ */

function BookingSkeleton() {
  return (
    <div
      className="
        mt-3

        animate-pulse
      "
    >
      <div
        className="
          h-[70px]

          rounded-xl

          border
          border-gray-200

          bg-white
        "
      />

      <div
        className="
          mt-3

          overflow-hidden

          rounded-[18px]

          border
          border-gray-200

          bg-white

          md:grid
          md:grid-cols-[310px_minmax(0,1fr)]
        "
      >
        <div
          className="
            flex

            min-h-[330px]

            items-center
            justify-center

            bg-gray-50
          "
        >
          <div
            className="
              h-[190px]
              w-[190px]

              rounded-xl

              bg-gray-100
            "
          />
        </div>

        <div
          className="
            space-y-5
            p-5
          "
        >
          <div
            className="
              h-6
              w-1/2
              rounded
              bg-gray-100
            "
          />

          <div
            className="
              grid
              grid-cols-2
              gap-4
            "
          >
            {Array.from({
              length:
                8,
            }).map(
              (
                _,
                index,
              ) => (
                <div
                  key={
                    index
                  }
                  className="
                    space-y-2
                  "
                >
                  <div
                    className="
                      h-2
                      w-14
                      rounded
                      bg-gray-100
                    "
                  />

                  <div
                    className="
                      h-4
                      w-28
                      rounded
                      bg-gray-100
                    "
                  />
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   INFO FIELD
============================================================ */

function InfoField({
  label,
  value,
}: {
  label: string;

  value: string;
}) {
  return (
    <div
      className="
        min-w-0
      "
    >
      <FieldLabel>
        {label}
      </FieldLabel>

      <p
        className="
          mt-0.5

          break-words

          text-[11px]
          font-medium

          leading-4

          text-secondary

          sm:text-[12px]
        "
      >
        {value}
      </p>
    </div>
  );
}

function FieldLabel({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <p
      className="
        text-[8px]
        font-bold

        uppercase

        tracking-[0.045em]

        text-gray-400
      "
    >
      {children}
    </p>
  );
}

/* ============================================================
   DOWNLOAD
============================================================ */

function DownloadButton({
  downloading,
  downloaded,
  onClick,
}: {
  downloading:
    boolean;

  downloaded:
    boolean;

  onClick:
    () => void;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{
        scale:
          0.985,
      }}
      disabled={
        downloading
      }
      onClick={
        onClick
      }
      className="
        flex

        h-11
        w-full

        cursor-pointer

        items-center
        justify-center
        gap-2

        rounded-xl

        bg-primary

        px-4

        text-[11px]
        font-semibold

        text-white

        shadow-sm

        hover:brightness-95

        disabled:cursor-wait
        disabled:opacity-60
      "
    >
      {downloading ? (
        <>
          <Spinner />

          Preparing...
        </>
      ) : downloaded ? (
        <>
          <CheckSmallIcon />

          Downloaded
        </>
      ) : (
        <>
          <DownloadIcon />

          Download Confirmation
        </>
      )}
    </motion.button>
  );
}

/* ============================================================
   BACK
============================================================ */

function BackButton({
  onClick,
}: {
  onClick:
    () => void;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className="
        flex

        h-11
        w-full

        cursor-pointer

        items-center
        justify-center

        rounded-xl

        border
        border-primary/60

        bg-white

        text-[11px]
        font-semibold

        text-primary

        hover:bg-primary/[0.03]
      "
    >
      Back to Events
    </button>
  );
}

/* ============================================================
   TIME
============================================================ */

function formatAttendanceTime(
  value:
    string,
) {
  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return '';
  }

  return new Intl.DateTimeFormat(
    'en-IN',
    {
      hour:
        '2-digit',

      minute:
        '2-digit',

      hour12:
        true,
    },
  ).format(
    date,
  );
}

/* ============================================================
   ICONS
============================================================ */

function Spinner() {
  return (
    <span
      className="
        h-4
        w-4

        animate-spin

        rounded-full

        border-2
        border-current/20
        border-t-current
      "
    />
  );
}

function CheckIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m5 12 4 4L19 6"
      />
    </svg>
  );
}

function CheckSmallIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.3}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m5 12 4 4L19 6"
      />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
      />

      <path
        strokeLinecap="round"
        d="M12 8v5M12 16h.01"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <circle
        cx="12"
        cy="12"
        r="8.5"
      />

      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 7.5V12l3 2"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3v12m0 0 4-4m-4 4-4-4"
      />

      <path
        strokeLinecap="round"
        d="M5 19h14"
      />
    </svg>
  );
}
