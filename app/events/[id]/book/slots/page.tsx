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

import { useRealtimeRefresh } from '@/components/realtime/RealtimeProvider';

import { trackActivity } from '@/lib/activity-client';

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

export default function TimeSlotsPage() {
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
              )}/slots`,
              {
                method:
                  'GET',

                cache:
                  'no-store',
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

              const slotStillExists =
                nextDays.some(
                  (day) =>
                    day.slots.some(
                      (slot) =>
                        slot._id ===
                          current &&
                        slot.available,
                    ),
                );

              return slotStillExists
                ? current
                : '';
            },
          );
        } catch (
          error: unknown
        ) {
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
    const timer = window.setTimeout(() => {
      void loadSlots();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [
    loadSlots,
  ]);

  useRealtimeRefresh(
    'events',
    (change) => {
      if (!change.id || change.id === eventId) {
        void loadSlots(true);
      }
    },
  );

  /*
   * Lightweight refresh.
   * This keeps bookedCount / availability
   * fresher while the user is on this page.
   *
    * Poll only while visible so background tabs do not
    * continuously reload the full availability response.
   */
  useEffect(() => {
     let timer: number | undefined;

     const schedulePolling = () => {
       if (document.visibilityState !== 'visible') {
         return;
       }

       timer = window.setTimeout(() => {
           void loadSlots(
             true,
           );
           schedulePolling();
         }, 30000);
     };

     const handleVisibilityChange = () => {
       if (timer !== undefined) {
         window.clearTimeout(timer);
         timer = undefined;
       }

       if (document.visibilityState === 'visible') {
         void loadSlots(true);
         schedulePolling();
       }
     };

     schedulePolling();
     document.addEventListener(
       'visibilitychange',
       handleVisibilityChange,
     );

     return () => {
       if (timer !== undefined) {
         window.clearTimeout(timer);
       }
       document.removeEventListener(
         'visibilitychange',
         handleVisibilityChange,
       );
     };
  }, [
    loadSlots,
  ]);

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

  function handleSelectDay(
    dayId: string,
  ) {
    setSelectedDayId(
      dayId,
    );

    setSelectedSlotId('');
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

    /*
     * Store selection only for moving between pages.
     *
     * Backend must validate availability again when
     * we build final booking confirmation.
     */
    sessionStorage.setItem(
      `ssi-booking-slot:${eventId}`,
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

    void trackActivity(
      'slot_selected',
      {
        eventId,
        metadata: {
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
        },
      },
    );

    /*
     * NEXT STEP:
     * we'll connect this to the final booking API.
     */

    router.push(
      `/events/${encodeURIComponent(
        eventId,
      )}/book/confirm`,
    );
  }

  if (loading) {
    return (
      <SlotsLoading />
    );
  }

  if (
    error &&
    !event
  ) {
    return (
      <main
        className="
          grid
          min-h-dvh
          place-items-center
          bg-[#F7F9FB]
          px-4
        "
      >
        <div
          className="
            w-full
            max-w-sm
            rounded-2xl
            border
            border-gray-200
            bg-white
            p-6
            text-center
          "
        >
          <h1
            className="
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
              text-sm
              leading-6
              text-gray-500
            "
          >
            {error}
          </p>

          <button
            type="button"
            onClick={() =>
              void loadSlots()
            }
            className="
              mt-5
              h-11
              w-full
              rounded-xl
              bg-primary
              text-sm
              font-semibold
              text-white
            "
          >
            Try Again
          </button>
        </div>
      </main>
    );
  }

  if (
    !event
  ) {
    return null;
  }

  return (
    <main
      className="
        min-h-dvh
        bg-[#F7F9FB]
      "
    >
      <div
        className="
          mx-auto
          w-full
          max-w-[760px]
          pb-[170px]
          sm:px-5
          sm:pt-5
          lg:max-w-[900px]
          lg:pb-10
          lg:pt-8
        "
      >
        <section
          className="
            bg-[#F7F9FB]
            px-4
            pb-5
            pt-5

            sm:rounded-2xl
            sm:border
            sm:border-gray-200
            sm:bg-white
            sm:px-6
            sm:py-6

            lg:px-8
            lg:py-8
          "
        >
          {/* BRAND */}

          <div
            className="
              flex
              justify-center
            "
          >
            <div
              className="
                inline-flex
                h-10
                items-center
                gap-2

                rounded-full

                border
                border-primary/25

                bg-white

                px-4

                shadow-[0_6px_20px_rgba(27,75,107,0.08)]
              "
            >
              <Image
                src="/logos/ssilogo.png"
                alt="SSI"
                width={19}
                height={19}
                priority
                className="
                  h-[19px]
                  w-[19px]
                  object-contain
                "
              />

              <span
                className="
                  text-[12px]
                  font-semibold
                  text-secondary
                "
              >
                SSI Maya Connect
              </span>
            </div>
          </div>

          {/* EVENT */}

          <header
            className="
              mt-6
            "
          >
            <h1
              className="
                font-heading
                text-[25px]
                font-bold
                leading-[1.14]
                tracking-[-0.025em]
                text-secondary

                sm:text-[28px]
              "
            >
              {event.eventName}
            </h1>

            <div
              className="
                mt-2
                flex
                items-start
                gap-2

                text-[13px]
                leading-5
                text-primary
              "
            >
              <LocationIcon />

              <span>
                {event.venue}
              </span>
            </div>

            {event.description && (
              <p
                className="
                  mt-3
                  line-clamp-2
                  max-w-2xl

                  text-[12px]
                  leading-5
                  text-gray-500

                  sm:text-[13px]
                "
              >
                {event.description}
              </p>
            )}
          </header>

          {/* DATE */}

          <section
            className="
              mt-6
            "
          >
            <p
              className="
                text-[11px]
                font-semibold
                uppercase
                tracking-[0.04em]
                text-gray-500
              "
            >
              Select date
            </p>

            <div
              className="
                mt-2.5
                grid
                grid-cols-3
                gap-2

                sm:flex
                sm:flex-wrap
                sm:gap-2.5
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
                    <button
                      key={
                        day._id
                      }
                      type="button"
                      onClick={() =>
                        handleSelectDay(
                          day._id,
                        )
                      }
                      className={`
                        min-w-0
                        rounded-xl
                        border
                        px-2
                        py-3
                        text-center

                        transition-all
                        duration-200

                        sm:min-w-[112px]
                        sm:px-4

                        ${
                          active
                            ? `
                              border-primary
                              bg-primary
                              text-white
                              shadow-[0_8px_20px_rgba(26,158,143,0.15)]
                            `
                            : `
                              border-gray-200
                              bg-white
                              text-secondary

                              hover:border-primary/30
                            `
                        }
                      `}
                    >
                      <span
                        className={`
                          block
                          text-[10px]
                          font-semibold
                          uppercase

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
                            weekday:
                              'short',
                          },
                        ).format(
                          date,
                        )}
                      </span>

                      <span
                        className="
                          mt-0.5
                          block
                          text-[18px]
                          font-bold
                          leading-5
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
                          mt-0.5
                          block
                          text-[10px]

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
                          },
                        ).format(
                          date,
                        )}
                      </span>
                    </button>
                  );
                },
              )}
            </div>
          </section>

          {/* SLOTS */}

          <section
            className="
              mt-6
            "
          >
            <div
              className="
                flex
                items-center
                justify-between
                gap-3
              "
            >
              <p
                className="
                  text-[11px]
                  font-semibold
                  uppercase
                  tracking-[0.04em]
                  text-gray-500
                "
              >
                Available time slots
              </p>

              <span
                className="
                  text-[10px]
                  font-medium
                  text-gray-500
                "
              >
                {availableCount}{' '}
                of{' '}
                {selectedDay?.slots
                  .length ||
                  0}{' '}
                available
              </span>
            </div>

            {!selectedDay ||
            selectedDay.slots
              .length === 0 ? (
              <div
                className="
                  mt-3
                  rounded-xl
                  border
                  border-gray-200
                  bg-white
                  px-4
                  py-8
                  text-center
                  text-sm
                  text-gray-500
                "
              >
                No time slots
                are available for
                this date.
              </div>
            ) : (
              <div
                className="
                  mt-3

                  grid
                  grid-cols-2
                  gap-2

                  sm:grid-cols-3
                  sm:gap-3
                "
              >
                {selectedDay.slots.map(
                  (slot) => {
                    const selected =
                      selectedSlotId ===
                      slot._id;

                    const booked =
                      !slot.available;

                    return (
                      <button
                        key={
                          slot._id
                        }
                        type="button"
                        disabled={
                          booked
                        }
                        onClick={() =>
                          handleSlotSelect(
                            slot,
                          )
                        }
                        className={`
                          relative
                          min-h-[48px]
                          rounded-xl
                          border
                          px-2
                          py-2.5

                          text-center

                          transition-all
                          duration-200

                          ${
                            booked
                              ? `
                                cursor-not-allowed
                                border-gray-200
                                bg-gray-200/80
                                text-gray-400
                              `
                              : selected
                                ? `
                                  border-primary
                                  bg-primary/[0.06]
                                  text-primary

                                  shadow-[inset_3px_0_0_0_rgba(26,158,143,1)]
                                `
                                : `
                                  cursor-pointer
                                  border-gray-200
                                  bg-white
                                  text-secondary

                                  hover:border-primary/35
                                  hover:bg-primary/[0.025]
                                `
                          }
                        `}
                      >
                        <span
                          className="
                            text-[12px]
                            font-medium

                            sm:text-[13px]
                          "
                        >
                          {slot.startTime}{' '}
                          -{' '}
                          {slot.endTime}
                        </span>

                        {booked ? (
                          <span
                            className="
                              ml-1
                              text-[9px]
                              font-semibold
                              uppercase
                            "
                          >
                            Booked
                          </span>
                        ) : (
                          <span
                            className={`
                              ml-1
                              text-[9px]
                              font-medium

                              ${
                                slot.remaining <=
                                2
                                  ? 'text-red-500'
                                  : 'text-green-600'
                              }
                            `}
                          >
                            {slot.remaining}{' '}
                            left
                          </span>
                        )}
                      </button>
                    );
                  },
                )}
              </div>
            )}
          </section>

          {error && (
            <p
              className="
                mt-4
                rounded-xl
                border
                border-red-200
                bg-red-50
                px-3
                py-2.5
                text-xs
                font-medium
                text-red-700
              "
            >
              {error}
            </p>
          )}

          {/* DESKTOP ACTIONS */}

          <div
            className="
              mt-7
              hidden
              grid-cols-2
              gap-3

              lg:grid
            "
          >
            <button
              type="button"
              onClick={() =>
                router.back()
              }
              className="
                h-12
                rounded-xl

                border
                border-primary

                bg-white

                text-sm
                font-semibold
                text-primary

                transition-colors

                hover:bg-primary/[0.04]
              "
            >
              Back to Details Form
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
                h-12
                rounded-xl

                bg-primary

                text-sm
                font-semibold
                text-white

                transition

                hover:brightness-95

                disabled:cursor-not-allowed
                disabled:opacity-45
              "
            >
              Continue
            </button>
          </div>
        </section>
      </div>

      {/* MOBILE STICKY FOOTER */}

      <div
        className="
          fixed
          inset-x-0
          bottom-0
          z-40

          border-t
          border-gray-200

          bg-white/95

          px-4
          pb-[max(14px,env(safe-area-inset-bottom))]
          pt-3

          backdrop-blur-xl

          lg:hidden
        "
      >
        {selectedDay &&
          selectedSlot && (
            <p
              className="
                mb-2.5
                text-center
                text-[11px]
                text-gray-500
              "
            >
              Selected:{' '}
              {formatSelectedDate(
                selectedDay.date,
              )}
              ,{' '}
              {
                selectedSlot.startTime
              }{' '}
              -{' '}
              {
                selectedSlot.endTime
              }
            </p>
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

            shadow-[0_8px_20px_rgba(26,158,143,0.15)]

            transition

            active:scale-[0.995]

            disabled:cursor-not-allowed
            disabled:opacity-45
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
            mt-2.5
            flex
            h-11
            w-full
            items-center
            justify-center

            rounded-xl

            border
            border-primary

            bg-white

            text-sm
            font-semibold
            text-primary
          "
        >
          Back to Details Form
        </button>
      </div>
    </main>
  );
}

