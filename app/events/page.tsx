'use client';

import Image from 'next/image';
import Link from 'next/link';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AnimatePresence,
  motion,
} from 'framer-motion';

import { useRealtimeRefresh } from '@/components/realtime/RealtimeProvider';

import { trackActivity } from '@/lib/activity-client';

interface IEvent {
  _id: string;
  eventName: string;
  eventType: 'conference' | 'mantram' | 'event';
  venue: string;
  startDate: string;
  endDate: string;
  description?: string;
  imageUrl?: string;
  totalSlots: number;
  bookedSlots: number;
  status: 'LIVE' | 'COMPLETED' | 'UPCOMING';
}

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

const EASE = [0.16, 1, 0.3, 1] as const;

export default function HomePage() {
  useEffect(() => {
    void trackActivity('page_view');
  }, []);

  const [events, setEvents] =
    useState<IEvent[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [search, setSearch] =
    useState('');

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

  const fetchEvents =
    useCallback(async (showLoading = true) => {
      if (showLoading) {
        setLoading(true);
      }

      try {
        const res = await fetch(
          '/api/events',
          {
            method: 'GET',
            cache: 'no-store',
          },
        );

        const data =
          await res.json();

        if (
          !res.ok ||
          !data.success
        ) {
          throw new Error(
            data.error ||
              'Failed to fetch events.',
          );
        }

        setEvents(
          data.events || [],
        );
      } catch (error) {
        console.error(
          'Failed to fetch events:',
          error,
        );

        setEvents([]);
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    }, []);

  useEffect(() => {
    void Promise.resolve().then(
      () => fetchEvents(),
    );
  }, [fetchEvents]);

  useRealtimeRefresh(
    'events',
    () => {
      void fetchEvents(false);
    },
  );

  const hasActiveFilters =
    statusFilter !== 'ALL' ||
    typeFilter !== 'ALL';

  const filteredEvents =
    useMemo(() => {
      const query = search
        .trim()
        .toLowerCase();

      return events.filter(
        (event) => {
          const matchesSearch =
            !query ||
            [
              event.eventName,
              event.eventType,
              event.venue,
              event.description ||
                '',
            ].some(
              (value) =>
                value
                  .toLowerCase()
                  .includes(query),
            );

          const matchesStatus =
            statusFilter ===
              'ALL' ||
            event.status ===
              statusFilter;

          const matchesType =
            typeFilter === 'ALL' ||
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
      search,
      statusFilter,
      typeFilter,
    ]);

  const liveEvents =
    useMemo(
      () =>
        filteredEvents.filter(
          (event) =>
            event.status ===
            'LIVE',
        ),
      [filteredEvents],
    );

  const upcomingConferences =
    useMemo(
      () =>
        filteredEvents.filter(
          (event) =>
            event.status ===
              'UPCOMING' &&
            event.eventType ===
              'conference',
        ),
      [filteredEvents],
    );

  const upcomingMantram =
    useMemo(
      () =>
        filteredEvents.filter(
          (event) =>
            event.status ===
              'UPCOMING' &&
            event.eventType ===
              'mantram',
        ),
      [filteredEvents],
    );

  const upcomingEvents =
    useMemo(
      () =>
        filteredEvents.filter(
          (event) =>
            event.status ===
              'UPCOMING' &&
            event.eventType ===
              'event',
        ),
      [filteredEvents],
    );

  const completedEvents =
    useMemo(
      () =>
        filteredEvents.filter(
          (event) =>
            event.status ===
            'COMPLETED',
        ),
      [filteredEvents],
    );

  function clearFilters() {
    setStatusFilter('ALL');
    setTypeFilter('ALL');
  }

  return (
    <div className="min-h-dvh bg-gray-50 pb-[86px] md:pb-0">
      {/* =====================================================
          DESKTOP HEADER
      ====================================================== */}
      <header className="sticky top-0 z-40 hidden border-b border-gray-200/80 bg-white/90 backdrop-blur-xl md:block">
        <div className="mx-auto grid h-16 w-full max-w-[1500px] grid-cols-[auto_minmax(320px,560px)_auto] items-center gap-8 px-6 lg:px-10">
          <Brand />

          <SearchBar
            value={search}
            onChange={setSearch}
            showFilters={
              showFilters
            }
            onToggleFilters={() =>
              setShowFilters(
                (value) => !value,
              )
            }
            hasActiveFilters={
              hasActiveFilters
            }
          />

          <div className="flex justify-end">
            <Link
              href="/tickets"
              className="
                inline-flex
                h-10
                cursor-pointer
                items-center
                justify-center
                rounded-full
                border
                border-primary/20
                bg-white
                px-5
                text-xs
                font-semibold
                text-primary
                shadow-sm
                transition-all
                duration-200

                hover:-translate-y-0.5
                hover:border-primary/40
                hover:bg-primary/5
                hover:shadow-md
              "
            >
              My Tickets
            </Link>
          </div>
        </div>

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
      </header>

      {/* =====================================================
          MOBILE FIXED HEADER
      ====================================================== */}
      <header
        className="
          fixed
          inset-x-0
          top-0
          z-50

          border-b
          border-gray-200/70

          bg-gray-50/95

          px-4
          pb-4
          pt-[max(14px,env(safe-area-inset-top))]

          shadow-[0_10px_30px_rgba(27,75,107,0.05)]

          backdrop-blur-xl

          md:hidden
        "
      >
        <div className="mx-auto w-full max-w-[430px]">
          <motion.div
            initial={{
              opacity: 0,
              y: -10,
              scale: 0.97,
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
            className="flex justify-center"
          >
            <Brand />
          </motion.div>

          <motion.h1
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
              delay: 0.06,
              ease: EASE,
            }}
            className="
              mt-7
              font-heading
              text-[27px]
              font-bold
              tracking-[-0.03em]
              text-secondary
            "
          >
            Hello!
          </motion.h1>

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
              delay: 0.1,
              ease: EASE,
            }}
            className="relative mt-4"
          >
            <SearchBar
              value={search}
              onChange={
                setSearch
              }
              mobile
              showFilters={
                showFilters
              }
              onToggleFilters={() =>
                setShowFilters(
                  (value) =>
                    !value,
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
          </motion.div>
        </div>
      </header>

      {/* =====================================================
          MAIN CONTENT
      ====================================================== */}
      <main
        className="
          mx-auto
          w-full
          max-w-[1500px]

          px-4
          pb-7
          pt-[230px]

          sm:px-5

          md:px-6
          md:py-8

          lg:px-10
        "
      >
        {/* Desktop Hero */}
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
            duration: 0.5,
            ease: EASE,
          }}
          className="hidden md:block md:mb-8"
        >
          <h1 className="font-heading text-3xl font-bold tracking-[-0.03em] text-secondary lg:text-[34px]">
            Hello!
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
            Welcome to your
            central medical
            networking hub.
            Discover live
            conferences and share
            expert research inside
            discussions.
          </p>
        </motion.section>

        {/* Active filter row */}
        <AnimatePresence>
          {hasActiveFilters && (
            <motion.div
              initial={{
                opacity: 0,
                height: 0,
                y: -6,
              }}
              animate={{
                opacity: 1,
                height: 'auto',
                y: 0,
              }}
              exit={{
                opacity: 0,
                height: 0,
                y: -6,
              }}
              transition={{
                duration: 0.3,
                ease: EASE,
              }}
              className="mb-5 overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-gray-400">
                  Filters:
                </span>

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
                    clearFilters
                  }
                  className="ml-1 cursor-pointer text-[11px] font-semibold text-primary transition hover:text-primary-dark"
                >
                  Clear
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <LoadingState />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${search}-${statusFilter}-${typeFilter}`}
              initial={{
                opacity: 0,
                y: 8,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                y: -4,
              }}
              transition={{
                duration: 0.3,
                ease: EASE,
              }}
              className="space-y-8 md:space-y-10"
            >
              {liveEvents.length >
                0 && (
                <AnimatedSection>
                  <SectionHeading
                    title="Live Now"
                    live
                  />

                  <div className="grid grid-cols-2 gap-3 md:gap-5">
                    {liveEvents.map(
                      (
                        event,
                        index,
                      ) => (
                        <LiveEventCard
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

              {upcomingConferences.length >
                0 && (
                <AnimatedSection>
                  <SectionHeading
                    title="Upcoming Conferences"
                  />

                  <UpcomingGrid
                    events={
                      upcomingConferences
                    }
                  />
                </AnimatedSection>
              )}

              {upcomingMantram.length >
                0 && (
                <AnimatedSection>
                  <SectionHeading
                    title="Upcoming MantraM Sessions"
                  />

                  <UpcomingGrid
                    events={
                      upcomingMantram
                    }
                  />
                </AnimatedSection>
              )}

              {upcomingEvents.length >
                0 && (
                <AnimatedSection>
                  <SectionHeading
                    title="Upcoming Events"
                  />

                  <UpcomingGrid
                    events={
                      upcomingEvents
                    }
                  />
                </AnimatedSection>
              )}

              {completedEvents.length >
                0 &&
                statusFilter ===
                  'COMPLETED' && (
                  <AnimatedSection>
                    <SectionHeading
                      title="Completed"
                    />

                    <UpcomingGrid
                      events={
                        completedEvents
                      }
                    />
                  </AnimatedSection>
                )}

              {filteredEvents.length ===
                0 && (
                <EmptyState
                  hasFilters={
                    hasActiveFilters
                  }
                  clearFilters={
                    clearFilters
                  }
                  clearSearch={() =>
                    setSearch('')
                  }
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {/* =====================================================
          MOBILE BOTTOM NAV
      ====================================================== */}
      <nav
        className="
          fixed
          inset-x-0
          bottom-0
          z-50

          grid
          grid-cols-2

          border-t
          border-gray-200/80

          bg-white/95

          pb-[max(10px,env(safe-area-inset-bottom))]
          pt-2

          shadow-[0_-8px_25px_rgba(27,75,107,0.06)]

          backdrop-blur-xl

          md:hidden
        "
      >
        <Link
          href="/events"
          className="
            flex
            min-h-[52px]
            cursor-pointer
            flex-col
            items-center
            justify-center
            gap-1
            text-primary
          "
        >
          <motion.svg
            whileTap={{
              scale: 0.88,
            }}
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"
            />
          </motion.svg>

          <span className="text-[10px] font-medium">
            Home
          </span>
        </Link>

        <Link
          href="/tickets"
          className="
            flex
            min-h-[52px]
            cursor-pointer
            flex-col
            items-center
            justify-center
            gap-1
            text-gray-500
            transition
            hover:text-primary
          "
        >
          <motion.svg
            whileTap={{
              scale: 0.88,
            }}
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 4v16M9 4v16M13 4v16M17 4v16M21 4v16"
            />
          </motion.svg>

          <span className="text-[10px] font-medium">
            My Tickets
          </span>
        </Link>
      </nav>
    </div>
  );
}

/* ============================================================
   BRAND
============================================================ */

function Brand() {
  return (
    <Link
      href="/"
      className="
        inline-flex
        w-fit
        cursor-pointer
        items-center
        gap-2.5

        rounded-full

        border
        border-primary/25

        bg-white/95

        px-4
        py-2.5

        shadow-[0_8px_25px_rgba(27,75,107,0.09)]

        backdrop-blur-xl

        transition-all
        duration-200

        hover:-translate-y-0.5
        hover:border-primary/40
        hover:shadow-[0_12px_30px_rgba(27,75,107,0.13)]

        active:scale-[0.98]
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

      <span className="text-sm font-semibold text-secondary">
        SSI Maya Connect
      </span>
    </Link>
  );
}

/* ============================================================
   SEARCH
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

  onChange: (
    value: string,
  ) => void;

  mobile?: boolean;

  showFilters: boolean;

  onToggleFilters: () => void;

  hasActiveFilters: boolean;
}) {
  return (
    <div className="relative w-full">
      <svg
        className="
          pointer-events-none
          absolute
          left-4
          top-1/2
          h-[18px]
          w-[18px]
          -translate-y-1/2
          text-primary
        "
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <circle
          cx="11"
          cy="11"
          r="7"
        />

        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m20 20-3.5-3.5"
        />
      </svg>

      <input
        type="search"
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
        placeholder="Search conferences, manthan, speakers..."
        className={`
          w-full

          rounded-xl

          border
          border-gray-200

          bg-white

          pl-11
          pr-13

          text-secondary

          shadow-[0_3px_12px_rgba(27,75,107,0.025)]

          outline-none

          transition-all
          duration-200

          placeholder:text-gray-500

          hover:border-gray-300

          focus:border-primary/60
          focus:shadow-[0_7px_20px_rgba(26,158,143,0.08)]
          focus:ring-2
          focus:ring-primary/10

          ${
            mobile
              ? 'h-[46px] text-[13px]'
              : 'h-10 text-xs'
          }
        `}
      />

      <motion.button
        type="button"
        aria-label="Filter events"
        aria-expanded={
          showFilters
        }
        onClick={
          onToggleFilters
        }
        whileTap={{
          scale: 0.9,
        }}
        className={`
          absolute
          right-2
          top-1/2

          grid
          h-8
          w-8
          -translate-y-1/2
          cursor-pointer
          place-items-center

          rounded-lg

          transition-all
          duration-200

          ${
            showFilters ||
            hasActiveFilters
              ? `
                bg-primary/10
                text-primary
              `
              : `
                text-gray-500
                hover:bg-gray-100
                hover:text-secondary
              `
          }
        `}
      >
        <svg
          className="h-[17px] w-[17px]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path d="M4 7h10M18 7h2M4 17h4M12 17h8M4 12h2M10 12h10" />

          <circle
            cx="16"
            cy="7"
            r="2"
          />

          <circle
            cx="10"
            cy="17"
            r="2"
          />

          <circle
            cx="8"
            cy="12"
            r="2"
          />
        </svg>

        {hasActiveFilters && (
          <span className="absolute right-[4px] top-[4px] h-[5px] w-[5px] rounded-full bg-primary" />
        )}
      </motion.button>
    </div>
  );
}

/* ============================================================
   FILTERS
============================================================ */

function MobileFilterPanel(
  props: FilterPanelProps,
) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: -8,
        scale: 0.97,
      }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
      }}
      exit={{
        opacity: 0,
        y: -8,
        scale: 0.97,
      }}
      transition={{
        duration: 0.22,
        ease: EASE,
      }}
      className="
        absolute
        inset-x-0
        top-[56px]
        z-[60]

        overflow-hidden

        rounded-2xl

        border
        border-gray-200/90

        bg-white/98

        p-4

        shadow-[0_20px_55px_rgba(27,75,107,0.16)]

        backdrop-blur-2xl
      "
    >
      <FilterContents
        {...props}
      />
    </motion.div>
  );
}

function DesktopFilterPanel(
  props: FilterPanelProps,
) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: -10,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      exit={{
        opacity: 0,
        y: -8,
      }}
      transition={{
        duration: 0.22,
        ease: EASE,
      }}
      className="absolute left-1/2 top-[58px] z-50 w-[430px] -translate-x-1/2 rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_24px_60px_rgba(27,75,107,0.15)]"
    >
      <FilterContents
        {...props}
      />
    </motion.div>
  );
}

interface FilterPanelProps {
  statusFilter: EventStatusFilter;

  typeFilter: EventTypeFilter;

  setStatusFilter: (
    value: EventStatusFilter,
  ) => void;

  setTypeFilter: (
    value: EventTypeFilter,
  ) => void;

  clearFilters: () => void;

  hasActiveFilters: boolean;

  onClose: () => void;
}

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
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-secondary">
          Filter events
        </h3>

        <button
          type="button"
          onClick={onClose}
          className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-secondary"
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
              d="M6 6l12 12M18 6 6 18"
            />
          </svg>
        </button>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-gray-400">
          Status
        </p>

        <div className="flex flex-wrap gap-2">
          {(
            [
              'ALL',
              'LIVE',
              'UPCOMING',
              'COMPLETED',
            ] as EventStatusFilter[]
          ).map((value) => (
            <FilterChoice
              key={value}
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
          ))}
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-gray-400">
          Type
        </p>

        <div className="flex flex-wrap gap-2">
          {(
            [
              'ALL',
              'conference',
              'mantram',
              'event',
            ] as EventTypeFilter[]
          ).map((value) => (
            <FilterChoice
              key={value}
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
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
        <button
          type="button"
          onClick={
            clearFilters
          }
          disabled={
            !hasActiveFilters
          }
          className="cursor-pointer text-xs font-semibold text-gray-500 transition hover:text-secondary disabled:cursor-default disabled:opacity-40"
        >
          Clear filters
        </button>

        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary-dark"
        >
          Done
        </button>
      </div>
    </>
  );
}

function FilterChoice({
  selected,
  label,
  onClick,
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{
        scale: 0.96,
      }}
      className={`
        cursor-pointer

        rounded-full

        border

        px-3
        py-2

        text-[11px]
        font-semibold

        transition-all
        duration-200

        ${
          selected
            ? `
              border-primary/30
              bg-primary/10
              text-primary
            `
            : `
              border-gray-200
              bg-white
              text-gray-500

              hover:border-gray-300
              hover:bg-gray-50
              hover:text-secondary
            `
        }
      `}
    >
      {label}
    </motion.button>
  );
}

/* ============================================================
   ACTIVE FILTER TAG
============================================================ */

function FilterTag({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <motion.span
      layout
      initial={{
        opacity: 0,
        scale: 0.9,
      }}
      animate={{
        opacity: 1,
        scale: 1,
      }}
      className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.07] px-2.5 py-1 text-[10px] font-semibold text-primary"
    >
      {label}

      <button
        type="button"
        onClick={onRemove}
        className="grid h-4 w-4 cursor-pointer place-items-center rounded-full transition hover:bg-primary/10"
      >
        ×
      </button>
    </motion.span>
  );
}

/* ============================================================
   SECTIONS
============================================================ */

function AnimatedSection({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <motion.section
      initial={{
        opacity: 0,
        y: 16,
      }}
      whileInView={{
        opacity: 1,
        y: 0,
      }}
      viewport={{
        once: true,
        amount: 0.08,
      }}
      transition={{
        duration: 0.48,
        ease: EASE,
      }}
    >
      {children}
    </motion.section>
  );
}

function SectionHeading({
  title,
  live = false,
}: {
  title: string;
  live?: boolean;
}) {
  return (
    <div className="mb-3.5 flex items-center justify-between md:mb-4">
      <div className="flex items-center gap-2">
        <h2 className="font-heading text-[19px] font-semibold tracking-[-0.02em] text-secondary md:text-xl">
          {title}
        </h2>

        {live && (
          <motion.span
            animate={{
              scale: [
                1,
                1.08,
                1,
              ],
            }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="grid h-[14px] w-[14px] place-items-center rounded-[10px] bg-[rgba(25,204,106,0.20)]"
          >
            <span className="h-[6px] w-[6px] rounded-full bg-[#19CC6A]" />
          </motion.span>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   LIVE CARD
============================================================ */

function LiveEventCard({
  event,
  index,
}: {
  event: IEvent;
  index: number;
}) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 12,
        scale: 0.98,
      }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
      }}
      transition={{
        duration: 0.45,
        delay:
          index * 0.05,
        ease: EASE,
      }}
      whileHover={{
        y: -4,
      }}
    >
      <Link
        href={`/events/${event._id}`}
        className="
          group
          block
          h-full
          overflow-hidden

          rounded-xl

          border
          border-gray-200

          bg-white

          shadow-[0_4px_14px_rgba(27,75,107,0.04)]

          transition-all
          duration-300

          hover:border-primary/25
          hover:shadow-[0_14px_32px_rgba(27,75,107,0.10)]
        "
      >
        <div className="relative aspect-[16/7.3] overflow-hidden bg-gray-100 md:aspect-[16/7]">
          {event.imageUrl ? (
            <Image
              src={
                event.imageUrl
              }
              alt={
                event.eventName
              }
              width={640}
              height={292}
              unoptimized
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.035]"
            />
          ) : (
            <div className="h-full w-full bg-gray-100" />
          )}

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/[0.10] to-transparent" />

          <span className="absolute left-2 top-2 rounded bg-red-500 px-1.5 py-1 text-[8px] font-bold uppercase leading-none text-white shadow-sm md:left-3 md:top-3 md:px-2 md:text-[10px]">
            LIVE
          </span>
        </div>

        <div className="p-2.5 md:p-5">
          <h3 className="line-clamp-2 min-h-[32px] text-[11px] font-semibold leading-4 text-secondary md:min-h-0 md:text-base md:leading-5">
            {event.eventName}
          </h3>

          <div className="mt-2 space-y-1 md:mt-3 md:space-y-1.5">
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

          <span className="mt-2.5 inline-flex rounded bg-primary px-2 py-1.5 text-[9px] font-semibold leading-none text-white transition-colors group-hover:bg-primary-dark md:mt-4 md:px-4 md:py-2 md:text-xs">
            Book Slot
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

/* ============================================================
   UPCOMING
============================================================ */

function UpcomingGrid({
  events,
}: {
  events: IEvent[];
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
      {events.map(
        (event, index) => (
          <UpcomingEventCard
            key={event._id}
            event={event}
            index={index}
          />
        ),
      )}
    </div>
  );
}

function UpcomingEventCard({
  event,
  index,
}: {
  event: IEvent;
  index: number;
}) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 12,
      }}
      whileInView={{
        opacity: 1,
        y: 0,
      }}
      viewport={{
        once: true,
      }}
      transition={{
        duration: 0.42,
        delay:
          Math.min(
            index,
            4,
          ) * 0.04,
        ease: EASE,
      }}
      whileHover={{
        y: -3,
      }}
    >
      <Link
        href={`/events/${event._id}`}
        className="
          group

          flex
          min-h-[96px]
          cursor-pointer
          items-center
          gap-3

          rounded-xl

          border
          border-gray-200

          bg-white

          p-2.5

          shadow-[0_3px_12px_rgba(27,75,107,0.035)]

          transition-all
          duration-300

          hover:border-primary/25
          hover:shadow-[0_12px_28px_rgba(27,75,107,0.09)]

          md:min-h-[112px]
          md:gap-4
          md:p-3
        "
      >
        <div className="h-[78px] w-[78px] shrink-0 overflow-hidden rounded-lg bg-gray-100 md:h-[86px] md:w-[86px]">
          {event.imageUrl ? (
            <Image
              src={
                event.imageUrl
              }
              alt={
                event.eventName
              }
              width={86}
              height={86}
              unoptimized
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
            />
          ) : (
            <div className="h-full w-full bg-gray-100" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14px] font-semibold leading-5 text-secondary md:text-[15px]">
            {event.eventName}
          </h3>

          <p className="mt-1.5 truncate text-[11px] leading-5 text-gray-500 md:text-xs">
            {formatDate(
              event.startDate,
            )}

            {event.venue
              ? ` • ${event.venue}`
              : ''}
          </p>
        </div>

        <svg
          className="hidden h-4 w-4 shrink-0 text-gray-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-primary sm:block"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m9 18 6-6-6-6"
          />
        </svg>
      </Link>
    </motion.div>
  );
}

/* ============================================================
   META
============================================================ */

function MetaRow({
  type,
  value,
}: {
  type:
    | 'location'
    | 'date';

  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-gray-500">
      {type ===
      'location' ? (
        <svg
          className="h-3 w-3 shrink-0 md:h-4 md:w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11z"
          />

          <circle
            cx="12"
            cy="10"
            r="2"
          />
        </svg>
      ) : (
        <svg
          className="h-3 w-3 shrink-0 md:h-4 md:w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1z" />
        </svg>
      )}

      <span className="truncate text-[9px] md:text-xs">
        {value}
      </span>
    </div>
  );
}

/* ============================================================
   EMPTY
============================================================ */

function EmptyState({
  hasFilters,
  clearFilters,
  clearSearch,
}: {
  hasFilters: boolean;
  clearFilters: () => void;
  clearSearch: () => void;
}) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        scale: 0.98,
      }}
      animate={{
        opacity: 1,
        scale: 1,
      }}
      className="rounded-2xl border border-gray-200 bg-white px-6 py-14 text-center shadow-sm"
    >
      <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-gray-50 text-gray-400">
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
            r="7"
          />

          <path d="m20 20-3.5-3.5" />
        </svg>
      </div>

      <p className="mt-4 text-sm font-semibold text-secondary">
        No events found
      </p>

      <p className="mt-1 text-xs text-gray-500">
        {hasFilters
          ? 'Try changing your search or filters.'
          : 'There are no published events yet.'}
      </p>

      <button
        type="button"
        onClick={() => {
          clearSearch();
          clearFilters();
        }}
        className="mt-5 cursor-pointer rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-secondary transition hover:border-primary/30 hover:bg-primary/[0.04] hover:text-primary"
      >
        Reset
      </button>
    </motion.div>
  );
}

/* ============================================================
   LOADING
============================================================ */

function LoadingState() {
  return (
    <div className="space-y-8 md:space-y-10">
      <section>
        <div className="mb-4 h-6 w-32 animate-pulse rounded bg-gray-100" />

        <div className="grid grid-cols-2 gap-3 md:gap-5">
          <div className="h-[220px] animate-pulse rounded-xl bg-gray-100 md:h-[330px]" />

          <div className="h-[220px] animate-pulse rounded-xl bg-gray-100 md:h-[330px]" />
        </div>
      </section>

      <section>
        <div className="mb-4 h-6 w-52 animate-pulse rounded bg-gray-100" />

        <div className="grid gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
          <div className="h-[96px] animate-pulse rounded-xl bg-gray-100 md:h-[112px]" />

          <div className="h-[96px] animate-pulse rounded-xl bg-gray-100 md:h-[112px]" />

          <div className="h-[96px] animate-pulse rounded-xl bg-gray-100 md:h-[112px]" />
        </div>
      </section>
    </div>
  );
}

/* ============================================================
   FORMATTERS
============================================================ */

function formatStatus(
  value: EventStatusFilter,
) {
  if (value === 'ALL') {
    return 'All';
  }

  if (
    value === 'UPCOMING'
  ) {
    return 'Upcoming';
  }

  if (
    value === 'COMPLETED'
  ) {
    return 'Completed';
  }

  return 'Live';
}

function formatType(
  value: EventTypeFilter,
) {
  if (value === 'ALL') {
    return 'All';
  }

  if (
    value === 'conference'
  ) {
    return 'Conference';
  }

  if (
    value === 'mantram'
  ) {
    return 'MantraM';
  }

  return 'Event';
}

function formatDate(
  value: string,
) {
  return new Intl.DateTimeFormat(
    'en-GB',
    {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    },
  ).format(
    new Date(value),
  );
}

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

  return `${startLabel} - ${endLabel}`;
}