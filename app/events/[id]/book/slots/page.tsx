'use client';

import Image from 'next/image';

import {
  useCallback,
  useEffect,
  useMemo,
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

type SlotItem = {
  _id: string;

  startTime: string;

  endTime: string;

  capacity: number;

  bookedCount: number;

  remaining: number;

  available: boolean;
};

type EventDay = {
  _id: string;

  dayNumber: number;

  date: string;

  startTime: string;

  endTime: string;

  slots: SlotItem[];
};

type SlotEvent = {
  _id: string;

  eventName: string;

  venue: string;

  description: string;

  startDate: string;

  endDate: string;

  status:
    | 'LIVE'
    | 'UPCOMING'
    | 'COMPLETED';
};

type SlotsResponse = {
  success: boolean;

  error?: string;

  event?: SlotEvent;

  days?: EventDay[];
};

const EASE = [
  0.16,
  1,
  0.3,
  1,
] as const;

export default function TimeSlotsPage() {
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
    useState<SlotEvent | null>(
      null,
    );

  const [
    days,
    setDays,
  ] =
    useState<EventDay[]>([]);

  const [
    selectedDayId,
    setSelectedDayId,
  ] =
    useState('');

  const [
    selectedSlotId,
    setSelectedSlotId,
  ] =
    useState('');

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
     LOAD REAL DATABASE SLOTS
  ============================================================ */

  const loadSlots =
    useCallback(
      async (
        silent = false,
      ) => {
        if (!eventId) {
          return;
        }

        if (!silent) {
          setLoading(true);
        }

        setError('');

        try {
          const response =
            await fetch(
              `/api/events/${encodeURIComponent(
                eventId,
              )}/slots?refresh=${Date.now()}`,
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
            (await response.json()) as
              SlotsResponse;

          if (
            !response.ok ||
            !data.success ||
            !data.event
          ) {
            throw new Error(
              data.error ||
                'Unable to load time slots.',
            );
          }

          const nextDays =
            Array.isArray(
              data.days,
            )
              ? data.days
              : [];

          setEvent(
            data.event,
          );

          setDays(
            nextDays,
          );

          setSelectedDayId(
            (current) => {
              if (
                current &&
                nextDays.some(
                  (day) =>
                    day._id ===
                    current,
                )
              ) {
                return current;
              }

              return (
                nextDays[0]?._id ||
                ''
              );
            },
          );

          setSelectedSlotId(
            (current) => {
              if (!current) {
                return '';
              }

              const stillAvailable =
                nextDays.some(
                  (day) =>
                    day.slots.some(
                      (slot) =>
                        slot._id ===
                          current &&
                        slot.available,
                    ),
                );

              return stillAvailable
                ? current
                : '';
            },
          );
        } catch (
          error: unknown
        ) {
          console.error(
            'Time slot loading error:',
            error,
          );

          setError(
            error instanceof Error
              ? error.message
              : 'Unable to load time slots.',
          );
        } finally {
          if (!silent) {
            setLoading(false);
          }
        }
      },
      [
        eventId,
      ],
    );

  useEffect(() => {
    void loadSlots();
  }, [
    loadSlots,
  ]);

  /* ============================================================
     REALTIME REFRESH
  ============================================================ */

  useRealtimeRefresh(
    'events',
    (change) => {
      if (
        !change.id ||
        change.id ===
          eventId
      ) {
        void loadSlots(
          true,
        );
      }
    },
  );

  /* ============================================================
     LIGHT POLLING
  ============================================================ */

  useEffect(() => {
    let timer:
      | number
      | undefined;

    function schedulePolling() {
      if (
        document.visibilityState !==
        'visible'
      ) {
        return;
      }

      timer =
        window.setTimeout(
          () => {
            void loadSlots(
              true,
            );

            schedulePolling();
          },
          30000,
        );
    }

    function handleVisibilityChange() {
      if (
        timer !== undefined
      ) {
        window.clearTimeout(
          timer,
        );

        timer =
          undefined;
      }

      if (
        document.visibilityState ===
        'visible'
      ) {
        void loadSlots(
          true,
        );

        schedulePolling();
      }
    }

    schedulePolling();

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    );

    return () => {
      if (
        timer !== undefined
      ) {
        window.clearTimeout(
          timer,
        );
      }

      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      );
    };
  }, [
    loadSlots,
  ]);

  /* ============================================================
     DERIVED STATE
  ============================================================ */

  const selectedDay =
    useMemo(
      () =>
        days.find(
          (day) =>
            day._id ===
            selectedDayId,
        ) ||
        days[0] ||
        null,
      [
        days,
        selectedDayId,
      ],
    );

  const selectedSlot =
    useMemo(
      () =>
        selectedDay?.slots.find(
          (slot) =>
            slot._id ===
            selectedSlotId,
        ) || null,
      [
        selectedDay,
        selectedSlotId,
      ],
    );

  const availableCount =
    useMemo(
      () =>
        selectedDay?.slots.filter(
          (slot) =>
            slot.available,
        ).length || 0,
      [
        selectedDay,
      ],
    );

  const totalSlots =
    selectedDay?.slots
      .length || 0;

  /* ============================================================
     ACTIONS
  ============================================================ */

  function handleSelectDay(
    dayId: string,
  ) {
    setSelectedDayId(
      dayId,
    );

    setSelectedSlotId('');

    setError('');
  }

  function handleSlotSelect(
    slot: SlotItem,
  ) {
    if (
      !slot.available
    ) {
      return;
    }

    setSelectedSlotId(
      slot._id,
    );

    setError('');
  }

  function handleContinue() {
    if (
      !selectedDay ||
      !selectedSlot
    ) {
      setError(
        'Please select an available time slot.',
      );

      return;
    }

    const slotStorageKey =
      `ssi-booking-slot:${eventId}:${selectedDay._id}:${selectedSlot._id}`;

    sessionStorage.setItem(
      slotStorageKey,
      JSON.stringify({
        eventId,

        dayScheduleId:
          selectedDay._id,

        date:
          selectedDay.date,

        slotId:
          selectedSlot._id,

        startTime:
          selectedSlot.startTime,

        endTime:
          selectedSlot.endTime,
      }),
    );

    sessionStorage.setItem(
      `ssi-booking-slot:${eventId}:latest`,
      JSON.stringify({
        eventId,

        dayScheduleId:
          selectedDay._id,

        date:
          selectedDay.date,

        slotId:
          selectedSlot._id,

        startTime:
          selectedSlot.startTime,

        endTime:
          selectedSlot.endTime,
      }),
    );

    // Back-compat cleanup for older per-event slot keys.
    sessionStorage.removeItem(
      `ssi-booking-slot:${eventId}`,
    );

    router.replace(
      `/events/${encodeURIComponent(
        eventId,
      )}/book/confirm`,
    );
  }

  /* ============================================================
     LOADING
  ============================================================ */

  if (loading) {
    return (
      <SlotsLoading
        onBack={() =>
          router.back()
        }
      />
    );
  }

  /* ============================================================
     ERROR
  ============================================================ */

  if (
    error &&
    !event
  ) {
    return (
      <SlotsError
        message={
          error
        }
        onBack={() =>
          router.back()
        }
        onRetry={() =>
          void loadSlots()
        }
      />
    );
  }

  if (!event) {
    return null;
  }

  /* ============================================================
     PAGE
  ============================================================ */

  return (
    <main
      className="
        min-h-dvh
        overflow-x-hidden
        bg-[#F7F9FB]

        pb-[168px]

        md:pb-10
      "
    >
      {/* =====================================================
          GLOBAL HEADER
      ===================================================== */}

      <header
        className="
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
            max-w-[1100px]

            items-center
            justify-between

            px-3

            sm:h-[68px]
            sm:px-5

            lg:px-7
          "
        >
          {/* BACK */}

          <button
            type="button"
            onClick={() =>
              router.back()
            }
            aria-label="Back to registration form"
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

              sm:h-11
              sm:w-11
            "
          >
            <svg
              className="
                h-[18px]
                w-[18px]

                transition-transform
                duration-200

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

          <div
            className="
              pointer-events-none

              absolute
              left-1/2
              top-1/2

              -translate-x-1/2
              -translate-y-1/2
            "
          >
            <div
              className="
                pointer-events-auto

                flex
                h-10
                max-w-[215px]

                items-center
                gap-2

                rounded-full

                border
                border-primary/20

                bg-white

                px-3.5

                shadow-[0_4px_14px_rgba(27,75,107,0.06)]

                min-[390px]:max-w-[245px]

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
            </div>
          </div>

          {/* RIGHT BALANCER */}

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

        {/* STEP */}

        <div
          className="
            border-t
            border-gray-200/60

            bg-white/40
          "
        >
          <div
            className="
              mx-auto
              flex
              h-9
              w-full
              max-w-[1100px]

              items-center
              justify-center

              px-4
            "
          >
            <p
              className="
                truncate

                text-[10px]
                font-medium

                text-gray-500

                sm:text-[11px]
              "
            >
              Select a date and available time for{' '}
              <span
                className="
                  font-semibold
                  text-secondary
                "
              >
                {event.eventName}
              </span>
            </p>
          </div>
        </div>
      </header>

      {/* =====================================================
          CONTENT
      ===================================================== */}

      <div
        className="
          mx-auto
          w-full
          max-w-[1100px]

          px-3
          pt-4

          sm:px-5
          sm:pt-5

          lg:px-7
          lg:pt-7
        "
      >
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
            duration:
              0.4,
            ease: EASE,
          }}
          className="
            overflow-hidden

            rounded-[18px]

            border
            border-gray-200

            bg-white

            shadow-[0_8px_28px_rgba(27,75,107,0.05)]

            sm:rounded-[20px]
          "
        >
          {/* =================================================
              EVENT OVERVIEW
          ================================================= */}

          <div
            className="
              border-b
              border-gray-200

              px-4
              py-5

              sm:px-6
              sm:py-6

              lg:px-8
              lg:py-7
            "
          >
            <div
              className="
                grid
                gap-5

                md:grid-cols-[minmax(0,1fr)_220px]
                md:items-start
                md:gap-8
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
                  <span
                    className="
                      text-[10px]
                      font-semibold
                      uppercase

                      tracking-[0.08em]

                      text-gray-400
                    "
                  >
                    Time Slot Selection
                  </span>

                  <StatusBadge
                    status={
                      event.status
                    }
                  />
                </div>

                <h1
                  className="
                    mt-2

                    max-w-[700px]

                    font-heading

                    text-[24px]
                    font-bold

                    leading-[1.15]

                    tracking-[-0.03em]

                    text-secondary

                    sm:text-[28px]

                    lg:text-[31px]
                  "
                >
                  {event.eventName}
                </h1>

                <div
                  className="
                    mt-3

                    flex
                    items-start
                    gap-1.5

                    text-[12px]
                    leading-5

                    text-gray-500

                    sm:text-[13px]
                  "
                >
                  <span
                    className="
                      mt-[2px]
                      shrink-0

                      text-primary
                    "
                  >
                    <LocationIcon />
                  </span>

                  <span>
                    {
                      event.venue
                    }
                  </span>
                </div>

                {event.description && (
                  <p
                    className="
                      mt-3

                      max-w-2xl

                      line-clamp-2

                      text-[12px]
                      leading-5

                      text-gray-500

                      sm:text-[13px]
                    "
                  >
                    {
                      event.description
                    }
                  </p>
                )}
              </div>

              {/* DESKTOP STEP SUMMARY */}

              <div
                className="
                  hidden

                  rounded-xl

                  border
                  border-gray-200

                  bg-[#FAFBFC]

                  p-4

                  md:block
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
                  Booking Step
                </p>

                <p
                  className="
                    mt-1.5

                    text-[15px]
                    font-semibold

                    text-secondary
                  "
                >
                  Choose your time
                </p>

                <p
                  className="
                    mt-1

                    text-[11px]
                    leading-5

                    text-gray-500
                  "
                >
                  Select an event date,
                  then choose one
                  available slot.
                </p>
              </div>
            </div>
          </div>

          {/* =================================================
              BODY
          ================================================= */}

          <div
            className="
              px-4
              py-5

              sm:px-6
              sm:py-6

              lg:px-8
              lg:py-7
            "
          >
            {/* =================================================
                DATE SECTION
            ================================================= */}

            <section>
              <div
                className="
                  flex
                  items-end
                  justify-between

                  gap-4
                "
              >
                <div>
                  <p
                    className="
                      text-[10px]
                      font-semibold
                      uppercase

                      tracking-[0.07em]

                      text-gray-400
                    "
                  >
                    Step 1
                  </p>

                  <h2
                    className="
                      mt-1

                      text-[15px]
                      font-semibold

                      text-secondary

                      sm:text-[16px]
                    "
                  >
                    Select a date
                  </h2>
                </div>

                <span
                  className="
                    text-[10px]
                    font-medium

                    text-gray-400
                  "
                >
                  {days.length}{' '}
                  {days.length ===
                  1
                    ? 'day'
                    : 'days'}
                </span>
              </div>

              {days.length ===
              0 ? (
                <EmptyBlock
                  title="No event dates available"
                  message="The schedule for this event has not been configured yet."
                />
              ) : (
                <div
                  className="
                    mt-3

                    flex
                    gap-2.5

                    overflow-x-auto

                    pb-1

                    scrollbar-hide

                    sm:flex-wrap
                    sm:overflow-visible
                  "
                >
                  {days.map(
                    (day) => {
                      const active =
                        day._id ===
                        selectedDay?._id;

                      const date =
                        new Date(
                          day.date,
                        );

                      return (
                        <motion.button
                          key={
                            day._id
                          }
                          type="button"
                          onClick={() =>
                            handleSelectDay(
                              day._id,
                            )
                          }
                          whileTap={{
                            scale:
                              0.97,
                          }}
                          className={`
                            min-w-[92px]
                            shrink-0

                            rounded-xl

                            border

                            px-3
                            py-3

                            text-center

                            transition-all
                            duration-200

                            sm:min-w-[104px]

                            ${
                              active
                                ? `
                                  border-primary
                                  bg-primary
                                  text-white

                                  shadow-[0_8px_18px_rgba(26,158,143,0.14)]
                                `
                                : `
                                  border-gray-200
                                  bg-white
                                  text-secondary

                                  hover:border-primary/30
                                  hover:bg-primary/[0.025]
                                `
                            }
                          `}
                        >
                          <span
                            className={`
                              block

                              text-[9px]
                              font-semibold
                              uppercase

                              tracking-[0.05em]

                              ${
                                active
                                  ? 'text-white/75'
                                  : 'text-gray-400'
                              }
                            `}
                          >
                            {new Intl.DateTimeFormat(
                              'en-IN',
                              {
                                weekday:
                                  'short',
                              },
                            ).format(
                              date,
                            )}
                          </span>

                          <span
                            className="
                              mt-1
                              block

                              text-[20px]
                              font-bold

                              leading-none
                            "
                          >
                            {new Intl.DateTimeFormat(
                              'en-IN',
                              {
                                day:
                                  '2-digit',
                              },
                            ).format(
                              date,
                            )}
                          </span>

                          <span
                            className={`
                              mt-1
                              block

                              text-[10px]
                              font-medium

                              ${
                                active
                                  ? 'text-white/80'
                                  : 'text-gray-500'
                              }
                            `}
                          >
                            {new Intl.DateTimeFormat(
                              'en-IN',
                              {
                                month:
                                  'short',
                                year:
                                  'numeric',
                              },
                            ).format(
                              date,
                            )}
                          </span>
                        </motion.button>
                      );
                    },
                  )}
                </div>
              )}
            </section>

            <div
              className="
                my-6
                h-px
                bg-gray-200
              "
            />

            {/* =================================================
                SLOT SECTION
            ================================================= */}

            <section>
              <div
                className="
                  flex
                  items-end
                  justify-between

                  gap-3
                "
              >
                <div>
                  <p
                    className="
                      text-[10px]
                      font-semibold
                      uppercase

                      tracking-[0.07em]

                      text-gray-400
                    "
                  >
                    Step 2
                  </p>

                  <h2
                    className="
                      mt-1

                      text-[15px]
                      font-semibold

                      text-secondary

                      sm:text-[16px]
                    "
                  >
                    Choose a time
                  </h2>
                </div>

                <div
                  className="
                    shrink-0

                    text-right
                  "
                >
                  <p
                    className="
                      text-[11px]
                      font-semibold

                      text-secondary
                    "
                  >
                    {availableCount}{' '}
                    available
                  </p>

                  <p
                    className="
                      mt-0.5

                      text-[9px]

                      text-gray-400
                    "
                  >
                    of{' '}
                    {
                      totalSlots
                    }{' '}
                    total
                  </p>
                </div>
              </div>

              {/* LEGEND */}

              <div
                className="
                  mt-3

                  flex
                  flex-wrap
                  items-center

                  gap-x-4
                  gap-y-2
                "
              >
                <LegendItem
                  type="available"
                  label="Available"
                />

                <LegendItem
                  type="selected"
                  label="Selected"
                />

                <LegendItem
                  type="booked"
                  label="Booked"
                />
              </div>

              {!selectedDay ||
              selectedDay.slots
                .length === 0 ? (
                <EmptyBlock
                  title="No time slots available"
                  message="There are currently no time slots configured for the selected date."
                />
              ) : (
                <div
                  className="
                    mt-4

                    grid
                    grid-cols-2

                    gap-2.5

                    sm:grid-cols-3

                    lg:grid-cols-4
                    lg:gap-3
                  "
                >
                  {selectedDay.slots.map(
                    (
                      slot,
                    ) => {
                      const selected =
                        selectedSlotId ===
                        slot._id;

                      const booked =
                        !slot.available;

                      return (
                        <motion.button
                          key={
                            slot._id
                          }
                          type="button"
                          disabled={
                            booked
                          }
                          whileTap={
                            booked
                              ? undefined
                              : {
                                  scale:
                                    0.98,
                                }
                          }
                          onClick={() =>
                            handleSlotSelect(
                              slot,
                            )
                          }
                          className={`
                            relative

                            flex
                            min-h-[62px]

                            flex-col

                            items-center
                            justify-center

                            rounded-xl

                            border

                            px-2.5
                            py-2.5

                            text-center

                            transition-all
                            duration-200

                            ${
                              booked
                                ? `
                                  cursor-not-allowed

                                  border-gray-200

                                  bg-gray-100

                                  text-gray-400
                                `
                                : selected
                                  ? `
                                    border-primary

                                    bg-primary/[0.07]

                                    text-primary

                                    shadow-[inset_0_0_0_1px_rgba(26,158,143,0.10)]
                                  `
                                  : `
                                    cursor-pointer

                                    border-gray-200

                                    bg-white

                                    text-secondary

                                    hover:-translate-y-0.5
                                    hover:border-primary/30
                                    hover:bg-primary/[0.02]
                                    hover:shadow-[0_5px_14px_rgba(27,75,107,0.05)]
                                  `
                            }
                          `}
                        >
                          <span
                            className="
                              text-[12px]
                              font-semibold

                              leading-5

                              sm:text-[13px]
                            "
                          >
                            {
                              slot.startTime
                            }
                            {' – '}
                            {
                              slot.endTime
                            }
                          </span>

                          <span
                            className={`
                              mt-0.5

                              text-[9px]
                              font-medium

                              ${
                                booked
                                  ? 'text-gray-400'
                                  : selected
                                    ? 'text-primary'
                                    : slot.remaining <=
                                        2
                                      ? 'text-red-500'
                                      : 'text-gray-400'
                              }
                            `}
                          >
                            {booked
                              ? 'Fully booked'
                              : `${slot.remaining} ${
                                  slot.remaining ===
                                  1
                                    ? 'place'
                                    : 'places'
                                } left`}
                          </span>

                          {selected && (
                            <span
                              className="
                                absolute
                                right-2
                                top-2

                                grid
                                h-4
                                w-4

                                place-items-center

                                rounded-full

                                bg-primary

                                text-white
                              "
                            >
                              <svg
                                className="
                                  h-2.5
                                  w-2.5
                                "
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={3}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="m5 12 4 4L19 6"
                                />
                              </svg>
                            </span>
                          )}
                        </motion.button>
                      );
                    },
                  )}
                </div>
              )}
            </section>

            {/* =================================================
                SELECTED SUMMARY
            ================================================= */}

            <AnimatePresence>
              {selectedDay &&
                selectedSlot && (
                  <motion.div
                    initial={{
                      opacity: 0,
                      y: 8,
                      height: 0,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      height:
                        'auto',
                    }}
                    exit={{
                      opacity: 0,
                      y: 6,
                      height: 0,
                    }}
                    transition={{
                      duration:
                        0.28,
                      ease: EASE,
                    }}
                    className="
                      overflow-hidden
                    "
                  >
                    <div
                      className="
                        mt-6

                        rounded-xl

                        border
                        border-primary/20

                        bg-primary/[0.035]

                        px-4
                        py-3.5
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
                            mt-0.5

                            grid
                            h-8
                            w-8

                            shrink-0

                            place-items-center

                            rounded-lg

                            bg-primary/10

                            text-primary
                          "
                        >
                          <svg
                            className="
                              h-4
                              w-4
                            "
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
                        </div>

                        <div
                          className="
                            min-w-0
                          "
                        >
                          <p
                            className="
                              text-[10px]
                              font-semibold
                              uppercase

                              tracking-[0.05em]

                              text-gray-400
                            "
                          >
                            Selected appointment
                          </p>

                          <p
                            className="
                              mt-1

                              text-[13px]
                              font-semibold

                              text-secondary
                            "
                          >
                            {formatSelectedDate(
                              selectedDay.date,
                            )}
                          </p>

                          <p
                            className="
                              mt-0.5

                              text-[12px]

                              text-gray-500
                            "
                          >
                            {
                              selectedSlot.startTime
                            }
                            {' – '}
                            {
                              selectedSlot.endTime
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
            </AnimatePresence>

            {/* ERROR */}

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{
                    opacity: 0,
                    y: 5,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  exit={{
                    opacity: 0,
                    y: 5,
                  }}
                  className="
                    mt-4

                    rounded-xl

                    border
                    border-red-200

                    bg-red-50

                    px-3.5
                    py-3

                    text-[11px]
                    font-medium
                    leading-5

                    text-red-700

                    sm:text-xs
                  "
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* =================================================
                DESKTOP ACTIONS
            ================================================= */}

            <div
              className="
                mt-7

                hidden

                grid-cols-2

                gap-3

                md:grid
              "
            >
              <button
                type="button"
                onClick={() =>
                  router.back()
                }
                className="
                  flex
                  h-12
                  items-center
                  justify-center

                  rounded-xl

                  border
                  border-gray-300

                  bg-white

                  text-sm
                  font-semibold

                  text-secondary

                  transition-all
                  duration-200

                  hover:border-primary/25
                  hover:bg-gray-50

                  active:scale-[0.995]
                "
              >
                Back to Details
              </button>

              <button
                type="button"
                disabled={
                  !selectedSlot
                }
                onClick={
                  handleContinue
                }
                className="
                  flex
                  h-12
                  items-center
                  justify-center

                  rounded-xl

                  bg-primary

                  text-sm
                  font-semibold
                  text-white

                  shadow-[0_8px_20px_rgba(26,158,143,0.16)]

                  transition-all
                  duration-200

                  hover:brightness-95

                  active:scale-[0.995]

                  disabled:cursor-not-allowed
                  disabled:bg-gray-200
                  disabled:text-gray-400
                  disabled:shadow-none
                "
              >
                Continue
              </button>
            </div>
          </div>
        </motion.section>

        <p
          className="
            mx-auto
            mt-4
            max-w-xl

            px-3

            text-center

            text-[9px]
            leading-4

            text-gray-400

            sm:text-[10px]
          "
        >
          Slot availability may change until the booking is confirmed.
        </p>
      </div>

      {/* =====================================================
          MOBILE STICKY FOOTER
      ===================================================== */}

      <div
        className="
          fixed
          inset-x-0
          bottom-0
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
            max-w-[500px]
          "
        >
          {selectedDay &&
            selectedSlot && (
              <div
                className="
                  mb-2.5

                  flex
                  items-center
                  justify-between

                  gap-3
                "
              >
                <div
                  className="
                    min-w-0
                  "
                >
                  <p
                    className="
                      truncate

                      text-[10px]
                      font-medium

                      text-gray-400
                    "
                  >
                    Selected
                  </p>

                  <p
                    className="
                      truncate

                      text-[11px]
                      font-semibold

                      text-secondary
                    "
                  >
                    {formatSelectedDate(
                      selectedDay.date,
                    )}
                    {' · '}
                    {
                      selectedSlot.startTime
                    }
                    {' – '}
                    {
                      selectedSlot.endTime
                    }
                  </p>
                </div>

                <span
                  className="
                    shrink-0

                    rounded-full

                    bg-primary/10

                    px-2
                    py-1

                    text-[9px]
                    font-semibold

                    text-primary
                  "
                >
                  Selected
                </span>
              </div>
            )}

          <button
            type="button"
            disabled={
              !selectedSlot
            }
            onClick={
              handleContinue
            }
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

              shadow-[0_8px_20px_rgba(26,158,143,0.16)]

              transition-all

              active:scale-[0.995]

              disabled:cursor-not-allowed
              disabled:bg-gray-200
              disabled:text-gray-400
              disabled:shadow-none
            "
          >
            Continue
          </button>

          <button
            type="button"
            onClick={() =>
              router.back()
            }
            className="
              mt-2

              flex
              h-10
              w-full

              items-center
              justify-center

              text-[12px]
              font-semibold

              text-gray-500

              transition

              hover:text-secondary
            "
          >
            Back to Details
          </button>
        </div>
      </div>
    </main>
  );
}

/* ============================================================
   STATUS BADGE
============================================================ */

function StatusBadge({
  status,
}: {
  status:
    SlotEvent['status'];
}) {
  return (
    <span
      className={`
        inline-flex
        items-center
        gap-1.5

        rounded-full

        px-2
        py-1

        text-[8px]
        font-bold
        uppercase

        tracking-[0.06em]

        ${
          status ===
          'LIVE'
            ? `
              bg-[rgba(25,204,106,0.12)]
              text-[#15935A]
            `
            : status ===
                'UPCOMING'
              ? `
                bg-primary/[0.07]
                text-primary
              `
              : `
                bg-gray-100
                text-gray-500
              `
        }
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
   LEGEND
============================================================ */

function LegendItem({
  type,
  label,
}: {
  type:
    | 'available'
    | 'selected'
    | 'booked';

  label: string;
}) {
  return (
    <div
      className="
        flex
        items-center
        gap-1.5
      "
    >
      <span
        className={`
          h-2
          w-2

          rounded-full

          ${
            type ===
            'available'
              ? 'bg-gray-300'
              : type ===
                  'selected'
                ? 'bg-primary'
                : 'bg-gray-400'
          }
        `}
      />

      <span
        className="
          text-[9px]
          font-medium

          text-gray-500

          sm:text-[10px]
        "
      >
        {label}
      </span>
    </div>
  );
}

/* ============================================================
   EMPTY BLOCK
============================================================ */

function EmptyBlock({
  title,
  message,
}: {
  title: string;

  message: string;
}) {
  return (
    <div
      className="
        mt-4

        rounded-xl

        border
        border-dashed
        border-gray-200

        bg-[#FAFBFC]

        px-4
        py-7

        text-center
      "
    >
      <div
        className="
          mx-auto

          grid
          h-9
          w-9

          place-items-center

          rounded-full

          bg-white

          text-gray-400

          shadow-sm
        "
      >
        <svg
          className="
            h-4
            w-4
          "
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
            d="M12 8v4l2.5 1.5"
          />
        </svg>
      </div>

      <p
        className="
          mt-3

          text-[13px]
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

          max-w-sm

          text-[11px]
          leading-5

          text-gray-500
        "
      >
        {message}
      </p>
    </div>
  );
}

/* ============================================================
   ERROR PAGE
============================================================ */

function SlotsError({
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
        min-h-dvh
        bg-[#F7F9FB]
      "
    >
      <SimpleHeader
        onBack={
          onBack
        }
      />

      <div
        className="
          flex

          min-h-[calc(100dvh-64px)]

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
              className="
                h-5
                w-5
              "
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

              text-lg
              font-bold

              text-secondary
            "
          >
            Time slots unavailable
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

                transition

                hover:bg-gray-50
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

                transition

                hover:brightness-95
              "
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

/* ============================================================
   SIMPLE HEADER
============================================================ */

function SimpleHeader({
  onBack,
}: {
  onBack:
    () => void;
}) {
  return (
    <header
      className="
        border-b
        border-gray-200

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
          max-w-[1100px]

          items-center
          justify-between

          px-3

          sm:h-[68px]
          sm:px-5
        "
      >
        <button
          type="button"
          onClick={
            onBack
          }
          className="
            grid
            h-10
            w-10

            place-items-center

            rounded-full

            border
            border-gray-200

            bg-white

            text-secondary
          "
        >
          <svg
            className="
              h-[18px]
              w-[18px]
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

        <div
          className="
            absolute
            left-1/2
            top-1/2

            flex
            h-10

            -translate-x-1/2
            -translate-y-1/2

            items-center
            gap-2

            rounded-full

            border
            border-primary/20

            bg-white

            px-3.5
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
              object-contain
            "
          />

          <span
            className="
              whitespace-nowrap

              text-[11px]
              font-semibold

              text-secondary
            "
          >
            SSI Maya Connect
          </span>
        </div>

        <div
          className="
            h-10
            w-10
          "
        />
      </div>
    </header>
  );
}

/* ============================================================
   DATE FORMAT
============================================================ */

function formatSelectedDate(
  value: string,
) {
  return new Intl.DateTimeFormat(
    'en-IN',
    {
      weekday:
        'short',

      day:
        '2-digit',

      month:
        'short',

      year:
        'numeric',
    },
  ).format(
    new Date(
      value,
    ),
  );
}

/* ============================================================
   LOCATION ICON
============================================================ */

function LocationIcon() {
  return (
    <svg
      className="
        h-4
        w-4
      "
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.9}
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

/* ============================================================
   LOADING
============================================================ */

function SlotsLoading({
  onBack,
}: {
  onBack:
    () => void;
}) {
  return (
    <main
      className="
        min-h-dvh
        bg-[#F7F9FB]
      "
    >
      <SimpleHeader
        onBack={
          onBack
        }
      />

      <div
        className="
          mx-auto
          w-full
          max-w-[1100px]

          px-3
          py-4

          sm:px-5
          sm:py-5

          lg:px-7
          lg:py-7
        "
      >
        <div
          className="
            overflow-hidden

            rounded-[18px]

            border
            border-gray-200

            bg-white

            shadow-[0_8px_28px_rgba(27,75,107,0.05)]
          "
        >
          <div
            className="
              border-b
              border-gray-200

              px-4
              py-5

              sm:px-6
              sm:py-6
            "
          >
            <div
              className="
                h-3
                w-24

                animate-pulse

                rounded

                bg-gray-100
              "
            />

            <div
              className="
                mt-3

                h-7
                w-[300px]
                max-w-[80%]

                animate-pulse

                rounded

                bg-gray-200
              "
            />

            <div
              className="
                mt-3

                h-4
                w-[220px]

                animate-pulse

                rounded

                bg-gray-100
              "
            />
          </div>

          <div
            className="
              px-4
              py-5

              sm:px-6
              sm:py-6
            "
          >
            <div
              className="
                h-4
                w-28

                animate-pulse

                rounded

                bg-gray-100
              "
            />

            <div
              className="
                mt-4

                flex
                gap-2.5
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
                      h-[72px]
                      w-[96px]

                      animate-pulse

                      rounded-xl

                      bg-gray-100
                    "
                  />
                ),
              )}
            </div>

            <div
              className="
                my-6
                h-px
                bg-gray-200
              "
            />
            <div
              className="
                h-4
                w-32

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

                gap-2.5

                sm:grid-cols-3

                lg:grid-cols-4
              "
            >
              {Array.from({
                length: 8,
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
                      h-[62px]

                      animate-pulse

                      rounded-xl

                      bg-gray-100
                    "
                  />
                ),
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
