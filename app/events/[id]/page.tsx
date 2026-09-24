'use client';

import Image from 'next/image';
import Link from 'next/link';

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
} from 'next/navigation';

import {
  AnimatePresence,
  motion,
} from 'framer-motion';

import {
  useRealtimeRefresh,
} from '@/components/realtime/RealtimeProvider';


interface DaySchedule {
  _id: string;

  dayNumber: number;

  date: string;

  startTime: string;

  endTime: string;

  lunchEnabled: boolean;

  lunchStart: string;

  lunchEnd: string;

  slotDuration: string;

  slotGap: string;

  capacity: string;

  sameAsDay1: boolean;
}

interface EventDetails {
  _id: string;

  eventName: string;

  eventType:
    | 'conference'
    | 'mantram'
    | 'event';

  venue: string;

  description: string;

  imageUrl?: string;

  numberOfDays: number;

  startDate: string;

  endDate: string;

  status:
    | 'LIVE'
    | 'UPCOMING'
    | 'COMPLETED';

  totalSlots: number;

  bookedSlots: number;

  daySchedules:
    DaySchedule[];
}

const EASE = [
  0.16,
  1,
  0.3,
  1,
] as const;

export default function EventDetailsPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const router =
    useRouter();

  const eventId =
    params.id;


  const [
    event,
    setEvent,
  ] =
    useState<EventDetails | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState('');

  const [
    copied,
    setCopied,
  ] =
    useState(false);

  const [
    showShareHint,
    setShowShareHint,
  ] =
    useState(false);

  const shareHintTimer =
    useRef<
      ReturnType<
        typeof setTimeout
      > | null
    >(null);

  /* ============================================================
     FETCH
  ============================================================ */

  const fetchEvent =
    useCallback(
      async (
        showLoading = true,
      ) => {
        if (!eventId) {
          return;
        }

        if (showLoading) {
          setLoading(true);
        }

        setError('');

        try {
          const response =
            await fetch(
              `${`/api/events/${encodeURIComponent(
                eventId,
              )}`}${
                showLoading
                  ? ''
                  : `?refresh=${Date.now()}`
              }`,
              {
                method:
                  'GET',

                cache:
                  showLoading
                    ? 'default'
                    : 'no-store',
              },
            );

          const data =
            await response.json();

          if (
            !response.ok ||
            !data.success ||
            !data.event
          ) {
            throw new Error(
              data.error ||
                'Failed to load event.',
            );
          }

          setEvent(
            data.event,
          );
        } catch (
          error: unknown
        ) {
          console.error(
            'Event loading error:',
            error,
          );

          setError(
            error instanceof Error
              ? error.message
              : 'Failed to load event.',
          );

          setEvent(null);
        } finally {
          if (showLoading) {
            setLoading(
              false,
            );
          }
        }
      },
      [
        eventId,
      ],
    );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchEvent();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    fetchEvent,
  ]);

  useRealtimeRefresh(
    'events',
    (change) => {
      if (
        !change.id ||
        change.id ===
          eventId
      ) {
        void fetchEvent(
          false,
        );
      }
    },
  );

  useEffect(() => {
    return () => {
      if (
        shareHintTimer.current
      ) {
        clearTimeout(
          shareHintTimer.current,
        );
      }
    };
  }, []);

  const eventTime =
    useMemo(() => {
      const firstDay =
        event
          ?.daySchedules?.[0];

      if (!firstDay) {
        return '';
      }

      return formatTimeRange(
        firstDay.startTime,
        firstDay.endTime,
      );
    }, [
      event,
    ]);

  const remainingCapacity =
    Math.max(
      0,
      (event?.totalSlots ||
        0) -
        (event?.bookedSlots ||
          0),
    );

  if (loading) {
    return (
      <EventDetailsSkeleton />
    );
  }

  if (
    error ||
    !event
  ) {
    return (
      <EventError
        message={
          error ||
          'Event could not be loaded.'
        }
        onBack={() =>
          router.push(
            '/events',
          )
        }
        onRetry={() =>
          void fetchEvent()
        }
      />
    );
  }

  const loadedEvent = event;

  async function handleShare() {
    try {
      if (
        navigator.share
      ) {
        await navigator.share(
          {
            title:
            loadedEvent.eventName,

            text:
            loadedEvent.eventName,

            url:
              window.location
                .href,
          },
        );

        return;
      }

      await navigator.clipboard.writeText(
        window.location.href,
      );

      setCopied(true);

      window.setTimeout(
        () =>
          setCopied(
            false,
          ),
        1500,
      );
    } catch {
      // Share cancelled.
    }
  }

  function showShareTooltip() {
    if (
      shareHintTimer.current
    ) {
      clearTimeout(
        shareHintTimer.current,
      );
    }

    setShowShareHint(
      true,
    );

    shareHintTimer.current =
      setTimeout(
        () => {
          setShowShareHint(
            false,
          );
        },
        1600,
      );
  }

  const canBook =
    event.status !==
    'COMPLETED';

  return (
    <main
      className="
        min-h-dvh
        bg-[#F7F9FB]
        pb-[130px]

        md:pb-10
      "
    >
      {/* HEADER */}

      <header
        className=" max-md:hidden
          sticky
          top-0
          z-50

          border-b
          border-gray-200/80

          bg-[#F7F9FB]/95

          backdrop-blur-xl
        "
      >
        <div
          className="
            relative

            mx-auto

            flex
            h-[64px]
            w-full
            max-w-[1180px]

            items-center
            justify-between

            px-3

            sm:h-[68px]
            sm:px-5

            lg:px-8
          "
        >
          <button
            type="button"
            aria-label="Go back"
            onClick={() =>
              router.back()
            }
            className="
              group
              relative
              z-20

              grid
              h-10
              w-10

              cursor-pointer
              place-items-center

              rounded-full

              border
              border-gray-200

              bg-white

              text-secondary

              shadow-[0_2px_8px_rgba(27,75,107,0.05)]

              transition-all
              duration-200

              hover:border-primary/30
              hover:text-primary

              active:scale-95
            "
          >
            <svg
              className="
                h-[18px]
                w-[18px]

                transition-transform

                group-hover:-translate-x-0.5
              "
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 18l-6-6 6-6"
              />
            </svg>
          </button>

          <Link
            href="/events"
            className="
              absolute
              left-1/2
              top-1/2

              flex
              h-10
              max-w-[210px]

              -translate-x-1/2
              -translate-y-1/2

              items-center
              gap-2

              rounded-full

              border
              border-primary/20

              bg-white

              px-3.5

              shadow-[0_4px_14px_rgba(27,75,107,0.06)]

              transition-all

              hover:border-primary/35
              hover:shadow-[0_7px_20px_rgba(27,75,107,0.09)]

              min-[390px]:max-w-[240px]

              sm:h-11
              sm:px-4
            "
          >
            <Image
              src="/logos/ssilogo.png"
              alt="SSI"
              width={20}
              height={20}
              priority
              className="
                h-5
                w-5
                shrink-0
                object-contain
              "
            />

            <span
              className="
                truncate
                whitespace-nowrap

                text-[11px]
                font-semibold

                text-secondary

                sm:text-xs
              "
            >
              SSI Maya Connect
            </span>
          </Link>

          <div
            className="
              relative
              z-20
            "
            onMouseEnter={
              showShareTooltip
            }
            onFocus={
              showShareTooltip
            }
          >
            <button
              type="button"
              aria-label="Share this event"
              onClick={() =>
                void handleShare()
              }
              className="
                grid
                h-10
                w-10

                cursor-pointer
                place-items-center

                rounded-full

                border
                border-gray-200

                bg-white

                text-secondary

                shadow-[0_2px_8px_rgba(27,75,107,0.05)]

                transition-all

                hover:border-primary/30
                hover:text-primary

                active:scale-95
              "
            >
              <svg
                className="h-[18px] w-[18px]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.9}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 16V4m0 0L8 8m4-4 4 4"
                />

                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 11v8a1 1 0 001 1h10a1 1 0 001-1v-8"
                />
              </svg>
            </button>

            <AnimatePresence>
              {showShareHint && (
                <motion.div
                  initial={{
                    opacity: 0,
                    y: 4,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  exit={{
                    opacity: 0,
                    y: 4,
                  }}
                  className="
                    pointer-events-none

                    absolute
                    right-0
                    top-[47px]

                    whitespace-nowrap

                    rounded-lg

                    bg-secondary

                    px-2.5
                    py-1.5

                    text-[10px]
                    font-semibold
                    text-white

                    shadow-lg
                  "
                >
                  Share this event
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* CONTENT */}

      <div
        className="
          mx-auto
          w-full
          max-w-[1180px]

          sm:px-5
          sm:pt-5

          lg:px-8
          lg:pt-6
        "
      >
        <motion.article
          initial={{
            opacity: 0,
            y: 12,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.45,
            ease: EASE,
          }}
          className="
            overflow-hidden

            bg-white

            sm:rounded-[20px]
            sm:border
            sm:border-gray-200

            sm:shadow-[0_8px_28px_rgba(27,75,107,0.05)]
          "
        >
          {/* IMAGE */}

          <div
            className="
              relative

              aspect-[16/9]
              w-full

              overflow-hidden

              bg-gray-100

              sm:aspect-[16/7]

              lg:aspect-[16/6.2]
            "
          >
            {event.imageUrl ? (
              <img
                src={
                  event.imageUrl
                }
                alt={
                  event.eventName
                }
                className="
                  h-full
                  w-full
                  object-cover
                "
              />
            ) : (
              <div
                className="
                  flex
                  h-full
                  w-full

                  items-center
                  justify-center

                  bg-gray-100
                  text-gray-300
                "
              >
                <svg
                  className="h-10 w-10"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 17l5-5 4 4 2-2 5 5M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z"
                  />
                </svg>
              </div>
            )}

            <div
              className="
                absolute
                left-3
                top-3

                sm:left-4
                sm:top-4
              "
            >
              <StatusBadge
                status={
                  event.status
                }
              />
            </div>
          </div>

          {/* DETAILS */}

          <div
            className="
              px-4
              pb-6
              pt-5

              sm:px-7
              sm:pb-7
              sm:pt-6

              lg:px-9
              lg:py-8
            "
          >
            <div
              className="
                grid
                gap-6

                lg:grid-cols-[minmax(0,1fr)_250px]
                lg:items-start
                lg:gap-10
              "
            >
              <div className="min-w-0">
                <p
                  className="
                    text-[10px]
                    font-semibold
                    uppercase
                    tracking-[0.08em]
                    text-gray-400
                  "
                >
                  {formatEventType(
                    event.eventType,
                  )}
                </p>

                <h1
                  className="
                    mt-1.5

                    max-w-[850px]

                    font-heading

                    text-[24px]
                    font-bold

                    leading-[1.14]

                    tracking-[-0.03em]

                    text-secondary

                    sm:text-[30px]

                    lg:text-[34px]
                  "
                >
                  {event.eventName}
                </h1>

                <p
                  className="
                    mt-2

                    text-[12px]

                    text-gray-500

                    sm:text-[13px]
                  "
                >
                  Organized by{' '}
                  <span
                    className="
                      font-semibold
                      text-primary
                    "
                  >
                    SSI INNOVATIONS
                  </span>
                </p>

                <div
                  className="
                    mt-5

                    flex
                    flex-wrap

                    gap-2
                  "
                >
                  <InfoPill
                    type="calendar"
                    value={formatDateRange(
                      event.startDate,
                      event.endDate,
                    )}
                  />

                  {eventTime && (
                    <InfoPill
                      type="clock"
                      value={
                        eventTime
                      }
                    />
                  )}

                  <InfoPill
                    type="location"
                    value={
                      event.venue
                    }
                  />
                </div>
              </div>

              <div
                className="
                  hidden

                  rounded-xl

                  border
                  border-gray-200

                  bg-[#FAFBFC]

                  p-4

                  lg:block
                "
              >
                <p
                  className="
                    text-[10px]
                    font-semibold
                    uppercase
                    tracking-[0.06em]
                    text-gray-400
                  "
                >
                  Availability
                </p>

                <p
                  className="
                    mt-1.5

                    text-2xl
                    font-bold

                    tracking-[-0.03em]

                    text-secondary
                  "
                >
                  {remainingCapacity}
                </p>

                <p
                  className="
                    mt-0.5

                    text-xs

                    text-gray-500
                  "
                >
                  booking places remaining
                </p>
              </div>
            </div>

            <div
              className="
                my-6
                h-px
                bg-gray-200
              "
            />

            <section>
              <h2
                className="
                  font-heading

                  text-[17px]
                  font-bold

                  text-secondary

                  sm:text-lg
                "
              >
                About This Event
              </h2>

              <p
                className="
                  mt-2.5

                  max-w-4xl

                  whitespace-pre-line

                  text-[13px]
                  leading-[1.7]

                  text-gray-500

                  sm:text-sm
                  sm:leading-6
                "
              >
                {event.description}
              </p>
            </section>
          </div>
        </motion.article>

        {/* DESKTOP BUTTONS */}

        <div
          className="
            mt-4
            hidden
            grid-cols-2
            gap-3

            md:grid
          "
        >
          <Link
            href={
              canBook
                ? `/events/${event._id}/book`
                : '#'
            }
            aria-disabled={
              !canBook
            }
            onClick={(
              e,
            ) => {
              if (
                !canBook
              ) {
                e.preventDefault();
              }
            }}
            className={`
              flex
              h-12
              items-center
              justify-center

              rounded-xl

              text-sm
              font-semibold

              transition-all

              ${
                canBook
                  ? `
                    bg-primary
                    text-white

                    shadow-[0_7px_18px_rgba(26,158,143,0.16)]

                    hover:brightness-95
                  `
                  : `
                    cursor-not-allowed
                    bg-gray-200
                    text-gray-400
                  `
              }
            `}
          >
            {canBook
              ? 'Book Tickets'
              : 'Booking Closed'}
          </Link>

          <button
            type="button"
            onClick={() =>
              router.back()
            }
            className="
              h-12

              cursor-pointer

              rounded-xl

              border
              border-gray-300

              bg-white

              text-sm
              font-semibold

              text-secondary

              transition-all

              hover:bg-gray-50
            "
          >
            Go Back
          </button>
        </div>
      </div>

      {/* MOBILE ACTION */}

      <div
        className="
          fixed
          inset-x-0
          bottom-0 max-md:bottom-[var(--user-nav-h)]
          z-50

          border-t
          border-gray-200/80

          bg-white/95

          px-4
          pb-[max(12px,env(safe-area-inset-bottom))]
          pt-3

          shadow-[0_-8px_24px_rgba(27,75,107,0.06)]

          backdrop-blur-xl

          md:hidden
        "
      >
        <div
          className="
            mx-auto
            w-full
            max-w-[430px]

            space-y-2
          "
        >
          {canBook ? (
            <Link
              href={`/events/${event._id}/book`}
              className="
                flex
                h-12
                w-full

                items-center
                justify-center

                rounded-xl

                bg-primary

                text-sm
                font-semibold
                text-white

                shadow-[0_7px_18px_rgba(26,158,143,0.16)]

                transition

                active:scale-[0.995]
              "
            >
              Book Tickets
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="
                h-12
                w-full

                rounded-xl

                bg-gray-200

                text-sm
                font-semibold
                text-gray-400
              "
            >
              Booking Closed
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              router.back()
            }
            className="
              h-11
              w-full

              cursor-pointer

              rounded-xl

              border
              border-gray-300

              bg-white

              text-sm
              font-semibold
              text-secondary
              hidden sm:block
            "
          >
            Go Back
          </button>
        </div>
      </div>

      <AnimatePresence>
        {copied && (
          <motion.div
            initial={{
              opacity: 0,
              y: -8,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              y: -8,
            }}
            className="
              fixed
              left-1/2
              top-[76px]
              z-[100]

              -translate-x-1/2

              rounded-full

              border
              border-gray-200

              bg-white

              px-3
              py-1.5

              text-[11px]
              font-semibold
              text-secondary

              shadow-lg
            "
          >
            Link copied
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

/* ============================================================
   STATUS
============================================================ */

function StatusBadge({
  status,
}: {
  status:
    EventDetails['status'];
}) {
  const classes =
    status === 'LIVE'
      ? 'bg-white text-[#15935A]'
      : status ===
          'COMPLETED'
        ? 'bg-white text-gray-500'
        : 'bg-white text-secondary';

  return (
    <span
      className={`
        inline-flex
        items-center
        gap-1.5

        rounded-full

        px-2.5
        py-1.5

        text-[9px]
        font-bold
        uppercase
        tracking-[0.06em]

        shadow-sm

        ${classes}
      `}
    >
      {status ===
        'LIVE' && (
        <span
          className="
            h-1.5
            w-1.5
            rounded-full
            bg-[#19CC6A]
          "
        />
      )}

      {status}
    </span>
  );
}

/* ============================================================
   ERROR
============================================================ */

function EventError({
  message,
  onBack,
  onRetry,
}: {
  message: string;

  onBack:
    () => void;

  onRetry:
    () => void;
}) {
  return (
    <main
      className="
        grid
        min-h-dvh
        place-items-center

        bg-[#F7F9FB]

        px-4
      "
    >
      <div
        className="
          w-full
          max-w-[400px]

          rounded-2xl

          border
          border-gray-200

          bg-white

          p-6

          text-center

          shadow-[0_12px_35px_rgba(27,75,107,0.06)]
        "
      >
        <h1
          className="
            text-lg
            font-bold
            text-secondary
          "
        >
          Event could not be loaded
        </h1>

        <p
          className="
            mt-2

            text-sm
            leading-6

            text-gray-500
          "
        >
          {message}
        </p>

        <div
          className="
            mt-5
            grid
            grid-cols-2
            gap-2.5
          "
        >
          <button
            type="button"
            onClick={
              onBack
            }
            className="
              h-11

              rounded-xl

              border
              border-gray-200

              bg-white

              text-sm
              font-semibold
              text-secondary
            "
          >
            Go Back
          </button>

          <button
            type="button"
            onClick={
              onRetry
            }
            className="
              h-11

              rounded-xl

              bg-primary

              text-sm
              font-semibold
              text-white
            "
          >
            Try Again
          </button>
        </div>
      </div>
    </main>
  );
}

/* ============================================================
   INFO
============================================================ */

function InfoPill({
  type,
  value,
}: {
  type:
    | 'calendar'
    | 'clock'
    | 'location';

  value: string;
}) {
  return (
    <div
      className="
        inline-flex
        min-h-[32px]

        items-center
        gap-1.5

        rounded-lg

        border
        border-gray-200

        bg-white

        px-2.5
        py-1.5

        text-[11px]
        font-medium
        text-secondary

        sm:text-xs
      "
    >
      <span className="text-primary">
        <InfoIcon
          type={type}
        />
      </span>

      <span>
        {value}
      </span>
    </div>
  );
}

function InfoIcon({
  type,
}: {
  type:
    | 'calendar'
    | 'clock'
    | 'location';
}) {
  if (
    type ===
    'calendar'
  ) {
    return (
      <svg
        className="h-[15px] w-[15px]"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.9}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8 3v3m8-3v3M4 9h16M5 5h14a1 1 0 011 1v14H4V6a1 1 0 011-1z"
        />
      </svg>
    );
  }

  if (
    type ===
    'clock'
  ) {
    return (
      <svg
        className="h-[15px] w-[15px]"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.9}
      >
        <circle
          cx="12"
          cy="12"
          r="9"
        />

        <path
          strokeLinecap="round"
          d="M12 7v5l3 2"
        />
      </svg>
    );
  }

  return (
    <svg
      className="h-[15px] w-[15px]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.9}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21s6-5.2 6-11a6 6 0 10-12 0c0 5.8 6 11 6 11z"
      />

      <circle
        cx="12"
        cy="10"
        r="2"
      />
    </svg>
  );
}

/* ============================================================
   SKELETON
============================================================ */

function EventDetailsSkeleton() {
  return (
    <main className="min-h-dvh bg-[#F7F9FB]">
      <div
        className="
          h-[64px]
          border-b
          border-gray-200
          bg-white

          sm:h-[68px]
        "
      />

      <div
        className="
          mx-auto
          w-full
          max-w-[1180px]

          sm:px-5
          sm:pt-5

          lg:px-8
        "
      >
        <div
          className="
            overflow-hidden

            bg-white

            sm:rounded-[20px]
            sm:border
            sm:border-gray-200
          "
        >
          <div
            className="
              aspect-[16/9]
              animate-pulse
              bg-gray-100

              sm:aspect-[16/7]
            "
          />

          <div
            className="
              px-4
              py-5

              sm:px-7
              sm:py-7
            "
          >
            <div className="h-3 w-20 animate-pulse rounded bg-gray-100" />

            <div className="mt-3 h-7 w-[80%] animate-pulse rounded bg-gray-100" />

            <div className="mt-3 h-4 w-40 animate-pulse rounded bg-gray-100" />

            <div className="mt-6 flex gap-2">
              <div className="h-8 w-28 animate-pulse rounded-lg bg-gray-100" />
              <div className="h-8 w-32 animate-pulse rounded-lg bg-gray-100" />
            </div>

            <div className="my-6 h-px bg-gray-200" />

            <div className="h-5 w-32 animate-pulse rounded bg-gray-100" />

            <div className="mt-3 space-y-2">
              <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
              <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
              <div className="h-3 w-[70%] animate-pulse rounded bg-gray-100" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

/* ============================================================
   FORMAT
============================================================ */

function formatEventType(
  value:
    EventDetails['eventType'],
) {
  if (
    value ===
    'conference'
  ) {
    return 'Conference';
  }

  if (
    value ===
    'mantram'
  ) {
    return 'MantraM';
  }

  return 'Event';
}

function formatDateRange(
  startValue: string,
  endValue: string,
) {
  const start =
    new Date(
      startValue,
    );

  const end =
    new Date(
      endValue,
    );

  if (
    start.toDateString() ===
    end.toDateString()
  ) {
    return new Intl.DateTimeFormat(
      'en-GB',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      },
    ).format(
      start,
    );
  }

  const startLabel =
    new Intl.DateTimeFormat(
      'en-GB',
      {
        day: '2-digit',
        month: 'short',
      },
    ).format(
      start,
    );

  const endLabel =
    new Intl.DateTimeFormat(
      'en-GB',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      },
    ).format(
      end,
    );

  return `${startLabel} – ${endLabel}`;
}

function formatTimeRange(
  start: string,
  end: string,
) {
  return `${formatTime(
    start,
  )} – ${formatTime(
    end,
  )}`;
}

function formatTime(
  value: string,
) {
  if (!value) {
    return '';
  }

  const [
    hour,
    minute,
  ] =
    value.split(':');

  const date =
    new Date();

  date.setHours(
    Number(hour),
    Number(minute),
    0,
    0,
  );

  return new Intl.DateTimeFormat(
    'en-US',
    {
      hour: 'numeric',
      minute:
        '2-digit',
      hour12: true,
    },
  ).format(
    date,
  );
}