function formatSelectedDate(
  value: string,
) {
  return new Intl.DateTimeFormat(
    'en-IN',
    {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    },
  ).format(
    new Date(value),
  );
}

function LocationIcon() {
  return (
    <svg
      className="
        mt-[2px]
        h-4
        w-4
        shrink-0
      "
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
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

function SlotsLoading() {
  return (
    <main
      className="
        min-h-dvh
        bg-[#F7F9FB]
        px-4
        py-5
      "
    >
      <div
        className="
          mx-auto
          w-full
          max-w-[760px]
        "
      >
        <div
          className="
            mx-auto
            h-10
            w-[175px]
            animate-pulse
            rounded-full
            bg-gray-200
          "
        />

        <div
          className="
            mt-7
            h-7
            w-[280px]
            max-w-full
            animate-pulse
            rounded
            bg-gray-200
          "
        />

        <div
          className="
            mt-2
            h-4
            w-[210px]
            animate-pulse
            rounded
            bg-gray-200
          "
        />

        <div
          className="
            mt-7
            grid
            grid-cols-3
            gap-2
          "
        >
          {Array.from({
            length: 3,
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
                  h-20
                  animate-pulse
                  rounded-xl
                  bg-gray-200
                "
              />
            ),
          )}
        </div>

        <div
          className="
            mt-8
            grid
            grid-cols-2
            gap-2
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
                  h-12
                  animate-pulse
                  rounded-xl
                  bg-gray-200
                "
              />
            ),
          )}
        </div>
      </div>
    </main>
  );
}