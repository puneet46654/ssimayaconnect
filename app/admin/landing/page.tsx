'use client';

import type {
  ReactNode,
} from 'react';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import Link from 'next/link';

import {
  motion,
} from 'framer-motion';

/* ============================================================
   TYPES
============================================================ */

type DashboardStats = {
  totalEvents: number;
  liveToday: number;
  totalBookings: number;
  todayAttendance: number;
  availableSlots: number;
};

type RecentBooking = {
  id: string;

  bookingId: string;

  fullName: string;

  eventName: string;

  date: string | null;

  startTime: string;

  endTime: string;

  attendanceStatus: string;
};

type UpcomingEvent = {
  id: string;

  eventName: string;

  venue: string;

  startDate: string | null;

  endDate: string | null;

  status: string;

  booked: number;

  capacity: number;

  percentage: number;
};

type DashboardResponse = {
  success: boolean;

  stats?: DashboardStats;

  recentBookings?: RecentBooking[];

  upcomingEvents?: UpcomingEvent[];

  message?: string;
};

/* ============================================================
   CONSTANTS
============================================================ */

const EMPTY_STATS: DashboardStats = {
  totalEvents: 0,
  liveToday: 0,
  totalBookings: 0,
  todayAttendance: 0,
  availableSlots: 0,
};

const EASE = [
  0.16,
  1,
  0.3,
  1,
] as const;

/* ============================================================
   PAGE
============================================================ */

