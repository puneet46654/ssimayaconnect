'use client';

import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  BrowserQRCodeReader,
} from '@zxing/browser';

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

type LiveEvent = {
  id: string;
  eventName: string;
  venue: string;
  startDate: string;
  endDate: string;
};

type Stats = {
  total: number;
  present: number;
  remaining: number;
  percentage: number;
};

type RecentScan = {
  id: string;
  bookingId: string;
  fullName: string;
  checkedInAt:
    string | null;
  checkedInBy: string;
  method:
    | 'QR'
    | 'MANUAL';
};

type DashboardResponse = {
  success: boolean;

  events: LiveEvent[];

  stats: Stats;

  recent: RecentScan[];

  message?: string;
};

type CheckInResponse = {
  success: boolean;

  alreadyPresent?: boolean;

  message?: string;

  booking?: {
    id: string;
    bookingId: string;
    fullName: string;
    email?: string;

    attendanceStatus:
      'PRESENT';

    checkedInAt:
      string | null;
  };
};

type ResultState = {
  type:
    | 'success'
    | 'warning'
    | 'error';

  title: string;

  message: string;

  bookingId?: string;

  fullName?: string;
};

/* ============================================================
   ANIMATION
============================================================ */

const EASE = [
  0.16,
  1,
  0.3,
  1,
] as const;

/* ============================================================
   PAGE
============================================================ */

