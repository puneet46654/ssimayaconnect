'use client';

import Image from 'next/image';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  useParams,
  useRouter,
} from 'next/navigation';

import ConferenceTemplate from '@/app/components/admin/booking-templates/ConferenceTemplate';

import MantramTemplate from '@/app/components/admin/booking-templates/MantramTemplate';

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

const DEFAULT_BOOKING_TEMPLATE:
  BookingFormTemplate =
    'practitioner-institutional';

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
    normalized ===
      'practitioner' ||
    normalized ===
      'practitioner-institutional' ||
    normalized ===
      'practitioner_institutional' ||
    normalized ===
      'practitioner institutional' ||
    normalized ===
      'template-1' ||
    normalized ===
      'template1'
  ) {
    return 'practitioner-institutional';
  }

  if (
    normalized ===
      'template-2' ||
    normalized ===
      'template2'
  ) {
    return 'template-2';
  }

  if (
    normalized ===
      'template-3' ||
    normalized ===
      'template3'
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

  const loadEvent =
    useCallback(
      async () => {
        if (!eventId) {
          return;
        }

        setLoading(
          true,
        );

        setError('');

        try {
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
                  'Cache-Control':
                    'no-cache',
                },
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
                'Unable to load event.',
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
            'Failed to load booking event:',
            error,
          );

          setError(
            error instanceof
              Error
              ? error.message
              : 'Unable to load event.',
          );

          setEvent(
            null,
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [
        eventId,
      ],
    );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadEvent();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [
    loadEvent,
  ]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (
        document.visibilityState ===
        'visible'
      ) {
        void loadEvent();
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

  if (loading) {
    return (
      <BookingTemplateSkeleton />
    );
  }

  if (
    error ||
    !event
  ) {
    return (
      <BookingMessage
        title="Unable to load booking"
        message={
          error ||
          'Event could not be loaded.'
        }
        onBack={() =>
          router.back()
        }
      />
    );
  }

  if (
    event.status ===
    'COMPLETED'
  ) {
    return (
      <BookingMessage
        title="Booking unavailable"
        message="This event has already completed."
        onBack={() =>
          router.back()
        }
      />
    );
  }

  switch (
    event.bookingFormTemplate
  ) {
    case 'practitioner-institutional':
      return (
        <ConferenceTemplate
          key={`${event._id}-practitioner-institutional`}
          eventId={
            event._id
          }
          eventName={
            event.eventName
          }
        />
      );

    case 'template-2':
      return (
        <MantramTemplate
          key={`${event._id}-template-2`}
          eventId={
            event._id
          }
          eventName={
            event.eventName
          }
        />
      );

    case 'template-3':
      return (
        <BookingMessage
          title="Registration form unavailable"
          message="Template 3 is not available yet."
          onBack={() =>
            router.back()
          }
        />
      );

    default:
      return (
        <ConferenceTemplate
          key={`${event._id}-fallback`}
          eventId={
            event._id
          }
          eventName={
            event.eventName
          }
        />
      );
  }
}

function BookingMessage({
  title,
  message,
  onBack,
}: {
  title: string;

  message: string;

  onBack:
    () => void;
}) {
  return (
    <main className="min-h-dvh bg-gray-50 px-4">
      <div className="mx-auto flex min-h-dvh w-full max-w-md items-center justify-center">
        <div className="w-full rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-[0_10px_35px_rgba(27,75,107,0.07)]">
          <div className="flex justify-center">
            <div className="inline-flex h-10 items-center gap-2 rounded-full border border-primary/25 bg-white px-3.5 shadow-sm">
              <Image
                src="/logos/ssilogo.png"
                alt="SSI"
                width={20}
                height={20}
                priority
                className="h-5 w-5 object-contain"
              />

              <span className="text-xs font-semibold text-secondary">
                SSI Maya Connect
              </span>
            </div>
          </div>

          <h1 className="mt-6 font-heading text-lg font-bold text-secondary">
            {title}
          </h1>

          <p className="mt-2 text-sm leading-6 text-gray-500">
            {message}
          </p>

          <button
            type="button"
            onClick={
              onBack
            }
            className="mt-5 flex h-10 w-full cursor-pointer items-center justify-center rounded-lg border border-secondary bg-white text-sm font-semibold text-secondary transition-all hover:bg-gray-50 active:scale-[0.99]"
          >
            Go Back
          </button>
        </div>
      </div>
    </main>
  );
}

function BookingTemplateSkeleton() {
  return (
    <main className="min-h-dvh bg-gray-50 px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto w-full max-w-[1500px] rounded-[22px] border border-gray-200 bg-white px-4 py-6 sm:px-6 lg:px-10">
        <div className="mx-auto h-10 w-[170px] animate-pulse rounded-full bg-gray-100" />

        <div className="mt-8 h-7 w-[320px] max-w-full animate-pulse rounded bg-gray-100" />

        <div className="mt-2 h-4 w-[250px] max-w-full animate-pulse rounded bg-gray-100" />

        <div className="mt-7 grid gap-4 md:grid-cols-2">
          {Array.from({
            length: 8,
          }).map(
            (
              _,
              index,
            ) => (
              <div
                key={index}
                className="h-11 animate-pulse rounded-xl bg-gray-100"
              />
            ),
          )}
        </div>

        <div className="mt-6 h-11 animate-pulse rounded-xl bg-gray-100" />

        <div className="mt-2.5 h-11 animate-pulse rounded-xl bg-gray-100" />
      </div>
    </main>
  );
}