export default function AdminDashboard() {
  const [
    stats,
    setStats,
  ] =
    useState<DashboardStats>(
      EMPTY_STATS,
    );

  const [
    recentBookings,
    setRecentBookings,
  ] =
    useState<RecentBooking[]>(
      [],
    );

  const [
    upcomingEvents,
    setUpcomingEvents,
  ] =
    useState<UpcomingEvent[]>(
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

  /* ==========================================================
     LOAD DASHBOARD
  ========================================================== */

  const loadDashboard =
    useCallback(
      async (
        quiet = false,
      ) => {
        if (quiet) {
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
          const response =
            await fetch(
              '/api/admin/dashboard',
              {
                method:
                  'GET',

                credentials:
                  'include',

                cache:
                  'no-store',
              },
            );

          const data =
            (await response.json()) as DashboardResponse;

          if (
            !response.ok ||
            !data.success
          ) {
            throw new Error(
              data.message ||
                'Unable to load dashboard.',
            );
          }

          setStats(
            data.stats ??
              EMPTY_STATS,
          );

          setRecentBookings(
            data.recentBookings ??
              [],
          );

          setUpcomingEvents(
            data.upcomingEvents ??
              [],
          );
        } catch (err) {
          console.error(
            'Dashboard load failed:',
            err,
          );

          setError(
            err instanceof
              Error
              ? err.message
              : 'Unable to load dashboard.',
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
    void loadDashboard();
  }, [
    loadDashboard,
  ]);

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <motion.div
      initial={{
        opacity: 0,
      }}
      animate={{
        opacity: 1,
      }}
      transition={{
        duration: 0.35,
      }}
      className="
        w-full
        min-w-0
        max-w-full

        overflow-x-hidden

        space-y-4

        sm:space-y-5
        lg:space-y-6
      "
    >
      {/* ======================================================
          HEADER
      ====================================================== */}

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
          ease: EASE,
        }}
        className="
          flex
          min-w-0
          flex-col
          gap-3

          sm:flex-row
          sm:items-start
          sm:justify-between
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

              sm:text-[26px]
              lg:text-[28px]
            "
          >
            Dashboard
          </h1>

          <p
            className="
              mt-1

              max-w-[720px]

              text-[11px]
              leading-[18px]

              text-gray-500

              sm:text-[12px]
              sm:leading-5

              lg:text-[13px]
            "
          >
            Monitor registrations,
            attendance, event
            capacity and key
            administrative activity
            from one place.
          </p>
        </div>

        <motion.button
          type="button"
          whileHover={{
            y: -1,
          }}
          whileTap={{
            scale: 0.97,
          }}
          disabled={
            refreshing
          }
          onClick={() =>
            void loadDashboard(
              true,
            )
          }
          className="
            flex
            h-10
            shrink-0

            items-center
            justify-center
            gap-2

            self-start

            rounded-lg

            border
            border-gray-200

            bg-white

            px-3.5

            text-[10px]
            font-semibold

            text-secondary

            shadow-[0_3px_12px_rgba(27,75,107,0.04)]

            transition-colors

            hover:border-primary/30
            hover:text-primary

            disabled:cursor-not-allowed
            disabled:opacity-50

            sm:text-[11px]
          "
        >
          <RefreshIcon
            spinning={
              refreshing
            }
          />

          {refreshing
            ? 'Refreshing'
            : 'Refresh Data'}
        </motion.button>
      </motion.section>

      {/* ======================================================
          QUICK ACTIONS - TOP
      ====================================================== */}

      <motion.section
        initial={{
          opacity: 0,
          y: 14,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        transition={{
          duration: 0.5,
          delay: 0.05,
          ease: EASE,
        }}
        className="
          min-w-0

          overflow-hidden

          rounded-[16px]

          border
          border-gray-200

          bg-white

          shadow-[0_6px_24px_rgba(27,75,107,0.045)]
        "
      >
        <div
          className="
            flex
            min-w-0
            items-center
            justify-between
            gap-3

            border-b
            border-gray-100

            px-3.5
            py-3.5

            sm:px-5
            sm:py-4
          "
        >
          <div
            className="
              min-w-0
            "
          >
            <h2
              className="
                text-[13px]
                font-semibold

                text-secondary

                sm:text-[14px]
              "
            >
              Quick Actions
            </h2>

         
          </div>
        </div>

        <div
          className="
            grid
            min-w-0
            grid-cols-1

            divide-y
            divide-gray-100

            min-[450px]:grid-cols-2
            min-[450px]:divide-y-0

            lg:grid-cols-4
            lg:divide-x
          "
        >
          <QuickActionCard
            href="/admin/eventmanagement"
            title="Create Event"
            description="Create and configure a new event."
            icon={
              <EventPlusIcon />
            }
            index={
              0
            }
          />

          <QuickActionCard
            href="/admin/bookings"
            title="Manage Bookings"
            description="Review and manage registrations."
            icon={
              <BookingIcon />
            }
            index={
              1
            }
          />

          <QuickActionCard
            href="/admin/check-in"
            title="Check-in Scanner"
            description="Scan attendee QR passes at venue."
            icon={
              <ScanIcon />
            }
            index={
              2
            }
          />

          <QuickActionCard
            href="/admin/reports"
            title="Reports & Export"
            description="Analyse and export operational data."
            icon={
              <ReportIcon />
            }
            index={
              3
            }
          />
        </div>
      </motion.section>

      {/* ======================================================
          ERROR
      ====================================================== */}

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
          className="
            flex
            flex-col
            gap-3

            rounded-xl

            border
            border-red-200

            bg-red-50

            px-3
            py-3

            sm:flex-row
            sm:items-center
            sm:justify-between

            sm:px-4
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
                grid
                h-8
                w-8
                shrink-0

                place-items-center

                rounded-lg

                bg-red-100

                text-red-600
              "
            >
              <AlertIcon />
            </span>

            <div
              className="
                min-w-0
              "
            >
              <p
                className="
                  text-[11px]
                  font-semibold

                  text-red-700
                "
              >
                Unable to load
                dashboard
              </p>

              <p
                className="
                  mt-0.5

                  break-words

                  text-[10px]
                  leading-4

                  text-red-600
                "
              >
                {error}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadDashboard()
            }
            className="
              h-9

              rounded-lg

              border
              border-red-200

              bg-white

              px-4

              text-[10px]
              font-semibold

              text-red-600

              hover:bg-red-50
            "
          >
            Retry
          </button>
        </motion.div>
      )}

      {/* ======================================================
          SECTION LABEL
      ====================================================== */}

      <motion.div
        initial={{
          opacity: 0,
        }}
        animate={{
          opacity: 1,
        }}
        transition={{
          delay: 0.12,
        }}
        className="
          flex
          items-center
          justify-between
          gap-3
        "
      >
        <div>
          <h2
            className="
              text-[13px]
              font-semibold

              text-secondary

              sm:text-[14px]
            "
          >
            Operational Overview
          </h2>

          <p
            className="
              mt-0.5
              text-[9px]
              text-gray-400

              sm:text-[10px]
            "
          >
            Current platform activity
            and capacity.
          </p>
        </div>
      </motion.div>

      {/* ======================================================
          STATS
      ====================================================== */}

      <section
        className="
          grid
          min-w-0
          grid-cols-1
          gap-3

          min-[360px]:grid-cols-2

          sm:gap-4

          xl:grid-cols-4
        "
      >
        <DashboardStat
          index={
            0
          }
          label="Total Events"
          value={
            stats.totalEvents
          }
          description={`${stats.liveToday} currently live`}
          loading={
            loading
          }
          icon={
            <EventIcon />
          }
        />

        <DashboardStat
          index={
            1
          }
          label="Total Bookings"
          value={
            stats.totalBookings
          }
          description="Registered delegates"
          loading={
            loading
          }
          icon={
            <BookingIcon />
          }
        />

        <DashboardStat
          index={
            2
          }
          label="Today's Attendance"
          value={
            stats.todayAttendance
          }
          description="Verified venue entries"
          loading={
            loading
          }
          icon={
            <AttendanceIcon />
          }
          highlight
        />

        <DashboardStat
          index={
            3
          }
          label="Available Slots"
          value={
            stats.availableSlots
          }
          description="Remaining future capacity"
          loading={
            loading
          }
          icon={
            <SlotIcon />
          }
        />
      </section>

      {/* ======================================================
          CONTENT
      ====================================================== */}

      <section
        className="
          grid
          min-w-0
          grid-cols-1
          gap-4

          xl:grid-cols-3
          xl:gap-5
        "
      >
        {/* ====================================================
            RECENT BOOKINGS
        ==================================================== */}

        <motion.div
          initial={{
            opacity: 0,
            y: 14,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.5,
            delay: 0.22,
            ease: EASE,
          }}
          className="
            min-w-0
            overflow-hidden

            rounded-[16px]

            border
            border-gray-200

            bg-white

            shadow-[0_6px_24px_rgba(27,75,107,0.04)]

            xl:col-span-2
          "
        >
          <SectionHeader
            title="Recent Bookings"
            description="Latest attendee registrations received."
            href="/admin/bookings"
            linkText="View All"
          />

          {/* MOBILE */}

          <div
            className="
              divide-y
              divide-gray-100

              md:hidden
            "
          >
            {loading ? (
              <>
                <MobileBookingSkeleton />
                <MobileBookingSkeleton />
                <MobileBookingSkeleton />
              </>
            ) : recentBookings.length ===
              0 ? (
              <DashboardEmpty
                title="No bookings yet"
                description="New registrations will appear here."
              />
            ) : (
              recentBookings.map(
                (
                  booking,
                  index,
                ) => (
                  <RecentBookingCard
                    key={
                      booking.id
                    }
                    booking={
                      booking
                    }
                    index={
                      index
                    }
                  />
                ),
              )
            )}
          </div>

          {/* DESKTOP */}

          <div
            className="
              hidden
              min-w-0
              overflow-x-auto

              md:block
            "
          >
            <table
              className="
                data-table
                w-full
                min-w-[760px]
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
                    Event
                  </th>

                  <th>
                    Date
                  </th>

                  <th>
                    Time Slot
                  </th>

                  <th>
                    Attendance
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <BookingSkeleton />
                ) : recentBookings.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={
                        6
                      }
                      className="
                        !py-12
                        text-center
                        text-gray-400
                      "
                    >
                      No bookings
                      found.
                    </td>
                  </tr>
                ) : (
                  recentBookings.map(
                    (
                      booking,
                    ) => (
                      <tr
                        key={
                          booking.id
                        }
                        className="
                          transition-colors
                          hover:bg-gray-50/60
                        "
                      >
                        <td>
                          <span
                            className="
                              whitespace-nowrap

                              font-mono

                              text-[10px]
                              font-semibold

                              text-primary
                            "
                          >
                            {
                              booking.bookingId
                            }
                          </span>
                        </td>

                        <td>
                          <span
                            className="
                              block
                              max-w-[170px]
                              truncate

                              font-medium

                              text-gray-700
                            "
                          >
                            {
                              booking.fullName
                            }
                          </span>
                        </td>

                        <td>
                          <span
                            className="
                              block
                              max-w-[220px]
                              truncate

                              text-[11px]
                              font-medium

                              text-gray-700
                            "
                          >
                            {
                              booking.eventName
                            }
                          </span>
                        </td>

                        <td
                          className="
                            whitespace-nowrap
                            text-[11px]
                          "
                        >
                          {formatShortDate(
                            booking.date,
                          )}
                        </td>

                        <td
                          className="
                            whitespace-nowrap
                            text-[11px]
                          "
                        >
                          {formatSlot(
                            booking.startTime,
                            booking.endTime,
                          )}
                        </td>

                        <td>
                          <AttendanceBadge
                            status={
                              booking.attendanceStatus
                            }
                          />
                        </td>
                      </tr>
                    ),
                  )
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* ====================================================
            UPCOMING EVENTS
        ==================================================== */}

        <motion.div
          initial={{
            opacity: 0,
            y: 14,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.5,
            delay: 0.28,
            ease: EASE,
          }}
          className="
            min-w-0
            overflow-hidden

            rounded-[16px]

            border
            border-gray-200

            bg-white

            shadow-[0_6px_24px_rgba(27,75,107,0.04)]
          "
        >
          <SectionHeader
            title="Upcoming Events"
            description="Event schedule and capacity overview."
            href="/admin/eventmanagement"
            linkText="Manage"
          />

          <div
            className="
              space-y-3

              p-3

              sm:p-4
            "
          >
            {loading ? (
              <>
                <EventSkeleton />
                <EventSkeleton />
                <EventSkeleton />
              </>
            ) : upcomingEvents.length ===
              0 ? (
              <DashboardEmpty
                compact
                title="No upcoming events"
                description="Upcoming events will appear here."
              />
            ) : (
              upcomingEvents.map(
                (
                  event,
                  index,
                ) => (
                  <UpcomingEventCard
                    key={
                      event.id
                    }
                    event={
                      event
                    }
                    index={
                      index
                    }
                  />
                ),
              )
            )}
          </div>
        </motion.div>
      </section>
    </motion.div>
  );
}

