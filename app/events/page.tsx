'use client';

import type {
  ReactNode,
} from 'react';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  useCallback,
  useDeferredValue,
  useEffect,
  memo,
  useMemo,
  useState,
} from 'react';

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

  description?: string;

  imageUrl?: string;

  status:
    | 'LIVE'
    | 'COMPLETED'
    | 'UPCOMING';
}

type CachedTicket = {
  bookingId: string;
  eventId: string;
  eventName: string;
  venue: string;
  imageUrl: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  qrData: string;
};

type EventStatusFilter =
  | 'ALL'
  | 'LIVE'
  | 'UPCOMING'
  | 'COMPLETED';

type EventTypeFilter =
  | 'ALL'
  | 'conference'
  | 'mantram'
  | 'event';

/* ============================================================
   ANIMATION
============================================================ */

const EASE = [
  0.16,
  1,
  0.3,
  1,
] as const;

const TICKET_CACHE =
  'ssi-my-tickets-data';

/* ============================================================
   PAGE
============================================================ */

export default function EventsPage() {
  const router = useRouter();

  /* ==========================================================
     TRACK PAGE VIEW
  ========================================================== */


  /* ==========================================================
     EVENTS
  ========================================================== */

  const [
    events,
    setEvents,
  ] = useState<IEvent[]>(
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

  /* ==========================================================
     SEARCH + FILTERS
  ========================================================== */

  const [
    search,
    setSearch,
  ] = useState('');

  const deferredSearch =
    useDeferredValue(search);

  const [
    showFilters,
    setShowFilters,
  ] = useState(false);

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState<EventStatusFilter>(
      'ALL',
    );

  const [
    typeFilter,
    setTypeFilter,
  ] =
    useState<EventTypeFilter>(
      'ALL',
    );

  /* ==========================================================
     FEEDBACK PICKER

     We intentionally DO NOT create another feedback form here.

     User chooses the event, then we route to the already
     existing:

     /events/[id]/book/feedback

     This keeps the existing feedback data structure/backend.
  ========================================================== */

  const [
    showFeedbackPicker,
    setShowFeedbackPicker,
  ] = useState(false);

  const [
    bookedTickets,
    setBookedTickets,
  ] = useState<CachedTicket[]>([]);

  /* ==========================================================
     LOAD EVENTS
  ========================================================== */

  const fetchEvents =
    useCallback(
      async (
        showInitialLoading =
          true,
      ) => {
        if (
          showInitialLoading
        ) {
          setLoading(
            true,
          );
        } else {
          setRefreshing(
            true,
          );
        }

        try {
          const response =
            await fetch(
            showInitialLoading
              ? '/api/events'
              : `/api/events?refresh=${Date.now()}`,
            {
              method:
                'GET',

              cache:
                showInitialLoading
                  ? 'default'
                  : 'no-store',
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

          try {
            window.sessionStorage.setItem(
              'ssi-events-cache',
              JSON.stringify(
                Array.isArray(
                  data.events,
                )
                  ? data.events
                  : [],
              ),
            );
          } catch (error) {
            console.error(
              'Unable to cache events:',
              error,
            );
          }
        } catch (
          error
        ) {
          console.error(
            'Failed to fetch events:',
            error,
          );

          setEvents(
            [],
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
    let hasCachedEvents =
      false;

    try {
      const cached =
        window.sessionStorage.getItem(
          'ssi-events-cache',
        );

      if (cached) {
        const parsed =
          JSON.parse(cached);

        if (
          Array.isArray(parsed)
        ) {
          window.setTimeout(() => {
            setEvents(parsed as IEvent[]);
            setLoading(false);
          }, 0);
          hasCachedEvents = true;
        }
      }
    } catch (error) {
      console.error(
        'Unable to restore cached events:',
        error,
      );
    }

    window.setTimeout(() => {
      void fetchEvents(
        !hasCachedEvents,
      );
    }, 0);
  }, [
    fetchEvents,
  ]);

  useRealtimeRefresh(
    'events',
    () => {
      void fetchEvents(
        false,
      );
    },
  );

  /* ==========================================================
     FILTERING
  ========================================================== */

  const hasActiveFilters =
    statusFilter !==
      'ALL' ||
    typeFilter !==
      'ALL';

  const hasSearch =
    search.trim().length >
    0;

  const filteredEvents =
    useMemo(() => {
      const query =
        deferredSearch
          .trim()
          .toLowerCase();

      return events.filter(
        (
          event,
        ) => {
          const matchesSearch =
            !query ||
            [
              event.eventName,
              event.eventType,
              event.venue,
              event.description ||
                '',
            ].some(
              (
                value,
              ) =>
                value
                  .toLowerCase()
                  .includes(
                    query,
                  ),
            );

          const matchesStatus =
            statusFilter ===
              'ALL' ||
            event.status ===
              statusFilter;

          const matchesType =
            typeFilter ===
              'ALL' ||
            event.eventType ===
              typeFilter;

          return (
            matchesSearch &&
            matchesStatus &&
            matchesType
          );
        },
      );
    }, [
      events,
      deferredSearch,
      statusFilter,
      typeFilter,
    ]);

  const liveEvents =
    useMemo(
      () =>
        filteredEvents.filter(
          (
            event,
          ) =>
            event.status ===
            'LIVE',
        ),
      [
        filteredEvents,
      ],
    );

  const upcomingConferences =
    useMemo(
      () =>
        filteredEvents.filter(
          (
            event,
          ) =>
            event.status ===
              'UPCOMING' &&
            event.eventType ===
              'conference',
        ),
      [
        filteredEvents,
      ],
    );

  const upcomingMantram =
    useMemo(
      () =>
        filteredEvents.filter(
          (
            event,
          ) =>
            event.status ===
              'UPCOMING' &&
            event.eventType ===
              'mantram',
        ),
      [
        filteredEvents,
      ],
    );

  const upcomingEvents =
    useMemo(
      () =>
        filteredEvents.filter(
          (
            event,
          ) =>
            event.status ===
              'UPCOMING' &&
            event.eventType ===
              'event',
        ),
      [
        filteredEvents,
      ],
    );

  const completedEvents =
    useMemo(
      () =>
        filteredEvents.filter(
          (
            event,
          ) =>
            event.status ===
            'COMPLETED',
        ),
      [
        filteredEvents,
      ],
    );

  /* ==========================================================
     FILTER ACTIONS
  ========================================================== */

  function clearFilters() {
    setStatusFilter(
      'ALL',
    );

    setTypeFilter(
      'ALL',
    );
  }

  function resetAll() {
    setSearch('');

    clearFilters();

    setShowFilters(
      false,
    );
  }

  /* ==========================================================
     FEEDBACK
  ========================================================== */

  function openFeedback() {
    try {
      const cached =
        localStorage.getItem(
          TICKET_CACHE,
        );
      const tickets =
        cached
          ? JSON.parse(cached)
          : [];

      setBookedTickets(
        Array.isArray(tickets)
          ? tickets.filter(
              (ticket): ticket is CachedTicket =>
                Boolean(
                  ticket &&
                    typeof ticket.eventId ===
                      'string' &&
                    typeof ticket.bookingId ===
                      'string',
                ),
            )
          : [],
      );
    } catch (error) {
      console.error(
        'Unable to restore booked tickets for feedback:',
        error,
      );
      setBookedTickets([]);
    }

    setShowFeedbackPicker(
      true,
    );
  }

  function closeFeedback() {
    setShowFeedbackPicker(
      false,
    );
  }

  function goToFeedback(
    eventId:
      string,
    bookingId:
      string,
    bookingMongoId:
      string,
  ) {
    setShowFeedbackPicker(
      false,
    );

    sessionStorage.setItem(
      `ssi-feedback-booking-id:${eventId}`,
      bookingId,
    );
    sessionStorage.setItem(
      `ssi-feedback-booking-mongo-id:${eventId}`,
      bookingMongoId,
    );

    router.push(
      `/events/${encodeURIComponent(
        eventId,
      )}/book/feedback?scope=event`,
    );
  }

  /* ==========================================================
     PAGE
  ========================================================== */

  return (
    <div
      className="
        min-h-dvh

        bg-[#F7F9FA]

        pb-[76px]

        md:pb-0
      "
    >
      {/* ======================================================
          DESKTOP HEADER
      ====================================================== */}

      <header
        className="
          sticky
          top-0
          z-50

          hidden

          border-b
          border-gray-200/80

          bg-white/95

          backdrop-blur-xl

          md:block
        "
      >
        <div
          className="
            mx-auto

            grid
            h-[66px]
            w-full
            max-w-[1500px]

            grid-cols-[auto_minmax(300px,540px)_auto]

            items-center

            gap-6

            px-6

            lg:px-10
          "
        >
          {/* BRAND */}

          <Brand />

          {/* SEARCH */}

          <div
            className="
              relative
            "
          >
            <SearchBar
              value={
                search
              }
              onChange={
                setSearch
              }
              showFilters={
                showFilters
              }
              onToggleFilters={() =>
                setShowFilters(
                  (
                    current,
                  ) =>
                    !current,
                )
              }
              hasActiveFilters={
                hasActiveFilters
              }
            />

            <AnimatePresence>
              {showFilters && (
                <DesktopFilterPanel
                  statusFilter={
                    statusFilter
                  }
                  typeFilter={
                    typeFilter
                  }
                  setStatusFilter={
                    setStatusFilter
                  }
                  setTypeFilter={
                    setTypeFilter
                  }
                  clearFilters={
                    clearFilters
                  }
                  hasActiveFilters={
                    hasActiveFilters
                  }
                  onClose={() =>
                    setShowFilters(
                      false,
                    )
                  }
                />
              )}
            </AnimatePresence>
          </div>

          {/* ACTIONS */}

          <div
            className="
              flex
              items-center
              justify-end
              gap-2
            "
          >
            <button
              type="button"
              aria-label="Refresh events"
              disabled={
                refreshing
              }
              onClick={() =>
                void fetchEvents(
                  false,
                )
              }
              className="
                grid
                h-10
                w-10

                place-items-center

                rounded-lg

                border
                border-gray-200

                bg-white

                text-gray-500

                transition-all
                duration-150

                hover:border-gray-300
                hover:bg-gray-50
                hover:text-secondary

                focus:outline-none
                focus-visible:ring-2
                focus-visible:ring-primary/15

                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >
              <RefreshIcon
                spinning={
                  refreshing
                }
              />
            </button>

            <Link
              href="/events/mytickets"
              className="
                inline-flex
                h-10

                items-center
                justify-center
                gap-2

                rounded-lg

                border
                border-gray-200

                bg-white

                px-4

                text-[11px]
                font-semibold

                text-secondary

                transition-all
                duration-150

                hover:border-primary/25
                hover:bg-primary/[0.035]
                hover:text-primary

                focus:outline-none
                focus-visible:ring-2
                focus-visible:ring-primary/15
              "
            >
              <TicketIcon />

              My Tickets
            </Link>

            <button
              type="button"
              onClick={
                openFeedback
              }
              className="
                inline-flex
                h-10

                items-center
                justify-center
                gap-2

                rounded-lg

                border
                border-gray-200

                bg-white

                px-4

                text-[11px]
                font-semibold

                text-secondary

                transition-all
                duration-150

                hover:border-primary/25
                hover:bg-primary/[0.035]
                hover:text-primary

                focus:outline-none
                focus-visible:ring-2
                focus-visible:ring-primary/15
              "
            >
              <FeedbackIcon />

              Feedback
            </button>
          </div>
        </div>
      </header>

      {/* ======================================================
          MOBILE HEADER
      ====================================================== */}

      <header
        className="
          relative
          top-0
          z-50

          border-b
          border-gray-200/80

          bg-[#F7F9FA]/95

          px-4
          pb-3
          pt-[max(10px,env(safe-area-inset-top))]

          backdrop-blur-xl

          md:hidden
        "
      >
        <div
          className="
            mx-auto
            max-w-[520px]
          "
        >
          {/* TOP ROW */}

          <div
            className="
              flex
              items-center
              justify-between
              gap-3
            "
          >
            <span />

            <button
              type="button"
              onClick={
                openFeedback
              }
              className="
                inline-flex
                h-9
                shrink-0

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

                shadow-[0_2px_8px_rgba(27,75,107,0.025)]

                transition-colors

                active:bg-gray-50
              "
            >
              <FeedbackIcon />

              Feedback
            </button>
          </div>

          {/* TITLE */}

          <div
            className="
              mt-4
            "
          >
            <h1
              className="
                font-heading

                text-[22px]
                font-bold

                leading-[1.2]

                tracking-[-0.03em]

                text-secondary
              "
            >
              Discover Events
            </h1>

            <p
              className="
                mt-1

                text-[11px]
                leading-[17px]

                text-gray-500
              "
            >
              Explore conferences,
              MantraM sessions and
              upcoming programmes.
            </p>
          </div>

          {/* SEARCH */}

          <div
            className="
              relative
              mt-3
            "
          >
            <SearchBar
              value={
                search
              }
              onChange={
                setSearch
              }
              mobile
              showFilters={
                showFilters
              }
              onToggleFilters={() =>
                setShowFilters(
                  (
                    current,
                  ) =>
                    !current,
                )
              }
              hasActiveFilters={
                hasActiveFilters
              }
            />

            <AnimatePresence>
              {showFilters && (
                <MobileFilterPanel
                  statusFilter={
                    statusFilter
                  }
                  typeFilter={
                    typeFilter
                  }
                  setStatusFilter={
                    setStatusFilter
                  }
                  setTypeFilter={
                    setTypeFilter
                  }
                  clearFilters={
                    clearFilters
                  }
                  hasActiveFilters={
                    hasActiveFilters
                  }
                  onClose={() =>
                    setShowFilters(
                      false,
                    )
                  }
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* ======================================================
          CONTENT
      ====================================================== */}

      <main
        className="
          mx-auto

          w-full
          max-w-[1500px]

          px-4
          py-5

          sm:px-5

          md:px-6
          md:py-8

          lg:px-10
        "
      >
        {/* ====================================================
            DESKTOP INTRO
        ==================================================== */}

        <section
          className="
            hidden

            md:block
          "
        >
          <div
            className="
              max-w-[680px]
            "
          >
            <h1
              className="
                font-heading

                text-[30px]
                font-bold

                tracking-[-0.035em]

                text-secondary

                lg:text-[34px]
              "
            >
              Discover Events
            </h1>

            <p
              className="
                mt-1.5

                text-[12px]
                leading-5

                text-gray-500
              "
            >
              Browse conferences,
              MantraM sessions and
              programmes currently
              available through SSI
              Maya Connect.
            </p>
          </div>
        </section>

        {/* ====================================================
            ACTIVE FILTERS
        ==================================================== */}

        <AnimatePresence>
          {(hasActiveFilters ||
            hasSearch) && (
            <motion.div
              initial={{
                opacity: 0,
                y: -5,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                y: -5,
              }}
              className="
                mt-4

                flex
                flex-wrap
                items-center
                gap-1.5

                md:mt-6
              "
            >
              {hasSearch && (
                <FilterTag
                  label={`Search: ${search}`}
                  onRemove={() =>
                    setSearch('')
                  }
                />
              )}

              {statusFilter !==
                'ALL' && (
                <FilterTag
                  label={formatStatus(
                    statusFilter,
                  )}
                  onRemove={() =>
                    setStatusFilter(
                      'ALL',
                    )
                  }
                />
              )}

              {typeFilter !==
                'ALL' && (
                <FilterTag
                  label={formatType(
                    typeFilter,
                  )}
                  onRemove={() =>
                    setTypeFilter(
                      'ALL',
                    )
                  }
                />
              )}

              <button
                type="button"
                onClick={
                  resetAll
                }
                className="
                  ml-1

                  text-[10px]
                  font-semibold

                  text-gray-400

                  transition-colors

                  hover:text-secondary
                "
              >
                Clear all
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ====================================================
            LOADING
        ==================================================== */}

        {loading ? (
          <div
            className="
              mt-5

              md:mt-8
            "
          >
            <LoadingState />
          </div>
        ) : events.length ===
          0 ? (
          /* ==================================================
             NO EVENTS AT ALL
          ================================================== */

          <div
            className="
              mt-4

              md:mt-8
            "
          >
            <NoPublishedEvents
              onRefresh={() =>
                void fetchEvents(
                  false,
                )
              }
              refreshing={
                refreshing
              }
              onFeedback={
                openFeedback
              }
            />
          </div>
        ) : filteredEvents.length ===
          0 ? (
          /* ==================================================
             FILTERS RETURNED NOTHING
          ================================================== */

          <div
            className="
              mt-4

              md:mt-8
            "
          >
            <NoMatchingEvents
              clearAll={
                resetAll
              }
            />
          </div>
        ) : (
          /* ==================================================
             EVENT SECTIONS
          ================================================== */

          <motion.div
            key={`${search}-${statusFilter}-${typeFilter}`}
            initial={{
              opacity: 0,
              y: 6,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration:
                0.28,

              ease:
                EASE,
            }}
            className="
              mt-5
              space-y-8

              md:mt-8
              md:space-y-10
            "
          >
            {/* OPEN */}

            {liveEvents.length >
              0 && (
              <AnimatedSection>
                <SectionHeading
                  title="Open for Registration"
                  subtitle="Events currently accepting registrations"
                />

                <div
                  className="
                    grid
                    grid-cols-1
                    gap-3

                    min-[520px]:grid-cols-2

                    md:gap-5
                  "
                >
                  {liveEvents.map(
                    (
                      event,
                      index,
                    ) => (
                      <OpenEventCard
                        key={
                          event._id
                        }
                        event={
                          event
                        }
                        index={
                          index
                        }
                      />
                    ),
                  )}
                </div>
              </AnimatedSection>
            )}

            {/* CONFERENCES */}

            {upcomingConferences.length >
              0 && (
              <AnimatedSection>
                <SectionHeading
                  title="Upcoming Conferences"
                  subtitle="Upcoming conferences and scientific programmes"
                />

                <UpcomingGrid
                  events={
                    upcomingConferences
                  }
                />
              </AnimatedSection>
            )}

            {/* MANTRAM */}

            {upcomingMantram.length >
              0 && (
              <AnimatedSection>
                <SectionHeading
                  title="Upcoming MantraM Sessions"
                  subtitle="Upcoming MantraM programmes"
                />

                <UpcomingGrid
                  events={
                    upcomingMantram
                  }
                />
              </AnimatedSection>
            )}

            {/* OTHER */}

            {upcomingEvents.length >
              0 && (
              <AnimatedSection>
                <SectionHeading
                  title="Upcoming Events"
                  subtitle="More programmes and opportunities to participate"
                />

                <UpcomingGrid
                  events={
                    upcomingEvents
                  }
                />
              </AnimatedSection>
            )}

            {/* COMPLETED */}

            {completedEvents.length >
              0 &&
              statusFilter ===
                'COMPLETED' && (
                <AnimatedSection>
                  <SectionHeading
                    title="Completed Events"
                    subtitle="Previously concluded programmes"
                  />

                  <UpcomingGrid
                    events={
                      completedEvents
                    }
                    completed
                  />
                </AnimatedSection>
              )}
          </motion.div>
        )}
      </main>

      {/* ======================================================
          MOBILE BOTTOM NAVIGATION

          Tickets remain here.
          They are removed only from the top header.
      ====================================================== */}


      {/* ======================================================
          FEEDBACK EVENT SELECTOR

          This is NOT a new feedback form.

          Selecting an event takes the user directly to the
          existing feedback page/backend.
      ====================================================== */}

      <AnimatePresence>
        {showFeedbackPicker && (
          <FeedbackEventPicker
            events={
              events.filter((event) =>
                bookedTickets.some(
                  (ticket) =>
                    ticket.eventId ===
                    event._id,
                ),
              )
            }
            tickets={bookedTickets}
            onSelect={
              goToFeedback
            }
            onClose={
              closeFeedback
            }
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ============================================================
   BRAND
============================================================ */

function Brand({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <Link
      href="/"
      className="
        inline-flex
        w-fit

        items-center
        gap-2

        transition-opacity

        hover:opacity-80
      "
    >
      <Image
        src="/logos/ssilogo.png"
        alt="SSI"
        width={
          compact
            ? 24
            : 26
        }
        height={
          compact
            ? 24
            : 26
        }
        priority
        className="
          shrink-0
          object-contain
        "
      />

      <span
        className={`
          font-semibold

          text-secondary

          ${
            compact
              ? 'text-[13px]'
              : 'text-[14px]'
          }
        `}
      >
        SSI Maya Connect
      </span>
    </Link>
  );
}

/* ============================================================
   SEARCH BAR
============================================================ */

function SearchBar({
  value,
  onChange,
  mobile = false,
  showFilters,
  onToggleFilters,
  hasActiveFilters,
}: {
  value: string;

  onChange:
    (
      value:
        string,
    ) => void;

  mobile?: boolean;

  showFilters: boolean;

  onToggleFilters:
    () => void;

  hasActiveFilters:
    boolean;
}) {
  return (
    <div
      className="
        relative
        w-full
      "
    >
      <span
        className="
          pointer-events-none

          absolute
          left-3.5
          top-1/2

          -translate-y-1/2

          text-gray-400
        "
      >
        <SearchIcon />
      </span>

      <input
        type="search"
        value={
          value
        }
        onChange={(
          event,
        ) =>
          onChange(
            event.target.value,
          )
        }
        placeholder={
          mobile
            ? 'Search events...'
            : 'Search events, venue or type...'
        }
        className={`
          w-full

          rounded-lg

          border
          border-gray-200

          bg-white

          pl-10
          pr-12

          text-secondary

          outline-none

          transition-all
          duration-150

          placeholder:text-gray-400

          hover:border-gray-300

          focus:border-primary/40
          focus:ring-2
          focus:ring-primary/10

          ${
            mobile
              ? 'h-11 text-[12px]'
              : 'h-10 text-[11px]'
          }
        `}
      />

      <button
        type="button"
        aria-label="Filter events"
        aria-expanded={
          showFilters
        }
        onClick={
          onToggleFilters
        }
        className={`
          absolute
          right-1.5
          top-1/2

          grid
          h-8
          w-8

          -translate-y-1/2

          place-items-center

          rounded-md

          transition-all

          ${
            showFilters ||
            hasActiveFilters
              ? `
                  bg-primary/[0.08]
                  text-primary
                `
              : `
                  text-gray-400

                  hover:bg-gray-100
                  hover:text-secondary
                `
          }
        `}
      >
        <FilterIcon />

        {hasActiveFilters && (
          <span
            className="
              absolute
              right-[4px]
              top-[4px]

              h-[5px]
              w-[5px]

              rounded-full

              bg-primary
            "
          />
        )}
      </button>
    </div>
  );
}

/* ============================================================
   FILTER TYPES
============================================================ */

interface FilterPanelProps {
  statusFilter:
    EventStatusFilter;

  typeFilter:
    EventTypeFilter;

  setStatusFilter:
    (
      value:
        EventStatusFilter,
    ) => void;

  setTypeFilter:
    (
      value:
        EventTypeFilter,
    ) => void;

  clearFilters:
    () => void;

  hasActiveFilters:
    boolean;

  onClose:
    () => void;
}

/* ============================================================
   MOBILE FILTER PANEL
============================================================ */

function MobileFilterPanel(
  props:
    FilterPanelProps,
) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: -5,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      exit={{
        opacity: 0,
        y: -5,
      }}
      transition={{
        duration: 0.16,
      }}
      className="
        absolute

        inset-x-0
        top-[50px]

        z-[70]

        rounded-xl

        border
        border-gray-200

        bg-white

        p-3.5

        shadow-[0_18px_42px_rgba(27,75,107,0.15)]
      "
    >
      <FilterContents
        {...props}
      />
    </motion.div>
  );
}

/* ============================================================
   DESKTOP FILTER PANEL
============================================================ */

function DesktopFilterPanel(
  props:
    FilterPanelProps,
) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: -5,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      exit={{
        opacity: 0,
        y: -5,
      }}
      transition={{
        duration: 0.16,
      }}
      className="
        absolute

        left-1/2
        top-[48px]

        z-50

        w-[400px]

        -translate-x-1/2

        rounded-xl

        border
        border-gray-200

        bg-white

        p-4

        shadow-[0_18px_45px_rgba(27,75,107,0.14)]
      "
    >
      <FilterContents
        {...props}
      />
    </motion.div>
  );
}

/* ============================================================
   FILTER CONTENT
============================================================ */

function FilterContents({
  statusFilter,
  typeFilter,
  setStatusFilter,
  setTypeFilter,
  clearFilters,
  hasActiveFilters,
  onClose,
}: FilterPanelProps) {
  return (
    <>
      <div
        className="
          flex
          items-start
          justify-between
          gap-3
        "
      >
        <div>
          <h3
            className="
              text-[12px]
              font-semibold

              text-secondary
            "
          >
            Filter events
          </h3>

          <p
            className="
              mt-0.5

              text-[8px]

              text-gray-400
            "
          >
            Refine the events shown below.
          </p>
        </div>

        <button
          type="button"
          aria-label="Close filters"
          onClick={
            onClose
          }
          className="
            grid
            h-8
            w-8

            place-items-center

            rounded-lg

            text-gray-400

            transition

            hover:bg-gray-100
            hover:text-secondary
          "
        >
          <CloseIcon />
        </button>
      </div>

      {/* STATUS */}

      <div
        className="
          mt-4
        "
      >
        <FilterLabel>
          Status
        </FilterLabel>

        <div
          className="
            mt-2

            flex
            flex-wrap
            gap-1.5
          "
        >
          {(
            [
              'ALL',
              'LIVE',
              'UPCOMING',
              'COMPLETED',
            ] as EventStatusFilter[]
          ).map(
            (
              value,
            ) => (
              <FilterChoice
                key={
                  value
                }
                selected={
                  statusFilter ===
                  value
                }
                label={formatStatus(
                  value,
                )}
                onClick={() =>
                  setStatusFilter(
                    value,
                  )
                }
              />
            ),
          )}
        </div>
      </div>

      {/* EVENT TYPE */}

      <div
        className="
          mt-4
        "
      >
        <FilterLabel>
          Event Type
        </FilterLabel>

        <div
          className="
            mt-2

            flex
            flex-wrap
            gap-1.5
          "
        >
          {(
            [
              'ALL',
              'conference',
              'mantram',
              'event',
            ] as EventTypeFilter[]
          ).map(
            (
              value,
            ) => (
              <FilterChoice
                key={
                  value
                }
                selected={
                  typeFilter ===
                  value
                }
                label={formatType(
                  value,
                )}
                onClick={() =>
                  setTypeFilter(
                    value,
                  )
                }
              />
            ),
          )}
        </div>
      </div>

      {/* FOOTER */}

      <div
        className="
          mt-4

          flex
          items-center
          justify-between

          border-t
          border-gray-100

          pt-3
        "
      >
        <button
          type="button"
          onClick={
            clearFilters
          }
          disabled={
            !hasActiveFilters
          }
          className="
            text-[10px]
            font-semibold

            text-gray-400

            transition-colors

            hover:text-secondary

            disabled:opacity-40
          "
        >
          Clear filters
        </button>

        <button
          type="button"
          onClick={
            onClose
          }
          className="
            h-8

            rounded-lg

            bg-primary

            px-4

            text-[9px]
            font-semibold

            text-white

            transition-colors

            hover:bg-primary-dark
          "
        >
          Apply
        </button>
      </div>
    </>
  );
}

/* ============================================================
   FILTER LABEL
============================================================ */

function FilterLabel({
  children,
}: {
  children:
    ReactNode;
}) {
  return (
    <p
      className="
        text-[8px]
        font-bold

        uppercase

        tracking-[0.08em]

        text-gray-400
      "
    >
      {children}
    </p>
  );
}

/* ============================================================
   FILTER CHOICE
============================================================ */

function FilterChoice({
  selected,
  label,
  onClick,
}: {
  selected:
    boolean;

  label:
    string;

  onClick:
    () => void;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className={`
        min-h-[34px]

        rounded-lg

        border

        px-3

        text-[9px]
        font-semibold

        transition-all

        ${
          selected
            ? `
                border-primary/25
                bg-primary/[0.07]
                text-primary
              `
            : `
                border-gray-200
                bg-white
                text-gray-500

                hover:border-gray-300
                hover:text-secondary
              `
        }
      `}
    >
      {label}
    </button>
  );
}

/* ============================================================
   ACTIVE FILTER TAG
============================================================ */

function FilterTag({
  label,
  onRemove,
}: {
  label:
    string;

  onRemove:
    () => void;
}) {
  return (
    <motion.span
      layout
      initial={{
        opacity: 0,
        scale: 0.96,
      }}
      animate={{
        opacity: 1,
        scale: 1,
      }}
      className="
        inline-flex
        max-w-full

        items-center
        gap-1.5

        rounded-full

        border
        border-gray-200

        bg-white

        px-2.5
        py-1.5

        text-[9px]
        font-medium

        text-secondary
      "
    >
      <span
        className="
          max-w-[210px]
          truncate
        "
      >
        {label}
      </span>

      <button
        type="button"
        aria-label={`Remove ${label}`}
        onClick={
          onRemove
        }
        className="
          grid
          h-4
          w-4
          shrink-0

          place-items-center

          rounded-full

          text-gray-400

          hover:bg-gray-100
          hover:text-secondary
        "
      >
        ×
      </button>
    </motion.span>
  );
}

/* ============================================================
   SECTION
============================================================ */

function AnimatedSection({
  children,
}: {
  children:
    ReactNode;
}) {
  return (
    <motion.section
      initial={{
        opacity: 0,
        y: 8,
      }}
      whileInView={{
        opacity: 1,
        y: 0,
      }}
      viewport={{
        once: true,
        amount: 0.04,
      }}
      transition={{
        duration: 0.35,
        ease: EASE,
      }}
    >
      {children}
    </motion.section>
  );
}

/* ============================================================
   SECTION HEADING
============================================================ */

function SectionHeading({
  title,
  subtitle,
}: {
  title:
    string;

  subtitle?:
    string;
}) {
  return (
    <div
      className="
        mb-3

        md:mb-4
      "
    >
      <h2
        className="
          font-heading

          text-[17px]
          font-semibold

          tracking-[-0.02em]

          text-secondary

          md:text-[20px]
        "
      >
        {title}
      </h2>

      {subtitle && (
        <p
          className="
            mt-0.5

            text-[9px]

            text-gray-400

            md:text-[10px]
          "
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

/* ============================================================
   OPEN EVENT CARD
============================================================ */

const OpenEventCard = memo(function OpenEventCard({
  event,
  index,
}: {
  event:
    IEvent;

  index:
    number;
}) {
  return (
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
          0.32,

        delay:
          index *
          0.035,

        ease:
          EASE,
      }}
      className="
        h-full
      "
    >
      <Link
        href={`/events/${event._id}`}
        className="
          group

          flex
          h-full
          flex-col

          overflow-hidden

          rounded-xl

          border
          border-gray-200

          bg-white

          shadow-[0_3px_12px_rgba(27,75,107,0.025)]

          transition-all
          duration-200

          hover:border-gray-300
          hover:shadow-[0_8px_24px_rgba(27,75,107,0.055)]
        "
      >
        {/* IMAGE */}

        <div
          className="
            relative

            aspect-[16/8.5]

            overflow-hidden

            bg-gray-100

            sm:aspect-[16/8]

            md:aspect-[16/7.4]
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
              loading={
                index < 2
                  ? 'eager'
                  : 'lazy'
              }
              sizes="
                (max-width: 520px) 100vw,
                (max-width: 768px) 50vw,
                45vw
              "
              className="
                object-cover

                transition-transform
                duration-500

                group-hover:scale-[1.02]
              "
            />
          ) : (
            <EventPlaceholder />
          )}
        </div>

        {/* CONTENT */}

        <div
          className="
            flex
            flex-1
            flex-col

            p-3.5

            md:p-4
          "
        >
          {/* TYPE */}

          <p
            className="
              text-[8px]
              font-semibold

              uppercase

              tracking-[0.06em]

              text-gray-400
            "
          >
            {formatType(
              event.eventType,
            )}
          </p>

          {/* NAME */}

          <h3
            className="
              mt-1

              line-clamp-2

              font-heading

              text-[15px]
              font-semibold

              leading-5

              text-secondary

              md:text-[16px]
            "
          >
            {event.eventName}
          </h3>

          {/* META */}

          <div
            className="
              mt-2.5

              space-y-1.5
            "
          >
            <MetaRow
              type="location"
              value={
                event.venue
              }
            />

            <MetaRow
              type="date"
              value={formatDateRange(
                event.startDate,
                event.endDate,
              )}
            />
          </div>

          {/* ABOUT

              This replaces the old booked/remaining capacity bar.
          */}

          <div
            className="
              mt-3

              border-t
              border-gray-100

              pt-3
            "
          >
            <div
              className="
                flex
                min-w-0
                items-baseline
                gap-2
              "
            >
              <span
                className="
                  shrink-0

                  text-[8px]
                  font-semibold

                  text-secondary
                "
              >
                About
              </span>

              <p
                className="
                  min-w-0
                  flex-1

                  truncate

                  text-[10px]
                  leading-4

                  text-gray-500

                  md:text-[11px]
                "
              >
                {event.description
                  ?.trim() ||
                  'View event information, schedule and registration details.'}
              </p>
            </div>
          </div>

          {/* ACTION */}

          <div
            className="
              mt-auto
              pt-3
            "
          >
            <div
              className="
                flex
                items-center
                justify-between

                border-t
                border-gray-100

                pt-3
              "
            >
              <span
                className="
                  text-[8px]
                  font-medium

                  text-gray-400
                "
              >
                Registration available
              </span>

              <span
                className="
                  inline-flex
                  items-center
                  gap-1.5

                  text-[10px]
                  font-semibold

                  text-primary

                  transition-colors

                  group-hover:text-primary-dark
                "
              >
                View event

                <ArrowIcon />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
});

/* ============================================================
   UPCOMING GRID
============================================================ */

function UpcomingGrid({
  events,
  completed = false,
}: {
  events:
    IEvent[];

  completed?:
    boolean;
}) {
  return (
    <div
      className="
        grid
        grid-cols-1
        gap-2.5

        sm:grid-cols-2

        xl:grid-cols-3

        md:gap-3
      "
    >
      {events.map(
        (
          event,
          index,
        ) => (
          <UpcomingEventCard
            key={
              event._id
            }
            event={
              event
            }
            index={
              index
            }
            completed={
              completed
            }
          />
        ),
      )}
    </div>
  );
}

/* ============================================================
   UPCOMING CARD
============================================================ */

const UpcomingEventCard = memo(function UpcomingEventCard({
  event,
  index,
  completed,
}: {
  event:
    IEvent;

  index:
    number;

  completed:
    boolean;
}) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 6,
      }}
      whileInView={{
        opacity: 1,
        y: 0,
      }}
      viewport={{
        once: true,
      }}
      transition={{
        duration:
          0.28,

        delay:
          Math.min(
            index,
            5,
          ) * 0.025,

        ease:
          EASE,
      }}
    >
      <Link
        href={`/events/${event._id}`}
        className="
          group

          flex
          min-h-[108px]

          items-center
          gap-3

          rounded-xl

          border
          border-gray-200

          bg-white

          p-2.5

          shadow-[0_2px_10px_rgba(27,75,107,0.02)]

          transition-all
          duration-200

          hover:border-gray-300
          hover:shadow-[0_7px_20px_rgba(27,75,107,0.05)]

          md:min-h-[112px]
          md:p-3
        "
      >
        {/* THUMBNAIL */}

        <div
          className="
            relative

            h-[82px]
            w-[82px]
            shrink-0

            overflow-hidden

            rounded-lg

            bg-gray-100

            md:h-[88px]
            md:w-[88px]
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
              loading="lazy"
              sizes="90px"
              className="
                object-cover

                transition-transform
                duration-400

                group-hover:scale-[1.025]
              "
            />
          ) : (
            <EventPlaceholder
              compact
            />
          )}

          {completed && (
            <div
              className="
                absolute
                inset-0

                bg-black/15
              "
            />
          )}
        </div>

        {/* DETAILS */}

        <div
          className="
            min-w-0
            flex-1
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
            {formatType(
              event.eventType,
            )}
          </p>

          <h3
            className="
              mt-1

              line-clamp-2

              text-[13px]
              font-semibold

              leading-[18px]

              text-secondary

              md:text-[14px]
            "
          >
            {event.eventName}
          </h3>

          <p
            className="
              mt-1

              truncate

              text-[9px]

              text-gray-500
            "
          >
            {formatDate(
              event.startDate,
            )}
          </p>

          <p
            className="
              mt-1

              truncate

              text-[8px]

              text-gray-400
            "
          >
            {event.description
              ?.trim() ||
              event.venue}
          </p>
        </div>

        {/* ARROW */}

        <span
          className="
            grid
            h-8
            w-8
            shrink-0

            place-items-center

            text-gray-300

            transition-colors

            group-hover:text-primary
          "
        >
          <ArrowIcon />
        </span>
      </Link>
    </motion.div>
  );
});

/* ============================================================
   FEEDBACK EVENT PICKER

   IMPORTANT:
   This component DOES NOT save feedback.

   It only selects the event and navigates into the existing
   /events/[id]/book/feedback page.

   Therefore the existing:
   - rating
   - message
   - suggestedFeature
   - submittedAt
   - sessionStorage keys
   - trackActivity
   all remain unchanged.
============================================================ */

function FeedbackEventPicker({
  events,
  tickets,
  onSelect,
  onClose,
}: {
  events:
    IEvent[];

  tickets:
    CachedTicket[];

  onSelect:
    (
      eventId:
        string,
      bookingId:
        string,
      bookingMongoId:
        string,
    ) => void;

  onClose:
    () => void;
}) {
  const [
    search,
    setSearch,
  ] = useState('');

  const sortedEvents =
    useMemo(
      () =>
        [...events].sort(
          (
            first,
            second,
          ) => {
            const firstRank =
              feedbackEventRank(
                first.status,
              );
            const secondRank =
              feedbackEventRank(
                second.status,
              );

            if (
              firstRank !==
              secondRank
            ) {
              return (
                firstRank -
                secondRank
              );
            }

            return (
              new Date(
                first.startDate,
              ).getTime() -
              new Date(
                second.startDate,
              ).getTime()
            );
          },
        ),
      [
        events,
      ],
    );
  const visibleEvents =
    sortedEvents.filter(
      (event) =>
        !search.trim() ||
        event.eventName
          .toLowerCase()
          .includes(
            search.trim().toLowerCase(),
          ),
    );
  const bookedEvents =
    visibleEvents
      .map((event) => ({
        event,
        tickets: tickets.filter(
          (ticket) =>
            ticket.eventId ===
            event._id,
        ),
      }))
      .filter(
        (item) =>
          item.tickets.length > 0,
      );

  return (
    <motion.div
      initial={{
        opacity: 0,
      }}
      animate={{
        opacity: 1,
      }}
      exit={{
        opacity: 0,
      }}
      className="
        fixed
        inset-0

        z-[100]

        flex
        items-end
        justify-center

        bg-[#07151F]/35

        backdrop-blur-[2px]

        sm:items-center
        sm:px-4
      "
      onMouseDown={(
        event,
      ) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <motion.section
        initial={{
          opacity: 0,
          y: 22,
          scale: 0.99,
        }}
        animate={{
          opacity: 1,
          y: 0,
          scale: 1,
        }}
        exit={{
          opacity: 0,
          y: 14,
          scale: 0.99,
        }}
        transition={{
          duration:
            0.22,

          ease:
            EASE,
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-picker-title"
        className="
          w-full

          overflow-hidden

          rounded-t-[18px]

          border
          border-gray-200

          bg-white

          shadow-[0_-10px_40px_rgba(6,19,29,0.12)]

          sm:max-w-[520px]
          sm:rounded-xl
          sm:shadow-[0_20px_60px_rgba(6,19,29,0.16)]
        "
      >
        {/* HEADER */}

        <div
          className="
            flex
            items-start
            justify-between
            gap-4

            border-b
            border-gray-100

            px-4
            py-4

            sm:px-5
          "
        >
          <div
            className="
              flex
              min-w-0
              items-start
              gap-3
            "
          >
            <span
              className="
                grid
                h-9
                w-9
                shrink-0

                place-items-center

                rounded-lg

                bg-primary/[0.07]

                text-primary
              "
            >
              <FeedbackIcon />
            </span>

            <div
              className="
                min-w-0
              "
            >
              <h2
                id="feedback-picker-title"
                className="
                  text-[15px]
                  font-semibold

                  text-secondary
                "
              >
                Share Feedback
              </h2>

              <p
                className="
                  mt-0.5

                  text-[10px]
                  leading-4

                  text-gray-500
                "
              >
                Select the event you
                would like to review.
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close feedback"
            onClick={
              onClose
            }
            className="
              grid
              h-8
              w-8
              shrink-0

              place-items-center

              rounded-lg

              text-gray-400

              transition-colors

              hover:bg-gray-100
              hover:text-secondary
            "
          >
            <CloseIcon />
          </button>
        </div>

        {/* CONTENT */}

        <div
          className="
            max-h-[62dvh]

            overflow-y-auto

            px-4
            py-3

            sm:max-h-[520px]
            sm:px-5
            sm:py-4
          "
        >
          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search by event name"
            aria-label="Search by event name"
            className="
              mb-3
              h-10
              w-full
              rounded-lg
              border
              border-gray-200
              px-3
              text-[12px]
              text-secondary
              outline-none
              placeholder:text-gray-400
              focus:border-primary/40
              focus:ring-2
              focus:ring-primary/10
            "
          />

          {bookedEvents.length >
          0 ? (
            <div
              className="
                space-y-2
              "
            >
              {bookedEvents
                .filter((item) =>
                  !search.trim() ||
                  item.event.eventName
                    .toLowerCase()
                    .includes(
                      search.trim().toLowerCase(),
                    ),
                )
                .map(
                (
                  item,
                ) => (
                  <div
                    key={item.event._id}
                    className="
                      group

                      flex
                      w-full

                      items-center
                      gap-3

                      rounded-xl

                      border
                      border-gray-200

                      bg-white

                      p-2.5

                      text-left

                      transition-all
                      duration-150

                      hover:border-primary/25
                      hover:bg-primary/[0.025]
                    "
                  >
                    {/* EVENT IMAGE */}

                    <div
                      className="
                        relative

                        h-14
                        w-14
                        shrink-0

                        overflow-hidden

                        rounded-lg

                        bg-gray-100
                      "
                    >
                      {item.event.imageUrl ? (
                        <Image
                          src={
                            item.event.imageUrl
                          }
                          alt=""
                          fill
                          unoptimized
                          sizes="56px"
                          className="
                            object-cover
                          "
                        />
                      ) : (
                        <EventPlaceholder
                          compact
                        />
                      )}
                    </div>

                    {/* EVENT */}

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
                          gap-x-2
                          gap-y-0.5
                        "
                      >
                        <span
                          className="
                            text-[7px]
                            font-semibold

                            uppercase

                            tracking-[0.05em]

                            text-gray-400
                          "
                        >
                          {formatType(
                            item.event.eventType,
                          )}
                        </span>

                        <span
                          className="
                            text-[7px]
                            font-medium

                            text-primary
                          "
                        >
                          {feedbackStatusLabel(
                            item.event.status,
                          )}
                        </span>
                      </div>

                      <p
                        className="
                          mt-1

                          truncate

                          text-[12px]
                          font-semibold

                          text-secondary
                        "
                      >
                        {item.event.eventName}
                      </p>

                      <p
                        className="
                          mt-0.5

                          truncate

                          text-[8px]

                          text-gray-400
                        "
                      >
                        {formatDate(
                          item.event.startDate,
                        )}

                        {item.event.venue
                          ? ` · ${item.event.venue}`
                          : ''}
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

                        text-gray-300

                        transition-colors

                        group-hover:bg-primary/[0.05]
                        group-hover:text-primary
                      "
                    >
                      <ArrowIcon />
                    </span>
                    {item.tickets.map((ticket) => {
                      let bookingMongoId = '';
                      try {
                        const qr =
                          JSON.parse(ticket.qrData);
                        bookingMongoId =
                          typeof qr.doctorId ===
                            'string'
                            ? qr.doctorId
                            : '';
                      } catch {
                        bookingMongoId = '';
                      }

                      return (
                        <button
                          key={ticket.bookingId}
                          type="button"
                          onClick={() =>
                            onSelect(
                              ticket.eventId,
                              ticket.bookingId,
                              bookingMongoId,
                            )
                          }
                          className="
                            mt-2
                            flex
                            w-full
                            items-center
                            justify-between
                            rounded-lg
                            bg-gray-50
                            px-2.5
                            py-2
                            text-left
                            text-[10px]
                            text-gray-600
                            hover:bg-primary/[0.05]
                          "
                        >
                          <span>
                            {ticket.date} · {ticket.startTime}
                          </span>
                          <span className="font-semibold text-primary">
                            Review
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ),
              )}
            </div>
          ) : (
            /* NO EVENTS */

            <div
              className="
                py-8

                text-center
              "
            >
              <span
                className="
                  mx-auto

                  grid
                  h-10
                  w-10

                  place-items-center

                  rounded-lg

                  bg-gray-50

                  text-gray-400
                "
              >
                <CalendarLargeIcon />
              </span>

              <h3
                className="
                  mt-3

                  text-[13px]
                  font-semibold

                  text-secondary
                "
              >
                No event available
              </h3>

              <p
                className="
                  mx-auto
                  mt-1

                  max-w-[290px]

                  text-[10px]
                  leading-5

                  text-gray-500
                "
              >
                Event feedback becomes
                available once an event
                is published.
              </p>
            </div>
          )}
        </div>

        {/* FOOTER */}

        <div
          className="
            border-t
            border-gray-100

            bg-gray-50/50

            px-4
            pb-[max(12px,env(safe-area-inset-bottom))]
            pt-3

            sm:px-5
            sm:pb-3
          "
        >
          <p
            className="
              text-center

              text-[8px]
              leading-4

              text-gray-400
            "
          >
            Feedback is associated
            with the selected event.
          </p>
        </div>
      </motion.section>
    </motion.div>
  );
}

/* ============================================================
   EMPTY STATE
============================================================ */

function NoPublishedEvents({
  onRefresh,
  refreshing,
  onFeedback,
}: {
  onRefresh:
    () => void;

  refreshing:
    boolean;

  onFeedback:
    () => void;
}) {
  return (
    <motion.section
      initial={{
        opacity: 0,
        y: 8,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      className="
        rounded-2xl

        border
        border-gray-200

        bg-white

        px-5
        py-9

        text-center

        shadow-[0_4px_18px_rgba(27,75,107,0.025)]

        sm:px-8
        sm:py-12
      "
    >
      <span
        className="
          mx-auto

          grid
          h-11
          w-11

          place-items-center

          rounded-xl

          border
          border-gray-200

          bg-gray-50

          text-gray-400
        "
      >
        <CalendarLargeIcon />
      </span>

      <h2
        className="
          mt-4

          font-heading

          text-[19px]
          font-semibold

          tracking-[-0.02em]

          text-secondary
        "
      >
        No events are available
        right now
      </h2>

      <p
        className="
          mx-auto
          mt-1.5

          max-w-[450px]

          text-[11px]
          leading-5

          text-gray-500
        "
      >
        New conferences,
        MantraM sessions and
        programmes will appear here
        when they are published.
      </p>

      <div
        className="
          mt-5

          flex
          flex-wrap
          items-center
          justify-center
          gap-2
        "
      >
        <button
          type="button"
          disabled={
            refreshing
          }
          onClick={
            onRefresh
          }
          className="
            inline-flex
            h-10

            items-center
            justify-center
            gap-2

            rounded-lg

            bg-primary

            px-4

            text-[10px]
            font-semibold

            text-white

            transition-colors

            hover:bg-primary-dark

            disabled:opacity-50
          "
        >
          <RefreshIcon
            spinning={
              refreshing
            }
          />

          {refreshing
            ? 'Checking...'
            : 'Check Again'}
        </button>

        <button
          type="button"
          onClick={
            onFeedback
          }
          className="
            inline-flex
            h-10

            items-center
            justify-center
            gap-2

            rounded-lg

            border
            border-gray-200

            bg-white

            px-4

            text-[10px]
            font-semibold

            text-secondary

            transition-colors

            hover:bg-gray-50
          "
        >
          <FeedbackIcon />

          Feedback
        </button>
      </div>
    </motion.section>
  );
}

/* ============================================================
   NO MATCHING EVENTS
============================================================ */

function NoMatchingEvents({
  clearAll,
}: {
  clearAll:
    () => void;
}) {
  return (
    <motion.section
      initial={{
        opacity: 0,
        y: 6,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      className="
        rounded-xl

        border
        border-gray-200

        bg-white

        px-5
        py-10

        text-center

        shadow-[0_3px_14px_rgba(27,75,107,0.02)]
      "
    >
      <span
        className="
          mx-auto

          grid
          h-10
          w-10

          place-items-center

          rounded-lg

          bg-gray-50

          text-gray-400
        "
      >
        <SearchLargeIcon />
      </span>

      <h2
        className="
          mt-3

          text-[14px]
          font-semibold

          text-secondary
        "
      >
        No matching events
      </h2>

      <p
        className="
          mx-auto
          mt-1

          max-w-[350px]

          text-[10px]
          leading-5

          text-gray-500
        "
      >
        Try another search or clear
        the current filters.
      </p>

      <button
        type="button"
        onClick={
          clearAll
        }
        className="
          mt-4

          h-9

          rounded-lg

          border
          border-gray-200

          bg-white

          px-4

          text-[9px]
          font-semibold

          text-secondary

          transition-colors

          hover:bg-gray-50
        "
      >
        Clear Search & Filters
      </button>
    </motion.section>
  );
}

/* ============================================================
   LOADING
============================================================ */

function LoadingState() {
  return (
    <div
      className="
        space-y-8
      "
    >
      <section>
        <div
          className="
            h-5
            w-40

            animate-pulse

            rounded

            bg-gray-100
          "
        />

        <div
          className="
            mt-3

            grid
            grid-cols-1
            gap-3

            min-[520px]:grid-cols-2

            md:gap-5
          "
        >
          {Array.from({
            length: 2,
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
                    aspect-[16/8]

                    animate-pulse

                    bg-gray-100
                  "
                />

                <div
                  className="
                    p-4
                  "
                >
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
                      mt-2

                      h-4
                      w-3/4

                      animate-pulse

                      rounded

                      bg-gray-100
                    "
                  />

                  <div
                    className="
                      mt-3

                      h-3
                      w-1/2

                      animate-pulse

                      rounded

                      bg-gray-100
                    "
                  />

                  <div
                    className="
                      mt-4

                      h-9

                      animate-pulse

                      rounded-lg

                      bg-gray-50
                    "
                  />
                </div>
              </div>
            ),
          )}
        </div>
      </section>
    </div>
  );
}

/* ============================================================
   META ROW
============================================================ */

function MetaRow({
  type,
  value,
}: {
  type:
    | 'location'
    | 'date';

  value:
    string;
}) {
  return (
    <div
      className="
        flex
        min-w-0
        items-center
        gap-1.5

        text-gray-500
      "
    >
      {type ===
      'location' ? (
        <LocationIcon />
      ) : (
        <CalendarIcon />
      )}

      <span
        className="
          truncate

          text-[9px]

          md:text-[10px]
        "
      >
        {value}
      </span>
    </div>
  );
}

/* ============================================================
   MOBILE NAV ITEM
============================================================ */

function MobileNavItem({
  href,
  label,
  icon,
  active = false,
}: {
  href:
    string;

  label:
    string;

  icon:
    ReactNode;

  active?:
    boolean;
}) {
  return (
    <Link
      href={
        href
      }
      className={`
        flex
        min-h-[54px]

        flex-col
        items-center
        justify-center
        gap-1

        text-[9px]
        font-medium

        transition-colors

        ${
          active
            ? 'text-primary'
            : 'text-gray-400'
        }
      `}
    >
      {icon}

      <span>
        {label}
      </span>
    </Link>
  );
}

/* ============================================================
   PLACEHOLDER
============================================================ */

function EventPlaceholder({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <div
      className="
        flex
        h-full
        w-full

        items-center
        justify-center

        bg-[#F2F6F6]
      "
    >
      <span
        className="
          grid
          h-10
          w-10

          place-items-center

          rounded-lg

          border
          border-gray-200

          bg-white

          text-primary/45
        "
      >
        {compact ? (
          <EventSmallIcon />
        ) : (
          <EventIcon />
        )}
      </span>
    </div>
  );
}

/* ============================================================
   FEEDBACK EVENT HELPERS
============================================================ */

function feedbackEventRank(
  status:
    IEvent['status'],
) {
  if (
    status ===
    'LIVE'
  ) {
    return 0;
  }

  if (
    status ===
    'UPCOMING'
  ) {
    return 1;
  }

  return 2;
}

function feedbackStatusLabel(
  status:
    IEvent['status'],
) {
  if (
    status ===
    'LIVE'
  ) {
    return 'Open';
  }

  if (
    status ===
    'UPCOMING'
  ) {
    return 'Upcoming';
  }

  return 'Completed';
}

/* ============================================================
   FORMATTERS
============================================================ */

function formatStatus(
  value:
    EventStatusFilter,
) {
  if (
    value ===
    'ALL'
  ) {
    return 'All';
  }

  if (
    value ===
    'UPCOMING'
  ) {
    return 'Upcoming';
  }

  if (
    value ===
    'COMPLETED'
  ) {
    return 'Completed';
  }

  return 'Open';
}

function formatType(
  value:
    EventTypeFilter |
    IEvent['eventType'],
) {
  if (
    value ===
    'ALL'
  ) {
    return 'All';
  }

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

function formatDate(
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
    'en-GB',
    {
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
}

function formatDateRange(
  startValue:
    string,

  endValue:
    string,
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
    Number.isNaN(
      start.getTime(),
    )
  ) {
    return '';
  }

  if (
    Number.isNaN(
      end.getTime(),
    ) ||
    start.toDateString() ===
      end.toDateString()
  ) {
    return formatDate(
      startValue,
    );
  }

  const startLabel =
    new Intl.DateTimeFormat(
      'en-GB',
      {
        day:
          '2-digit',

        month:
          'short',
      },
    ).format(
      start,
    );

  const endLabel =
    new Intl.DateTimeFormat(
      'en-GB',
      {
        day:
          '2-digit',

        month:
          'short',

        year:
          'numeric',
      },
    ).format(
      end,
    );

  return `${startLabel} – ${endLabel}`;
}

/* ============================================================
   ICONS
============================================================ */

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

function SearchLargeIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
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

function FilterIcon() {
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
        d="M4 6h16M7 12h10M10 18h4"
      />
    </svg>
  );
}

function CloseIcon() {
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
        d="M6 6l12 12M18 6 6 18"
      />
    </svg>
  );
}

function FeedbackIcon() {
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
        d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-5 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
      />

      <path
        strokeLinecap="round"
        d="M8 9h8M8 13h5"
      />
    </svg>
  );
}

function TicketIcon() {
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
        d="M5 5h14v4a3 3 0 010 6v4H5v-4a3 3 0 010-6V5Z"
      />

      <path
        strokeLinecap="round"
        d="M12 7v10"
      />
    </svg>
  );
}

function HomeIcon() {
  return (
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
        d="M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"
      />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21s6-5.2 6-11a6 6 0 10-12 0c0 5.8 6 11 6 11Z"
      />

      <circle
        cx="12"
        cy="10"
        r="2"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 011 1v14H4V6a1 1 0 011-1Z"
      />
    </svg>
  );
}

function CalendarLargeIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 011 1v14H4V6a1 1 0 011-1Z"
      />
    </svg>
  );
}

function EventIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.7}
    >
      <rect
        x="4"
        y="5"
        width="16"
        height="14"
        rx="2"
      />

      <path
        strokeLinecap="round"
        d="M8 9h8M8 13h5"
      />
    </svg>
  );
}

function EventSmallIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.7}
    >
      <rect
        x="4"
        y="5"
        width="16"
        height="14"
        rx="2"
      />

      <path
        strokeLinecap="round"
        d="M8 9h8M8 13h5"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      className="h-3 w-3"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m9 6 6 6-6 6"
      />
    </svg>
  );
}

function RefreshIcon({
  spinning,
}: {
  spinning:
    boolean;
}) {
  return (
    <svg
      className={`
        h-4
        w-4

        ${
          spinning
            ? 'animate-spin'
            : ''
        }
      `}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.9}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 11a8 8 0 10-2.35 5.65M20 4v7h-7"
      />
    </svg>
  );
}
