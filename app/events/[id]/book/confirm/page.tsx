'use client';

import {
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

  error?: string;

  message?: string;

  booking?:
    ServerBooking;
};

/* ============================================================
   ANIMATION
============================================================ */

const EASE = [
  0.22,
  1,
  0.36,
  1,
] as const;

/* ============================================================
   FALLBACK
============================================================ */

const DEMO_BOOKING:
  BookingDetails = {
  eventName:
    'Annual Cardiology Summit 2026',

  designation:
    'Delegate',

  title:
    'Dr.',

  fullName:
    'Ramesh Kumar',

  specialty:
    'Cardiology',

  hospitalName:
    'All India Institute of Medical Sciences',

  email:
    'dr.ramesh@hospital.com',

  mobile:
    '9876543210',

  countryCode:
    '+91',

  city:
    'New Delhi',

  country:
    'India',
};

const DEMO_SLOT:
  SlotSelection = {
  date:
    '2026-07-19T00:00:00.000Z',

  startTime:
    '10:00',

  endTime:
    '10:30',
};

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

  /* ==========================================================
     STATE
  ========================================================== */

  const [
    bookingDetails,
    setBookingDetails,
  ] =
    useState<BookingDetails>(
      DEMO_BOOKING,
    );

  const [
    slotSelection,
    setSlotSelection,
  ] =
    useState<SlotSelection>(
      DEMO_SLOT,
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
    bookingDataLoaded,
    setBookingDataLoaded,
  ] = useState(false);

  const [
    bookingError,
    setBookingError,
  ] = useState('');

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
     LOAD TEMP BOOKING DATA
  ========================================================== */

  useEffect(() => {
    if (!eventId) {
      return;
    }

    const timeoutId =
      window.setTimeout(() => {
        try {
          const detailsRaw =
            sessionStorage.getItem(
              `ssi-booking-details:${eventId}`,
            );

          const slotRaw =
            sessionStorage.getItem(
              `ssi-booking-slot:${eventId}`,
            );

          if (detailsRaw) {
            setBookingDetails(
              JSON.parse(
                detailsRaw,
              ),
            );
          }

          if (slotRaw) {
            setSlotSelection(
              JSON.parse(
                slotRaw,
              ),
            );
          }

          setBookingDataLoaded(
            true,
          );
        } catch (error) {
          console.error(
            'Unable to restore booking data:',
            error,
          );

          setBookingDataLoaded(
            true,
          );
        }
      }, 0);

    return () => {
      window.clearTimeout(
        timeoutId,
      );
    };
  }, [
    eventId,
  ]);

  /* ==========================================================
     CREATE / RESTORE SERVER BOOKING
  ========================================================== */

  useEffect(() => {
    if (
      !eventId ||
      !bookingDataLoaded ||
      !bookingDetails.fullName ||
      !bookingDetails.email ||
      !bookingDetails.mobile ||
      !slotSelection.slotId
    ) {
      return;
    }

    const bookingStorageKey =
      `ssi-server-booking-id:${eventId}`;

    const mongoStorageKey =
      `ssi-server-booking-mongo-id:${eventId}`;

    const storedBookingId =
      sessionStorage.getItem(
        bookingStorageKey,
      );

    const storedMongoId =
      sessionStorage.getItem(
        mongoStorageKey,
      );

    let cancelled =
      false;

    /* ========================================================
       RESTORE EXISTING
    ======================================================== */

    if (storedBookingId) {
      const bookingIdForRequest =
        storedBookingId;

      window.setTimeout(() => {
        setBookingId(
          bookingIdForRequest,
        );

        if (
          storedMongoId
        ) {
          setBookingMongoId(
            storedMongoId,
          );
        }
      }, 0);

      async function hydrateExisting() {
        try {
          const response =
            await fetch(
              `/api/bookings?bookingId=${encodeURIComponent(
                bookingIdForRequest,
              )}`,
              {
                cache:
                  'no-store',
              },
            );

          const data =
            (await response.json()) as BookingApiResponse;

          if (
            !response.ok ||
            !data.success ||
            !data.booking
          ) {
            return;
          }

          if (cancelled) {
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
              .checkedInAt ||
              null,
          );

          setAttendanceLoaded(
            true,
          );

          sessionStorage.setItem(
            mongoStorageKey,
            data.booking.id,
          );
        } catch (error) {
          console.error(
            'Unable to restore server booking:',
            error,
          );
        }
      }

      void hydrateExisting();

      return () => {
        cancelled =
          true;
      };
    }

    /* ========================================================
       CREATE NEW
    ======================================================== */

    async function createBooking() {
      setBookingError('');

      try {
        const response =
          await fetch(
            '/api/bookings',
            {
              method:
                'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              credentials:
                'include',

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
              'Unable to complete the booking.',
          );
        }

        if (cancelled) {
          return;
        }

        setBookingId(
          data.booking
            .bookingId,
        );

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
            .checkedInAt ||
            null,
        );

        setAttendanceLoaded(
          true,
        );

        sessionStorage.setItem(
          bookingStorageKey,
          data.booking
            .bookingId,
        );

        sessionStorage.setItem(
          mongoStorageKey,
          data.booking.id,
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error(
          'Unable to create booking:',
          error,
        );

        setBookingError(
          error instanceof
            Error
            ? error.message
            : 'Unable to complete the booking.',
        );
      }
    }

    void createBooking();

    return () => {
      cancelled =
        true;
    };
  }, [
    bookingDataLoaded,
    bookingDetails,
    eventId,
    slotSelection,
  ]);

  /* ==========================================================
     TRACK COMPLETE
  ========================================================== */

  useEffect(() => {
    if (
      !eventId ||
      !bookingId
    ) {
      return;
    }

    void trackActivity(
      'booking_completed',
      {
        eventId,

        metadata: {
          bookingId,
          bookingDetails,
          slotSelection,
        },
      },
    );
  }, [
    bookingDetails,
    bookingId,
    eventId,
    slotSelection,
  ]);

  /* ==========================================================
     LIVE ATTENDANCE POLLING

     Every 2 seconds the user ticket checks MongoDB.
     Once admin scans the QR the interface turns green.
  ========================================================== */

  useEffect(() => {
    if (!bookingId) {
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
            .checkedInAt ||
            null,
        );

        setAttendanceLoaded(
          true,
        );
      } catch {
        /*
         * Do not interrupt user ticket because
         * of a temporary polling/network error.
         */
      }
    }

    void checkAttendance();

    const interval =
      window.setInterval(
        () => {
          void checkAttendance();
        },
        2000,
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
  ]);

  /* ==========================================================
     FEEDBACK
  ========================================================== */

  useEffect(() => {
    if (!eventId) {
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

    const feedbackState =
      sessionStorage.getItem(
        `ssi-feedback-state:${eventId}`,
      );

    if (
      feedbackState ===
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
    eventId,
    searchParams,
  ]);

  /* ==========================================================
     DISPLAY NAME
  ========================================================== */

  const displayName =
    useMemo(() => {
      const title =
        bookingDetails.title
          ?.trim() ||
        '';

      const name =
        bookingDetails.fullName
          ?.trim() ||
        'Guest';

      if (
        title &&
        !name
          .toLowerCase()
          .startsWith(
            title.toLowerCase(),
          )
      ) {
        return `${title} ${name}`;
      }

      return name;
    }, [
      bookingDetails,
    ]);

  /* ==========================================================
     DATE
  ========================================================== */

  const formattedDate =
    useMemo(() => {
      if (
        !slotSelection.date
      ) {
        return 'Date not available';
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
      slotSelection.date,
    ]);

  /* ==========================================================
     TIME
  ========================================================== */

  const formattedTime =
    useMemo(() => {
      if (
        !slotSelection.startTime ||
        !slotSelection.endTime
      ) {
        return 'Time not available';
      }

      return `${slotSelection.startTime} – ${slotSelection.endTime}`;
    }, [
      slotSelection.startTime,
      slotSelection.endTime,
    ]);

  /* ==========================================================
     QR

     doctorId = the unique Mongo Booking document ID.
  ========================================================== */

  const qrValue =
    useMemo(
      () =>
        JSON.stringify({
          type:
            'SSI_MAYA_CONNECT_ATTENDANCE',

          doctorId:
            bookingMongoId,

          bookingId,

          eventId,

          eventName:
            bookingDetails.eventName,

          name:
            displayName,

          date:
            slotSelection.date,

          startTime:
            slotSelection.startTime,

          endTime:
            slotSelection.endTime,
        }),
      [
        bookingMongoId,
        bookingId,
        eventId,
        bookingDetails.eventName,
        displayName,
        slotSelection.date,
        slotSelection.startTime,
        slotSelection.endTime,
      ],
    );

  /* ==========================================================
     DOWNLOAD
  ========================================================== */

  async function handleDownload() {
    if (
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
        `${
          bookingId ||
          'ssi-booking-confirmation'
        }.png`;

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

  const active =
    attendanceStatus ===
    'PRESENT';

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

        pb-[142px]
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
            ERROR
        ================================================== */}

        {bookingError && (
          <div
            role="alert"
            className="
              mb-3

              rounded-xl

              border
              border-red-200

              bg-red-50

              px-4
              py-3

              text-[12px]
              leading-5

              text-red-700
            "
          >
            {bookingError}
          </div>
        )}

        {/* ==================================================
            CONFIRMED HEADER
        ================================================== */}

        <motion.div
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
              0.5,

            ease:
              EASE,
          }}
          className="
            mb-3

            flex
            items-center
            gap-3

            rounded-xl

            border
            border-gray-200

            bg-white

            px-3.5
            py-3

            shadow-sm

            sm:px-4
            sm:py-3.5
          "
        >
          <motion.div
            initial={{
              scale:
                0.5,

              opacity:
                0,
            }}
            animate={{
              scale:
                1,

              opacity:
                1,
            }}
            transition={{
              delay:
                0.12,

              duration:
                0.45,

              ease:
                EASE,
            }}
            className="
              grid

              h-10
              w-10

              shrink-0

              place-items-center

              rounded-full

              bg-primary

              text-white
            "
          >
            <CheckIcon />
          </motion.div>

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
              Booking Confirmed!
            </h1>

            <p
              className="
                mt-0.5

                !text-[10px]
                !leading-4
                !text-gray-500

                sm:!text-[11px]
              "
            >
              Your slot has been
              reserved successfully.
            </p>
          </div>
        </motion.div>

        {/* ==================================================
            LIVE TICKET STATUS
        ================================================== */}

        <AttendanceStatusCard
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

        {/* ==================================================
            TICKET
        ================================================== */}

        <motion.div
          ref={
            ticketRef
          }
          initial={{
            opacity:
              0,

            y:
              12,
          }}
          animate={{
            opacity:
              1,

            y:
              0,
          }}
          transition={{
            delay:
              0.08,

            duration:
              0.55,

            ease:
              EASE,
          }}
          className={`
            mt-3

            overflow-hidden

            rounded-[18px]

            border

            bg-white

            shadow-[0_10px_28px_rgba(27,75,107,0.05)]

            transition-colors
            duration-500

            md:grid
            md:grid-cols-[310px_minmax(0,1fr)]

            ${
              active
                ? 'border-emerald-300'
                : 'border-amber-200'
            }
          `}
        >
          {/* ================================================
              QR SIDE
          ================================================ */}

          <section
            className={`
              relative

              flex
              items-center
              gap-4

              border-b
              border-gray-100

              p-4

              transition-colors
              duration-500

              md:flex-col
              md:justify-center

              md:border-b-0
              md:border-r

              md:p-5
              md:text-center

              ${
                active
                  ? 'bg-emerald-50/55'
                  : 'bg-amber-50/50'
              }
            `}
          >
            {active && (
              <motion.div
                initial={{
                  opacity:
                    0,

                  scale:
                    0.6,
                }}
                animate={{
                  opacity: [
                    0.15,
                    0.4,
                    0.15,
                  ],

                  scale: [
                    0.8,
                    1.3,
                    0.8,
                  ],
                }}
                transition={{
                  duration:
                    2.3,

                  repeat:
                    Infinity,

                  ease:
                    'easeInOut',
                }}
                className="
                  pointer-events-none

                  absolute
                  left-1/2
                  top-1/2

                  h-[230px]
                  w-[230px]

                  -translate-x-1/2
                  -translate-y-1/2

                  rounded-full

                  bg-emerald-200

                  blur-3xl
                "
              />
            )}

            {/* QR */}

            <motion.div
              animate={
                active
                  ? {
                      scale: [
                        1,
                        1.025,
                        1,
                      ],
                    }
                  : {
                      scale:
                        1,
                    }
              }
              transition={
                active
                  ? {
                      duration:
                        2,

                      repeat:
                        Infinity,
                    }
                  : undefined
              }
              className={`
                relative
                z-10

                shrink-0

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
              {bookingId &&
              bookingMongoId ? (
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
                  className="
                    h-[132px]
                    w-[132px]

                    sm:h-[148px]
                    sm:w-[148px]

                    md:h-[170px]
                    md:w-[170px]
                  "
                />
              ) : (
                <div
                  className="
                    grid

                    h-[132px]
                    w-[132px]

                    place-items-center

                    rounded-lg

                    bg-gray-100

                    sm:h-[148px]
                    sm:w-[148px]

                    md:h-[170px]
                    md:w-[170px]
                  "
                >
                  <span
                    className="
                      h-5
                      w-5

                      animate-spin

                      rounded-full

                      border-2
                      border-gray-300
                      border-t-primary
                    "
                  />
                </div>
              )}
            </motion.div>

            {/* QR INFO */}

            <div
              className="
                relative
                z-10

                min-w-0

                flex-1

                md:flex-none
              "
            >
              <p
                className={`
                  text-[9px]
                  font-bold

                  uppercase

                  tracking-[0.06em]

                  ${
                    active
                      ? 'text-emerald-600'
                      : 'text-amber-600'
                  }
                `}
              >
                Your Entry Pass
              </p>

              <p
                className="
                  mt-1

                  truncate

                  text-[13px]
                  font-semibold

                  text-secondary
                "
              >
                {bookingId ||
                  'Generating...'}
              </p>

              <div
                className="
                  mt-2
                "
              >
                <span
                  className={`
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
              </div>

              <p
                className="
                  mt-2

                  max-w-[230px]

                  !text-[10px]
                  !leading-4
                  !text-gray-500

                  md:mx-auto
                "
              >
                {active
                  ? 'Attendance verified. Your ticket is active.'
                  : 'Present this QR code at the venue for attendance verification.'}
              </p>

              {/* FEEDBACK */}

              <button
                type="button"
                data-export-ignore="true"
                onClick={() =>
                  router.push(
                    `/events/${eventId}/book/feedback`,
                  )
                }
                className="
                  mt-3

                  inline-flex
                  h-8

                  cursor-pointer

                  items-center
                  justify-center
                  gap-1.5

                  rounded-lg

                  border
                  border-primary/20

                  bg-white

                  px-3

                  text-[10px]
                  font-semibold

                  text-primary

                  transition-colors

                  hover:bg-primary/[0.05]
                "
              >
                <FeedbackIcon />

                Give Feedback
              </button>
            </div>
          </section>

          {/* ================================================
              DETAILS
          ================================================ */}

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
                <p
                  className="
                    !text-[8px]
                    !font-bold
                    !uppercase
                    !tracking-[0.055em]
                    !text-gray-400
                  "
                >
                  Booking ID
                </p>

                <p
                  className="
                    mt-0.5

                    truncate

                    !text-[13px]
                    !font-semibold
                    !text-secondary
                  "
                >
                  {bookingId ||
                    'Generating...'}
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

            {/* EVENT */}

            <div
              className="
                mt-4

                grid
                grid-cols-2

                gap-x-4
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
                wide
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

            {/* USER */}

            <div
              className="
                grid
                grid-cols-2

                gap-x-4
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
                  wide
                />
              )}

              {bookingDetails.email && (
                <InfoField
                  label="Email"
                  value={
                    bookingDetails.email
                  }
                  wide
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

        {/* ==================================================
            DESKTOP ACTIONS
        ================================================== */}

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

          <button
            type="button"
            onClick={() =>
              router.push(
                '/events',
              )
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

              text-[12px]
              font-semibold

              text-primary

              transition-colors

              hover:bg-primary/[0.035]
            "
          >
            Back to Events
          </button>
        </div>
      </div>

      {/* ====================================================
          MOBILE ACTIONS
      ==================================================== */}

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

          pb-[max(8px,env(safe-area-inset-bottom))]
          pt-2

          shadow-[0_-5px_20px_rgba(27,75,107,0.06)]

          backdrop-blur-xl

          md:hidden
        "
      >
        <div
          className="
            mx-auto

            flex

            w-full
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

          <button
            type="button"
            onClick={() =>
              router.push(
                '/events',
              )
            }
            className="
              flex

              h-10
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
            "
          >
            Back to Events
          </button>
        </div>
      </div>
    </main>
  );
}

/* ============================================================
   ATTENDANCE STATUS
============================================================ */

function AttendanceStatusCard({
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
        opacity: 0,
        y: 5,
        scale: 0.99,
      }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
      }}
      transition={{
        duration:
          0.45,

        ease:
          EASE,
      }}
      className={`
        relative

        overflow-hidden

        rounded-xl

        border

        px-4
        py-3.5

        transition-colors
        duration-500

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
      {active && (
        <motion.div
          initial={{
            opacity:
              0,
          }}
          animate={{
            opacity: [
              0,
              0.35,
              0,
            ],

            scale: [
              0.7,
              1.5,
              0.7,
            ],
          }}
          transition={{
            duration:
              2.4,

            repeat:
              Infinity,

            ease:
              'easeInOut',
          }}
          className="
            pointer-events-none

            absolute
            -left-6
            top-1/2

            h-24
            w-24

            -translate-y-1/2

            rounded-full

            bg-emerald-300

            blur-2xl
          "
        />
      )}

      <div
        className="
          relative

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
              : {
                  scale:
                    1,
                }
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

        <div
          className="
            min-w-0
            flex-1
          "
        >
          <div
            className="
              flex
              flex-wrap
              items-center
              gap-2
            "
          >
            <p
              className={`
                !text-[13px]
                !font-semibold

                ${
                  active
                    ? '!text-emerald-800'
                    : '!text-amber-800'
                }
              `}
            >
              {!loaded
                ? 'Checking Ticket Status'
                : active
                  ? 'Ticket Active'
                  : 'Ticket Not Active Yet'}
            </p>

            {!active &&
              loaded && (
              <span
                className="
                  h-1.5
                  w-1.5

                  animate-pulse

                  rounded-full

                  bg-amber-500
                "
              />
            )}
          </div>

          <p
            className={`
              mt-0.5

              !text-[10px]
              !leading-4

              ${
                active
                  ? '!text-emerald-700'
                  : '!text-amber-700'
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
                : 'Your ticket will automatically activate after the venue team scans your QR code.'}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

/* ============================================================
   INFO FIELD
============================================================ */

function InfoField({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div
      className={
        wide
          ? 'col-span-2 sm:col-span-2'
          : ''
      }
    >
      <p
        className="
          !text-[8px]
          !font-bold

          !uppercase

          !tracking-[0.045em]

          !text-gray-400
        "
      >
        {label}
      </p>

      <p
        className="
          mt-0.5

          break-words

          !text-[11px]
          !font-medium

          !leading-4

          !text-secondary

          sm:!text-[12px]
        "
      >
        {value}
      </p>
    </div>
  );
}

/* ============================================================
   DOWNLOAD BUTTON
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
      onClick={
        onClick
      }
      disabled={
        downloading
      }
      className="
        flex

        h-10
        w-full

        cursor-pointer

        items-center
        justify-center
        gap-2

        rounded-xl

        bg-primary

        px-3

        text-[11px]
        font-semibold

        text-white

        shadow-[0_5px_14px_rgba(26,158,143,0.14)]

        transition-colors

        hover:brightness-95

        disabled:cursor-wait
        disabled:opacity-70

        md:h-11
        md:text-[12px]
      "
    >
      {downloaded ? (
        <>
          <CheckSmallIcon />

          Downloaded
        </>
      ) : downloading ? (
        <>
          <span
            className="
              h-4
              w-4

              animate-spin

              rounded-full

              border-2
              border-white/35
              border-t-white
            "
          />

          Preparing...
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
   HELPERS
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

function FeedbackIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.9}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 12a8.5 8.5 0 0 1-12.7 7.4L3 21l1.6-5.1A8.5 8.5 0 1 1 21 12Z"
      />

      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 10h8M8 14h5"
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