/* ============================================================
   QUICK ACTION
============================================================ */

function QuickActionCard({
  href,
  title,
  description,
  icon,
  index,
}: {
  href: string;

  title: string;

  description: string;

  icon: ReactNode;

  index: number;
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
        delay:
          0.12 +
          index * 0.05,

        duration: 0.4,
        ease: EASE,
      }}
      className="
        min-w-0
      "
    >
      <Link
        href={
          href
        }
        className="
          group

          flex
          min-h-[92px]
          min-w-0

          items-center
          gap-3

          px-3.5
          py-3.5

          transition-all
          duration-200

          hover:bg-primary/[0.025]

          sm:min-h-[105px]
          sm:px-4
          sm:py-4
        "
      >
        <motion.span
          whileHover={{
            scale: 1.06,
            rotate: -2,
          }}
          className="
            grid
            h-10
            w-10
            shrink-0

            place-items-center

            rounded-xl

            border
            border-primary/10

            bg-primary/[0.07]

            text-primary

            transition-colors

            group-hover:border-primary/20
            group-hover:bg-primary/[0.1]

            sm:h-11
            sm:w-11
          "
        >
          {icon}
        </motion.span>

        <div
          className="
            min-w-0
            flex-1
          "
        >
          <div
            className="
              flex
              min-w-0
              items-center
              justify-between
              gap-2
            "
          >
            <h3
              className="
                truncate

                text-[11px]
                font-semibold

                text-secondary

                sm:text-[12px]
              "
            >
              {title}
            </h3>

            <span
              className="
                shrink-0

                text-gray-300

                transition-all
                duration-200

                group-hover:translate-x-0.5
                group-hover:text-primary
              "
            >
              <ArrowIcon />
            </span>
          </div>

          <p
            className="
              mt-1

              text-[9px]
              leading-4

              text-gray-400

              sm:text-[10px]
            "
          >
            {description}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}

