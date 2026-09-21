'use client';

import Image from 'next/image';
import Link from 'next/link';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  useParams,
  useRouter,
} from 'next/navigation';

import {
  motion,
} from 'framer-motion';

import ConferenceTemplate from '@/app/components/admin/booking-templates/ConferenceTemplate';

import MantramTemplate from '@/app/components/admin/booking-templates/MantramTemplate';

import { trackActivity } from '@/lib/activity-client';

type BookingFormTemplate =
  | 'practitioner-institutional'
  | 'template-2'
  | 'template-3';

interface BookingEvent {
  _id: string;

  eventName: string;

  bookingFormTemplate:
    BookingFormTemplate;

  status:
    | 'LIVE'
    | 'UPCOMING'
    | 'COMPLETED';
}

interface EventApiPayload {
  _id?: unknown;
  eventName?: unknown;
  bookingFormTemplate?: unknown;
  status?: unknown;
}

interface EventApiResponse {
  success?: unknown;
  error?: unknown;
  event?: EventApiPayload;
}

const DEFAULT_BOOKING_TEMPLATE:
  BookingFormTemplate =
    'practitioner-institutional';

const EASE = [
  0.16,
  1,
  0.3,
  1,
] as const;

function normalizeBookingTemplate(
  value: unknown,
): BookingFormTemplate {
  const normalized =
    String(
      value || '',
    )
      .trim()
      .toLowerCase();

  if (
    [
      'practitioner',
      'practitioner-institutional',
      'practitioner_institutional',
      'practitioner institutional',
      'template-1',
      'template1',
    ].includes(
      normalized,
    )
  ) {
    return 'practitioner-institutional';
  }

  if (
    [
      'template-2',
      'template2',
    ].includes(
      normalized,
    )
  ) {
    return 'template-2';
  }

  if (
    [
      'template-3',
      'template3',
    ].includes(
      normalized,
    )
  ) {
    return 'template-3';
  }

  return DEFAULT_BOOKING_TEMPLATE;
}

