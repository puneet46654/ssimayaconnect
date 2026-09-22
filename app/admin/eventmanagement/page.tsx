'use client';

import type {
  ReactNode,
} from 'react';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import Link from 'next/link';
import Image from 'next/image';

import {
  AnimatePresence,
  motion,
} from 'framer-motion';

import {
  useRealtimeRefresh,
} from '@/components/realtime/RealtimeProvider';

/* ============================================================
   TYPES
============================================================ */

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

type DeleteTarget = {
  id: string;
  name: string;
};

const tabs: EventTab[] = [
  'All Events',
  'Conferences',
  'Mantram',
  'Live',
  'Upcoming',
  'Completed',
];

const EASE = [
  0.16,
  1,
  0.3,
  1,
] as const;

/* ============================================================
   PAGE
============================================================ */

export default function EventsManagementPage() {
  const [
    events,
    setEvents,
  ] =
    useState<IEvent[]>(
      [],
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState('');

  const [
    activeTab,
    setActiveTab,
  ] =
    useState<EventTab>(
      'All Events',
    );

  const [
    search,
    setSearch,
  ] = useState('');

  const [
    deletingId,
    setDeletingId,
  ] =
    useState<
      string | null
    >(null);

  const [
    deleteTarget,
    setDeleteTarget,
  ] =
    useState<
      DeleteTarget | null
    >(null);

  const [
    successMessage,
    setSuccessMessage,
  ] = useState('');

  /* ==========================================================
     FETCH
  ========================================================== */

  const fetchEvents =
    useCallback(
      async (
        showLoading =
          true,
      ) => {
        if (
          showLoading
        ) {
          setLoading(
            true,
          );
        } else {
          setRefreshing(
            true,
          );
        }

        setError('');

        try {
          const response =
            await fetch(
              '/api/events',
              {
                method:
                  'GET',

                cache:
                  'no-store',
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
            error instanceof
              Error
              ? error.message
              : 'An unexpected error occurred.',
          );
        } finally {
          setLoading(
            false,
          );

          setRefreshing(
            false,
          );
        }
      },
      [],
    );

  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          void fetchEvents();
        },
        0,
      );

    return () =>
      window.clearTimeout(
        timer,
      );
  }, [
    fetchEvents,
  ]);

  /* ==========================================================
     REALTIME
  ========================================================== */

  useRealtimeRefresh(
    'events',
    () => {
      void fetchEvents(
        false,
      );
    },
  );

  /* ==========================================================
     DELETE
  ========================================================== */

  async function handleDelete() {
    if (
      !deleteTarget
    ) {
      return;
    }

    const {
      id,
      name,
    } = deleteTarget;

    setDeletingId(
      id,
    );

    setSuccessMessage(
      '',
    );

    try {
      const response =
        await fetch(
          `/api/events/${encodeURIComponent(
            id,
          )}`,
          {
            method:
              'DELETE',
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
        (
          current,
        ) =>
          current.filter(
            (
              event,
            ) =>
              event._id !==
              id,
          ),
      );

      setDeleteTarget(
        null,
      );

      setSuccessMessage(
        `"${name}" was deleted successfully.`,
      );

      window.setTimeout(
        () => {
          setSuccessMessage(
            '',
          );
        },
        3500,
      );
    } catch (
      error: unknown
    ) {
      setError(
        error instanceof
          Error
          ? error.message
          : 'Error deleting event.',
      );
    } finally {
      setDeletingId(
        null,
      );
    }
  }

  /* ==========================================================
     STATS
  ========================================================== */

  const stats =
    useMemo(
      () => ({
        total:
          events.length,

        live:
          events.filter(
            (
              event,
            ) =>
              event.status ===
              'LIVE',
          ).length,

        upcoming:
          events.filter(
            (
              event,
            ) =>
              event.status ===
              'UPCOMING',
          ).length,

        completed:
          events.filter(
            (
              event,
            ) =>
              event.status ===
              'COMPLETED',
          ).length,
      }),
      [
        events,
      ],
    );

  /* ==========================================================
     FILTER
  ========================================================== */

  const filteredEvents =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      return events.filter(
        (
          event,
        ) => {
          let matchesTab =
            true;

          if (
            activeTab ===
            'Conferences'
          ) {
            matchesTab =
              event.eventType ===
              'conference';
          }

          if (
            activeTab ===
            'Mantram'
          ) {
            matchesTab =
              event.eventType ===
              'mantram';
          }

          if (
            activeTab ===
            'Live'
          ) {
            matchesTab =
              event.status ===
              'LIVE';
          }

          if (
            activeTab ===
            'Upcoming'
          ) {
            matchesTab =
              event.status ===
              'UPCOMING';
          }

          if (
            activeTab ===
            'Completed'
          ) {
            matchesTab =
              event.status ===
              'COMPLETED';
          }

          if (
            !matchesTab
          ) {
            return false;
          }

          if (
            !normalizedSearch
          ) {
            return true;
          }

          const haystack = [
            event.eventName,
            event.venue,
            event.description,
            event.eventType,
            event.status,
          ]
            .filter(
              Boolean,
            )
            .join(
              ' ',
            )
            .toLowerCase();

          return haystack.includes(
            normalizedSearch,
          );
        },
      );
    }, [
      events,
      activeTab,
      search,
    ]);

  /* ==========================================================
     DATE HELPERS
  ========================================================== */

  function formatDate(
    date:
      string,
  ) {
    return new Date(
      date,
    ).toLocaleDateString(
      'en-GB',
      {
        day:
          '2-digit',

        month:
          'short',

        year:
          'numeric',
      },
    );
  }

  function formatDateRange(
    startDate:
      string,

    endDate:
      string,
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
    description?:
      string,
  ) {
    if (
      !description
    ) {
      return '';
    }

    if (
      description.length <=
      145
    ) {
      return description;
    }

    return `${description.slice(
      0,
      145,
    )}…`;
  }

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <main
      className="
        w-full
        min-w-0
        max-w-full

        overflow-x-hidden

        pb-8
      "
    >
      {/* ======================================================
          HEADER
      ====================================================== */}

      <motion.header
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
        className="
          flex
          min-w-0
          flex-col
          gap-4

          border-b
          border-gray-200

          pb-5

          sm:flex-row
          sm:items-end
          sm:justify-between

          sm:pb-6
        "
      >
        <div
          className="
            min-w-0
            flex-1
          "
        >


          <h1
            className="
              font-heading

              text-[23px]
              font-bold

              tracking-[-0.035em]

              text-secondary

              sm:text-[27px]
              lg:text-[30px]
            "
          >
            Events Management
          </h1>

          <p
            className="
              mt-1

              max-w-[650px]

              text-[11px]
              leading-[18px]

              text-gray-500

              sm:text-[13px]
              sm:leading-5
            "
          >
            Create, monitor and
            manage events,
            schedules,
            registration capacity
            and attendee activity.
          </p>
        </div>

        <div
          className="
            grid
            w-full
            grid-cols-2
            gap-2

            sm:flex
            sm:w-auto
          "
        >
          <motion.button
            type="button"
            whileTap={{
              scale:
                0.97,
            }}
            disabled={
              refreshing
            }
            onClick={() =>
              void fetchEvents(
                false,
              )
            }
            className="
              inline-flex

              min-h-[42px]

              items-center
              justify-center
              gap-2

              rounded-lg

              border
              border-gray-200

              bg-white

              px-3

              text-[10px]
              font-semibold

              text-secondary

              shadow-sm

              transition-colors

              hover:border-primary/30
              hover:text-primary

              disabled:opacity-50

              sm:px-4
              sm:text-[11px]
            "
          >
            <RefreshIcon
              spinning={
                refreshing
              }
            />

            Refresh
          </motion.button>

          <motion.div
            whileTap={{
              scale:
                0.98,
            }}
          >
            <Link
              href="/admin/eventmanagement/new"
              className="
                inline-flex

                min-h-[42px]
                w-full

                items-center
                justify-center
                gap-2

                rounded-lg

                bg-primary

                px-3.5

                text-[10px]
                font-semibold

                text-white

                shadow-[0_5px_16px_rgba(26,158,143,0.18)]

                transition-all

                hover:brightness-95

                sm:w-auto
                sm:px-4
                sm:text-[11px]
              "
            >
              <PlusIcon />

              New Event
            </Link>
          </motion.div>
        </div>
      </motion.header>

      {/* ======================================================
          SUMMARY
      ====================================================== */}

      <motion.section
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
            0.05,

          duration:
            0.45,

          ease:
            EASE,
        }}
        className="
          mt-4

          grid
          grid-cols-2
          gap-2.5

          sm:mt-5
          sm:gap-3

          lg:grid-cols-4
        "
      >
        <SummaryCard
          label="Total Events"
          value={
            stats.total
          }
          icon={
            <EventsIcon />
          }
          description="All configured events"
        />

        <SummaryCard
          label="Live"
          value={
            stats.live
          }
          icon={
            <LiveIcon />
          }
          description="Currently active"
          accent
        />

        <SummaryCard
          label="Upcoming"
          value={
            stats.upcoming
          }
          icon={
            <CalendarIcon />
          }
          description="Scheduled ahead"
        />

        <SummaryCard
          label="Completed"
          value={
            stats.completed
          }
          icon={
            <CheckIcon />
          }
          description="Finished events"
        />
      </motion.section>

      {/* ======================================================
          TOOLBAR
      ====================================================== */}

      <motion.section
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
            0.1,

          duration:
            0.45,

          ease:
            EASE,
        }}
        className="
          mt-4

          min-w-0

          overflow-hidden

          rounded-xl

          border
          border-gray-200

          bg-white

          shadow-[0_4px_18px_rgba(27,75,107,0.035)]

          sm:mt-5
        "
      >
        {/* SEARCH */}

        <div
          className="
            flex
            min-w-0
            flex-col
            gap-3

            border-b
            border-gray-100

            p-3

            sm:flex-row
            sm:items-center
            sm:justify-between

            sm:p-4
          "
        >
          <div
            className="
              relative
              w-full
              min-w-0

              sm:max-w-[420px]
            "
          >
            <span
              className="
                pointer-events-none

                absolute
                left-3
                top-1/2

                -translate-y-1/2

                text-gray-400
              "
            >
              <SearchIcon />
            </span>

            <input
              value={
                search
              }
              onChange={(
                event,
              ) =>
                setSearch(
                  event
                    .target
                    .value,
                )
              }
              placeholder="Search event, venue or type..."
              className="
                h-10
                w-full
                min-w-0

                rounded-lg

                border
                border-gray-200

                bg-gray-50/70

                pl-9
                pr-9

                text-[11px]

                text-secondary

                outline-none

                transition-all

                placeholder:text-gray-400

                focus:border-primary/40
                focus:bg-white
                focus:ring-2
                focus:ring-primary/10

                sm:text-[12px]
              "
            />

            {search && (
              <button
                type="button"
                onClick={() =>
                  setSearch(
                    '',
                  )
                }
                className="
                  absolute
                  right-2.5
                  top-1/2

                  grid
                  h-6
                  w-6

                  -translate-y-1/2

                  place-items-center

                  rounded-md

                  text-gray-400

                  hover:bg-gray-100
                  hover:text-secondary
                "
              >
                <CloseSmallIcon />
              </button>
            )}
          </div>

          <p
            className="
              shrink-0

              text-[9px]
              font-medium

              text-gray-400

              sm:text-[10px]
            "
          >
            {filteredEvents.length}{' '}
            {filteredEvents.length ===
            1
              ? 'event'
              : 'events'}
          </p>
        </div>

        {/* TABS */}

        <div
          className="
            min-w-0
            overflow-x-auto

            px-3

            [scrollbar-width:none]

            [&::-webkit-scrollbar]:hidden

            sm:px-4
          "
        >
          <div
            className="
              flex
              min-w-max
              gap-1
            "
          >
            {tabs.map(
              (
                tab,
              ) => {
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

                      min-h-[44px]

                      cursor-pointer

                      whitespace-nowrap

                      px-2.5

                      text-[10px]
                      font-semibold

                      transition-colors

                      sm:px-3
                      sm:text-[11px]

                      ${
                        active
                          ? 'text-primary'
                          : 'text-gray-400 hover:text-secondary'
                      }
                    `}
                  >
                    {tab}

                    {active && (
                      <motion.span
                        layoutId="active-event-tab"
                        className="
                          absolute

                          inset-x-2
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
        </div>
      </motion.section>

      {/* ======================================================
          MESSAGES
      ====================================================== */}

      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{
              opacity:
                0,

              y:
                -5,
            }}
            animate={{
              opacity:
                1,

              y:
                0,
            }}
            exit={{
              opacity:
                0,

              y:
                -5,
            }}
            className="
              mt-4

              flex
              items-start
              gap-2.5

              rounded-xl

              border
              border-emerald-200

              bg-emerald-50

              px-3.5
              py-3

              text-[11px]

              text-emerald-700
            "
          >
            <CheckCircleIcon />

            <span
              className="
                min-w-0
                break-words
              "
            >
              {successMessage}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <motion.div
          initial={{
            opacity:
              0,

            y:
              -5,
          }}
          animate={{
            opacity:
              1,

            y:
              0,
          }}
          className="
            mt-4

            flex
            flex-col
            gap-3

            rounded-xl

            border
            border-red-200

            bg-red-50

            px-3.5
            py-3

            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >
          <div
            className="
              flex
              min-w-0
              items-start
              gap-2.5
            "
          >
            <span
              className="
                mt-0.5
                text-red-500
              "
            >
              <AlertIcon />
            </span>

            <p
              className="
                min-w-0

                break-words

                text-[11px]
                leading-5

                text-red-700
              "
            >
              {error}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              void fetchEvents()
            }
            className="
              shrink-0

              text-[10px]
              font-semibold

              text-red-700
            "
          >
            Retry
          </button>
        </motion.div>
      )}

      {/* ======================================================
          LOADING
      ====================================================== */}

      {loading && (
        <EventsSkeleton />
      )}

      {/* ======================================================
          EMPTY
      ====================================================== */}

      {!loading &&
        filteredEvents.length ===
          0 && (
          <motion.div
            initial={{
              opacity:
                0,
            }}
            animate={{
              opacity:
                1,
            }}
            className="
              mt-5

              flex
              min-h-[320px]

              items-center
              justify-center

              rounded-xl

              border
              border-dashed
              border-gray-200

              bg-white

              px-4

              text-center
            "
          >
            <div
              className="
                max-w-[300px]
              "
            >
              <div
                className="
                  mx-auto

                  grid
                  h-12
                  w-12

                  place-items-center

                  rounded-xl

                  bg-gray-100

                  text-gray-400
                "
              >
                <SearchEmptyIcon />
              </div>

              <h2
                className="
                  mt-3

                  text-[13px]
                  font-semibold

                  text-secondary
                "
              >
                No events found
              </h2>

              <p
                className="
                  mt-1

                  text-[10px]
                  leading-5

                  text-gray-500
                "
              >
                Try another filter or
                search term, or create
                a new event.
              </p>

              {(search ||
                activeTab !==
                  'All Events') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch(
                      '',
                    );

                    setActiveTab(
                      'All Events',
                    );
                  }}
                  className="
                    mt-4

                    rounded-lg

                    border
                    border-gray-200

                    bg-white

                    px-3
                    py-2

                    text-[10px]
                    font-semibold

                    text-secondary

                    hover:bg-gray-50
                  "
                >
                  Clear Filters
                </button>
              )}
            </div>
          </motion.div>
        )}

      {/* ======================================================
          EVENT GRID
      ====================================================== */}

      {!loading &&
        filteredEvents.length >
          0 && (
          <motion.section
            layout
            className="
              mt-4

              grid
              min-w-0
              grid-cols-1
              gap-4

              sm:mt-5

              min-[1450px]:grid-cols-2
            "
          >
            <AnimatePresence
              mode="popLayout"
            >
              {filteredEvents.map(
                (
                  event,
                  index,
                ) => (
                  <EventCard
                    key={
                      event._id
                    }
                    event={
                      event
                    }
                    index={
                      index
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
                    onDelete={() =>
                      setDeleteTarget({
                        id:
                          event._id,

                        name:
                          event.eventName,
                      })
                    }
                  />
                ),
              )}
            </AnimatePresence>
          </motion.section>
        )}

      {/* ======================================================
          FOOTER COUNT
      ====================================================== */}

      {!loading &&
        filteredEvents.length >
          0 && (
          <div
            className="
              mt-5

              flex
              flex-col
              gap-1

              border-t
              border-gray-200

              pt-4

              text-[9px]

              text-gray-400

              sm:flex-row
              sm:items-center
              sm:justify-between

              sm:text-[10px]
            "
          >
            <span>
              Showing{' '}
              <strong
                className="
                  font-semibold
                  text-gray-600
                "
              >
                {
                  filteredEvents.length
                }
              </strong>{' '}
              of{' '}
              <strong
                className="
                  font-semibold
                  text-gray-600
                "
              >
                {events.length}
              </strong>{' '}
              events
            </span>

            <span>
              SSI Maya Connect •
              Event Management
            </span>
          </div>
        )}

      {/* ======================================================
          DELETE MODAL
      ====================================================== */}

      <AnimatePresence>
        {deleteTarget && (
          <DeleteModal
            target={
              deleteTarget
            }
            deleting={
              deletingId ===
              deleteTarget.id
            }
            onCancel={() => {
              if (
                !deletingId
              ) {
                setDeleteTarget(
                  null,
                );
              }
            }}
            onConfirm={() =>
              void handleDelete()
            }
          />
        )}
      </AnimatePresence>
    </main>
  );
}

/* ============================================================
   EVENT CARD
============================================================ */

function EventCard({
  event,
  index,
  deleting,
  dateRange,
  description,
  onDelete,
}: {
  event:
    IEvent;

  index:
    number;

  deleting:
    boolean;

  dateRange:
    string;

  description:
    string;

  onDelete:
    () => void;
}) {
  const booked =
    event.bookedSlots ||
    0;

  const total =
    event.totalSlots ||
    0;

  const progress =
    total > 0
      ? Math.min(
          100,
          (booked /
            total) *
            100,
        )
      : 0;

  const remaining =
    Math.max(
      total -
        booked,
      0,
    );

  return (
    <motion.article
      layout
      initial={{
        opacity:
          0,

        y:
          14,
      }}
      animate={{
        opacity:
          1,

        y:
          0,
      }}
      exit={{
        opacity:
          0,

        scale:
          0.98,
      }}
      transition={{
        duration:
          0.42,

        delay:
          Math.min(
            index *
              0.035,
            0.2,
          ),

        ease:
          EASE,
      }}
      whileHover={{
        y:
          -2,
      }}
      className="
        group

        min-w-0
        overflow-hidden

        rounded-[16px]

        border
        border-gray-200

        bg-white

        shadow-[0_5px_20px_rgba(27,75,107,0.03)]

        transition-shadow

        hover:shadow-[0_12px_32px_rgba(27,75,107,0.07)]
      "
    >
      <div
        className="
          grid
          min-w-0
          grid-cols-1

          sm:grid-cols-[170px_minmax(0,1fr)]

          lg:grid-cols-[190px_minmax(0,1fr)]
        "
      >
        {/* ====================================================
            IMAGE
        ==================================================== */}

        <div
          className="
            relative

            aspect-[16/8.5]

            overflow-hidden

            bg-gray-100

            sm:aspect-auto
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
                200px
              "
              className="
                object-cover

                transition-transform
                duration-500

                group-hover:scale-[1.025]
              "
            />
          ) : (
            <div
              className="
                flex
                h-full
                min-h-[155px]

                items-center
                justify-center

                bg-[linear-gradient(135deg,#f1f7f7,#f5f7f9)]

                text-gray-300
              "
            >
              <ImagePlaceholderIcon />
            </div>
          )}

          <div
            className="
              pointer-events-none

              absolute
              inset-0

              bg-gradient-to-t

              from-secondary/25
              via-transparent
              to-transparent
            "
          />

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

          <span
            className="
              absolute
              bottom-3
              left-3

              rounded-md

              bg-black/35

              px-2
              py-1

              text-[8px]
              font-semibold

              uppercase

              tracking-[0.08em]

              text-white

              backdrop-blur-md
            "
          >
            {event.eventType}
          </span>
        </div>

        {/* ====================================================
            BODY
        ==================================================== */}

        <div
          className="
            flex
            min-w-0
            flex-col

            p-3.5

            sm:p-4

            lg:p-5
          "
        >
          {/* TITLE */}

          <div
            className="
              min-w-0
            "
          >
            <h2
              className="
                line-clamp-2

                break-words

                font-heading

                text-[16px]
                font-bold

                leading-[1.35]

                tracking-[-0.02em]

                text-secondary

                sm:text-[17px]
                lg:text-[18px]
              "
            >
              {event.eventName}
            </h2>
          </div>

          {/* META */}

          <div
            className="
              mt-3

              grid
              grid-cols-1
              gap-2

              min-[430px]:grid-cols-2

              sm:grid-cols-1

              lg:grid-cols-2
            "
          >
            <MetaBox
              icon={
                <CalendarIcon />
              }
              label="Schedule"
              value={
                dateRange
              }
            />

            <MetaBox
              icon={
                <LocationIcon />
              }
              label="Venue"
              value={
                event.venue
              }
            />
          </div>

          {/* DESCRIPTION */}

          {description && (
            <div
              className="
                mt-3
              "
            >
              <p
                className="
                  line-clamp-2

                  text-[10px]
                  leading-[17px]

                  text-gray-500

                  sm:text-[11px]
                "
              >
                {description}
              </p>
            </div>
          )}

          {/* CAPACITY */}

          <div
            className="
              mt-auto
              pt-4
            "
          >
            <div
              className="
                rounded-xl

                border
                border-gray-100

                bg-gray-50/70

                p-3
              "
            >
              <div
                className="
                  flex
                  items-start
                  justify-between
                  gap-3
                "
              >
                <div>
                  <p
                    className="
                      text-[8px]
                      font-semibold

                      uppercase

                      tracking-[0.05em]

                      text-gray-400
                    "
                  >
                    Booking Capacity
                  </p>

                  <p
                    className="
                      mt-1

                      text-[11px]
                      font-semibold

                      text-secondary
                    "
                  >
                    {booked}{' '}
                    booked
                  </p>
                </div>

                <div
                  className="
                    text-right
                  "
                >
                  <p
                    className="
                      text-[13px]
                      font-bold

                      text-secondary
                    "
                  >
                    {booked}
                    <span
                      className="
                        text-[9px]
                        font-medium
                        text-gray-400
                      "
                    >
                      {' '}
                      / {total}
                    </span>
                  </p>

                  <p
                    className="
                      mt-0.5

                      text-[8px]
                      text-gray-400
                    "
                  >
                    {remaining}{' '}
                    remaining
                  </p>
                </div>
              </div>

              <div
                className="
                  mt-3

                  h-1.5

                  overflow-hidden

                  rounded-full

                  bg-gray-200/70
                "
              >
                <motion.div
                  initial={{
                    width:
                      0,
                  }}
                  animate={{
                    width:
                      `${progress}%`,
                  }}
                  transition={{
                    duration:
                      0.75,

                    delay:
                      0.25,

                    ease:
                      EASE,
                  }}
                  className={`
                    h-full

                    rounded-full

                    ${
                      progress >=
                      90
                        ? 'bg-secondary'
                        : 'bg-primary'
                    }
                  `}
                />
              </div>

              <div
                className="
                  mt-1.5

                  flex
                  justify-end
                "
              >
                <span
                  className="
                    text-[8px]
                    font-semibold

                    text-gray-400
                  "
                >
                  {Math.round(
                    progress,
                  )}
                  % filled
                </span>
              </div>
            </div>

            {/* ACTIONS */}

            <div
              className="
                mt-3

                grid
                grid-cols-2
                gap-2
              "
            >
              <Link
                href={`/admin/eventmanagement/${event._id}/edit`}
                className="
                  inline-flex

                  min-h-[38px]

                  items-center
                  justify-center
                  gap-1.5

                  rounded-lg

                  border
                  border-gray-200

                  bg-white

                  px-3

                  text-[10px]
                  font-semibold

                  text-secondary

                  transition-all

                  hover:border-primary/25
                  hover:bg-primary/[0.03]
                  hover:text-primary
                "
              >
                <EditIcon />

                Edit Event
              </Link>

              <button
                type="button"
                disabled={
                  deleting
                }
                onClick={
                  onDelete
                }
                className="
                  inline-flex

                  min-h-[38px]

                  cursor-pointer

                  items-center
                  justify-center
                  gap-1.5

                  rounded-lg

                  border
                  border-transparent

                  px-3

                  text-[10px]
                  font-semibold

                  text-gray-400

                  transition-all

                  hover:border-red-100
                  hover:bg-red-50
                  hover:text-red-600

                  disabled:cursor-wait
                  disabled:opacity-40
                "
              >
                {deleting ? (
                  <Spinner />
                ) : (
                  <TrashIcon />
                )}

                {deleting
                  ? 'Deleting'
                  : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

/* ============================================================
   SUMMARY CARD
============================================================ */

function SummaryCard({
  label,
  value,
  description,
  icon,
  accent = false,
}: {
  label:
    string;

  value:
    number;

  description:
    string;

  icon:
    ReactNode;

  accent?:
    boolean;
}) {
  return (
    <motion.article
      whileHover={{
        y:
          -2,
      }}
      className="
        min-w-0

        rounded-xl

        border
        border-gray-200

        bg-white

        p-3

        shadow-[0_4px_16px_rgba(27,75,107,0.025)]

        sm:p-4
      "
    >
      <div
        className="
          flex
          items-start
          justify-between
          gap-2
        "
      >
        <div
          className="
            min-w-0
          "
        >
          <p
            className="
              text-[8px]
              font-bold

              uppercase

              tracking-[0.06em]

              text-gray-400

              sm:text-[9px]
            "
          >
            {label}
          </p>

          <p
            className={`
              mt-1

              font-heading

              text-[24px]
              font-bold

              tracking-[-0.04em]

              sm:text-[27px]

              ${
                accent
                  ? 'text-primary'
                  : 'text-secondary'
              }
            `}
          >
            {value}
          </p>

          <p
            className="
              mt-0.5

              truncate

              text-[8px]

              text-gray-400

              sm:text-[9px]
            "
          >
            {description}
          </p>
        </div>

        <span
          className="
            grid
            h-8
            w-8
            shrink-0

            place-items-center

            rounded-lg

            bg-primary/[0.07]

            text-primary

            sm:h-9
            sm:w-9
          "
        >
          {icon}
        </span>
      </div>
    </motion.article>
  );
}

/* ============================================================
   META BOX
============================================================ */

function MetaBox({
  icon,
  label,
  value,
}: {
  icon:
    ReactNode;

  label:
    string;

  value:
    string;
}) {
  return (
    <div
      className="
        flex
        min-w-0
        items-start
        gap-2

        rounded-lg

        bg-gray-50/70

        px-2.5
        py-2
      "
    >
      <span
        className="
          mt-0.5
          shrink-0
          text-gray-400
        "
      >
        {icon}
      </span>

      <div
        className="
          min-w-0
        "
      >
        <p
          className="
            text-[7px]
            font-semibold

            uppercase

            tracking-[0.05em]

            text-gray-400
          "
        >
          {label}
        </p>

        <p
          className="
            mt-0.5

            truncate

            text-[9px]
            font-medium

            text-gray-600
          "
        >
          {value}
        </p>
      </div>
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
          inline-flex
          items-center
          gap-1.5

          rounded-full

          border
          border-emerald-100

          bg-white/95

          px-2
          py-1

          text-[8px]
          font-bold

          uppercase

          tracking-[0.06em]

          text-emerald-600

          shadow-sm

          backdrop-blur
        "
      >
        <span
          className="
            h-1.5
            w-1.5

            rounded-full

            bg-emerald-500
          "
        />

        Live
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
          rounded-full

          border
          border-gray-100

          bg-white/95

          px-2
          py-1

          text-[8px]
          font-bold

          uppercase

          tracking-[0.05em]

          text-gray-500

          shadow-sm
        "
      >
        Completed
      </span>
    );
  }

  return (
    <span
      className="
        rounded-full

        border
        border-blue-100

        bg-white/95

        px-2
        py-1

        text-[8px]
        font-bold

        uppercase

        tracking-[0.05em]

        text-secondary

        shadow-sm
      "
    >
      Upcoming
    </span>
  );
}

/* ============================================================
   DELETE MODAL
============================================================ */

function DeleteModal({
  target,
  deleting,
  onCancel,
  onConfirm,
}: {
  target:
    DeleteTarget;

  deleting:
    boolean;

  onCancel:
    () => void;

  onConfirm:
    () => void;
}) {
  return (
    <>
      <motion.button
        type="button"
        aria-label="Close delete dialog"
        initial={{
          opacity:
            0,
        }}
        animate={{
          opacity:
            1,
        }}
        exit={{
          opacity:
            0,
        }}
        onClick={
          onCancel
        }
        className="
          fixed
          inset-0
          z-[100]

          cursor-default

          bg-secondary/30

          backdrop-blur-[2px]
        "
      />

      <div
        className="
          fixed
          inset-0
          z-[110]

          flex
          items-end
          justify-center

          p-0

          pointer-events-none

          sm:items-center
          sm:p-4
        "
      >
        <motion.div
          initial={{
            opacity:
              0,

            y:
              30,

            scale:
              0.98,
          }}
          animate={{
            opacity:
              1,

            y:
              0,

            scale:
              1,
          }}
          exit={{
            opacity:
              0,

            y:
              25,

            scale:
              0.98,
          }}
          transition={{
            duration:
              0.22,

            ease:
              EASE,
          }}
          className="
            pointer-events-auto

            w-full
            max-w-[430px]

            rounded-t-[20px]

            border
            border-gray-200

            bg-white

            p-4

            shadow-[0_20px_60px_rgba(27,75,107,0.2)]

            sm:rounded-[18px]
            sm:p-5
          "
        >
          <div
            className="
              flex
              items-start
              gap-3
            "
          >
            <div
              className="
                grid
                h-10
                w-10
                shrink-0

                place-items-center

                rounded-xl

                bg-red-50

                text-red-600
              "
            >
              <TrashIcon />
            </div>

            <div
              className="
                min-w-0
              "
            >
              <h2
                className="
                  text-[14px]
                  font-semibold

                  text-secondary
                "
              >
                Delete Event?
              </h2>

              <p
                className="
                  mt-1

                  text-[10px]
                  leading-[17px]

                  text-gray-500
                "
              >
                You are about to
                permanently delete{' '}
                <strong
                  className="
                    font-semibold
                    text-gray-700
                  "
                >
                  {target.name}
                </strong>
                . This action cannot
                be undone.
              </p>
            </div>
          </div>

          <div
            className="
              mt-5

              grid
              grid-cols-2
              gap-2
            "
          >
            <button
              type="button"
              disabled={
                deleting
              }
              onClick={
                onCancel
              }
              className="
                min-h-[42px]

                rounded-lg

                border
                border-gray-200

                bg-white

                text-[10px]
                font-semibold

                text-secondary

                hover:bg-gray-50

                disabled:opacity-50
              "
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={
                deleting
              }
              onClick={
                onConfirm
              }
              className="
                inline-flex
                min-h-[42px]

                items-center
                justify-center
                gap-2

                rounded-lg

                bg-red-600

                text-[10px]
                font-semibold

                text-white

                hover:bg-red-700

                disabled:cursor-wait
                disabled:opacity-60
              "
            >
              {deleting && (
                <Spinner />
              )}

              {deleting
                ? 'Deleting...'
                : 'Delete Event'}
            </button>
          </div>
        </motion.div>
      </div>
    </>
  );
}

/* ============================================================
   SKELETON
============================================================ */

function EventsSkeleton() {
  return (
    <section
      className="
        mt-4

        grid
        grid-cols-1
        gap-4

        sm:mt-5

        min-[1450px]:grid-cols-2
      "
    >
      {Array.from({
        length:
          4,
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

              rounded-[16px]

              border
              border-gray-200

              bg-white
            "
          >
            <div
              className="
                grid
                grid-cols-1

                sm:grid-cols-[170px_minmax(0,1fr)]

                lg:grid-cols-[190px_minmax(0,1fr)]
              "
            >
              <div
                className="
                  aspect-[16/8.5]

                  animate-pulse

                  bg-gray-100

                  sm:aspect-auto
                  sm:min-h-[250px]
                "
              />

              <div
                className="
                  p-4
                "
              >
                <div
                  className="
                    h-5
                    w-3/4

                    animate-pulse

                    rounded

                    bg-gray-100
                  "
                />

                <div
                  className="
                    mt-4

                    grid
                    grid-cols-2
                    gap-2
                  "
                >
                  <div
                    className="
                      h-11

                      animate-pulse

                      rounded-lg

                      bg-gray-100
                    "
                  />

                  <div
                    className="
                      h-11

                      animate-pulse

                      rounded-lg

                      bg-gray-100
                    "
                  />
                </div>

                <div
                  className="
                    mt-4

                    h-8

                    animate-pulse

                    rounded

                    bg-gray-50
                  "
                />

                <div
                  className="
                    mt-5

                    h-[86px]

                    animate-pulse

                    rounded-xl

                    bg-gray-100
                  "
                />

                <div
                  className="
                    mt-3

                    grid
                    grid-cols-2
                    gap-2
                  "
                >
                  <div
                    className="
                      h-9

                      animate-pulse

                      rounded-lg

                      bg-gray-100
                    "
                  />

                  <div
                    className="
                      h-9

                      animate-pulse

                      rounded-lg

                      bg-gray-100
                    "
                  />
                </div>
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

function RefreshIcon({
  spinning,
}: {
  spinning:
    boolean;
}) {
  return (
    <svg
      className={`h-4 w-4 ${
        spinning
          ? 'animate-spin'
          : ''
      }`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.9}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 11a8 8 0 1 0-2.35 5.65M20 4v7h-7"
      />
    </svg>
  );
}

function PlusIcon() {
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
        d="M12 5v14M5 12h14"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.9}
    >
      <circle
        cx="11"
        cy="11"
        r="6.5"
      />

      <path
        strokeLinecap="round"
        d="m16 16 4 4"
      />
    </svg>
  );
}

function CloseSmallIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        d="m6 6 12 12M18 6 6 18"
      />
    </svg>
  );
}

function EventsIcon() {
  return (
    <svg
      className="h-[17px] w-[17px]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 3v4m8-4v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z"
      />
    </svg>
  );
}

function LiveIcon() {
  return (
    <svg
      className="h-[17px] w-[17px]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <circle
        cx="12"
        cy="12"
        r="2"
      />

      <path
        strokeLinecap="round"
        d="M7.8 7.8a6 6 0 0 0 0 8.4m8.4-8.4a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14m14-14a10 10 0 0 1 0 14"
      />
    </svg>
  );
}

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

function CheckIcon() {
  return (
    <svg
      className="h-[17px] w-[17px]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m5 12 4 4L19 6"
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
      className="h-4 w-4"
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

function AlertIcon() {
  return (
    <svg
      className="h-4 w-4"
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

function CheckCircleIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0"
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
        strokeLinejoin="round"
        d="m8 12 2.5 2.5L16.5 9"
      />
    </svg>
  );
}

function ImagePlaceholderIcon() {
  return (
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
  );
}

function SearchEmptyIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <circle
        cx="10"
        cy="10"
        r="6"
      />

      <path
        strokeLinecap="round"
        d="m15 15 5 5M8 8l4 4m0-4-4 4"
      />
    </svg>
  );
}

