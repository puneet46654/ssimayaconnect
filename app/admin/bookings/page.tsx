'use client';

import type {
  FormEvent,
  ReactNode,
} from 'react';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useRouter,
} from 'next/navigation';

import {
  AnimatePresence,
  motion,
} from 'framer-motion';

/* ============================================================
   TYPES
============================================================ */

type BookingRow = {
  _id: string;
  bookingId: string;

  attendee: {
    fullName: string;
    email: string;
    mobile: string;
  };

  event: {
    _id: string;
    eventName: string;
    venue: string;
    status: string;
  } | null;

  daySchedule: {
    _id: string;
    date: string;
  } | null;

  slot: {
    _id: string;
    startTime: string;
    endTime: string;
  } | null;

  createdAt: string;
};

type EventOption = {
  _id: string;
  eventName: string;
};

type Stats = {
  total: number;
  upcoming: number;
  past: number;
};

type BookingsResponse = {
  success: boolean;

  bookings: BookingRow[];

  events: EventOption[];

  stats: Stats;

  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };

  message?: string;
};

type DeleteTarget = {
  id: string;
  bookingId: string;
  attendeeName: string;
} | null;

/* ============================================================
   CONSTANTS
============================================================ */

const PAGE_SIZE = 10;

const EASE = [
  0.16,
  1,
  0.3,
  1,
] as const;

/* ============================================================
   PAGE
============================================================ */