/* ============================================================
   DASHBOARD STAT
============================================================ */

function DashboardStat({
  index,
  label,
  value,
  description,
  loading,
  icon,
  highlight = false,
}: {
  index: number;

  label: string;

  value: number;

  description: string;

  loading: boolean;

  icon: ReactNode;

  highlight?: boolean;
}) {
  return (
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
        delay:
          0.12 +
          index * 0.045,

        duration: 0.45,

        ease: EASE,
      }}
      whileHover={{
        y: -3,
      }}
      className="
        group
        min-w-0

        overflow-hidden

        rounded-[15px]

        border
        border-gray-200

        bg-white

        p-3.5

        shadow-[0_5px_20px_rgba(27,75,107,0.035)]

        transition-shadow

        hover:shadow-[0_10px_28px_rgba(27,75,107,0.07)]

        sm:p-4
        lg:p-5
      "
    >
      <div
        className="
          flex
          min-w-0
          items-start
          justify-between
          gap-3
        "
      >
        <div
          className="
            min-w-0
            flex-1
          "
        >
          <p
            className="
              truncate

              text-[9px]
              font-bold

              uppercase

              tracking-[0.06em]

              text-gray-400

              sm:text-[10px]
            "
          >
            {label}
          </p>

          {loading ? (
            <StatSkeleton />
          ) : (
            <>
              <motion.p
                initial={{
                  opacity: 0,
                  scale: 0.96,
                }}
                animate={{
                  opacity: 1,
                  scale: 1,
                }}
                transition={{
                  delay:
                    0.25 +
                    index * 0.05,
                }}
                className={`
                  mt-1.5

                  font-heading

                  text-[27px]
                  font-bold

                  tracking-[-0.045em]

                  sm:text-[31px]
                  lg:text-[34px]

                  ${
                    highlight
                      ? 'text-primary'
                      : 'text-secondary'
                  }
                `}
              >
                {value}
              </motion.p>

              <p
                className="
                  mt-1

                  truncate

                  text-[9px]
                  text-gray-400

                  sm:text-[10px]
                "
              >
                {description}
              </p>
            </>
          )}
        </div>

        <motion.div
          whileHover={{
            scale: 1.08,
            rotate: 2,
          }}
          className="
            grid
            h-9
            w-9
            shrink-0

            place-items-center

            rounded-xl

            border
            border-primary/10

            bg-primary/[0.065]

            text-primary

            transition-colors

            group-hover:bg-primary/[0.1]

            sm:h-10
            sm:w-10
          "
        >
          {icon}
        </motion.div>
      </div>
    </motion.article>
  );
}

