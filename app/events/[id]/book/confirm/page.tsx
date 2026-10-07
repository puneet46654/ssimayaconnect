'use client';

import { phoneIdentity } from '@/lib/phone';
import { type BookingDetails as SharedBookingDetails, type ServerBooking, type BookingApiResponse, bookingStorage, ticketStorage } from '@/lib/booking-contracts';

import { attendeeIdentity, bookingRequestData } from '@/lib/bookings/identity';
import { clearPendingBooking } from '@/lib/pending-booking';
import { calendarDateFormatter, eventTimeZone } from '@/lib/events/dates';

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
  useRealtimeRefresh,
} from '@/components/realtime/RealtimeProvider';

/* ============================================================
   TYPES
============================================================ */

type BookingDetails = Partial<SharedBookingDetails>;

type SlotSelection = {
  timeZone?: string;
  eventId?: string;

  dayScheduleId?: string;

  date?: string;

  slotId?: string;

  startTime?: string;

  endTime?: string;
};



type BookingState =
  | 'loading'
  | 'creating'
  | 'ready'
  | 'error';

/* ============================================================
   CONSTANTS
============================================================ */

const EASE = [
  0.22,
  1,
  0.36,
  1,
] as const;

type BookingIntent = { key: string; fingerprint: string; bookingId?: string };

function readBookingIntent(eventId: string, fingerprint: string): BookingIntent {
  try {
    const saved = JSON.parse(sessionStorage.getItem(bookingStorage.intent(eventId)) || 'null') as BookingIntent | null;
    if (saved?.fingerprint === fingerprint && saved.key) return saved;
  } catch { /* Invalid caches are not proof of a booking. */ }
  const intent = { key: crypto.randomUUID(), fingerprint };
  sessionStorage.setItem(bookingStorage.intent(eventId), JSON.stringify(intent));
  return intent;
}

