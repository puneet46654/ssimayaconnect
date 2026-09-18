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

import { useRealtimeRefresh } from '@/components/realtime/RealtimeProvider';

/* ============================================================
   TYPES
============================================================ */

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

  daySchedules: DaySchedule[];
}

const EASE = [0.16, 1, 0.3, 1] as const;

/* ============================================================
   PAGE
============================================================ */

export default function EventDetailsPage() {
  const params = useParams<{
    id: string;
  }>();

  const router = useRouter();

  const eventId = params.id;

  const [event, setEvent] =
    useState<EventDetails | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const [copied, setCopied] =
    useState(false);

  const [
    showShareHint,
    setShowShareHint,
  ] = useState(false);

  const shareHintTimer =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  /* ============================================================
     FETCH EVENT
  ============================================================ */

  const fetchEvent =
    useCallback(async (showLoading = true) => {
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
            `/api/events/${encodeURIComponent(
              eventId,
            )}`,
            {
              method: 'GET',
              cache: 'no-store',
            },
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.error ||
              'Failed to load event.',
          );
        }

        setEvent(data.event);
      } catch (
        error: unknown
      ) {
        setError(
          error instanceof Error
            ? error.message
            : 'Failed to load event.',
        );
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    }, [eventId]);

  useEffect(() => {
    void Promise.resolve().then(
      () => fetchEvent(),
    );
  }, [fetchEvent]);

  useRealtimeRefresh(
    'events',
    (change) => {
      if (
        !change.id ||
        change.id === eventId
      ) {
        void fetchEvent(false);
      }
    },
  );

  /* ============================================================
     CLEAN TOOLTIP TIMER
  ============================================================ */

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

  /* ============================================================
     EVENT TIME
  ============================================================ */

  const eventTime =
    useMemo(() => {
      if (
        !event?.daySchedules
          ?.length
      ) {
        return '';
      }

      const firstDay =
        event.daySchedules[0];

      return formatTimeRange(
        firstDay.startTime,
        firstDay.endTime,
      );
    }, [event]);

  /* ============================================================
     LOADING
  ============================================================ */

  if (loading) {
    return (
      <EventDetailsSkeleton />
    );
  }

  /* ============================================================
     ERROR
  ============================================================ */

  if (error || !event) {
    return (
      <main className="min-h-dvh bg-[#F8FAFC] px-4">
        <div className="mx-auto flex min-h-dvh max-w-md items-center justify-center">
          <motion.div
            initial={{
              opacity: 0,
              y: 10,
              scale: 0.98,
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            transition={{
              duration: 0.45,
              ease: EASE,
            }}
            className="
              w-full

              rounded-2xl

              border
              border-gray-200

              bg-white

              p-6

              text-center

              shadow-sm
            "
          >
            <div
              className="
                mx-auto
                grid
                h-11
                w-11
                place-items-center

                rounded-full

                bg-red-50
                text-red-500
              "
            >
              <svg
                className="h-5 w-5"
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
                  d="M12 8v4"
                />

                <circle
                  cx="12"
                  cy="16"
                  r=".5"
                  fill="currentColor"
                />
              </svg>
            </div>

            <h1 className="mt-4 text-lg font-bold text-secondary">
              Event could not
              be loaded
            </h1>

            {error && (
              <p className="mt-2 text-sm text-gray-500">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={() =>
                router.back()
              }
              className="btn btn-secondary mt-5"
            >
              Go Back
            </button>
          </motion.div>
        </div>
      </main>
    );
  }

  /* ============================================================
     SHARE
  ============================================================ */

  async function handleShare() {
    try {
      if (navigator.share) {
        await navigator.share({
          title:
            event?.eventName,

          url:
            window.location.href,
        });

        return;
      }

      await navigator.clipboard.writeText(
        window.location.href,
      );

      setCopied(true);

      window.setTimeout(
        () =>
          setCopied(false),
        1400,
      );
    } catch {
      // User cancelled share.
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

    setShowShareHint(true);

    shareHintTimer.current =
      setTimeout(() => {
        setShowShareHint(false);
      }, 1800);
  }

  /* ============================================================
     RENDER
  ============================================================ */

  return (
    <main className="min-h-dvh bg-[#F8FAFC] pb-[138px] md:pb-10">
      {/* =====================================================
          HEADER
      ====================================================== */}

      <header
        className="
          sticky
          top-0
          z-50

          border-b
          border-gray-200/70

          bg-white/95

          backdrop-blur-xl
        "
      >
        <div
          className="
            relative

            mx-auto

            flex

            h-[104px]

            w-full
            max-w-[1180px]

            items-end
            justify-between

            px-4
            pb-4

            sm:px-6

            md:h-[74px]
            md:items-center
            md:pb-0

            lg:px-8
          "
        >
          {/* BACK */}

          <motion.button
            type="button"
            aria-label="Go back"
            onClick={() =>
              router.back()
            }
            whileTap={{
              scale: 0.92,
            }}
            whileHover={{
              x: -2,
            }}
            className="
              grid
              h-10
              w-10

              cursor-pointer
              place-items-center

              rounded-full

              bg-gray-50

              text-secondary

              transition-all
              duration-200

              hover:bg-gray-100
              hover:shadow-sm
            "
          >
            <svg
              className="h-[18px] w-[18px]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m15 18-6-6 6-6"
              />
            </svg>
          </motion.button>

          {/* BRAND ISLAND */}

          <motion.div
            initial={{
              opacity: 0,
              y: -10,
              scale: 0.96,
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            transition={{
              duration: 0.55,
              ease: EASE,
            }}
            className="
              absolute

              left-1/2
              top-[14px]

              -translate-x-1/2

              md:top-1/2
              md:-translate-y-1/2
            "
          >
            <Link
              href="/"
              className="
                inline-flex

                h-11

                items-center

                gap-2.5

                whitespace-nowrap

                rounded-full

                border
                border-primary/25

                bg-white

                px-4

                shadow-[0_8px_24px_rgba(27,75,107,0.09)]

                transition-all
                duration-300

                hover:-translate-y-0.5
                hover:border-primary/40
                hover:shadow-[0_12px_30px_rgba(27,75,107,0.13)]
              "
            >
              <Image
                src="/logos/ssilogo.png"
                alt="SSI"
                width={22}
                height={22}
                priority
                className="h-[22px] w-[22px] object-contain"
              />

              <span className="text-sm font-semibold tracking-[-0.01em] text-secondary">
                SSI Maya Connect
              </span>
            </Link>
          </motion.div>

          {/* SHARE */}

          <div
            className="relative"
            onMouseEnter={
              showShareTooltip
            }
            onFocus={
              showShareTooltip
            }
          >
            <motion.button
              type="button"
              aria-label="Share this event"
              onClick={
                handleShare
              }
              whileTap={{
                scale: 0.92,
              }}
              whileHover={{
                scale: 1.04,
              }}
              className="
                grid

                h-10
                w-10

                cursor-pointer

                place-items-center

                rounded-full

                bg-gray-50

                text-secondary

                transition-all
                duration-200

                hover:bg-primary/[0.06]
                hover:text-primary
                hover:shadow-sm
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
            </motion.button>

            <AnimatePresence>
              {showShareHint && (
                <motion.div
                  initial={{
                    opacity: 0,
                    y: 4,
                    scale: 0.96,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                  }}
                  exit={{
                    opacity: 0,
                    y: 4,
                    scale: 0.96,
                  }}
                  transition={{
                    duration: 0.16,
                  }}
                  className="
                    pointer-events-none

                    absolute

                    right-0
                    top-[48px]

                    z-[80]

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

                  <span
                    className="
                      absolute
                      -top-1
                      right-[14px]

                      h-2
                      w-2

                      rotate-45

                      bg-secondary
                    "
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* =====================================================
          PAGE CONTENT
      ====================================================== */}

      <div
        className="
          mx-auto

          w-full
          max-w-[1180px]

          sm:px-6
          sm:pt-5

          lg:px-8
        "
      >
        <motion.article
          initial={{
            opacity: 0,
            y: 16,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.55,
            ease: EASE,
          }}
          className="
            bg-white

            sm:rounded-[18px]
            sm:border
            sm:border-gray-200
            sm:shadow-[0_8px_30px_rgba(27,75,107,0.06)]
          "
        >
          {/* =================================================
              IMAGE
          ================================================== */}

          <motion.div
            initial={{
              opacity: 0,
              scale: 1.015,
            }}
            animate={{
              opacity: 1,
              scale: 1,
            }}
            transition={{
              duration: 0.7,
              ease: EASE,
            }}
            className="
              relative

              h-[220px]

              overflow-hidden

              rounded-b-[18px]

              bg-gray-100

              sm:h-[340px]
              sm:rounded-[18px]

              lg:h-[420px]
            "
          >
            {event.imageUrl ? (
              <motion.img
                src={
                  event.imageUrl
                }
                alt={
                  event.eventName
                }
                initial={{
                  scale: 1.025,
                }}
                animate={{
                  scale: 1,
                }}
                transition={{
                  duration: 1,
                  ease: EASE,
                }}
                whileHover={{
                  scale: 1.012,
                }}
                className="
                  h-full
                  w-full

                  object-cover
                "
              />
            ) : (
              <div className="h-full w-full bg-gray-100" />
            )}
          </motion.div>

          {/* =================================================
              EVENT CONTENT
          ================================================== */}

          <motion.div
            initial={{
              opacity: 0,
              y: 12,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.5,
              delay: 0.08,
              ease: EASE,
            }}
            className="
              bg-gradient-to-b
              from-white
              to-[#FCFDFE]

              px-4

              pb-5
              pt-5

              sm:rounded-b-[18px]

              sm:px-7
              sm:pb-7
              sm:pt-6

              lg:px-9
            "
          >
            {/* TITLE */}

            <h1
              className="
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

            {/* ORGANIZER */}

            <p
              className="
                mt-1.5

                text-[12px]

                text-gray-500

                sm:text-[13px]
              "
            >
              Organized by{' '}

              <span className="font-semibold text-primary">
                SSI INNOVATIONS
              </span>
            </p>

            {/* =================================================
                INFO PILLS
            ================================================== */}

            <motion.div
              initial={{
                opacity: 0,
                y: 8,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                duration: 0.45,
                delay: 0.16,
                ease: EASE,
              }}
              className="
                mt-5

                flex
                flex-wrap

                gap-2

                sm:gap-2.5
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
            </motion.div>

            {/* DIVIDER */}

            <div className="my-5 h-px bg-gray-200 sm:my-6" />

            {/* =================================================
                ABOUT
            ================================================== */}

            <motion.section
              initial={{
                opacity: 0,
                y: 10,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                duration: 0.45,
                delay: 0.2,
                ease: EASE,
              }}
            >
              <h2
                className="
                  font-heading

                  text-[17px]
                  font-bold

                  tracking-[-0.015em]

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
                  leading-[1.6]

                  text-gray-500

                  sm:text-sm
                  sm:leading-6
                "
              >
                {event.description}
              </p>
            </motion.section>
          </motion.div>
        </motion.article>
      </div>

      {/* =====================================================
          MOBILE ACTIONS
      ====================================================== */}

      <div
        className="
          fixed

          inset-x-0
          bottom-0

          z-50

          border-t
          border-gray-200/80

          bg-white/92

          px-4

          pb-[max(12px,env(safe-area-inset-bottom))]
          pt-3

          shadow-[0_-10px_30px_rgba(27,75,107,0.07)]

          backdrop-blur-2xl

          md:hidden
        "
      >
        <div className="mx-auto w-full max-w-[430px] space-y-2.5">
          {/* BOOK */}

          <motion.button
            type="button"
            disabled={
              event.status ===
              'COMPLETED'
            }
            onClick={() =>
              router.push(
                `/events/${event._id}/book`,
              )
            }
            whileTap={{
              scale: 0.985,
            }}
            className="
              flex

              h-[46px]

              w-full

              cursor-pointer

              items-center
              justify-center

              rounded-[11px]

              bg-primary

              text-sm
              font-semibold
              text-white

              shadow-[0_8px_20px_rgba(26,158,143,0.18)]

              transition-all
              duration-200

              hover:-translate-y-0.5
              hover:bg-primary-dark
              hover:shadow-[0_10px_24px_rgba(26,158,143,0.22)]

              active:translate-y-0

              disabled:cursor-not-allowed
              disabled:bg-gray-300
              disabled:shadow-none
            "
          >
            Book Tickets
          </motion.button>

          {/* BACK */}

          <motion.button
            type="button"
            onClick={() =>
              router.back()
            }
            whileTap={{
              scale: 0.985,
            }}
            className="
              flex

              h-[46px]

              w-full

              cursor-pointer

              items-center
              justify-center

              rounded-[11px]

              border
              border-secondary/65

              bg-white

              text-sm
              font-semibold
              text-secondary

              transition-all
              duration-200

              hover:-translate-y-0.5
              hover:border-secondary
              hover:bg-gray-50

              active:translate-y-0
            "
          >
            Go Back
          </motion.button>
        </div>
      </div>

      {/* =====================================================
          DESKTOP ACTIONS
      ====================================================== */}

      <motion.div
        initial={{
          opacity: 0,
          y: 10,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        transition={{
          duration: 0.45,
          delay: 0.25,
          ease: EASE,
        }}
        className="
          mx-auto

          mt-4

          hidden

          w-full
          max-w-[1180px]

          gap-3

          px-6

          md:flex

          lg:px-8
        "
      >
        <button
          type="button"
          disabled={
            event.status ===
            'COMPLETED'
          }
          onClick={() =>
            router.push(
              `/events/${event._id}/book`,
            )
          }
          className="
            btn
            btn-primary

            h-11

            flex-1

            rounded-[11px]

            shadow-[0_8px_20px_rgba(26,158,143,0.15)]

            transition-all
            duration-200

            hover:-translate-y-0.5
            hover:shadow-[0_10px_24px_rgba(26,158,143,0.20)]
          "
        >
          Book Tickets
        </button>

        <button
          type="button"
          onClick={() =>
            router.back()
          }
          className="
            btn
            btn-secondary

            h-11

            flex-1

            rounded-[11px]

            transition-all
            duration-200

            hover:-translate-y-0.5
          "
        >
          Go Back
        </button>
      </motion.div>

      {/* =====================================================
          COPY FEEDBACK
      ====================================================== */}

      <AnimatePresence>
        {copied && (
          <motion.div
            initial={{
              opacity: 0,
              y: -8,
              scale: 0.96,
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            exit={{
              opacity: 0,
              y: -8,
              scale: 0.96,
            }}
            transition={{
              duration: 0.2,
            }}
            className="
              fixed

              left-1/2
              top-[118px]

              z-[80]

              -translate-x-1/2

              rounded-full

              border
              border-gray-200

              bg-white/95

              px-3
              py-1.5

              text-[11px]
              font-semibold
              text-secondary

              shadow-lg

              backdrop-blur-xl

              md:top-[84px]
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
   INFO PILL
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
    <motion.div
      whileHover={{
        y: -1,
      }}
      transition={{
        duration: 0.18,
      }}
      className="
        inline-flex

        min-h-[30px]

        items-center
        gap-1.5

        rounded-[9px]

        border
        border-gray-200

        bg-white

        px-2.5
        py-1.5

        text-[11px]
        font-medium

        text-secondary

        shadow-[0_3px_10px_rgba(27,75,107,0.035)]

        transition-all
        duration-200

        hover:border-primary/25
        hover:shadow-[0_6px_16px_rgba(27,75,107,0.06)]

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
    </motion.div>
  );
}

/* ============================================================
   INFO ICON
============================================================ */

function InfoIcon({
  type,
}: {
  type:
    | 'calendar'
    | 'clock'
    | 'location';
}) {
  if (
    type === 'calendar'
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
    type === 'clock'
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
          strokeLinejoin="round"
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
    <main className="min-h-dvh bg-[#F8FAFC] pb-[138px]">
      {/* HEADER */}

      <div className="h-[104px] border-b border-gray-200 bg-white md:h-[74px]" />

      <div className="mx-auto w-full max-w-[1180px] sm:px-6 sm:pt-5 lg:px-8">
        <div className="bg-white sm:rounded-[18px] sm:border sm:border-gray-200">
          {/* IMAGE */}

          <div
            className="
              h-[220px]

              animate-pulse

              rounded-b-[18px]

              bg-gray-100

              sm:h-[340px]
              sm:rounded-[18px]

              lg:h-[420px]
            "
          />

          {/* BODY */}

          <div className="px-4 py-5 sm:px-7 sm:py-6">
            <div className="h-7 w-[82%] animate-pulse rounded bg-gray-100" />

            <div className="mt-2 h-4 w-44 animate-pulse rounded bg-gray-100" />

            <div className="mt-5 flex flex-wrap gap-2">
              <div className="h-8 w-32 animate-pulse rounded-lg bg-gray-100" />

              <div className="h-8 w-40 animate-pulse rounded-lg bg-gray-100" />

              <div className="h-8 w-36 animate-pulse rounded-lg bg-gray-100" />
            </div>

            <div className="my-5 h-px bg-gray-200" />

            <div className="h-5 w-36 animate-pulse rounded bg-gray-100" />

            <div className="mt-3 space-y-2.5">
              <div className="h-3.5 w-full animate-pulse rounded bg-gray-100" />

              <div className="h-3.5 w-full animate-pulse rounded bg-gray-100" />

              <div className="h-3.5 w-[86%] animate-pulse rounded bg-gray-100" />
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE BUTTONS */}

      <div
        className="
          fixed
          inset-x-0
          bottom-0

          border-t
          border-gray-200

          bg-white

          px-4
          pb-4
          pt-3

          md:hidden
        "
      >
        <div className="mx-auto max-w-[430px] space-y-2.5">
          <div className="h-[46px] animate-pulse rounded-[11px] bg-gray-100" />

          <div className="h-[46px] animate-pulse rounded-[11px] bg-gray-100" />
        </div>
      </div>
    </main>
  );
}

/* ============================================================
   FORMATTERS
============================================================ */

function formatDateRange(
  startValue: string,
  endValue: string,
) {
  const start =
    new Date(startValue);

  const end =
    new Date(endValue);

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
    ).format(start);
  }

  const sameMonth =
    start.getMonth() ===
      end.getMonth() &&
    start.getFullYear() ===
      end.getFullYear();

  if (sameMonth) {
    const startDay =
      new Intl.DateTimeFormat(
        'en-GB',
        {
          day: '2-digit',
        },
      ).format(start);

    const endLabel =
      new Intl.DateTimeFormat(
        'en-GB',
        {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        },
      ).format(end);

    return `${startDay}–${endLabel}`;
  }

  const startLabel =
    new Intl.DateTimeFormat(
      'en-GB',
      {
        day: '2-digit',
        month: 'short',
      },
    ).format(start);

  const endLabel =
    new Intl.DateTimeFormat(
      'en-GB',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      },
    ).format(end);

  return `${startLabel} – ${endLabel}`;
}

function formatTimeRange(
  start: string,
  end: string,
) {
  return `${formatTime(
    start,
  )} - ${formatTime(
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
    hourString,
    minuteString,
  ] = value.split(':');

  const date =
    new Date();

  date.setHours(
    Number(hourString),
    Number(minuteString),
    0,
    0,
  );

  return new Intl.DateTimeFormat(
    'en-US',
    {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    },
  ).format(date);
}