/* ============================================================
   SECTION HEADER
============================================================ */

function SectionHeader({
  title,
  description,
  href,
  linkText,
}: {
  title: string;

  description: string;

  href: string;

  linkText: string;
}) {
  return (
    <div
      className="
        flex
        min-w-0
        items-center
        justify-between
        gap-3

        border-b
        border-gray-100

        px-3.5
        py-3.5

        sm:px-5
        sm:py-4
      "
    >
      <div
        className="
          min-w-0
        "
      >
        <h2
          className="
            text-[13px]
            font-semibold

            text-secondary

            sm:text-[14px]
          "
        >
          {title}
        </h2>

        <p
          className="
            mt-0.5

            truncate

            text-[9px]

            text-gray-400

            sm:text-[10px]
          "
        >
          {description}
        </p>
      </div>

      <Link
        href={
          href
        }
        className="
          group

          inline-flex
          shrink-0

          items-center
          gap-1

          whitespace-nowrap

          text-[9px]
          font-semibold

          text-primary

          transition-colors

          hover:text-primary-dark

          sm:text-[10px]
        "
      >
        {linkText}

        <span
          className="
            transition-transform
            group-hover:translate-x-0.5
          "
        >
          <ArrowIcon />
        </span>
      </Link>
    </div>
  );
}

/* ============================================================
   MOBILE BOOKING
============================================================ */