export default function AdminBookingsPage() {
  const router =
    useRouter();

  /* ==========================================================
     FILTER INPUTS
  ========================================================== */

  const [
    searchInput,
    setSearchInput,
  ] = useState('');

  const [
    eventInput,
    setEventInput,
  ] = useState('');

  const [
    dateInput,
    setDateInput,
  ] = useState<
    'all' | 'upcoming' | 'past'
  >('all');

  /* ==========================================================
     APPLIED FILTERS
  ========================================================== */

  const [
    search,
    setSearch,
  ] = useState('');

  const [
    eventId,
    setEventId,
  ] = useState('');

  const [
    dateFilter,
    setDateFilter,
  ] = useState<
    'all' | 'upcoming' | 'past'
  >('all');

  /* ==========================================================
     DATA
  ========================================================== */

  const [
    bookings,
    setBookings,
  ] =
    useState<BookingRow[]>(
      [],
    );

  const [
    events,
    setEvents,
  ] =
    useState<EventOption[]>(
      [],
    );

  const [
    stats,
    setStats,
  ] =
    useState<Stats>({
      total: 0,
      upcoming: 0,
      past: 0,
    });

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    totalPages,
    setTotalPages,
  ] = useState(1);

  const [
    totalMatches,
    setTotalMatches,
  ] = useState(0);

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

  /* ==========================================================
     DELETE
  ========================================================== */

  const [
    deleteTarget,
    setDeleteTarget,
  ] =
    useState<DeleteTarget>(
      null,
    );

  const [
    deleting,
    setDeleting,
  ] = useState(false);

  /* ==========================================================
     LOAD BOOKINGS
  ========================================================== */

  const loadBookings =
    useCallback(
      async (
        signal?: AbortSignal,
        refresh = false,
      ) => {
        if (refresh) {
          setRefreshing(
            true,
          );
        } else {
          setLoading(
            true,
          );
        }

        setError('');

        try {
          const params =
            new URLSearchParams();

          params.set(
            'page',
            String(page),
          );

          params.set(
            'limit',
            String(
              PAGE_SIZE,
            ),
          );

          if (search) {
            params.set(
              'search',
              search,
            );
          }

          if (eventId) {
            params.set(
              'eventId',
              eventId,
            );
          }

          if (
            dateFilter !==
            'all'
          ) {
            params.set(
              'dateFilter',
              dateFilter,
            );
          }

          const response =
            await fetch(
              `/api/admin/bookings?${params.toString()}`,
              {
                method:
                  'GET',

                credentials:
                  'include',

                cache:
                  'no-store',

                signal,
              },
            );

          const data =
            (await response.json()) as BookingsResponse;

          if (
            !response.ok ||
            !data.success
          ) {
            throw new Error(
              data.message ||
                'Unable to load bookings.',
            );
          }

          setBookings(
            data.bookings ??
              [],
          );

          setEvents(
            data.events ??
              [],
          );

          setStats(
            data.stats ?? {
              total: 0,
              upcoming: 0,
              past: 0,
            },
          );

          setTotalPages(
            Math.max(
              data.pagination
                ?.pages ??
                1,
              1,
            ),
          );

          setTotalMatches(
            data.pagination
              ?.total ??
              0,
          );
        } catch (err) {
          if (
            err instanceof
              DOMException &&
            err.name ===
              'AbortError'
          ) {
            return;
          }

          console.error(
            'Unable to load bookings:',
            err,
          );

          setError(
            err instanceof
              Error
              ? err.message
              : 'Unable to load bookings.',
          );
        } finally {
          if (
            !signal?.aborted
          ) {
            setLoading(
              false,
            );

            setRefreshing(
              false,
            );
          }
        }
      },
      [
        page,
        search,
        eventId,
        dateFilter,
      ],
    );

  useEffect(() => {
    const controller =
      new AbortController();

    void loadBookings(
      controller.signal,
    );

    return () => {
      controller.abort();
    };
  }, [
    loadBookings,
  ]);

  /* ==========================================================
     FILTERS
  ========================================================== */

  function applyFilters(
    event?: FormEvent,
  ) {
    event?.preventDefault();

    setPage(1);

    setSearch(
      searchInput.trim(),
    );

    setEventId(
      eventInput,
    );

    setDateFilter(
      dateInput,
    );
  }

  function clearFilters() {
    setSearchInput('');
    setEventInput('');
    setDateInput('all');

    setSearch('');
    setEventId('');
    setDateFilter('all');

    setPage(1);
  }

  const hasFilters =
    Boolean(
      search ||
        eventId ||
        dateFilter !==
          'all',
    );

  /* ==========================================================
     NAVIGATION
  ========================================================== */

  function viewBooking(
    id: string,
  ) {
    router.push(
      `/admin/bookings/${id}`,
    );
  }

  function editBooking(
    id: string,
  ) {
    router.push(
      `/admin/bookings/${id}?mode=edit`,
    );
  }

  /* ==========================================================
     DELETE
  ========================================================== */

  async function confirmDelete() {
    if (
      !deleteTarget ||
      deleting
    ) {
      return;
    }

    setDeleting(
      true,
    );

    setError('');

    try {
      const response =
        await fetch(
          `/api/admin/bookings/${deleteTarget.id}`,
          {
            method:
              'DELETE',

            credentials:
              'include',
          },
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            'Unable to delete booking.',
        );
      }

      setDeleteTarget(
        null,
      );

      if (
        bookings.length ===
          1 &&
        page > 1
      ) {
        setPage(
          (
            current,
          ) =>
            Math.max(
              1,
              current - 1,
            ),
        );
      } else {
        await loadBookings(
          undefined,
          true,
        );
      }
    } catch (err) {
      setError(
        err instanceof
          Error
          ? err.message
          : 'Unable to delete booking.',
      );
    } finally {
      setDeleting(
        false,
      );
    }
  }

  /* ==========================================================
     PAGINATION
  ========================================================== */

  const visiblePages =
    useMemo(() => {
      if (
        totalPages <= 5
      ) {
        return Array.from(
          {
            length:
              totalPages,
          },
          (
            _,
            index,
          ) =>
            index + 1,
        );
      }

      let start =
        Math.max(
          1,
          page - 1,
        );

      let end =
        Math.min(
          totalPages,
          page + 1,
        );

      if (page <= 2) {
        start = 1;
        end = 3;
      }

      if (
        page >=
        totalPages - 1
      ) {
        start =
          totalPages -
          2;

        end =
          totalPages;
      }

      return Array.from(
        {
          length:
            end -
            start +
            1,
        },
        (
          _,
          index,
        ) =>
          start +
          index,
      );
    }, [
      page,
      totalPages,
    ]);

  const rangeStart =
    totalMatches === 0
      ? 0
      : (page - 1) *
          PAGE_SIZE +
        1;

  const rangeEnd =
    Math.min(
      page *
        PAGE_SIZE,
      totalMatches,
    );

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <>
      <motion.div
        initial={{
          opacity: 0,
          y: 6,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        transition={{
          duration: 0.35,
          ease: EASE,
        }}
        className="
          w-full
          min-w-0
        "
      >
        {/* ====================================================
            HEADER
        ==================================================== */}

        <div
          className="
            flex
            flex-col
            gap-4

            sm:flex-row
            sm:items-start
            sm:justify-between
          "
        >
          <div
            className="
              min-w-0
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
              <h1
                className="
                  font-heading

                  text-[22px]
                  font-bold

                  tracking-[-0.025em]

                  text-secondary

                  sm:text-[24px]
                  lg:text-[26px]
                "
              >
                All Bookings
              </h1>

              {!loading && (
                <span
                  className="
                    inline-flex
                    h-6
                    items-center
                    rounded-full
                    bg-primary/[0.08]
                    px-2.5
                    text-[11px]
                    font-semibold
                    text-primary
                  "
                >
                  {stats.total.toLocaleString()}
                </span>
              )}
            </div>

            <p
              className="
                mt-1
                max-w-[720px]
                text-[13px]
                leading-5
                text-gray-500
              "
            >
              Search, review and manage
              registrations across all
              SSI Maya Connect events.
            </p>
          </div>

          <div
            className="
              flex
              shrink-0
              items-center
              gap-2
            "
          >
            <button
              type="button"
              disabled={
                refreshing
              }
              onClick={() =>
                void loadBookings(
                  undefined,
                  true,
                )
              }
              className="
                btn
                btn-secondary
                h-10
                px-3
              "
            >
              <RefreshIcon
                spinning={
                  refreshing
                }
              />

              <span
                className="
                  hidden
                  sm:inline
                "
              >
                Refresh
              </span>
            </button>

            <button
              type="button"
              disabled
              title="Export will be connected later"
              className="
                btn
                btn-secondary
                h-10
                px-3
              "
            >
              <DownloadIcon />

              <span
                className="
                  hidden
                  sm:inline
                "
              >
                Export CSV
              </span>
            </button>
          </div>
        </div>

        {/* ====================================================
            STATS
        ==================================================== */}

        <div
          className="
            mt-5
            grid
            grid-cols-1
            gap-3

            min-[520px]:grid-cols-3
          "
        >
          <StatCard
            icon={
              <BookingsIcon />
            }
            label="Total Bookings"
            value={
              stats.total
            }
            description="All registrations"
            loading={
              loading
            }
          />

          <StatCard
            icon={
              <CalendarIcon />
            }
            label="Upcoming"
            value={
              stats.upcoming
            }
            description="Scheduled ahead"
            loading={
              loading
            }
          />

          <StatCard
            icon={
              <HistoryIcon />
            }
            label="Past Bookings"
            value={
              stats.past
            }
            description="Past event dates"
            loading={
              loading
            }
          />
        </div>

        {/* ====================================================
            FILTERS
        ==================================================== */}

        <form
          onSubmit={
            applyFilters
          }
          className="
            mt-5

            rounded-xl

            border
            border-gray-200

            bg-white

            p-4

            shadow-sm
          "
        >
          <div
            className="
              flex
              flex-col
              gap-3

              lg:flex-row
              lg:items-end
            "
          >
            <div
              className="
                min-w-0
                flex-1
              "
            >
              <label
                htmlFor="booking-search"
                className="form-label"
              >
                Search Bookings
              </label>

              <div
                className="
                  relative
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
                  id="booking-search"
                  type="search"
                  value={
                    searchInput
                  }
                  onChange={(
                    event,
                  ) =>
                    setSearchInput(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Name, email, mobile or booking ID..."
                  className="
                    form-input
                    !pl-10
                  "
                />
              </div>
            </div>

            <div
              className="
                grid
                grid-cols-1
                gap-3

                min-[520px]:grid-cols-2

                lg:w-[430px]
              "
            >
              <FilterSelect
                label="Event / Conference"
                value={
                  eventInput
                }
                onChange={
                  setEventInput
                }
              >
                <option value="">
                  All Events
                </option>

                {events.map(
                  (
                    event,
                  ) => (
                    <option
                      key={
                        event._id
                      }
                      value={
                        event._id
                      }
                    >
                      {
                        event.eventName
                      }
                    </option>
                  ),
                )}
              </FilterSelect>

              <FilterSelect
                label="Date"
                value={
                  dateInput
                }
                onChange={(
                  value,
                ) =>
                  setDateInput(
                    value as
                      | 'all'
                      | 'upcoming'
                      | 'past',
                  )
                }
              >
                <option value="all">
                  All Dates
                </option>

                <option value="upcoming">
                  Upcoming
                </option>

                <option value="past">
                  Past
                </option>
              </FilterSelect>
            </div>

            <div
              className="
                flex
                items-center
                gap-2
              "
            >
              <button
                type="submit"
                className="
                  btn
                  btn-primary
                  h-[39px]
                  flex-1
                  lg:flex-none
                "
              >
                Apply Filters
              </button>

              <button
                type="button"
                disabled={
                  !hasFilters &&
                  !searchInput &&
                  !eventInput &&
                  dateInput ===
                    'all'
                }
                onClick={
                  clearFilters
                }
                className="
                  btn
                  h-[39px]
                  flex-1
                  border-gray-200
                  bg-white
                  text-gray-500

                  hover:bg-gray-50
                  hover:text-secondary

                  lg:flex-none
                "
              >
                Clear
              </button>
            </div>
          </div>
        </form>

        {/* ====================================================
            ERROR
        ==================================================== */}

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{
                opacity: 0,
                y: -4,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
              }}
              className="
                mt-4

                flex
                items-start
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
                    shrink-0
                    text-red-500
                  "
                >
                  <AlertIcon />
                </span>

                <p
                  className="
                    text-[13px]
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
                  setError('')
                }
                className="
                  shrink-0
                  cursor-pointer
                  text-red-500
                "
              >
                <CloseIcon />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ====================================================
            TABLE - DESKTOP
        ==================================================== */}

        <div
          className="
            mt-5

            hidden

            overflow-hidden

            rounded-xl

            border
            border-gray-200

            bg-white

            shadow-sm

            lg:block
          "
        >
          <div
            className="
              flex
              items-center
              justify-between
              gap-4

              border-b
              border-gray-200

              px-4
              py-3
            "
          >
            <div>
              <h2
                className="
                  text-[14px]
                  font-semibold
                  text-secondary
                "
              >
                Booking Records
              </h2>

              <p
                className="
                  mt-0.5
                  text-[12px]
                  text-gray-500
                "
              >
                View, edit or delete
                individual booking
                records.
              </p>
            </div>

            {!loading && (
              <p
                className="
                  text-[12px]
                  text-gray-500
                "
              >
                Showing{' '}
                <span
                  className="
                    font-semibold
                    text-secondary
                  "
                >
                  {rangeStart}–
                  {rangeEnd}
                </span>{' '}
                of{' '}
                <span
                  className="
                    font-semibold
                    text-secondary
                  "
                >
                  {
                    totalMatches
                  }
                </span>
              </p>
            )}
          </div>

          <div
            className="
              overflow-x-auto
            "
          >
            <table
              className="
                data-table
                min-w-[1080px]
              "
            >
              <thead>
                <tr>
                  <th>
                    Booking ID
                  </th>

                  <th>
                    Attendee
                  </th>

                  <th>
                    Email
                  </th>

                  <th>
                    Event
                  </th>

                  <th>
                    Date
                  </th>

                  <th>
                    Time Slot
                  </th>

                  <th>
                    Status
                  </th>

                  <th
                    className="
                      !text-right
                    "
                  >
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <DesktopTableSkeleton />
                ) : bookings.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="
                        !border-0
                        !px-6
                        !py-16
                      "
                    >
                      <EmptyState
                        filtered={
                          hasFilters
                        }
                        onClear={
                          clearFilters
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  bookings.map(
                    (
                      booking,
                    ) => (
                      <tr
                        key={
                          booking._id
                        }
                      >
                        <td>
                          <button
                            type="button"
                            onClick={() =>
                              viewBooking(
                                booking._id,
                              )
                            }
                            className="
                              cursor-pointer
                              font-semibold
                              text-secondary
                              transition-colors
                              hover:text-primary
                            "
                          >
                            {
                              booking.bookingId
                            }
                          </button>
                        </td>

                        <td>
                          <div
                            className="
                              flex
                              min-w-0
                              items-center
                              gap-2.5
                            "
                          >
                            <Avatar
                              name={
                                booking
                                  .attendee
                                  .fullName
                              }
                            />

                            <div
                              className="
                                min-w-0
                              "
                            >
                              <p
                                className="
                                  max-w-[180px]
                                  truncate
                                  !text-[13px]
                                  !font-medium
                                  !text-gray-700
                                "
                              >
                                {
                                  booking
                                    .attendee
                                    .fullName
                                }
                              </p>

                              {booking
                                .attendee
                                .mobile && (
                                <p
                                  className="
                                    mt-0.5
                                    max-w-[180px]
                                    truncate
                                    !text-[11px]
                                    !text-gray-400
                                  "
                                >
                                  {
                                    booking
                                      .attendee
                                      .mobile
                                  }
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        <td>
                          <span
                            className="
                              block
                              max-w-[210px]
                              truncate
                            "
                          >
                            {
                              booking
                                .attendee
                                .email
                            }
                          </span>
                        </td>

                        <td>
                          <div
                            className="
                              max-w-[260px]
                            "
                          >
                            <p
                              className="
                                truncate
                                !text-[13px]
                                !font-medium
                                !text-gray-700
                              "
                            >
                              {booking
                                .event
                                ?.eventName ||
                                '—'}
                            </p>

                            {booking
                              .event
                              ?.venue && (
                              <p
                                className="
                                  mt-0.5
                                  truncate
                                  !text-[11px]
                                  !text-gray-400
                                "
                              >
                                {
                                  booking
                                    .event
                                    .venue
                                }
                              </p>
                            )}
                          </div>
                        </td>

                        <td
                          className="
                            whitespace-nowrap
                          "
                        >
                          {
                            formatDate(
                              booking
                                .daySchedule
                                ?.date,
                            )
                          }
                        </td>

                        <td
                          className="
                            whitespace-nowrap
                          "
                        >
                          {
                            formatSlot(
                              booking.slot,
                            )
                          }
                        </td>

                        <td>
                          <BookingStatus
                            booking={
                              booking
                            }
                          />
                        </td>

                        <td>
                          <div
                            className="
                              flex
                              justify-end
                              gap-1.5
                            "
                          >
                            <IconButton
                              title="View booking"
                              onClick={() =>
                                viewBooking(
                                  booking._id,
                                )
                              }
                            >
                              <EyeIcon />
                            </IconButton>

                            <IconButton
                              title="Edit booking"
                              onClick={() =>
                                editBooking(
                                  booking._id,
                                )
                              }
                            >
                              <EditIcon />
                            </IconButton>

                            <IconButton
                              danger
                              title="Delete booking"
                              onClick={() =>
                                setDeleteTarget(
                                  {
                                    id:
                                      booking._id,

                                    bookingId:
                                      booking.bookingId,

                                    attendeeName:
                                      booking
                                        .attendee
                                        .fullName,
                                  },
                                )
                              }
                            >
                              <TrashIcon />
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    ),
                  )
                )}
              </tbody>
            </table>
          </div>

          {!loading &&
            totalMatches >
              0 && (
              <Pagination
                page={
                  page
                }
                totalPages={
                  totalPages
                }
                total={
                  totalMatches
                }
                rangeStart={
                  rangeStart
                }
                rangeEnd={
                  rangeEnd
                }
                visiblePages={
                  visiblePages
                }
                onChange={
                  setPage
                }
              />
            )}
        </div>

        {/* ====================================================
            MOBILE / TABLET
        ==================================================== */}

        <div
          className="
            mt-5
            space-y-3
            lg:hidden
          "
        >
          {loading ? (
            <>
              <MobileCardSkeleton />
              <MobileCardSkeleton />
              <MobileCardSkeleton />
            </>
          ) : bookings.length ===
            0 ? (
            <div
              className="
                rounded-xl
                border
                border-gray-200
                bg-white
                px-5
                py-12
                shadow-sm
              "
            >
              <EmptyState
                filtered={
                  hasFilters
                }
                onClear={
                  clearFilters
                }
              />
            </div>
          ) : (
            bookings.map(
              (
                booking,
              ) => (
                <motion.article
                  key={
                    booking._id
                  }
                  initial={{
                    opacity: 0,
                    y: 6,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  className="
                    overflow-hidden

                    rounded-xl

                    border
                    border-gray-200

                    bg-white

                    shadow-sm
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

                      px-4
                      py-3
                    "
                  >
                    <div
                      className="
                        min-w-0
                      "
                    >
                      <p
                        className="
                          !text-[11px]
                          !font-medium
                          !text-gray-400
                        "
                      >
                        Booking ID
                      </p>

                      <button
                        type="button"
                        onClick={() =>
                          viewBooking(
                            booking._id,
                          )
                        }
                        className="
                          mt-0.5
                          cursor-pointer
                          text-[13px]
                          font-semibold
                          text-secondary
                        "
                      >
                        {
                          booking.bookingId
                        }
                      </button>
                    </div>

                    <BookingStatus
                      booking={
                        booking
                      }
                    />
                  </div>

                  <div
                    className="
                      p-4
                    "
                  >
                    <div
                      className="
                        flex
                        min-w-0
                        items-center
                        gap-3
                      "
                    >
                      <Avatar
                        large
                        name={
                          booking
                            .attendee
                            .fullName
                        }
                      />

                      <div
                        className="
                          min-w-0
                          flex-1
                        "
                      >
                        <p
                          className="
                            truncate
                            !text-[14px]
                            !font-semibold
                            !text-secondary
                          "
                        >
                          {
                            booking
                              .attendee
                              .fullName
                          }
                        </p>

                        <p
                          className="
                            mt-0.5
                            truncate
                            !text-[12px]
                            !text-gray-500
                          "
                        >
                          {
                            booking
                              .attendee
                              .email
                          }
                        </p>

                        {booking
                          .attendee
                          .mobile && (
                          <p
                            className="
                              mt-0.5
                              !text-[12px]
                              !text-gray-400
                            "
                          >
                            {
                              booking
                                .attendee
                                .mobile
                            }
                          </p>
                        )}
                      </div>
                    </div>

                    <div
                      className="
                        mt-4
                        rounded-lg
                        bg-gray-50
                        p-3
                      "
                    >
                      <p
                        className="
                          !text-[11px]
                          !font-medium
                          !text-gray-400
                        "
                      >
                        Event
                      </p>

                      <p
                        className="
                          mt-1
                          !text-[13px]
                          !font-medium
                          !text-gray-700
                        "
                      >
                        {booking
                          .event
                          ?.eventName ||
                          '—'}
                      </p>
                    </div>

                    <div
                      className="
                        mt-3
                        grid
                        grid-cols-2
                        gap-3
                      "
                    >
                      <MobileInfo
                        label="Date"
                        value={
                          formatDate(
                            booking
                              .daySchedule
                              ?.date,
                          )
                        }
                      />

                      <MobileInfo
                        label="Time Slot"
                        value={
                          formatSlot(
                            booking.slot,
                          )
                        }
                      />
                    </div>

                    <div
                      className="
                        mt-4
                        grid
                        grid-cols-3
                        gap-2
                      "
                    >
                      <MobileAction
                        icon={
                          <EyeIcon />
                        }
                        label="View"
                        onClick={() =>
                          viewBooking(
                            booking._id,
                          )
                        }
                      />

                      <MobileAction
                        icon={
                          <EditIcon />
                        }
                        label="Edit"
                        onClick={() =>
                          editBooking(
                            booking._id,
                          )
                        }
                      />

                      <MobileAction
                        danger
                        icon={
                          <TrashIcon />
                        }
                        label="Delete"
                        onClick={() =>
                          setDeleteTarget(
                            {
                              id:
                                booking._id,

                              bookingId:
                                booking.bookingId,

                              attendeeName:
                                booking
                                  .attendee
                                  .fullName,
                            },
                          )
                        }
                      />
                    </div>
                  </div>
                </motion.article>
              ),
            )
          )}

          {!loading &&
            totalMatches >
              0 && (
              <div
                className="
                  overflow-hidden
                  rounded-xl
                  border
                  border-gray-200
                  bg-white
                  shadow-sm
                "
              >
                <Pagination
                  mobile
                  page={
                    page
                  }
                  totalPages={
                    totalPages
                  }
                  total={
                    totalMatches
                  }
                  rangeStart={
                    rangeStart
                  }
                  rangeEnd={
                    rangeEnd
                  }
                  visiblePages={
                    visiblePages
                  }
                  onChange={
                    setPage
                  }
                />
              </div>
            )}
        </div>
      </motion.div>

      {/* ======================================================
          DELETE MODAL
      ====================================================== */}

      <AnimatePresence>
        {deleteTarget && (
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
            onClick={() => {
              if (
                !deleting
              ) {
                setDeleteTarget(
                  null,
                );
              }
            }}
            className="
              fixed
              inset-0
              z-[100]

              grid
              place-items-center

              bg-secondary/25

              px-4

              backdrop-blur-[2px]
            "
          >
            <motion.div
              initial={{
                opacity: 0,
                scale: 0.97,
                y: 8,
              }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                scale: 0.98,
              }}
              transition={{
                duration: 0.2,
                ease: EASE,
              }}
              onClick={(
                event,
              ) =>
                event.stopPropagation()
              }
              className="
                w-full
                max-w-[430px]

                rounded-2xl

                border
                border-gray-200

                bg-white

                p-5

                shadow-[0_20px_60px_rgba(0,0,0,0.14)]

                sm:p-6
              "
            >
              <div
                className="
                  flex
                  items-start
                  gap-3
                "
              >
                <span
                  className="
                    grid
                    h-10
                    w-10
                    shrink-0
                    place-items-center

                    rounded-lg

                    bg-red-50

                    text-red-500
                  "
                >
                  <TrashIcon />
                </span>

                <div
                  className="
                    min-w-0
                  "
                >
                  <h2
                    className="
                      text-[16px]
                      font-semibold
                      text-secondary
                    "
                  >
                    Delete booking
                  </h2>

                  <p
                    className="
                      mt-1
                      text-[13px]
                      leading-5
                      text-gray-500
                    "
                  >
                    This action cannot
                    be undone.
                  </p>
                </div>
              </div>

              <div
                className="
                  mt-5
                  rounded-lg
                  border
                  border-gray-200
                  bg-gray-50
                  px-4
                  py-3
                "
              >
                <p
                  className="
                    !text-[12px]
                    !text-gray-500
                  "
                >
                  Booking
                </p>

                <p
                  className="
                    mt-0.5
                    !text-[13px]
                    !font-semibold
                    !text-secondary
                  "
                >
                  {
                    deleteTarget.bookingId
                  }
                </p>

                <p
                  className="
                    mt-1
                    !text-[12px]
                    !text-gray-500
                  "
                >
                  {
                    deleteTarget.attendeeName
                  }
                </p>
              </div>

              <div
                className="
                  mt-5
                  flex
                  flex-col-reverse
                  gap-2

                  sm:flex-row
                  sm:justify-end
                "
              >
                <button
                  type="button"
                  disabled={
                    deleting
                  }
                  onClick={() =>
                    setDeleteTarget(
                      null,
                    )
                  }
                  className="
                    btn
                    h-10
                    border-gray-200
                    bg-white
                    text-gray-600
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
                    confirmDelete
                  }
                  className="
                    btn
                    h-10

                    border-transparent

                    bg-[var(--color-danger-vivid)]

                    text-white

                    hover:brightness-95
                  "
                >
                  {deleting ? (
                    <>
                      <SpinnerIcon />

                      Deleting...
                    </>
                  ) : (
                    <>
                      <TrashIcon />

                      Delete Booking
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ============================================================
   STAT CARD
============================================================ */

function StatCard({
  icon,
  label,
  value,
  description,
  loading,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  description: string;
  loading: boolean;
}) {
  return (
    <div
      className="
        rounded-xl

        border
        border-gray-200

        bg-white

        p-4

        shadow-sm
      "
    >
      <div
        className="
          flex
          items-center
          gap-3
        "
      >
        <span
          className="
            grid
            h-10
            w-10
            shrink-0
            place-items-center

            rounded-lg

            bg-primary/[0.07]

            text-primary
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
              !text-[11px]
              !font-medium
              !text-gray-500
            "
          >
            {label}
          </p>

          {loading ? (
            <div
              className="
                mt-1.5
                h-6
                w-20
                animate-pulse
                rounded
                bg-gray-100
              "
            />
          ) : (
            <div
              className="
                mt-0.5
                flex
                flex-wrap
                items-baseline
                gap-x-2
              "
            >
              <span
                className="
                  font-heading
                  text-[22px]
                  font-bold
                  tracking-[-0.03em]
                  text-secondary
                "
              >
                {value.toLocaleString()}
              </span>

              <span
                className="
                  text-[11px]
                  text-gray-400
                "
              >
                {description}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   FILTER SELECT
============================================================ */

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (
    value: string,
  ) => void;
  children: ReactNode;
}) {
  return (
    <label
      className="
        block
        min-w-0
      "
    >
      <span
        className="form-label"
      >
        {label}
      </span>

      <select
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
        className="form-select"
      >
        {children}
      </select>
    </label>
  );
}

/* ============================================================
   AVATAR
============================================================ */

function Avatar({
  name,
  large = false,
}: {
  name: string;
  large?: boolean;
}) {
  const initials =
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(
        (
          item,
        ) =>
          item[0]
            ?.toUpperCase(),
      )
      .join('') ||
    'NA';

  return (
    <div
      className={`
        grid
        shrink-0
        place-items-center

        rounded-lg

        bg-primary/[0.08]

        font-semibold

        text-primary

        ${
          large
            ? `
                h-11
                w-11
                text-[13px]
              `
            : `
                h-8
                w-8
                text-[11px]
              `
        }
      `}
    >
      {initials}
    </div>
  );
}

/* ============================================================
   STATUS
============================================================ */

function BookingStatus({
  booking,
}: {
  booking: BookingRow;
}) {
  const date =
    booking.daySchedule
      ?.date
      ? new Date(
          booking
            .daySchedule
            .date,
        )
      : null;

  const upcoming =
    date
      ? date.getTime() >=
        startOfToday()
      : true;

  return (
    <span
      className={`
        badge

        ${
          upcoming
            ? 'badge--success'
            : 'badge--info'
        }
      `}
    >
      {upcoming
        ? 'Confirmed'
        : 'Completed'}
    </span>
  );
}

/* ============================================================
   ACTIONS
============================================================ */

function IconButton({
  title,
  children,
  onClick,
  danger = false,
}: {
  title: string;
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <motion.button
      type="button"
      title={
        title
      }
      aria-label={
        title
      }
      whileTap={{
        scale: 0.94,
      }}
      onClick={
        onClick
      }
      className={`
        grid
        h-8
        w-8
        cursor-pointer
        place-items-center

        rounded-md

        border

        transition-colors

        ${
          danger
            ? `
                border-red-100
                bg-red-50/60
                text-red-500

                hover:border-red-200
                hover:bg-red-50
              `
            : `
                border-gray-200
                bg-white
                text-gray-500

                hover:border-primary/30
                hover:bg-primary/[0.05]
                hover:text-primary
              `
        }
      `}
    >
      {children}
    </motion.button>
  );
}

function MobileAction({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className={`
        flex
        h-10
        cursor-pointer
        items-center
        justify-center
        gap-1.5

        rounded-lg

        border

        text-[12px]
        font-semibold

        transition-colors

        ${
          danger
            ? `
                border-red-100
                bg-red-50
                text-red-500
              `
            : `
                border-gray-200
                bg-white
                text-secondary

                hover:bg-gray-50
              `
        }
      `}
    >
      {icon}

      {label}
    </button>
  );
}

/* ============================================================
   MOBILE INFO
============================================================ */

function MobileInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      className="
        rounded-lg
        border
        border-gray-100
        px-3
        py-2.5
      "
    >
      <p
        className="
          !text-[11px]
          !text-gray-400
        "
      >
        {label}
      </p>

      <p
        className="
          mt-1
          !text-[12px]
          !font-medium
          !text-gray-700
        "
      >
        {value}
      </p>
    </div>
  );
}

/* ============================================================
   PAGINATION
============================================================ */

function Pagination({
  page,
  totalPages,
  total,
  rangeStart,
  rangeEnd,
  visiblePages,
  onChange,
  mobile = false,
}: {
  page: number;
  totalPages: number;
  total: number;
  rangeStart: number;
  rangeEnd: number;
  visiblePages: number[];
  onChange: (
    page: number,
  ) => void;
  mobile?: boolean;
}) {
  return (
    <div
      className={`
        flex

        ${
          mobile
            ? `
                flex-col
                gap-3
              `
            : `
                items-center
                justify-between
              `
        }

        border-t
        border-gray-200

        px-4
        py-3
      `}
    >
      <p
        className="
          !text-[12px]
          !text-gray-500
        "
      >
        Showing{' '}
        <span
          className="
            font-semibold
            text-secondary
          "
        >
          {rangeStart}–
          {rangeEnd}
        </span>{' '}
        of{' '}
        <span
          className="
            font-semibold
            text-secondary
          "
        >
          {total}
        </span>
      </p>

      <div
        className="
          flex
          items-center
          gap-1
        "
      >
        <PaginationButton
          disabled={
            page <= 1
          }
          onClick={() =>
            onChange(
              page - 1,
            )
          }
        >
          <ChevronLeftIcon />
        </PaginationButton>

        {visiblePages[0] >
          1 && (
          <>
            <PaginationButton
              onClick={() =>
                onChange(1)
              }
            >
              1
            </PaginationButton>

            {visiblePages[0] >
              2 && (
              <span
                className="
                  px-1
                  text-[12px]
                  text-gray-400
                "
              >
                …
              </span>
            )}
          </>
        )}

        {visiblePages.map(
          (
            pageNumber,
          ) => (
            <PaginationButton
              key={
                pageNumber
              }
              active={
                page ===
                pageNumber
              }
              onClick={() =>
                onChange(
                  pageNumber,
                )
              }
            >
              {pageNumber}
            </PaginationButton>
          ),
        )}

        {visiblePages[
          visiblePages.length -
            1
        ] <
          totalPages && (
          <>
            {visiblePages[
              visiblePages.length -
                1
            ] <
              totalPages -
                1 && (
              <span
                className="
                  px-1
                  text-[12px]
                  text-gray-400
                "
              >
                …
              </span>
            )}

            <PaginationButton
              active={
                page ===
                totalPages
              }
              onClick={() =>
                onChange(
                  totalPages,
                )
              }
            >
              {
                totalPages
              }
            </PaginationButton>
          </>
        )}

        <PaginationButton
          disabled={
            page >=
            totalPages
          }
          onClick={() =>
            onChange(
              page + 1,
            )
          }
        >
          <ChevronRightIcon />
        </PaginationButton>
      </div>
    </div>
  );
}

function PaginationButton({
  children,
  onClick,
  active = false,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={
        disabled
      }
      onClick={
        onClick
      }
      className={`
        grid
        h-8
        min-w-8
        cursor-pointer
        place-items-center

        rounded-md

        border

        px-2

        text-[12px]
        font-medium

        transition-colors

        ${
          active
            ? `
                border-primary
                bg-primary
                text-white
              `
            : `
                border-gray-200
                bg-white
                text-gray-600

                hover:border-primary/30
                hover:text-primary
              `
        }

        disabled:cursor-not-allowed
        disabled:opacity-40
      `}
    >
      {children}
    </button>
  );
}

/* ============================================================
   EMPTY
============================================================ */

function EmptyState({
  filtered,
  onClear,
}: {
  filtered: boolean;
  onClear: () => void;
}) {
  return (
    <div
      className="
        flex
        flex-col
        items-center
        justify-center
        text-center
      "
    >
      <span
        className="
          grid
          h-11
          w-11
          place-items-center

          rounded-lg

          bg-gray-100

          text-gray-400
        "
      >
        <BookingsIcon />
      </span>

      <h3
        className="
          mt-3
          text-[14px]
          font-semibold
          text-secondary
        "
      >
        No bookings found
      </h3>

      <p
        className="
          mt-1
          max-w-[300px]
          !text-[12px]
          !leading-5
          !text-gray-500
        "
      >
        {filtered
          ? 'No bookings match the current search and filters.'
          : 'Booking records will appear here once registrations are created.'}
      </p>

      {filtered && (
        <button
          type="button"
          onClick={
            onClear
          }
          className="
            btn
            btn-secondary
            mt-4
          "
        >
          Clear Filters
        </button>
      )}
    </div>
  );
}

/* ============================================================
   SKELETONS
============================================================ */

function DesktopTableSkeleton() {
  return (
    <>
      {Array.from({
        length: 7,
      }).map(
        (
          _,
          row,
        ) => (
          <tr
            key={
              row
            }
          >
            {Array.from({
              length: 8,
            }).map(
              (
                __,
                cell,
              ) => (
                <td
                  key={
                    cell
                  }
                >
                  {cell ===
                  1 ? (
                    <div
                      className="
                        flex
                        items-center
                        gap-2.5
                      "
                    >
                      <div
                        className="
                          h-8
                          w-8
                          animate-pulse
                          rounded-lg
                          bg-gray-100
                        "
                      />

                      <div
                        className="
                          space-y-2
                        "
                      >
                        <div
                          className="
                            h-3
                            w-28
                            animate-pulse
                            rounded
                            bg-gray-100
                          "
                        />

                        <div
                          className="
                            h-2.5
                            w-20
                            animate-pulse
                            rounded
                            bg-gray-100
                          "
                        />
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`
                        h-3
                        animate-pulse
                        rounded
                        bg-gray-100

                        ${
                          cell ===
                          7
                            ? 'ml-auto w-24'
                            : cell ===
                                3
                              ? 'w-40'
                              : 'w-24'
                        }
                      `}
                    />
                  )}
                </td>
              ),
            )}
          </tr>
        ),
      )}
    </>
  );
}

function MobileCardSkeleton() {
  return (
    <div
      className="
        animate-pulse

        overflow-hidden

        rounded-xl

        border
        border-gray-200

        bg-white

        shadow-sm
      "
    >
      <div
        className="
          flex
          items-center
          justify-between

          border-b
          border-gray-100

          px-4
          py-3
        "
      >
        <div
          className="
            h-4
            w-28
            rounded
            bg-gray-100
          "
        />

        <div
          className="
            h-5
            w-20
            rounded-full
            bg-gray-100
          "
        />
      </div>

      <div
        className="
          p-4
        "
      >
        <div
          className="
            flex
            items-center
            gap-3
          "
        >
          <div
            className="
              h-11
              w-11
              rounded-lg
              bg-gray-100
            "
          />

          <div
            className="
              flex-1
            "
          >
            <div
              className="
                h-4
                w-[45%]
                rounded
                bg-gray-100
              "
            />

            <div
              className="
                mt-2
                h-3
                w-[70%]
                rounded
                bg-gray-100
              "
            />
          </div>
        </div>

        <div
          className="
            mt-4
            h-16
            rounded-lg
            bg-gray-100
          "
        />

        <div
          className="
            mt-3
            grid
            grid-cols-3
            gap-2
          "
        >
          <div
            className="
              h-10
              rounded-lg
              bg-gray-100
            "
          />

          <div
            className="
              h-10
              rounded-lg
              bg-gray-100
            "
          />

          <div
            className="
              h-10
              rounded-lg
              bg-gray-100
            "
          />
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   HELPERS
============================================================ */

function formatDate(
  value?: string,
) {
  if (!value) {
    return '—';
  }

  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return '—';
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

function formatSlot(
  slot:
    BookingRow['slot'],
) {
  if (
    !slot?.startTime ||
    !slot?.endTime
  ) {
    return '—';
  }

  return `${slot.startTime} - ${slot.endTime}`;
}

function startOfToday() {
  const date =
    new Date();

  date.setHours(
    0,
    0,
    0,
    0,
  );

  return date.getTime();
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
      strokeWidth={2}
    >
      <circle
        cx="11"
        cy="11"
        r="6"
      />

      <path
        strokeLinecap="round"
        d="m16 16 4 4"
      />
    </svg>
  );
}

function BookingsIcon() {
  return (
    <svg
      className="h-[18px] w-[18px]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 5.5A1.5 1.5 0 0 1 6.5 4h11A1.5 1.5 0 0 1 19 5.5V9a2 2 0 0 0 0 4v3.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 16.5V13a2 2 0 0 0 0-4V5.5Z"
      />

      <path
        strokeLinecap="round"
        d="M12 7v8"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      className="h-[18px] w-[18px]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 3v3m10-3v3M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1ZM4 9h16"
      />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg
      className="h-[18px] w-[18px]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 12a8 8 0 1 0 2.35-5.65L4 8.7"
      />

      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 4v4.7h4.7M12 8v4l3 2"
      />
    </svg>
  );
}

function EyeIcon() {
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
        d="M3 12s3.4-6 9-6 9 6 9 6-3.4 6-9 6-9-6-9-6Z"
      />

      <circle
        cx="12"
        cy="12"
        r="2.5"
      />
    </svg>
  );
}

function EditIcon() {
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
        d="m14 5 5 5L9 20H4v-5L14 5Z"
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
        d="M4 7h16M9 3h6l1 4H8l1-4Z"
      />

      <path
        strokeLinecap="round"
        d="m7 7 1 14h8l1-14M10 11v6M14 11v6"
      />
    </svg>
  );
}

function RefreshIcon({
  spinning,
}: {
  spinning: boolean;
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
        d="M20 11a8 8 0 1 0-2.3 5.65M20 4v7h-7"
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
      strokeWidth={1.9}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3v11m0 0 4-4m-4 4-4-4M5 19h14"
      />
    </svg>
  );
}

function ChevronLeftIcon() {
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
        strokeLinejoin="round"
        d="m15 18-6-6 6-6"
      />
    </svg>
  );
}

function ChevronRightIcon() {
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
        strokeLinejoin="round"
        d="m9 18 6-6-6-6"
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
        d="m7 7 10 10M17 7 7 17"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      className="
        h-4
        w-4
        animate-spin
      "
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.25"
      />

      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}