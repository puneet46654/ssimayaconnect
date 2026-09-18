'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import Link from 'next/link';
import Image from 'next/image';

import { useRealtimeRefresh } from '@/components/realtime/RealtimeProvider';

interface IEvent {
  _id: string;

  eventName: string;

  eventType:
    | 'conference'
    | 'mantram'
    | 'event';

  venue: string;

  startDate: string;

  endDate: string;

  totalSlots: number;

  bookedSlots: number;

  status:
    | 'LIVE'
    | 'COMPLETED'
    | 'UPCOMING';

  description?: string;

  imageUrl?: string;

  bookingFormTemplate?:
    | 'practitioner-institutional'
    | 'template-2'
    | 'template-3';
}

type EventTab =
  | 'All Events'
  | 'Conferences'
  | 'Mantram'
  | 'Live'
  | 'Upcoming'
  | 'Completed';

const tabs: EventTab[] = [
  'All Events',
  'Conferences',
  'Mantram',
  'Live',
  'Upcoming',
  'Completed',
];

export default function EventsManagementPage() {
  const [events, setEvents] =
    useState<IEvent[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const [
    activeTab,
    setActiveTab,
  ] =
    useState<EventTab>(
      'All Events',
    );

  const [
    deletingId,
    setDeletingId,
  ] =
    useState<string | null>(
      null,
    );

  const fetchEvents =
    useCallback(async () => {
      setLoading(true);

      setError('');

      try {
        const response =
          await fetch(
            `/api/events?refresh=${Date.now()}`,
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
              'Failed to fetch events.',
          );
        }

        setEvents(
          Array.isArray(
            data.events,
          )
            ? data.events
            : [],
        );
      } catch (
        error: unknown
      ) {
        setError(
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred.',
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchEvents();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchEvents]);

  useRealtimeRefresh(
    'events',
    () => {
      void fetchEvents();
    },
  );

  async function handleDelete(
    id: string,
    name: string,
  ) {
    const confirmed =
      window.confirm(
        `Are you sure you want to delete "${name}"?`,
      );

    if (!confirmed) {
      return;
    }

    setDeletingId(id);

    try {
      const response =
        await fetch(
          `/api/events/${encodeURIComponent(
            id,
          )}`,
          {
            method: 'DELETE',
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
            'Failed to delete event.',
        );
      }

      setEvents(
        (current) =>
          current.filter(
            (event) =>
              event._id !== id,
          ),
      );
    } catch (
      error: unknown
    ) {
      window.alert(
        error instanceof Error
          ? error.message
          : 'Error deleting event.',
      );
    } finally {
      setDeletingId(null);
    }
  }

  const filteredEvents =
    useMemo(() => {
      return events.filter(
        (event) => {
          if (
            activeTab ===
            'All Events'
          ) {
            return true;
          }

          if (
            activeTab ===
            'Conferences'
          ) {
            return (
              event.eventType ===
              'conference'
            );
          }

          if (
            activeTab ===
            'Mantram'
          ) {
            return (
              event.eventType ===
              'mantram'
            );
          }

          if (
            activeTab ===
            'Live'
          ) {
            return (
              event.status ===
              'LIVE'
            );
          }

          if (
            activeTab ===
            'Upcoming'
          ) {
            return (
              event.status ===
              'UPCOMING'
            );
          }

          if (
            activeTab ===
            'Completed'
          ) {
            return (
              event.status ===
              'COMPLETED'
            );
          }

          return true;
        },
      );
    }, [
      events,
      activeTab,
    ]);

  const stats =
    useMemo(
      () => ({
        total:
          events.length,

        live:
          events.filter(
            (event) =>
              event.status ===
              'LIVE',
          ).length,

        upcoming:
          events.filter(
            (event) =>
              event.status ===
              'UPCOMING',
          ).length,

        completed:
          events.filter(
            (event) =>
              event.status ===
              'COMPLETED',
          ).length,
      }),
      [events],
    );

  function formatDate(
    date: string,
  ) {
    return new Date(
      date,
    ).toLocaleDateString(
      'en-GB',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      },
    );
  }

  function formatDateRange(
    startDate: string,
    endDate: string,
  ) {
    const start =
      new Date(
        startDate,
      );

    const end =
      new Date(
        endDate,
      );

    if (
      start.toDateString() ===
      end.toDateString()
    ) {
      return formatDate(
        startDate,
      );
    }

    return `${formatDate(
      startDate,
    )} – ${formatDate(
      endDate,
    )}`;
  }

  function shortDescription(
    description?: string,
  ) {
    if (!description) {
      return '';
    }

    if (
      description.length <=
      120
    ) {
      return description;
    }

    return `${description.slice(
      0,
      120,
    )}…`;
  }

  return (
    <main
      className="
        w-full
        pb-8
      "
    >
      {/* HEADER */}

      <header
        className="
          flex
          flex-col
          gap-5
          border-b
          border-gray-200
          pb-6
          sm:flex-row
          sm:items-end
          sm:justify-between
        "
      >
        <div>
          <h1
            className="
              font-heading
              text-[26px]
              font-bold
              tracking-[-0.025em]
              text-secondary
              sm:text-[30px]
            "
          >
            Events Management
          </h1>

          <p
            className="
              mt-1.5
              max-w-xl
              text-[13px]
              leading-5
              text-gray-500
              sm:text-sm
            "
          >
            Manage event information,
            schedules and registrations.
          </p>
        </div>

        <Link
          href="/admin/eventmanagement/new"
          className="
            inline-flex
            h-10
            w-full
            items-center
            justify-center
            gap-2
            rounded-lg
            bg-primary
            px-4
            text-sm
            font-semibold
            text-white
            transition-colors
            duration-200
            hover:brightness-95
            sm:w-auto
          "
        >
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
              d="M12 5v14M5 12h14"
            />
          </svg>

          New Event
        </Link>
      </header>

      {/* SUMMARY */}

      <section
        className="
          grid
          grid-cols-2
          border-b
          border-gray-200
          sm:grid-cols-4
        "
      >
        <SummaryItem
          label="Total"
          value={stats.total}
        />

        <SummaryItem
          label="Live"
          value={stats.live}
        />

        <SummaryItem
          label="Upcoming"
          value={stats.upcoming}
        />

        <SummaryItem
          label="Completed"
          value={stats.completed}
        />
      </section>

      {/* FILTER */}

      <section
        className="
          mt-5
          overflow-x-auto
          border-b
          border-gray-200
          [scrollbar-width:none]
          [&::-webkit-scrollbar]:hidden
        "
      >
        <div
          className="
            flex
            min-w-max
            gap-6
          "
        >
          {tabs.map(
            (tab) => {
              const active =
                activeTab ===
                tab;

              return (
                <button
                  key={
                    tab
                  }
                  type="button"
                  onClick={() =>
                    setActiveTab(
                      tab,
                    )
                  }
                  className={`
                    relative
                    cursor-pointer
                    pb-3
                    text-[13px]
                    font-medium
                    transition-colors
                    duration-200
                    sm:text-sm

                    ${
                      active
                        ? 'text-secondary'
                        : 'text-gray-400 hover:text-gray-600'
                    }
                  `}
                >
                  {tab}

                  {active && (
                    <span
                      className="
                        absolute
                        inset-x-0
                        bottom-0
                        h-[2px]
                        rounded-full
                        bg-primary
                      "
                    />
                  )}
                </button>
              );
            },
          )}
        </div>
      </section>

      {/* ERROR */}

      {error && (
        <div
          className="
            mt-5
            flex
            items-center
            justify-between
            gap-4
            rounded-lg
            border
            border-red-200
            bg-red-50
            px-4
            py-3
          "
        >
          <p
            className="
              text-sm
              text-red-700
            "
          >
            {error}
          </p>

          <button
            type="button"
            onClick={() =>
              void fetchEvents()
            }
            className="
              shrink-0
              cursor-pointer
              text-sm
              font-semibold
              text-red-700
            "
          >
            Retry
          </button>
        </div>
      )}

      {/* LOADING */}

      {loading && (
        <EventsSkeleton />
      )}

      {/* EMPTY */}

      {!loading &&
        filteredEvents.length ===
          0 && (
          <div
            className="
              flex
              min-h-[320px]
              items-center
              justify-center
              text-center
            "
          >
            <div>
              <h2
                className="
                  text-base
                  font-semibold
                  text-secondary
                "
              >
                No events found
              </h2>

              <p
                className="
                  mt-1
                  text-sm
                  text-gray-500
                "
              >
                No events match
                the selected filter.
              </p>
            </div>
          </div>
        )}

      {/* EVENT GRID */}

      {!loading &&
        filteredEvents.length >
          0 && (
          <section
            className="
              mt-6
              grid
              grid-cols-1
              gap-4
              xl:grid-cols-2
            "
          >
            {filteredEvents.map(
              (event) => (
                <EventCard
                  key={
                    event._id
                  }
                  event={
                    event
                  }
                  deleting={
                    deletingId ===
                    event._id
                  }
                  dateRange={formatDateRange(
                    event.startDate,
                    event.endDate,
                  )}
                  description={shortDescription(
                    event.description,
                  )}
                  onDelete={
                    handleDelete
                  }
                />
              ),
            )}
          </section>
        )}

      {!loading &&
        filteredEvents.length >
          0 && (
          <div
            className="
              mt-6
              border-t
              border-gray-200
              pt-4
              text-xs
              text-gray-400
            "
          >
            Showing{' '}
            <span className="font-semibold text-gray-600">
              {
                filteredEvents.length
              }
            </span>{' '}
            of{' '}
            <span className="font-semibold text-gray-600">
              {events.length}
            </span>{' '}
            events
          </div>
        )}
    </main>
  );
}

/* ============================================================
   EVENT CARD
============================================================ */

function EventCard({
  event,
  deleting,
  dateRange,
  description,
  onDelete,
}: {
  event: IEvent;

  deleting: boolean;

  dateRange: string;

  description: string;

  onDelete: (
    id: string,
    name: string,
  ) => Promise<void>;
}) {
  const booked =
    event.bookedSlots || 0;

  const total =
    event.totalSlots || 0;

  const progress =
    total > 0
      ? Math.min(
          100,
          (booked / total) *
            100,
        )
      : 0;

  return (
    <article
      className="
        overflow-hidden
        rounded-xl
        border
        border-gray-200
        bg-white
        transition-colors
        duration-200
        hover:border-gray-300
      "
    >
      <div
        className="
          grid
          grid-cols-1
          sm:grid-cols-[180px_minmax(0,1fr)]
          lg:grid-cols-[200px_minmax(0,1fr)]
        "
      >
        {/* IMAGE */}

        <div
          className="
            relative
            h-[190px]
            overflow-hidden
            bg-gray-100
            sm:h-full
            sm:min-h-[250px]
          "
        >
          {event.imageUrl ? (
            <Image
              src={
                event.imageUrl
              }
              alt={
                event.eventName
              }
              fill
              unoptimized
              sizes="
                (max-width: 640px) 100vw,
                220px
              "
              className="
                object-cover
              "
            />
          ) : (
            <div
              className="
                flex
                h-full
                items-center
                justify-center
                bg-gray-100
                text-gray-300
              "
            >
              <svg
                className="h-9 w-9"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5l5.5-5.5 4 4L15 12.5l6 6M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z"
                />
              </svg>
            </div>
          )}

          <div
            className="
              absolute
              left-3
              top-3
            "
          >
            <StatusLabel
              status={
                event.status
              }
            />
          </div>
        </div>

        {/* BODY */}

        <div
          className="
            flex
            min-w-0
            flex-col
            p-4
            sm:p-5
          "
        >
          <div
            className="
              flex
              items-start
              justify-between
              gap-4
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
                {
                  event.eventType
                }
              </p>

              <h2
                className="
                  mt-1
                  line-clamp-2
                  font-heading
                  text-[17px]
                  font-bold
                  leading-[1.3]
                  text-secondary
                  sm:text-[18px]
                "
              >
                {
                  event.eventName
                }
              </h2>
            </div>
          </div>

          {/* INFO */}

          <div
            className="
              mt-4
              space-y-2
            "
          >
            <MetaRow
              icon={
                <CalendarIcon />
              }
            >
              {dateRange}
            </MetaRow>

            <MetaRow
              icon={
                <LocationIcon />
              }
            >
              {event.venue}
            </MetaRow>
          </div>

          {/* ABOUT */}

          {description && (
            <div
              className="
                mt-4
                border-t
                border-gray-100
                pt-3.5
              "
            >
              <p
                className="
                  text-[11px]
                  font-semibold
                  text-gray-500
                "
              >
                About
              </p>

              <p
                className="
                  mt-1
                  line-clamp-2
                  text-[12px]
                  leading-[1.6]
                  text-gray-500
                  sm:text-[13px]
                "
              >
                {description}
              </p>
            </div>
          )}

          {/* BOOKING */}

          <div
            className="
              mt-auto
              pt-5
            "
          >
            <div
              className="
                flex
                items-center
                justify-between
                gap-3
                text-[11px]
              "
            >
              <span
                className="
                  font-medium
                  text-gray-500
                "
              >
                Booking capacity
              </span>

              <span
                className="
                  font-semibold
                  text-secondary
                "
              >
                {booked} /{' '}
                {total}
              </span>
            </div>

            <div
              className="
                mt-2
                h-[3px]
                overflow-hidden
                rounded-full
                bg-gray-100
              "
            >
              <div
                className="
                  h-full
                  rounded-full
                  bg-primary
                "
                style={{
                  width:
                    `${progress}%`,
                }}
              />
            </div>

            {/* ACTIONS */}

            <div
              className="
                mt-4
                flex
                items-center
                justify-between
                border-t
                border-gray-100
                pt-4
              "
            >
              <Link
                href={`/admin/eventmanagement/${event._id}/edit`}
                className="
                  inline-flex
                  h-9
                  items-center
                  gap-2
                  rounded-lg
                  border
                  border-gray-200
                  bg-white
                  px-3
                  text-xs
                  font-semibold
                  text-secondary
                  transition-colors
                  hover:border-gray-300
                  hover:bg-gray-50
                "
              >
                <EditIcon />

                Edit
              </Link>

              <button
                type="button"
                onClick={() =>
                  void onDelete(
                    event._id,
                    event.eventName,
                  )
                }
                disabled={
                  deleting
                }
                className="
                  inline-flex
                  h-9
                  cursor-pointer
                  items-center
                  gap-2
                  rounded-lg
                  px-2.5
                  text-xs
                  font-medium
                  text-gray-400
                  transition-colors
                  hover:bg-red-50
                  hover:text-red-600
                  disabled:opacity-40
                "
              >
                {deleting ? (
                  <Spinner />
                ) : (
                  <TrashIcon />
                )}

                <span className="hidden sm:inline">
                  {deleting
                    ? 'Deleting'
                    : 'Delete'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

/* ============================================================
   SUMMARY
============================================================ */

function SummaryItem({
  label,
  value,
}: {
  label: string;

  value: number;
}) {
  return (
    <div
      className="
        border-r
        border-gray-200
        px-2
        py-5
        first:pl-0
        last:border-r-0
        sm:px-5
        sm:py-6
      "
    >
      <p
        className="
          text-[11px]
          font-medium
          text-gray-400
          sm:text-xs
        "
      >
        {label}
      </p>

      <p
        className="
          mt-1
          text-[23px]
          font-bold
          tracking-[-0.025em]
          text-secondary
          sm:text-[26px]
        "
      >
        {value}
      </p>
    </div>
  );
}

/* ============================================================
   STATUS
============================================================ */

function StatusLabel({
  status,
}: {
  status:
    IEvent['status'];
}) {
  if (
    status ===
    'LIVE'
  ) {
    return (
      <span
        className="
          rounded-md
          bg-white
          px-2
          py-1
          text-[10px]
          font-bold
          tracking-wide
          text-[#278C78]
          shadow-sm
        "
      >
        LIVE
      </span>
    );
  }

  if (
    status ===
    'COMPLETED'
  ) {
    return (
      <span
        className="
          rounded-md
          bg-white
          px-2
          py-1
          text-[10px]
          font-semibold
          text-gray-500
          shadow-sm
        "
      >
        COMPLETED
      </span>
    );
  }

  return (
    <span
      className="
        rounded-md
        bg-white
        px-2
        py-1
        text-[10px]
        font-semibold
        text-secondary
        shadow-sm
      "
    >
      UPCOMING
    </span>
  );
}

/* ============================================================
   META ROW
============================================================ */

function MetaRow({
  icon,
  children,
}: {
  icon:
    React.ReactNode;

  children:
    React.ReactNode;
}) {
  return (
    <div
      className="
        flex
        min-w-0
        items-center
        gap-2
        text-[12px]
        leading-5
        text-gray-500
        sm:text-[13px]
      "
    >
      <span
        className="
          shrink-0
          text-gray-400
        "
      >
        {icon}
      </span>

      <span
        className="
          min-w-0
          truncate
        "
      >
        {children}
      </span>
    </div>
  );
}

/* ============================================================
   SKELETON
============================================================ */

function EventsSkeleton() {
  return (
    <section
      className="
        mt-6
        grid
        grid-cols-1
        gap-4
        xl:grid-cols-2
      "
    >
      {Array.from({
        length: 4,
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
              overflow-hidden
              rounded-xl
              border
              border-gray-200
              bg-white
            "
          >
            <div
              className="
                grid
                grid-cols-1
                sm:grid-cols-[180px_minmax(0,1fr)]
                lg:grid-cols-[200px_minmax(0,1fr)]
              "
            >
              <div
                className="
                  h-[190px]
                  animate-pulse
                  bg-gray-100
                  sm:h-full
                  sm:min-h-[250px]
                "
              />

              <div className="p-5">
                <div
                  className="
                    h-3
                    w-20
                    animate-pulse
                    rounded
                    bg-gray-100
                  "
                />

                <div
                  className="
                    mt-3
                    h-5
                    w-3/4
                    animate-pulse
                    rounded
                    bg-gray-100
                  "
                />

                <div
                  className="
                    mt-5
                    h-3
                    w-1/2
                    animate-pulse
                    rounded
                    bg-gray-100
                  "
                />

                <div
                  className="
                    mt-3
                    h-3
                    w-2/3
                    animate-pulse
                    rounded
                    bg-gray-100
                  "
                />

                <div
                  className="
                    mt-5
                    h-12
                    animate-pulse
                    rounded
                    bg-gray-50
                  "
                />

                <div
                  className="
                    mt-6
                    h-9
                    animate-pulse
                    rounded
                    bg-gray-100
                  "
                />
              </div>
            </div>
          </div>
        ),
      )}
    </section>
  );
}

/* ============================================================
   ICONS
============================================================ */

function CalendarIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 7V3m8 4V3M5 11h14M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z"
      />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21s6-5.686 6-11a6 6 0 10-12 0c0 5.314 6 11 6 11z"
      />

      <circle
        cx="12"
        cy="10"
        r="2"
      />
    </svg>
  );
}

function EditIcon() {
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
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
      />
    </svg>
  );
}

function TrashIcon() {
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
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      className="h-3.5 w-3.5 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-20"
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
      />

      <path
        className="opacity-70"
        fill="currentColor"
        d="M12 3a9 9 0 019 9h-3a6 6 0 00-6-6V3z"
      />
    </svg>
  );
}