function RecentBookingCard({
  booking,
  index,
}: {
  booking: RecentBooking;

  index: number;
}) {
  return (
    <motion.article
      initial={{
        opacity: 0,
        x: -8,
      }}
      animate={{
        opacity: 1,
        x: 0,
      }}
      transition={{
        delay:
          index *
          0.04,

        duration:
          0.35,
      }}
      className="
        min-w-0

        px-3.5
        py-3.5

        transition-colors

        active:bg-gray-50

        sm:px-4
      "
    >
      <div
        className="
          flex
          min-w-0
          items-start
          justify-between
          gap-3
        "
      >
        <div
          className="
            min-w-0
            flex-1
          "
        >
          <p
            className="
              break-all

              font-mono

              text-[8px]
              font-bold

              tracking-[0.02em]

              text-primary
            "
          >
            {booking.bookingId}
          </p>

          <p
            className="
              mt-1

              break-words

              text-[13px]
              font-semibold

              leading-5

              text-secondary
            "
          >
            {booking.fullName}
          </p>
        </div>

        <AttendanceBadge
          status={
            booking.attendanceStatus
          }
        />
      </div>

      <div
        className="
          mt-3

          rounded-xl

          border
          border-gray-100

          bg-gray-50/70

          px-3
          py-2.5
        "
      >
        <p
          className="
            break-words

            text-[10px]
            font-medium

            leading-4

            text-gray-700
          "
        >
          {booking.eventName}
        </p>

        <div
          className="
            mt-2

            flex
            flex-wrap
            items-center
            gap-x-3
            gap-y-1

            text-[9px]

            text-gray-400
          "
        >
          <span
            className="
              inline-flex
              items-center
              gap-1
            "
          >
            <CalendarSmallIcon />

            {formatShortDate(
              booking.date,
            )}
          </span>

          <span
            className="
              inline-flex
              items-center
              gap-1
            "
          >
            <ClockSmallIcon />

            {formatSlot(
              booking.startTime,
              booking.endTime,
            )}
          </span>
        </div>
      </div>
    </motion.article>
  );
}

/* ============================================================
   UPCOMING EVENT
============================================================ */

function UpcomingEventCard({
  event,
  index,
}: {
  event: UpcomingEvent;

  index: number;
}) {
  const percentage =
    Math.min(
      Math.max(
        event.percentage,
        0,
      ),
      100,
    );

  return (
    <motion.article
      initial={{
        opacity: 0,
        y: 8,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        delay:
          index *
          0.05,

        duration:
          0.4,
      }}
      whileHover={{
        y: -2,
      }}
      className="
        min-w-0

        rounded-xl

        border
        border-gray-200

        bg-white

        p-3

        shadow-[0_2px_8px_rgba(27,75,107,0.025)]

        transition-shadow

        hover:shadow-[0_6px_18px_rgba(27,75,107,0.065)]

        sm:p-3.5
      "
    >
      <div
        className="
          flex
          min-w-0
          items-start
          justify-between
          gap-3
        "
      >
        <div
          className="
            min-w-0
            flex-1
          "
        >
          <div
            className="
              flex
              min-w-0
              flex-wrap

              items-center
              gap-1.5
            "
          >
            <h3
              className="
                min-w-0

                break-words

                text-[11px]
                font-semibold

                leading-[17px]

                text-secondary

                sm:text-[12px]
              "
            >
              {event.eventName}
            </h3>

            {event.status ===
              'LIVE' && (
              <span
                className="
                  inline-flex
                  shrink-0
                  items-center

                  rounded-full

                  bg-emerald-50

                  px-1.5
                  py-0.5

                  text-[7px]
                  font-bold

                  uppercase

                  tracking-[0.04em]

                  text-emerald-600
                "
              >
                Live
              </span>
            )}
          </div>

          <p
            className="
              mt-1

              break-words

              text-[9px]
              leading-4

              text-gray-400
            "
          >
            {formatEventDates(
              event.startDate,
              event.endDate,
            )}

            {event.venue
              ? ` • ${event.venue}`
              : ''}
          </p>
        </div>

        <div
          className="
            shrink-0
            text-right
          "
        >
          <div
            className="
              flex
              items-baseline
              justify-end
              gap-0.5
            "
          >
            <span
              className="
                font-heading

                text-[17px]
                font-bold

                tracking-[-0.03em]

                text-primary
              "
            >
              {event.booked}
            </span>

            <span
              className="
                text-[8px]
                text-gray-400
              "
            >
              /{event.capacity}
            </span>
          </div>

          <p
            className="
              text-[7px]
              text-gray-400
            "
          >
            booked
          </p>
        </div>
      </div>

      <div
        className="
          mt-3
        "
      >
        <div
          className="
            flex
            items-center
            justify-between
          "
        >
          <span
            className="
              text-[8px]
              font-medium

              text-gray-400
            "
          >
            Capacity
          </span>

          <span
            className="
              text-[8px]
              font-semibold

              text-secondary
            "
          >
            {percentage}%
          </span>
        </div>

        <div
          className="
            mt-1.5

            h-1.5

            overflow-hidden

            rounded-full

            bg-gray-100
          "
        >
          <motion.div
            initial={{
              width:
                '0%',
            }}
            animate={{
              width:
                `${percentage}%`,
            }}
            transition={{
              duration:
                0.7,

              delay:
                0.25 +
                index *
                  0.07,

              ease: EASE,
            }}
            className={`
              h-full

              rounded-full

              ${
                percentage >=
                90
                  ? 'bg-secondary'
                  : 'bg-primary'
              }
            `}
          />
        </div>
      </div>
    </motion.article>
  );
}