export default function EventBookingPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const router =
    useRouter();

  const eventId =
    params.id;

  useEffect(() => {
    if (eventId) {
      void trackActivity(
        'page_view',
        {
          eventId,
        },
      );
    }
  }, [
    eventId,
  ]);

  const [
    event,
    setEvent,
  ] =
    useState<BookingEvent | null>(
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

  /* ============================================================
     LOAD PUBLIC EVENT
  ============================================================ */

  const loadEvent =
    useCallback(
      async (
        showLoading = true,
      ) => {
        if (!eventId) {
          return;
        }

        if (showLoading) {
          setLoading(
            true,
          );
        }

        setError('');

        try {
          /*
           * PUBLIC API.
           *
           * Do NOT send the admin token here.
           */
          const response =
            await fetch(
              `/api/events/${encodeURIComponent(
                eventId,
              )}?refresh=${Date.now()}`,
              {
                method:
                  'GET',

                cache:
                  'no-store',

                headers: {
                  Accept:
                    'application/json',

                  'Cache-Control':
                    'no-cache',
                },
              },
            );

          let data:
            | EventApiResponse
            | null =
            null;

          try {
            data =
              await response.json();
          } catch {
            throw new Error(
              'The event server returned an invalid response.',
            );
          }

          if (
            !response.ok ||
            !data?.success ||
            !data.event
          ) {
            throw new Error(
              typeof data?.error === 'string'
                ? data.error
                :
                'Unable to load this event.',
            );
          }

          if (
            data.event.status !== 'LIVE' &&
            data.event.status !== 'UPCOMING' &&
            data.event.status !== 'COMPLETED'
          ) {
            throw new Error(
              'The event server returned an invalid event status.',
            );
          }

          const template =
            normalizeBookingTemplate(
              data.event
                .bookingFormTemplate,
            );

          setEvent({
            _id:
              String(
                data.event._id,
              ),

            eventName:
              String(
                data.event
                  .eventName ||
                  '',
              ),

            bookingFormTemplate:
              template,

            status:
              data.event.status,
          });
        } catch (
          error: unknown
        ) {
          console.error(
            'Booking event loading error:',
            error,
          );

          setEvent(null);

          setError(
            error instanceof Error
              ? error.message
              : 'Unable to load this event.',
          );
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
      void loadEvent();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    loadEvent,
  ]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (
        document.visibilityState ===
        'visible'
      ) {
        void loadEvent(
          false,
        );
      }
    }

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    );

    return () => {
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      );
    };
  }, [
    loadEvent,
  ]);

  return (
    <main
      className="
        min-h-dvh
        w-full
        overflow-x-hidden
        bg-[#F7F9FB]
      "
    >
      {/* GLOBAL BOOKING HEADER */}

      <BookingHeader
        eventName={
          event?.eventName
        }
        onBack={() =>
          router.back()
        }
      />

      {/* PAGE */}

      <div
        className="
          mx-auto
          w-full
          max-w-[1500px]

          pb-8
          pt-4

          sm:pt-5

          lg:pb-10
          lg:pt-6
        "
      >
        {loading ? (
          <BookingTemplateSkeleton />
        ) : error ||
          !event ? (
          <BookingMessage
            title="Unable to load booking"
            message={
              error ||
              'The event could not be loaded.'
            }
            primaryLabel="Try Again"
            onPrimary={() =>
              void loadEvent()
            }
            onBack={() =>
              router.back()
            }
          />
        ) : event.status ===
          'COMPLETED' ? (
          <BookingMessage
            title="Booking unavailable"
            message="This event has already completed and is no longer accepting bookings."
            onBack={() =>
              router.back()
            }
          />
        ) : event.bookingFormTemplate ===
          'template-3' ? (
          <BookingMessage
            title="Registration form unavailable"
            message="The registration form for this event is not available yet."
            onBack={() =>
              router.back()
            }
          />
        ) : (
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
              duration:
                0.38,
              ease: EASE,
            }}
            className="
              booking-template-page
              min-w-0
              w-full
            "
          >
            {event.bookingFormTemplate ===
              'practitioner-institutional' ? (
              <ConferenceTemplate
                key={`${event._id}-conference`}
                eventId={
                  event._id
                }
                eventName={
                  event.eventName
                }
              />
            ) : (
              <MantramTemplate
                key={`${event._id}-mantram`}
                eventId={
                  event._id
                }
                eventName={
                  event.eventName
                }
              />
            )}
          </motion.div>
        )}
      </div>

      {/*
       * Your ConferenceTemplate and MantramTemplate
       * currently render their own SSI island.
       *
       * Until we remove that markup from those two files,
       * hide only that duplicate element here.
       */}
      <style
        dangerouslySetInnerHTML={{
          __html:
            '.booking-template-page > main > div > form > div:first-child { display: none; } .booking-template-page > main { min-height: auto !important; background: transparent !important; } .booking-template-page > main > div { padding-top: 0 !important; }',
        }}
      />
    </main>
  );
}

/* ============================================================
   HEADER
============================================================ */