export default function BookingConfirmationPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedReference = searchParams.get('bookingId') || '';
  const ticketRef = useRef<HTMLDivElement | null>(null);
  const [serverBooking, setServerBooking] = useState<ServerBooking | null>(null);
  const [bookingState, setBookingState] = useState<BookingState>('loading');
  const [bookingError, setBookingError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const bookingId = serverBooking?.bookingId || '';
  const bookingMongoId = serverBooking?.id || '';
  const bookingDetails = serverBooking?.details || null;
  const slotSelection = serverBooking;
  const attendanceStatus = serverBooking?.attendanceStatus || 'NOT_PRESENT';

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    async function load() {
      setServerBooking(null);
      setBookingState('loading');
      setBookingError('');
      try {
        let intent: BookingIntent | undefined;
        let details: BookingDetails | undefined;
        let slot: SlotSelection | undefined;
        let reference = requestedReference;
        if (!reference) {
          details = JSON.parse(sessionStorage.getItem(bookingStorage.details(eventId)) || 'null') as BookingDetails;
          slot = JSON.parse(sessionStorage.getItem(`ssi-booking-slot:${eventId}:latest`)
            || sessionStorage.getItem(`ssi-booking-slot:${eventId}`) || 'null') as SlotSelection;
          if (!details?.fullName || !details.email || !details.mobile || !slot?.slotId || !slot.dayScheduleId) {
            throw new Error('Booking information could not be found. Complete the form again, or recover your ticket in My Tickets.');
          }
          const fingerprint = bookingRequestData(eventId, slot.dayScheduleId, slot.slotId, details);
          intent = readBookingIntent(eventId, fingerprint);
          // One contact may hold many tickets, so only this exact request (same details and slot) maps to an existing booking.
          reference = intent.bookingId || '';
        }
        let confirmed: ServerBooking | undefined;
        if (reference) {
          const response = await fetch(`/api/bookings?bookingId=${encodeURIComponent(reference)}`, { cache: 'no-store', signal });
          const data: BookingApiResponse = await response.json();
          if (signal.aborted) return;
          if (response.ok && data.booking) {
            const sameAttendee = !details || attendeeIdentity(data.booking.details) === attendeeIdentity(details);
            const sameSlot = !slot || data.booking.slotId === slot.slotId && data.booking.dayScheduleId === slot.dayScheduleId;
            if (data.booking.eventId === eventId && sameAttendee && sameSlot) confirmed = data.booking;
            else if (requestedReference) throw new Error('This ticket belongs to another event. Open it in My Tickets.');
          } else if (requestedReference || ![403, 404].includes(response.status)) {
            throw new Error(data.error || data.message || 'Unable to verify your ticket.');
          }
        }
        if (!confirmed) {
          if (!intent || !details || !slot) throw new Error('Recover this booking in My Tickets.');
          setBookingState('creating');
          const response = await fetch('/api/bookings', {
            method: 'POST', credentials: 'include', cache: 'no-store', signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId, slotId: slot.slotId, dayScheduleId: slot.dayScheduleId, details, idempotencyKey: intent.key }),
          });
          const data: BookingApiResponse = await response.json();
          if (signal.aborted) return;
          if (!response.ok || !data.success || !data.booking) throw new Error(data.error || data.message || 'Unable to confirm booking.');
          confirmed = data.booking;
        }
        if (signal.aborted) return;
        setServerBooking(confirmed);
        setBookingState('ready');
        setBookingError('');
        try {
          if (intent) sessionStorage.setItem(bookingStorage.intent(eventId), JSON.stringify({ ...intent, bookingId: confirmed.bookingId }));
          if (!requestedReference) {
            sessionStorage.removeItem(bookingStorage.draft(eventId));
            sessionStorage.removeItem(bookingStorage.country(eventId));
            clearPendingBooking(eventId);
          }
          const cachedTickets = JSON.parse(sessionStorage.getItem(ticketStorage.tickets) || '[]');
          sessionStorage.setItem(ticketStorage.tickets, JSON.stringify([
            ...(Array.isArray(cachedTickets) ? cachedTickets.filter(ticket => ticket.bookingId !== confirmed.bookingId) : []), confirmed,
          ]));
          // My Tickets shows this booking automatically until its slot ends.
          const ticketMobile = phoneIdentity(confirmed.details?.mobile, confirmed.details?.countryCode);
          if (ticketMobile) localStorage.setItem(ticketStorage.mobile, ticketMobile);
          // Retain references for existing feedback URLs and earlier browser versions.
          sessionStorage.setItem(`ssi-server-booking-id:${eventId}:latest`, confirmed.bookingId);
          sessionStorage.setItem(`ssi-server-booking-mongo-id:${eventId}:latest`, confirmed.id);
          sessionStorage.setItem(`ssi-server-booking-id:${eventId}:${confirmed.dayScheduleId}:${confirmed.slotId}`, confirmed.bookingId);
        } catch { /* Cache failure must not hide a confirmed booking. */ }
      } catch (error) {
        if (signal.aborted) return;
        setServerBooking(null);
        setBookingState('error');
        setBookingError(error instanceof Error ? error.message : 'Unable to confirm booking. Please retry.');
      }
    }
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [eventId, requestedReference, attempt]);

  function retryBooking() {
    setBookingState('loading');
    setBookingError('');
    setAttempt(value => value + 1);
  }

  const checkAttendance = useCallback(async () => {
    if (!bookingId) return;
    try {
      const response = await fetch(`/api/bookings?bookingId=${encodeURIComponent(bookingId)}`, { cache: 'no-store' });
      const data: BookingApiResponse = await response.json();
      if (response.ok && data.booking) {
        const updated = data.booking;
        setServerBooking(current => current?.bookingId === updated.bookingId ? updated : current);
      }
    } catch { /* A temporary refresh failure does not erase the verified ticket. */ }
  }, [bookingId]);

  useEffect(() => {
    if (bookingState !== 'ready') return;
    const refresh = () => { if (!document.hidden) void checkAttendance(); };
    const interval = window.setInterval(refresh, 15000);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', refresh); };
  }, [bookingState, checkAttendance]);
  useRealtimeRefresh('attendance', checkAttendance);
  useRealtimeRefresh('bookings', checkAttendance);

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

  const cancelled = serverBooking?.status === 'CANCELLED';
  const active = !cancelled &&
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

      return calendarDateFormatter(
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

      return `${start} – ${end} (${eventTimeZone(slotSelection?.timeZone)})`;
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
      });
      // Minimal payload: the scanner only needs these, and a short QR scans faster.
    }, [
      bookingId,
      bookingMongoId,
      bookingReady,
      eventId,
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
            // Export the settled ticket even if its entrance animation is running.
            style: { opacity: '1', transform: 'none', animation: 'none', transition: 'none' },
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
      className={`
        min-h-dvh

        overflow-x-hidden

        transition-colors duration-500

        ${active ? 'ticket-present bg-[#ECFDF5]' : 'bg-[#FFF9E8]'}

        px-3

        pb-[80px] md:pb-[150px]
        pt-3

        sm:px-5
        sm:pt-5

        md:flex
        md:flex-col
        md:justify-center

        md:px-6
        md:py-7
      `}
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
          className={`
            ${bookingReady && !cancelled ? 'max-md:hidden' : ''}
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
          `}
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
                  bg-yellow-500
                      text-white
                    `
                  : bookingState ===
                      'error'
                    ? `
                        bg-red-100
                        text-red-600
                      `
                    : `
                    bg-yellow-100
                    text-amber-700
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
                ? cancelled ? 'Event Cancelled' : 'Booking Confirmed!'
                : bookingState ===
                    'error'
                  ? 'Unable to Verify Booking'
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
                ? cancelled ? 'Booking history is retained. This ticket is not valid for admission.' : 'Your booking has been saved successfully.'
                : bookingState ===
                    'error'
                  ? 'Please retry or recover your ticket in My Tickets.'
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
              {/* Point the user at the action that can actually fix the error */}
              {/booking already uses|recover|My Tickets/i.test(bookingError) ? (
                <button
                  type="button"
                  onClick={() =>
                    router.push('/events/mytickets')
                  }
                  className="
                    btn
                    btn-primary
                  "
                >
                  View My Tickets
                </button>
              ) : /slot/i.test(bookingError) ? (
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/events/${eventId}/book/slots`,
                    )
                  }
                  className="
                    btn
                    btn-primary
                  "
                >
                  Choose Another Time
                </button>
              ) : (
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
                    Try Again
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
                Edit My Details
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
              <motion.div
                key={
                  active
                    ? 'ticket-active'
                    : 'ticket-waiting'
                }
                ref={
                  ticketRef
                }
                initial={{
                  opacity:
                    0,

                  y:
                    10,

                  scale:
                    0.98,
                }}
                animate={
                  active
                    ? {
                        opacity:
                          1,

                        y:
                          0,

                        scale:
                          [0.96, 1.02, 1],

                        boxShadow:
                          '0 18px 40px rgba(250, 204, 21, 0.18)',
                      }
                    : {
                        opacity:
                          1,

                        y:
                          0,

                        scale:
                          1,
                      }
                }
                transition={{
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

                  shadow-[0_10px_30px_rgba(234,179,8,0.12)]

                  md:grid
                  md:grid-cols-[310px_minmax(0,1fr)]

                  ${
                    active ? 'border-emerald-300'
                      : 'border-yellow-200'
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
                      active ? 'bg-emerald-50/80'
                        : 'bg-yellow-50/90'
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
                      className={`
                        pointer-events-none

                        absolute

                        h-[230px]
                        w-[230px]

                        rounded-full

                        ${active ? 'bg-emerald-200' : 'bg-yellow-200'}

                        blur-3xl
                      `}
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
                        active ? 'border-emerald-300'
                          : 'border-yellow-200'
                      }
                    `}
                  >
                    {cancelled ? <p className="max-w-[170px] font-semibold text-red-700">Event cancelled. Not valid for admission.</p> : (<QRCodeSVG
                      value={
                        qrValue
                      }
                      size={200}
                      level="H"
                      marginSize={4}
                      bgColor="#FFFFFF"
                      fgColor="#000000"
                      role="img"
                      aria-label="Ticket QR code"
                    />)}
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

                      text-amber-700
                    "
                  >
                    {cancelled ? 'Cancelled booking' : 'Your Entry Pass'}
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
                              bg-yellow-50
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
                          active ? 'bg-emerald-500'
                              : 'animate-pulse bg-yellow-500'
                        }
                      `}
                    />

                    {cancelled ? 'Cancelled' : active
                      ? 'Checked In'
                      : 'Ready for Venue Scan'}
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
                    {cancelled ? 'Contact event staff for assistance.' : active
                      ? 'Attendance verified successfully.'
                      : 'Present this QR code at the venue for attendance verification.'}
                  </p>

                  <button
                    type="button"
                    data-export-ignore="true"
                    onClick={() =>
                      router.push(
                        `/events/${eventId}/book/feedback?scope=application`,
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
                      border-yellow-200

                      bg-white

                      px-3

                      text-[10px]
                      font-semibold

                      text-amber-700

                      hover:bg-yellow-50
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
                      max-md:hidden
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
                          active ? 'text-emerald-600'
                            : 'text-yellow-600'
                        }
                      `}
                    >
                      <span
                        className={`
                          h-1.5
                          w-1.5

                          rounded-full

                          ${
                            active ? 'bg-emerald-500'
                              : 'animate-pulse bg-yellow-500'
                          }
                        `}
                      />

                      {cancelled ? 'Cancelled' : active
                        ? 'Checked in'
                        : 'Ready'}
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
                        mobileHidden
                        value={
                          bookingDetails.specialty
                        }
                      />
                    )}

                    {bookingDetails.hospitalName && (
                      <InfoField
                        label="Hospital"
                        mobileHidden
                        value={
                          bookingDetails.hospitalName
                        }
                      />
                    )}

                    {bookingDetails.email && (
                      <InfoField
                        label="Email"
                        mobileHidden
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
                        mobileHidden
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
                {!cancelled && (<DownloadButton
                  downloading={
                    downloading
                  }
                  downloaded={
                    downloaded
                  }
                  onClick={
                    handleDownload
                  }
                />)}

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
                  bottom-0 max-md:bottom-[var(--user-nav-h)]

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
                    gap-2
                    [&>*]:flex-1
                  "
                >
                  {!cancelled && (<DownloadButton
                    downloading={
                      downloading
                    }
                    downloaded={
                      downloaded
                    }
                    onClick={
                      handleDownload
                    }
                  />)}

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
  mobileHidden = false,
}: {
  label: string;

  value: string;

  mobileHidden?: boolean;
}) {
  return (
    <div
      className={`min-w-0 ${mobileHidden ? 'max-md:hidden' : ''}`}
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

        bg-yellow-500

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
        border-yellow-300

        bg-white

        text-[11px]
        font-semibold

        text-amber-700

        hover:bg-yellow-50
      "
    >
      Back to Events
    </button>
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