/* ============================================================
   ATTENDANCE BADGE
============================================================ */

function AttendanceBadge({
  status,
}: {
  status: string;
}) {
  if (
    status ===
    'PRESENT'
  ) {
    return (
      <span
        className="
          inline-flex
          shrink-0

          items-center
          gap-1

          whitespace-nowrap

          rounded-full

          bg-emerald-50

          px-2
          py-1

          text-[8px]
          font-semibold

          text-emerald-700
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

        Present
      </span>
    );
  }

  return (
    <span
      className="
        inline-flex
        shrink-0

        items-center
        gap-1

        whitespace-nowrap

        rounded-full

        bg-amber-50

        px-2
        py-1

        text-[8px]
        font-semibold

        text-amber-700
      "
    >
      <span
        className="
          h-1.5
          w-1.5

          rounded-full

          bg-amber-500
        "
      />

      Not Present
    </span>
  );
}

/* ============================================================
   EMPTY
============================================================ */

function DashboardEmpty({
  title,
  description,
  compact = false,
}: {
  title: string;

  description: string;

  compact?: boolean;
}) {
  return (
    <div
      className={`
        px-4

        text-center

        ${
          compact
            ? 'py-7'
            : 'py-10'
        }
      `}
    >
      <div
        className="
          mx-auto

          grid
          h-10
          w-10

          place-items-center

          rounded-xl

          bg-gray-100

          text-gray-400
        "
      >
        <EmptyIcon />
      </div>

      <p
        className="
          mt-2.5

          text-[11px]
          font-semibold

          text-secondary
        "
      >
        {title}
      </p>

      <p
        className="
          mx-auto
          mt-1

          max-w-[240px]

          text-[9px]
          leading-4

          text-gray-400
        "
      >
        {description}
      </p>
    </div>
  );
}

/* ============================================================
   SKELETONS
============================================================ */

function StatSkeleton() {
  return (
    <>
      <div
        className="
          mt-2

          h-7
          w-14

          animate-pulse

          rounded-md

          bg-gray-100

          sm:h-8
          sm:w-16
        "
      />

      <div
        className="
          mt-2

          h-2.5
          w-24
          max-w-full

          animate-pulse

          rounded

          bg-gray-100
        "
      />
    </>
  );
}

function BookingSkeleton() {
  return (
    <>
      {Array.from({
        length:
          5,
      }).map(
        (
          _,
          index,
        ) => (
          <tr
            key={
              index
            }
          >
            {Array.from({
              length:
                6,
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
                  <div
                    className="
                      h-3
                      w-full
                      max-w-[110px]

                      animate-pulse

                      rounded

                      bg-gray-100
                    "
                  />
                </td>
              ),
            )}
          </tr>
        ),
      )}
    </>
  );
}

function MobileBookingSkeleton() {
  return (
    <div
      className="
        animate-pulse

        px-3.5
        py-4
      "
    >
      <div
        className="
          flex
          justify-between
          gap-3
        "
      >
        <div
          className="
            flex-1
          "
        >
          <div
            className="
              h-2.5
              w-28

              rounded

              bg-gray-100
            "
          />

          <div
            className="
              mt-2

              h-4
              w-32

              rounded

              bg-gray-100
            "
          />
        </div>

        <div
          className="
            h-6
            w-16

            rounded-full

            bg-gray-100
          "
        />
      </div>

      <div
        className="
          mt-3

          h-[60px]

          rounded-xl

          bg-gray-100
        "
      />
    </div>
  );
}

function EventSkeleton() {
  return (
    <div
      className="
        animate-pulse

        rounded-xl

        border
        border-gray-200

        p-3
      "
    >
      <div
        className="
          flex
          justify-between
          gap-4
        "
      >
        <div
          className="
            flex-1
          "
        >
          <div
            className="
              h-3.5
              w-2/3

              rounded

              bg-gray-100
            "
          />

          <div
            className="
              mt-2

              h-2.5
              w-1/2

              rounded

              bg-gray-100
            "
          />
        </div>

        <div
          className="
            h-7
            w-10

            rounded

            bg-gray-100
          "
        />
      </div>

      <div
        className="
          mt-4

          h-1.5

          rounded-full

          bg-gray-100
        "
      />
    </div>
  );
}