export default function AttendeesPage() {
  const videoRef =
    useRef<HTMLVideoElement | null>(
      null,
    );

  const controlsRef =
    useRef<{
      stop:
        () => void;
    } | null>(
      null,
    );

  const processingRef =
    useRef(
      false,
    );

  const lastScanRef =
    useRef<{
      value: string;
      time: number;
    } | null>(
      null,
    );

  /* ==========================================================
     STATE
  ========================================================== */

  const [
    events,
    setEvents,
  ] =
    useState<LiveEvent[]>(
      [],
    );

  const [
    selectedEventId,
    setSelectedEventId,
  ] = useState('');

  const [
    stats,
    setStats,
  ] =
    useState<Stats>({
      total: 0,
      present: 0,
      remaining: 0,
      percentage: 0,
    });

  const [
    recent,
    setRecent,
  ] =
    useState<RecentScan[]>(
      [],
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    scannerStatus,
    setScannerStatus,
  ] = useState<
    | 'idle'
    | 'starting'
    | 'scanning'
    | 'processing'
    | 'error'
  >('idle');

  const [
    scannerMessage,
    setScannerMessage,
  ] = useState('');

  const [
    manualId,
    setManualId,
  ] = useState('');

  const [
    manualLoading,
    setManualLoading,
  ] = useState(false);

  const [
    result,
    setResult,
  ] =
    useState<ResultState | null>(
      null,
    );

  /* ==========================================================
     STOP CAMERA
  ========================================================== */

  const stopCamera =
    useCallback(() => {
      if (
        controlsRef.current
      ) {
        try {
          controlsRef.current.stop();
        } catch {
          // Camera already stopped.
        }

        controlsRef.current =
          null;
      }
    }, []);

  /* ==========================================================
     LOAD DASHBOARD
  ========================================================== */

  const loadDashboard =
    useCallback(
      async (
        eventId?: string,
        quiet = false,
      ) => {
        if (!quiet) {
          setLoading(
            true,
          );
        }

        try {
          const url =
            eventId
              ? `/api/admin/attendance?eventId=${encodeURIComponent(
                  eventId,
                )}`
              : '/api/admin/attendance';

          const response =
            await fetch(
              url,
              {
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
                'Unable to load attendance.',
            );
          }

          setEvents(
            data.events ??
              [],
          );

          setStats(
            data.stats ?? {
              total: 0,
              present: 0,
              remaining: 0,
              percentage: 0,
            },
          );

          setRecent(
            data.recent ??
              [],
          );

          if (
            !eventId &&
            !selectedEventId &&
            data.events?.length
          ) {
            setSelectedEventId(
              data.events[0].id,
            );
          }
        } catch (error) {
          console.error(
            error,
          );

          setScannerMessage(
            error instanceof
              Error
              ? error.message
              : 'Unable to load attendance.',
          );
        } finally {
          if (!quiet) {
            setLoading(
              false,
            );
          }
        }
      },
      [
        selectedEventId,
      ],
    );

  useRealtimeRefresh(
    'attendance',
    () => {
      void loadDashboard(
        selectedEventId,
        true,
      );
    },
  );

  /* ==========================================================
     INITIAL LOAD
  ========================================================== */

  useEffect(() => {
    const timeoutId =
      window.setTimeout(() => {
        void loadDashboard();
      }, 0);

    return () => {
      window.clearTimeout(
        timeoutId,
      );
    };
  }, [
    loadDashboard,
  ]);

  /* ==========================================================
     EVENT DATA
  ========================================================== */

  useEffect(() => {
    if (
      !selectedEventId
    ) {
      return;
    }

    const initialLoadId =
      window.setTimeout(() => {
        void loadDashboard(
          selectedEventId,
        );
      }, 0);

    const interval =
      window.setInterval(
        () => {
          void loadDashboard(
            selectedEventId,
            true,
          );
        },
        5000,
      );

    return () => {
      window.clearTimeout(
        initialLoadId,
      );
      window.clearInterval(
        interval,
      );
    };
  }, [
    selectedEventId,
    loadDashboard,
  ]);

  /* ==========================================================
     SUBMIT CHECK IN
  ========================================================== */

  const submitAttendance =
    useCallback(
      async ({
        code,
        bookingId,
        method,
      }: {
        code?: string;
        bookingId?: string;
        method:
          | 'QR'
          | 'MANUAL';
      }) => {
        if (
          !selectedEventId
        ) {
          setResult({
            type:
              'error',

            title:
              'Select an event',

            message:
              'Choose a live event before scanning.',
          });

          return null;
        }

        const response =
          await fetch(
            '/api/admin/attendance',
            {
              method:
                'POST',

              credentials:
                'include',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body:
                JSON.stringify({
                  eventId:
                    selectedEventId,

                  code,

                  bookingId,

                  method,
                }),
            },
          );

        const data =
          (await response.json()) as CheckInResponse;

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.message ||
              'Unable to record attendance.',
          );
        }

        if (
          data.alreadyPresent
        ) {
          setResult({
            type:
              'warning',

            title:
              'Already Present',

            message:
              'Attendance was already recorded for this attendee.',

            fullName:
              data.booking
                ?.fullName,

            bookingId:
              data.booking
                ?.bookingId,
          });
        } else {
          setResult({
            type:
              'success',

            title:
              `Marked Present: ${
                data.booking
                  ?.fullName ||
                'Attendee'
              }`,

            message:
              'Ticket verified successfully.',

            fullName:
              data.booking
                ?.fullName,

            bookingId:
              data.booking
                ?.bookingId,
          });
        }

        await loadDashboard(
          selectedEventId,
          true,
        );

        return data;
      },
      [
        selectedEventId,
        loadDashboard,
      ],
    );

  /* ==========================================================
     PROCESS QR
  ========================================================== */

  const processQr =
    useCallback(
      async (
        value: string,
      ) => {
        if (
          !value ||
          processingRef.current
        ) {
          return;
        }

        const now =
          Date.now();

        const previous =
          lastScanRef.current;

        if (
          previous &&
          previous.value ===
            value &&
          now -
            previous.time <
            3500
        ) {
          return;
        }

        lastScanRef.current =
          {
            value,
            time:
              now,
          };

        processingRef.current =
          true;

        setScannerStatus(
          'processing',
        );

        setScannerMessage(
          'Verifying ticket...',
        );

        try {
          await submitAttendance({
            code:
              value,

            method:
              'QR',
          });

          setScannerStatus(
            'scanning',
          );

          setScannerMessage(
            'Ready for next ticket',
          );

          /*
           * Short physical feedback for
           * scanner operator.
           */
          if (
            'vibrate' in
            navigator
          ) {
            navigator.vibrate(
              [
                60,
                30,
                80,
              ],
            );
          }
        } catch (error) {
          setResult({
            type:
              'error',

            title:
              'Ticket Not Accepted',

            message:
              error instanceof
                Error
                ? error.message
                : 'Unable to verify ticket.',
          });

          setScannerStatus(
            'scanning',
          );

          setScannerMessage(
            'Ready to scan again',
          );
        } finally {
          window.setTimeout(
            () => {
              processingRef.current =
                false;
            },
            900,
          );
        }
      },
      [
        submitAttendance,
      ],
    );

  /* ==========================================================
     START CAMERA
  ========================================================== */

  const startCamera =
    useCallback(
      async () => {
        if (
          !selectedEventId ||
          !videoRef.current
        ) {
          return;
        }

        stopCamera();

        setScannerStatus(
          'starting',
        );

        setScannerMessage(
          'Starting camera...',
        );

        try {
          const reader =
            new BrowserQRCodeReader();

          const controls =
            await reader.decodeFromVideoDevice(
              undefined,
              videoRef.current,
              (
                scanResult,
              ) => {
                if (
                  scanResult
                ) {
                  void processQr(
                    scanResult.getText(),
                  );
                }
              },
            );

          controlsRef.current =
            controls;

          setScannerStatus(
            'scanning',
          );

          setScannerMessage(
            'Align QR code inside the frame',
          );
        } catch (error) {
          console.error(
            'Camera error:',
            error,
          );

          setScannerStatus(
            'error',
          );

          setScannerMessage(
            'Camera could not start. Allow camera access or use manual check-in.',
          );
        }
      },
      [
        processQr,
        selectedEventId,
        stopCamera,
      ],
    );

  /* ==========================================================
     AUTO START CAMERA
  ========================================================== */

  useEffect(() => {
    if (
      !selectedEventId
    ) {
      stopCamera();

      return;
    }

    const timer =
      window.setTimeout(
        () => {
          void startCamera();
        },
        250,
      );

    return () => {
      window.clearTimeout(
        timer,
      );

      stopCamera();
    };
  }, [
    selectedEventId,
    startCamera,
    stopCamera,
  ]);

  /* ==========================================================
     MANUAL CHECK IN
  ========================================================== */

  async function handleManual(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const id =
      manualId.trim();

    if (!id) {
      setResult({
        type:
          'error',

        title:
          'Registration ID required',

        message:
          'Enter the booking or registration ID.',
      });

      return;
    }

    setManualLoading(
      true,
    );

    try {
      await submitAttendance({
        bookingId:
          id,

        method:
          'MANUAL',
      });

      setManualId('');
    } catch (error) {
      setResult({
        type:
          'error',

        title:
          'Check-in Failed',

        message:
          error instanceof
            Error
            ? error.message
            : 'Unable to check in attendee.',
      });
    } finally {
      setManualLoading(
        false,
      );
    }
  }

  /* ==========================================================
     SELECTED EVENT
  ========================================================== */

  const selectedEvent =
    events.find(
      (
        event,
      ) =>
        event.id ===
        selectedEventId,
    );

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
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
        duration:
          0.4,

        ease:
          EASE,
      }}
      className="
        mx-auto
        w-full
        max-w-[1180px]
      "
    >
      {/* ====================================================
          HEADER
      ==================================================== */}

      <div>
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

              text-[24px]
              font-bold

              tracking-[-0.03em]

              text-secondary

              sm:text-[27px]
            "
          >
            Attendance Scanner
          </h1>

          <span
            className="
              badge
              badge--success
            "
          >
            Live
          </span>
        </div>

        <p
          className="
            mt-1
            !text-[13px]
            !text-gray-500
          "
        >
          Scan attendee tickets
          and record event
          attendance.
        </p>
      </div>

      {/* ====================================================
          EVENT SELECT
      ==================================================== */}

      <div
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
        <label
          htmlFor="attendance-event"
          className="form-label"
        >
          Live Event
        </label>

        {loading &&
        events.length ===
          0 ? (
          <div
            className="
              h-[41px]
              animate-pulse
              rounded-lg
              bg-gray-100
            "
          />
        ) : (
          <select
            id="attendance-event"
            value={
              selectedEventId
            }
            onChange={(
              event,
            ) => {
              setSelectedEventId(
                event.target
                  .value,
              );

              setResult(
                null,
              );
            }}
            className="form-select"
          >
            {events.length ===
              0 && (
              <option value="">
                No live events
              </option>
            )}

            {events.map(
              (
                event,
              ) => (
                <option
                  key={
                    event.id
                  }
                  value={
                    event.id
                  }
                >
                  {
                    event.eventName
                  }
                </option>
              ),
            )}
          </select>
        )}

        {selectedEvent
          ?.venue && (
          <p
            className="
              mt-2
              !text-[11px]
              !text-gray-400
            "
          >
            {
              selectedEvent.venue
            }
          </p>
        )}
      </div>

      {/* ====================================================
          MAIN GRID
      ==================================================== */}

      <div
        className="
          mt-5

          grid
          grid-cols-1
          gap-5

          lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]
        "
      >
        {/* ==================================================
            LEFT
        ================================================== */}

        <div
          className="
            min-w-0
            space-y-5
          "
        >
          {/* ================================================
              SCANNER
          ================================================ */}

          <section
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
                border-b
                border-gray-100

                px-4
                py-3.5

                sm:px-5
              "
            >
              <h2
                className="
                  text-[15px]
                  font-semibold
                  text-secondary
                "
              >
                Scan Pass / QR Code
              </h2>

              <p
                className="
                  mt-1
                  !text-[12px]
                  !text-gray-500
                "
              >
                Attendance is
                registered
                automatically after
                the ticket is
                verified.
              </p>
            </div>

            <div
              className="
                p-4
                sm:p-5
              "
            >
              <div
                className="
                  relative

                  aspect-[4/3]
                  w-full

                  overflow-hidden

                  rounded-xl

                  border-2
                  border-dashed
                  border-primary

                  bg-[#F7FBFA]

                  sm:aspect-[16/10]
                "
              >
                <video
                  ref={
                    videoRef
                  }
                  muted
                  playsInline
                  className="
                    absolute
                    inset-0

                    h-full
                    w-full

                    object-cover
                  "
                />

                {/* SOFT OVERLAY */}

                <div
                  className="
                    pointer-events-none

                    absolute
                    inset-0

                    bg-gradient-to-b
                    from-black/[0.02]
                    via-transparent
                    to-black/[0.08]
                  "
                />

                {/* SCAN FRAME */}

                <div
                  className="
                    pointer-events-none

                    absolute
                    left-1/2
                    top-1/2

                    h-[190px]
                    w-[190px]

                    -translate-x-1/2
                    -translate-y-1/2

                    sm:h-[230px]
                    sm:w-[230px]
                  "
                >
                  <Corner className="left-0 top-0 border-l-2 border-t-2" />
                  <Corner className="right-0 top-0 border-r-2 border-t-2" />
                  <Corner className="bottom-0 left-0 border-b-2 border-l-2" />
                  <Corner className="bottom-0 right-0 border-b-2 border-r-2" />

                  {scannerStatus ===
                    'scanning' && (
                    <motion.div
                      initial={{
                        y: 8,
                      }}
                      animate={{
                        y:
                          210,
                      }}
                      transition={{
                        duration:
                          2,

                        repeat:
                          Infinity,

                        repeatType:
                          'reverse',

                        ease:
                          'linear',
                      }}
                      className="
                        absolute
                        left-2
                        right-2
                        top-0

                        h-px

                        bg-primary

                        shadow-[0_0_10px_rgba(26,158,143,0.7)]

                        sm:hidden
                      "
                    />
                  )}

                  {scannerStatus ===
                    'scanning' && (
                    <motion.div
                      initial={{
                        y: 8,
                      }}
                      animate={{
                        y:
                          250,
                      }}
                      transition={{
                        duration:
                          2,

                        repeat:
                          Infinity,

                        repeatType:
                          'reverse',

                        ease:
                          'linear',
                      }}
                      className="
                        absolute
                        left-2
                        right-2
                        top-0

                        hidden
                        h-px

                        bg-primary

                        shadow-[0_0_10px_rgba(26,158,143,0.7)]

                        sm:block
                      "
                    />
                  )}
                </div>

                {/* STATUS */}

                <div
                  className="
                    absolute
                    inset-x-4
                    bottom-4

                    flex
                    justify-center
                  "
                >
                  <div
                    className="
                      inline-flex
                      max-w-full
                      items-center
                      gap-2

                      rounded-full

                      border
                      border-white/60

                      bg-white/90

                      px-3
                      py-2

                      text-[11px]
                      font-medium
                      text-secondary

                      shadow-sm

                      backdrop-blur
                    "
                  >
                    <ScannerIndicator
                      status={
                        scannerStatus
                      }
                    />

                    <span
                      className="
                        truncate
                      "
                    >
                      {scannerMessage ||
                        'Preparing scanner'}
                    </span>
                  </div>
                </div>

                {scannerStatus ===
                  'processing' && (
                  <div
                    className="
                      absolute
                      inset-0

                      grid
                      place-items-center

                      bg-white/55

                      backdrop-blur-[2px]
                    "
                  >
                    <div
                      className="
                        flex
                        items-center
                        gap-2

                        rounded-lg

                        bg-white

                        px-4
                        py-3

                        shadow-md
                      "
                    >
                      <Spinner />

                      <span
                        className="
                          text-[12px]
                          font-semibold
                          text-secondary
                        "
                      >
                        Verifying
                        ticket...
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {scannerStatus ===
                'error' && (
                <button
                  type="button"
                  onClick={() =>
                    void startCamera()
                  }
                  className="
                    btn
                    btn-secondary

                    mt-3
                    w-full
                  "
                >
                  <CameraIcon />

                  Retry Camera
                </button>
              )}
            </div>
          </section>

          {/* ================================================
              RESULT
          ================================================ */}

          <AnimatePresence
            mode="wait"
          >
            {result && (
              <motion.div
                key={`${result.type}-${result.bookingId || result.message}`}
                initial={{
                  opacity: 0,
                  y: 8,
                  scale: 0.985,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                }}
                exit={{
                  opacity: 0,
                  y: -5,
                }}
                transition={{
                  duration:
                    0.3,

                  ease:
                    EASE,
                }}
                className={`
                  overflow-hidden

                  rounded-xl

                  border

                  px-4
                  py-3.5

                  ${
                    result.type ===
                    'success'
                      ? `
                          border-emerald-300
                          bg-emerald-50
                        `
                      : result.type ===
                          'warning'
                        ? `
                            border-amber-300
                            bg-amber-50
                          `
                        : `
                            border-red-200
                            bg-red-50
                          `
                  }
                `}
              >
                <div
                  className="
                    flex
                    items-start
                    gap-3
                  "
                >
                  <motion.div
                    initial={{
                      scale: 0.5,
                    }}
                    animate={{
                      scale: 1,
                    }}
                    transition={{
                      type:
                        'spring',

                      stiffness:
                        350,

                      damping:
                        20,
                    }}
                    className={`
                      grid
                      h-10
                      w-10
                      shrink-0
                      place-items-center

                      rounded-full

                      ${
                        result.type ===
                        'success'
                          ? `
                              bg-emerald-200/70
                              text-emerald-700
                            `
                          : result.type ===
                              'warning'
                            ? `
                                bg-amber-200/70
                                text-amber-700
                              `
                            : `
                                bg-red-100
                                text-red-600
                              `
                      }
                    `}
                  >
                    {result.type ===
                    'success' ? (
                      <CheckIcon />
                    ) : result.type ===
                      'warning' ? (
                      <InfoIcon />
                    ) : (
                      <AlertIcon />
                    )}
                  </motion.div>

                  <div
                    className="
                      min-w-0
                      flex-1
                    "
                  >
                    <p
                      className={`
                        !text-[13px]
                        !font-semibold

                        ${
                          result.type ===
                          'success'
                            ? '!text-emerald-800'
                            : result.type ===
                                'warning'
                              ? '!text-amber-800'
                              : '!text-red-700'
                        }
                      `}
                    >
                      {
                        result.title
                      }
                    </p>

                    <p
                      className="
                        mt-0.5
                        !text-[11px]
                        !leading-4
                        !text-gray-600
                      "
                    >
                      {
                        result.message
                      }
                    </p>

                    {result.bookingId && (
                      <p
                        className="
                          mt-1
                          font-mono
                          !text-[10px]
                          !text-gray-500
                        "
                      >
                        ID:{' '}
                        {
                          result.bookingId
                        }
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setResult(
                        null,
                      )
                    }
                    className="
                      cursor-pointer
                      text-gray-400
                      hover:text-gray-600
                    "
                  >
                    <CloseIcon />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ================================================
              MANUAL
          ================================================ */}

          <section
            className="
              rounded-xl

              border
              border-gray-200

              bg-white

              p-4

              shadow-sm

              sm:p-5
            "
          >
            <div
              className="
                flex
                items-center
                gap-2
              "
            >
              <ManualIcon />

              <h2
                className="
                  text-[14px]
                  font-semibold
                  text-secondary
                "
              >
                Manual Registration
                Override
              </h2>
            </div>

            <p
              className="
                mt-1
                !text-[11px]
                !text-gray-500
              "
            >
              Use this when the QR
              code cannot be scanned.
            </p>

            <form
              onSubmit={
                handleManual
              }
              className="
                mt-4

                flex
                flex-col
                gap-2

                sm:flex-row
              "
            >
              <input
                value={
                  manualId
                }
                onChange={(
                  event,
                ) =>
                  setManualId(
                    event.target
                      .value,
                  )
                }
                placeholder="Enter Registration ID (e.g. SSI-MC-2026-04786)"
                className="
                  form-input
                  flex-1
                "
              />

              <button
                type="submit"
                disabled={
                  manualLoading ||
                  !selectedEventId
                }
                className="
                  btn
                  btn-primary

                  h-[41px]

                  px-6

                  sm:min-w-[130px]
                "
              >
                {manualLoading ? (
                  <>
                    <Spinner />

                    Checking...
                  </>
                ) : (
                  'Check In'
                )}
              </button>
            </form>
          </section>
        </div>

        {/* ==================================================
            RIGHT
        ================================================== */}

        <div
          className="
            min-w-0
            space-y-5
          "
        >
          {/* ================================================
              PROGRESS
          ================================================ */}

          <section
            className="
              rounded-xl

              border
              border-gray-200

              bg-white

              p-4

              shadow-sm

              sm:p-5
            "
          >
            <h2
              className="
                text-[14px]
                font-semibold
                text-secondary
              "
            >
              Attendance Progress
            </h2>

            <div
              className="
                mt-5
                flex
                items-end
                justify-between
                gap-3
              "
            >
              <div>
                <p
                  className="
                    !text-[11px]
                    !font-medium
                    !text-gray-500
                  "
                >
                  Present Attendees
                </p>

                <div
                  className="
                    mt-1
                    flex
                    items-baseline
                    gap-1.5
                  "
                >
                  <span
                    className="
                      font-heading
                      text-[28px]
                      font-bold
                      tracking-[-0.04em]
                      text-primary
                    "
                  >
                    {
                      stats.present
                    }
                  </span>

                  <span
                    className="
                      text-[12px]
                      text-gray-400
                    "
                  >
                    / {
                      stats.total
                    }
                  </span>
                </div>
              </div>

              <div
                className="
                  text-right
                "
              >
                <p
                  className="
                    font-heading
                    text-[20px]
                    font-semibold
                    text-secondary
                  "
                >
                  {
                    stats.percentage
                  }
                  %
                </p>

                <p
                  className="
                    mt-0.5
                    !text-[10px]
                    !text-gray-400
                  "
                >
                  checked in
                </p>
              </div>
            </div>

            <div
              className="
                mt-4

                h-2

                overflow-hidden

                rounded-full

                bg-gray-100
              "
            >
              <motion.div
                initial={{
                  width:
                    0,
                }}
                animate={{
                  width:
                    `${Math.min(
                      stats.percentage,
                      100,
                    )}%`,
                }}
                transition={{
                  duration:
                    0.55,

                  ease:
                    EASE,
                }}
                className="
                  h-full
                  rounded-full
                  bg-primary
                "
              />
            </div>

            <div
              className="
                mt-4

                grid
                grid-cols-2
                gap-3
              "
            >
              <MiniStat
                label="Present"
                value={
                  stats.present
                }
                success
              />

              <MiniStat
                label="Remaining"
                value={
                  stats.remaining
                }
              />
            </div>
          </section>

          {/* ================================================
              RECENT
          ================================================ */}

          <section
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
                border-b
                border-gray-100

                px-4
                py-3.5

                sm:px-5
              "
            >
              <h2
                className="
                  text-[14px]
                  font-semibold
                  text-secondary
                "
              >
                Recent Scans
              </h2>

              <p
                className="
                  mt-0.5
                  !text-[11px]
                  !text-gray-500
                "
              >
                Latest attendance
                confirmations.
              </p>
            </div>

            <div>
              {recent.length ===
              0 ? (
                <div
                  className="
                    px-5
                    py-10
                    text-center
                  "
                >
                  <div
                    className="
                      mx-auto

                      grid
                      h-10
                      w-10
                      place-items-center

                      rounded-lg

                      bg-gray-100

                      text-gray-400
                    "
                  >
                    <ScanIcon />
                  </div>

                  <p
                    className="
                      mt-3
                      !text-[12px]
                      !text-gray-500
                    "
                  >
                    No attendees have
                    been checked in yet.
                  </p>
                </div>
              ) : (
                recent.map(
                  (
                    scan,
                    index,
                  ) => (
                    <motion.div
                      key={
                        scan.id
                      }
                      initial={{
                        opacity:
                          0,

                        x:
                          -5,
                      }}
                      animate={{
                        opacity:
                          1,

                        x:
                          0,
                      }}
                      transition={{
                        delay:
                          index *
                          0.025,
                      }}
                      className="
                        flex
                        items-center
                        gap-3

                        border-b
                        border-gray-100

                        px-4
                        py-3

                        last:border-b-0

                        sm:px-5
                      "
                    >
                      <span
                        className="
                          grid
                          h-8
                          w-8
                          shrink-0
                          place-items-center

                          rounded-full

                          bg-emerald-50

                          text-emerald-600
                        "
                      >
                        <CheckSmallIcon />
                      </span>

                      <div
                        className="
                          min-w-0
                          flex-1
                        "
                      >
                        <p
                          className="
                            truncate
                            !text-[12px]
                            !font-semibold
                            !text-secondary
                          "
                        >
                          {
                            scan.fullName
                          }
                        </p>

                        <p
                          className="
                            mt-0.5
                            truncate
                            !font-mono
                            !text-[9px]
                            !text-gray-400
                          "
                        >
                          {
                            scan.bookingId
                          }
                        </p>
                      </div>

                      <div
                        className="
                          shrink-0
                          text-right
                        "
                      >
                        <p
                          className="
                            !text-[10px]
                            !font-medium
                            !text-primary
                          "
                        >
                          {
                            formatTime(
                              scan.checkedInAt,
                            )
                          }
                        </p>

                        <p
                          className="
                            mt-0.5
                            !text-[8px]
                            !uppercase
                            !text-gray-400
                          "
                        >
                          {
                            scan.method
                          }
                        </p>
                      </div>
                    </motion.div>
                  ),
                )
              )}
            </div>
          </section>
        </div>
      </div>
    </motion.div>
  );
}

/* ============================================================
   CORNER
============================================================ */

function Corner({
  className,
}: {
  className:
    string;
}) {
  return (
    <span
      className={`
        absolute

        h-7
        w-7

        border-primary

        ${className}
      `}
    />
  );
}

/* ============================================================
   INDICATOR
============================================================ */

function ScannerIndicator({
  status,
}: {
  status:
    | 'idle'
    | 'starting'
    | 'scanning'
    | 'processing'
    | 'error';
}) {
  if (
    status ===
    'starting' ||
    status ===
    'processing'
  ) {
    return (
      <span
        className="
          h-2
          w-2
          animate-pulse
          rounded-full
          bg-amber-400
        "
      />
    );
  }

  if (
    status ===
    'error'
  ) {
    return (
      <span
        className="
          h-2
          w-2
          rounded-full
          bg-red-500
        "
      />
    );
  }

  return (
    <span
      className="
        relative
        flex
        h-2
        w-2
      "
    >
      <span
        className="
          absolute
          inline-flex
          h-full
          w-full
          animate-ping
          rounded-full
          bg-primary
          opacity-50
        "
      />

      <span
        className="
          relative
          inline-flex
          h-2
          w-2
          rounded-full
          bg-primary
        "
      />
    </span>
  );
}

/* ============================================================
   MINI STAT
============================================================ */

function MiniStat({
  label,
  value,
  success = false,
}: {
  label: string;
  value: number;
  success?: boolean;
}) {
  return (
    <div
      className="
        rounded-lg
        bg-gray-50
        px-3
        py-3
      "
    >
      <p
        className="
          !text-[10px]
          !text-gray-400
        "
      >
        {label}
      </p>

      <p
        className={`
          mt-1

          !font-heading
          !text-[18px]
          !font-semibold

          ${
            success
              ? '!text-primary'
              : '!text-secondary'
          }
        `}
      >
        {value}
      </p>
    </div>
  );
}

/* ============================================================
   FORMAT TIME
============================================================ */

function formatTime(
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
    'en-IN',
    {
      hour:
        '2-digit',

      minute:
        '2-digit',
    },
  ).format(
    date,
  );
}

/* ============================================================
   ICONS
============================================================ */

function Spinner() {
  return (
    <span
      className="
        h-4
        w-4
        animate-spin
        rounded-full
        border-2
        border-current/20
        border-t-current
      "
    />
  );
}

function CheckIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.4}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m5 12 4 4L19 6"
      />
    </svg>
  );
}

function CheckSmallIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m5 12 4 4L19 6"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      className="h-5 w-5"
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
        d="M12 11v5M12 8h.01"
      />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      className="h-5 w-5"
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

function CameraIcon() {
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
        d="M4 7h4l1.5-2h5L16 7h4v12H4V7Z"
      />

      <circle
        cx="12"
        cy="13"
        r="3.5"
      />
    </svg>
  );
}

function ManualIcon() {
  return (
    <svg
      className="
        h-4
        w-4
        text-primary
      "
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.9}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 5h16v14H4V5Zm4 4h8M8 13h5"
      />
    </svg>
  );
}

function ScanIcon() {
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
        d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"
      />

      <rect
        x="9"
        y="9"
        width="6"
        height="6"
        rx="1"
      />
    </svg>
  );
}