function BookingHeader({
  eventName,
  onBack,
}: {
  eventName?:
    string;

  onBack:
    () => void;
}) {
  return (
    <header
      className="
        sticky
        top-0
        z-[150]

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
          max-w-[1500px]

          items-center
          justify-between

          px-3

          sm:h-[68px]
          sm:px-5

          lg:px-8
        "
      >
        {/* BACK */}

        <button
          type="button"
          aria-label="Go back"
          onClick={
            onBack
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

        {/* SSI ISLAND */}

        <Link
          href="/events"
          className="
            absolute
            left-1/2
            top-1/2

            flex
            h-10
            max-w-[205px]

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
            duration-200

            hover:border-primary/35
            hover:shadow-[0_7px_20px_rgba(27,75,107,0.09)]

            min-[390px]:max-w-[240px]

            sm:h-11
            sm:max-w-[270px]
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
          aria-hidden="true"
          className="
            h-10
            w-10

            sm:h-11
            sm:w-11
          "
        />
      </div>

      {eventName && (
        <div
          className="
            border-t
            border-gray-200/60

            bg-white/45
          "
        >
          <p
            className="
              mx-auto

              max-w-[600px]

              truncate

              px-6
              py-2

              text-center

              text-[10px]
              font-medium
              text-gray-500

              sm:text-[11px]
            "
          >
            Registration for{' '}
            <span
              className="
                font-semibold
                text-secondary
              "
            >
              {eventName}
            </span>
          </p>
        </div>
      )}
    </header>
  );
}

/* ============================================================
   MESSAGE
============================================================ */

function BookingMessage({
  title,
  message,
  onBack,
  primaryLabel,
  onPrimary,
}: {
  title: string;

  message: string;

  onBack:
    () => void;

  primaryLabel?: string;

  onPrimary?:
    () => void;
}) {
  return (
    <div
      className="
        flex
        min-h-[calc(100dvh-150px)]

        items-center
        justify-center

        px-4
        py-10
      "
    >
      <div
        className="
          w-full
          max-w-[410px]

          rounded-2xl

          border
          border-gray-200

          bg-white

          p-6

          text-center

          shadow-[0_12px_35px_rgba(27,75,107,0.06)]

          sm:p-7
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

            bg-gray-50

            text-gray-400
          "
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
          >
            <circle
              cx="12"
              cy="12"
              r="8"
            />

            <path
              strokeLinecap="round"
              d="M12 8v4"
            />

            <circle
              cx="12"
              cy="16"
              r=".8"
              fill="currentColor"
              stroke="none"
            />
          </svg>
        </div>

        <h1
          className="
            mt-4

            font-heading

            text-lg
            font-bold

            text-secondary
          "
        >
          {title}
        </h1>

        <p
          className="
            mt-2

            text-[13px]
            leading-6

            text-gray-500
          "
        >
          {message}
        </p>

        <div
          className={`
            mt-5
            grid
            gap-2.5

            ${
              onPrimary
                ? 'sm:grid-cols-2'
                : ''
            }
          `}
        >
          <button
            type="button"
            onClick={
              onBack
            }
            className="
              h-11

              cursor-pointer

              rounded-xl

              border
              border-gray-200

              bg-white

              text-sm
              font-semibold

              text-secondary

              transition

              hover:bg-gray-50
            "
          >
            Go Back
          </button>

          {onPrimary &&
            primaryLabel && (
              <button
                type="button"
                onClick={
                  onPrimary
                }
                className="
                  h-11

                  cursor-pointer

                  rounded-xl

                  bg-primary

                  text-sm
                  font-semibold
                  text-white

                  transition

                  hover:brightness-95
                "
              >
                {
                  primaryLabel
                }
              </button>
            )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   LOADING
============================================================ */

function BookingTemplateSkeleton() {
  return (
    <div
      className="
        mx-auto
        w-full
        max-w-[1500px]

        px-3

        sm:px-5

        md:px-6

        lg:px-8

        xl:px-10
      "
    >
      <div
        className="
          mt-2
          max-w-[650px]
        "
      >
        <div
          className="
            h-7
            w-[290px]
            max-w-[82vw]

            animate-pulse

            rounded

            bg-gray-200
          "
        />

        <div
          className="
            mt-2.5

            h-4
            w-[210px]

            animate-pulse

            rounded

            bg-gray-100
          "
        />
      </div>

      <div
        className="
          mt-7

          grid
          grid-cols-1

          gap-4

          md:grid-cols-2
          md:gap-5
        "
      >
        {Array.from({
          length: 8,
        }).map(
          (
            _,
            index,
          ) => (
            <SkeletonField
              key={
                index
              }
            />
          ),
        )}
      </div>

      <div
        className="
          mt-7

          grid
          gap-3

          sm:grid-cols-2
        "
      >
        <div className="h-12 animate-pulse rounded-xl bg-gray-100" />

        <div className="h-12 animate-pulse rounded-xl bg-primary/10" />
      </div>
    </div>
  );
}

function SkeletonField() {
  return (
    <div>
      <div
        className="
          mb-1.5

          h-2.5
          w-24

          animate-pulse

          rounded

          bg-gray-200
        "
      />

      <div
        className="
          h-11
          w-full

          animate-pulse

          rounded-xl

          bg-gray-100

          sm:h-12
        "
      />
    </div>
  );
}