/* ============================================================
   FORMATTING
============================================================ */

function formatShortDate(
  value:
    string | null,
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
        '2-digit',
    },
  )
    .format(
      date,
    )
    .replace(
      /(\d{2})$/,
      "'$1",
    );
}

function formatEventDates(
  start:
    string | null,

  end:
    string | null,
) {
  if (!start) {
    return 'Date unavailable';
  }

  const startDate =
    new Date(
      start,
    );

  if (
    Number.isNaN(
      startDate.getTime(),
    )
  ) {
    return 'Date unavailable';
  }

  if (!end) {
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
      startDate,
    );
  }

  const endDate =
    new Date(
      end,
    );

  if (
    Number.isNaN(
      endDate.getTime(),
    )
  ) {
    return formatShortDate(
      start,
    );
  }

  const sameMonth =
    startDate.getMonth() ===
      endDate.getMonth() &&
    startDate.getFullYear() ===
      endDate.getFullYear();

  if (sameMonth) {
    const monthYear =
      new Intl.DateTimeFormat(
        'en-GB',
        {
          month:
            'short',

          year:
            'numeric',
        },
      ).format(
        startDate,
      );

    return `${startDate.getDate()}-${endDate.getDate()} ${monthYear}`;
  }

  const first =
    new Intl.DateTimeFormat(
      'en-GB',
      {
        day:
          '2-digit',

        month:
          'short',
      },
    ).format(
      startDate,
    );

  const second =
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
      endDate,
    );

  return `${first} - ${second}`;
}

function formatSlot(
  start:
    string,

  end:
    string,
) {
  if (
    !start ||
    !end
  ) {
    return '—';
  }

  return `${start} - ${end}`;
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
      className={`
        h-3.5
        w-3.5

        ${
          spinning
            ? 'animate-spin'
            : ''
        }
      `}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 11a8 8 0 1 0-2.35 5.65M20 4v7h-7"
      />
    </svg>
  );
}

function EventIcon() {
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
        d="M8 3v4m8-4v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z"
      />
    </svg>
  );
}

function EventPlusIcon() {
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
        d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z"
      />

      <path
        strokeLinecap="round"
        d="M12 12v5m-2.5-2.5h5"
      />
    </svg>
  );
}

function BookingIcon() {
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
    </svg>
  );
}

function AttendanceIcon() {
  return (
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
        d="m5 12 4 4L19 6"
      />
    </svg>
  );
}

function SlotIcon() {
  return (
    <svg
      className="h-[18px] w-[18px]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <circle
        cx="12"
        cy="12"
        r="8.5"
      />

      <path
        strokeLinecap="round"
        d="M12 7.5V12l3 2"
      />
    </svg>
  );
}

function ScanIcon() {
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
        d="M8 4H5a1 1 0 0 0-1 1v3M16 4h3a1 1 0 0 1 1 1v3M8 20H5a1 1 0 0 1-1-1v-3M16 20h3a1 1 0 0 0 1-1v-3M7 12h10"
      />
    </svg>
  );
}

function ReportIcon() {
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
        d="M5 20V10m7 10V4m7 16v-7"
      />

      <path
        strokeLinecap="round"
        d="M3 20h18"
      />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg
      className="h-[17px] w-[17px]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.9}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m13 2-8 12h6l-1 8 9-13h-6V2Z"
      />
    </svg>
  );
}

function CalendarSmallIcon() {
  return (
    <svg
      className="h-3 w-3"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.9}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z"
      />
    </svg>
  );
}

function ClockSmallIcon() {
  return (
    <svg
      className="h-3 w-3"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.9}
    >
      <circle
        cx="12"
        cy="12"
        r="8.5"
      />

      <path
        strokeLinecap="round"
        d="M12 7.5V12l3 2"
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
        d="m9 5 7 7-7 7"
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

function EmptyIcon() {
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
        strokeLinejoin="round"
        d="M5 5h14v14H5V5Zm3 4h8M8 13h5"
      />
    </svg>
  );
}