'use client';

import type {
  FormEvent,
} from 'react';

import {
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

/* ============================================================
   TYPES
============================================================ */

type LiveEvent = {
  id: string;
  eventName: string;
  venue?: string;
  startDate?: string;
  endDate?: string;
};

type AttendanceStats = {
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

  checkedInBy?: string;

  method:
    | 'QR'
    | 'MANUAL';
};

type DashboardResponse = {
  success: boolean;

  events?: LiveEvent[];

  stats?: AttendanceStats;

  recent?: RecentScan[];

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

    attendanceStatus:
      'PRESENT';

    checkedInAt:
      string | null;
  };
};

type ScanMessage = {
  type:
    | 'success'
    | 'warning'
    | 'error';

  title: string;

  message: string;

  bookingId?: string;

  fullName?: string;
};

type ScannerState =
  | 'idle'
  | 'starting'
  | 'scanning'
  | 'processing'
  | 'error';

/* ============================================================
   CONSTANTS
============================================================ */

const EASE = [
  0.16,
  1,
  0.3,
  1,
] as const;

const EMPTY_STATS:
  AttendanceStats = {
  total: 0,
  present: 0,
  remaining: 0,
  percentage: 0,
};

/* ============================================================
   PAGE
============================================================ */

export default function CheckInPage() {
  const videoRef =
    useRef<HTMLVideoElement | null>(
      null,
    );

  const controlsRef =
    useRef<{
      stop: () => void;
    } | null>(
      null,
    );

  const processingRef =
    useRef(false);

  const lastScanRef =
    useRef<{
      text: string;
      time: number;
    } | null>(
      null,
    );

  /* ==========================================================
     EVENT STATE
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
    eventsLoading,
    setEventsLoading,
  ] = useState(true);

  /* ==========================================================
     ATTENDANCE STATE
  ========================================================== */

  const [
    stats,
    setStats,
  ] =
    useState<AttendanceStats>(
      EMPTY_STATS,
    );

  const [
    recent,
    setRecent,
  ] =
    useState<RecentScan[]>(
      [],
    );

  const [
    dashboardLoading,
    setDashboardLoading,
  ] = useState(false);

  /* ==========================================================
     SCANNER STATE
  ========================================================== */

  const [
    scannerState,
    setScannerState,
  ] =
    useState<ScannerState>(
      'idle',
    );

  const [
    scannerText,
    setScannerText,
  ] =
    useState(
      'Select a live event to begin scanning.',
    );

  /* ==========================================================
     MANUAL
  ========================================================== */

  const [
    manualBookingId,
    setManualBookingId,
  ] = useState('');

  const [
    manualLoading,
    setManualLoading,
  ] = useState(false);

  /* ==========================================================
     RESULT
  ========================================================== */

  const [
    scanMessage,
    setScanMessage,
  ] =
    useState<ScanMessage | null>(
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
          // Scanner is already stopped.
        }

        controlsRef.current =
          null;
      }

      const video =
        videoRef.current;

      if (
        video?.srcObject
      ) {
        const stream =
          video.srcObject as MediaStream;

        stream
          .getTracks()
          .forEach(
            (
              track,
            ) =>
              track.stop(),
          );

        video.srcObject =
          null;
      }
    }, []);

  /* ==========================================================
     LOAD LIVE EVENTS
  ========================================================== */

  const loadLiveEvents =
    useCallback(
      async () => {
        setEventsLoading(
          true,
        );

        try {
          const response =
            await fetch(
              '/api/admin/attendance',
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
                'Unable to load live events.',
            );
          }

          const nextEvents =
            data.events ??
            [];

          setEvents(
            nextEvents,
          );

          setSelectedEventId(
            (
              current,
            ) => {
              if (
                current &&
                nextEvents.some(
                  (
                    event,
                  ) =>
                    event.id ===
                    current,
                )
              ) {
                return current;
              }

              return (
                nextEvents[0]
                  ?.id ??
                ''
              );
            },
          );
        } catch (error) {
          console.error(
            'Live events error:',
            error,
          );

          setScanMessage({
            type:
              'error',

            title:
              'Unable to load events',

            message:
              error instanceof
                Error
                ? error.message
                : 'Unable to load live events.',
          });
        } finally {
          setEventsLoading(
            false,
          );
        }
      },
      [],
    );

  /* ==========================================================
     LOAD EVENT ATTENDANCE
  ========================================================== */

  const loadAttendance =
    useCallback(
      async (
        eventId: string,
        quiet = false,
      ) => {
        if (!eventId) {
          setStats(
            EMPTY_STATS,
          );

          setRecent(
            [],
          );

          return;
        }

        if (!quiet) {
          setDashboardLoading(
            true,
          );
        }

        try {
          const response =
            await fetch(
              `/api/admin/attendance?eventId=${encodeURIComponent(
                eventId,
              )}`,
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
                'Unable to load attendance.',
            );
          }

          setStats(
            data.stats ??
              EMPTY_STATS,
          );

          setRecent(
            data.recent ??
              [],
          );

          if (
            data.events
          ) {
            setEvents(
              data.events,
            );
          }
        } catch (error) {
          console.error(
            'Attendance error:',
            error,
          );

          if (!quiet) {
            setScanMessage({
              type:
                'error',

              title:
                'Attendance unavailable',

              message:
                error instanceof
                  Error
                  ? error.message
                  : 'Unable to load attendance.',
            });
          }
        } finally {
          if (!quiet) {
            setDashboardLoading(
              false,
            );
          }
        }
      },
      [],
    );

  /* ==========================================================
     INITIAL EVENTS
  ========================================================== */

  useEffect(() => {
    const timer =
      window.setTimeout(() => {
        void loadLiveEvents();
      }, 0);

    return () => {
      window.clearTimeout(
        timer,
      );
    };
  }, [
    loadLiveEvents,
  ]);

  /* ==========================================================
     ATTENDANCE POLLING
  ========================================================== */

  useEffect(() => {
    if (
      !selectedEventId
    ) {
      const timer =
        window.setTimeout(() => {
          setStats(
            EMPTY_STATS,
          );

          setRecent(
            [],
          );
        }, 0);

      return () => {
        window.clearTimeout(
          timer,
        );
      };
    }

    const initialLoadId =
      window.setTimeout(() => {
        void loadAttendance(
          selectedEventId,
        );
      }, 0);

    const interval =
      window.setInterval(
        () => {
          void loadAttendance(
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
    loadAttendance,
  ]);

  /* ==========================================================
     CHECK IN REQUEST
  ========================================================== */

  const checkIn =
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
          throw new Error(
            'Select a live event before checking in an attendee.',
          );
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
          setScanMessage({
            type:
              'warning',

            title:
              'Already checked in',

            message:
              'Attendance for this booking has already been recorded.',

            bookingId:
              data.booking
                ?.bookingId,

            fullName:
              data.booking
                ?.fullName,
          });
        } else {
          setScanMessage({
            type:
              'success',

            title:
              'Marked Present',

            message:
              'Ticket verified and attendance recorded successfully.',

            bookingId:
              data.booking
                ?.bookingId,

            fullName:
              data.booking
                ?.fullName,
          });
        }

        await loadAttendance(
          selectedEventId,
          true,
        );

        if (
          'vibrate' in
          navigator
        ) {
          navigator.vibrate(
            data.alreadyPresent
              ? 50
              : [
                  60,
                  40,
                  100,
                ],
          );
        }

        return data;
      },
      [
        selectedEventId,
        loadAttendance,
      ],
    );

  /* ==========================================================
     QR PROCESSING
  ========================================================== */

  const processQr =
    useCallback(
      async (
        text: string,
      ) => {
        if (
          !text ||
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
          previous.text ===
            text &&
          now -
            previous.time <
            3500
        ) {
          return;
        }

        lastScanRef.current =
          {
            text,
            time:
              now,
          };

        processingRef.current =
          true;

        setScannerState(
          'processing',
        );

        setScannerText(
          'Verifying ticket...',
        );

        try {
          await checkIn({
            code:
              text,

            method:
              'QR',
          });

          setScannerState(
            'scanning',
          );

          setScannerText(
            'Ready for the next ticket',
          );
        } catch (error) {
          setScanMessage({
            type:
              'error',

            title:
              'Ticket not accepted',

            message:
              error instanceof
                Error
                ? error.message
                : 'Unable to verify ticket.',
          });

          setScannerState(
            'scanning',
          );

          setScannerText(
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
        checkIn,
      ],
    );

  /* ==========================================================
     START CAMERA
  ========================================================== */

  const startCamera =
    useCallback(
      async () => {
        if (
          !selectedEventId
        ) {
          const timer =
            window.setTimeout(() => {
              setScannerState(
                'idle',
              );

              setScannerText(
                'Select a live event to begin scanning.',
              );
            }, 0);

          return () => {
            window.clearTimeout(
              timer,
            );

            stopCamera();
          };
        }

        if (
          !videoRef.current
        ) {
          return;
        }

        stopCamera();

        setScannerState(
          'starting',
        );

        setScannerText(
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
                result,
              ) => {
                if (
                  result
                ) {
                  void processQr(
                    result.getText(),
                  );
                }
              },
            );

          controlsRef.current =
            controls;

          setScannerState(
            'scanning',
          );

          setScannerText(
            'Align QR code inside the frame',
          );
        } catch (error) {
          console.error(
            'Camera error:',
            error,
          );

          setScannerState(
            'error',
          );

          setScannerText(
            'Camera access is unavailable. Allow camera permission or use manual check-in.',
          );
        }
      },
      [
        selectedEventId,
        processQr,
        stopCamera,
      ],
    );

  /* ==========================================================
     START / RESTART CAMERA ON EVENT CHANGE
  ========================================================== */

  useEffect(() => {
    stopCamera();

    if (
      !selectedEventId
    ) {
      const timer =
        window.setTimeout(() => {
          setScannerState(
            'idle',
          );

          setScannerText(
            'Select a live event to begin scanning.',
          );
        }, 0);

      return () => {
        window.clearTimeout(
          timer,
        );
        stopCamera();
      };
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

  async function handleManualCheckIn(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const value =
      manualBookingId.trim();

    if (!value) {
      setScanMessage({
        type:
          'error',

        title:
          'Registration ID required',

        message:
          'Enter a valid Booking ID or MongoDB booking ID.',
      });

      return;
    }

    setManualLoading(
      true,
    );

    try {
      await checkIn({
        bookingId:
          value,

        method:
          'MANUAL',
      });

      setManualBookingId(
        '',
      );
    } catch (error) {
      setScanMessage({
        type:
          'error',

        title:
          'Check-in failed',

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
     EVENT
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
          0.35,

        ease:
          EASE,
      }}
      className="
        w-full
        min-w-0
        pb-4
      "
    >
      {/* ======================================================
          PAGE HEADER
      ====================================================== */}

      <div
        className="
          flex
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
                lg:text-[27px]
              "
            >
              Check-in Scanner
            </h1>

            {events.length >
              0 && (
              <span
                className="
                  badge
                  badge--success
                "
              >
                Live
              </span>
            )}
          </div>

          <p
            className="
              mt-1

              max-w-[680px]

              text-[12px]
              leading-5

              text-gray-500

              sm:text-[13px]
            "
          >
            Select a live event,
            scan the attendee pass
            and mark attendance
            instantly.
          </p>
        </div>

        <button
          type="button"
          disabled={
            eventsLoading
          }
          onClick={() =>
            void loadLiveEvents()
          }
          className="
            btn
            btn-secondary

            h-10

            self-start
          "
        >
          <RefreshIcon
            spinning={
              eventsLoading
            }
          />

          Refresh
        </button>
      </div>

      {/* ======================================================
          EVENT SELECTOR
      ====================================================== */}

      <section
        className="
          mt-5

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
            flex-col
            gap-3

            md:flex-row
            md:items-end
          "
        >
          <div
            className="
              min-w-0
              flex-1
            "
          >
            <label
              htmlFor="live-event"
              className="form-label"
            >
              Live Event
            </label>

            {eventsLoading ? (
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
                id="live-event"
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

                  setScanMessage(
                    null,
                  );
                }}
                className="form-select"
              >
                {events.length ===
                  0 && (
                  <option value="">
                    No live events available
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
          </div>

          {selectedEvent && (
            <div
              className="
                grid
                grid-cols-2
                gap-2

                md:w-[360px]
              "
            >
              <EventMeta
                label="Venue"
                value={
                  selectedEvent.venue ||
                  'Not specified'
                }
              />

              <EventMeta
                label="Status"
                value="Live now"
                active
              />
            </div>
          )}
        </div>
      </section>

      {/* ======================================================
          MOBILE SUCCESS / ERROR
      ====================================================== */}

      <AnimatePresence
        mode="wait"
      >
        {scanMessage && (
          <ScanResult
            value={
              scanMessage
            }
            onClose={() =>
              setScanMessage(
                null,
              )
            }
          />
        )}
      </AnimatePresence>

      {/* ======================================================
          CONTENT GRID
      ====================================================== */}

      <div
        className="
          mt-5

          grid
          grid-cols-1
          gap-5

          xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.65fr)]
        "
      >
        {/* ====================================================
            LEFT
        ==================================================== */}

        <div
          className="
            min-w-0
            space-y-5
          "
        >
          {/* ==================================================
              SCANNER CARD
          ================================================== */}

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
                flex
                flex-col
                gap-3

                border-b
                border-gray-100

                px-4
                py-3.5

                sm:flex-row
                sm:items-center
                sm:justify-between

                sm:px-5
              "
            >
              <div>
                <h2
                  className="
                    text-[14px]
                    font-semibold
                    text-secondary

                    sm:text-[15px]
                  "
                >
                  Scan Pass / QR Code
                </h2>

                <p
                  className="
                    mt-0.5
                    text-[11px]
                    text-gray-500
                  "
                >
                  Keep the QR code
                  inside the scanning
                  frame.
                </p>
              </div>

              <button
                type="button"
                disabled={
                  !selectedEventId ||
                  scannerState ===
                    'starting'
                }
                onClick={() =>
                  void startCamera()
                }
                className="
                  btn

                  h-9

                  border-gray-200

                  bg-white

                  text-secondary

                  hover:bg-gray-50
                "
              >
                <CameraIcon />

                {scannerState ===
                'scanning'
                  ? 'Restart Camera'
                  : 'Start Camera'}
              </button>
            </div>

            <div
              className="
                p-3

                sm:p-4
                lg:p-5
              "
            >
              {/* ==============================================
                  CAMERA AREA
              ============================================== */}

              <div
                className="
                  relative

                  aspect-[4/3]

                  w-full

                  overflow-hidden

                  rounded-xl

                  border-2
                  border-dashed
                  border-primary/75

                  bg-[#F6FBFA]

                  sm:aspect-[16/10]

                  xl:aspect-[16/9]
                "
              >
                <video
                  ref={
                    videoRef
                  }
                  autoPlay
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

                {/* CAMERA PLACEHOLDER */}

                {(scannerState ===
                  'idle' ||
                  scannerState ===
                    'error') && (
                  <div
                    className="
                      absolute
                      inset-0

                      z-10

                      grid
                      place-items-center

                      bg-[#F6FBFA]

                      px-5

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
                          h-16
                          w-16

                          place-items-center

                          rounded-2xl

                          border
                          border-primary/20

                          bg-white

                          text-primary

                          shadow-sm
                        "
                      >
                        <QrFrameIcon />
                      </div>

                      <p
                        className="
                          mt-4

                          text-[13px]
                          font-semibold

                          text-secondary
                        "
                      >
                        {scannerState ===
                        'error'
                          ? 'Camera unavailable'
                          : selectedEventId
                            ? 'Camera ready'
                            : 'Select an event first'}
                      </p>

                      <p
                        className="
                          mt-1

                          text-[11px]
                          leading-5

                          text-gray-500
                        "
                      >
                        {
                          scannerText
                        }
                      </p>

                      {selectedEventId && (
                        <button
                          type="button"
                          onClick={() =>
                            void startCamera()
                          }
                          className="
                            btn
                            btn-primary

                            mt-4
                          "
                        >
                          <CameraIcon />

                          Open Camera
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* CAMERA SHADE */}

                {scannerState !==
                  'idle' &&
                  scannerState !==
                    'error' && (
                    <div
                      className="
                        pointer-events-none

                        absolute
                        inset-0

                        bg-gradient-to-b
                        from-black/[0.04]
                        via-transparent
                        to-black/[0.10]
                      "
                    />
                  )}

                {/* SCAN FRAME */}

                {(scannerState ===
                  'scanning' ||
                  scannerState ===
                    'processing' ||
                  scannerState ===
                    'starting') && (
                  <div
                    className="
                      pointer-events-none

                      absolute
                      left-1/2
                      top-1/2

                      h-[180px]
                      w-[180px]

                      -translate-x-1/2
                      -translate-y-1/2

                      min-[390px]:h-[210px]
                      min-[390px]:w-[210px]

                      sm:h-[240px]
                      sm:w-[240px]

                      lg:h-[260px]
                      lg:w-[260px]
                    "
                  >
                    <ScanCorner
                      className="
                        left-0
                        top-0

                        border-l-[3px]
                        border-t-[3px]
                      "
                    />

                    <ScanCorner
                      className="
                        right-0
                        top-0

                        border-r-[3px]
                        border-t-[3px]
                      "
                    />

                    <ScanCorner
                      className="
                        bottom-0
                        left-0

                        border-b-[3px]
                        border-l-[3px]
                      "
                    />

                    <ScanCorner
                      className="
                        bottom-0
                        right-0

                        border-b-[3px]
                        border-r-[3px]
                      "
                    />

                    {scannerState ===
                      'scanning' && (
                      <motion.div
                        initial={{
                          top:
                            '8%',
                        }}
                        animate={{
                          top:
                            '90%',
                        }}
                        transition={{
                          duration:
                            1.8,

                          repeat:
                            Infinity,

                          repeatType:
                            'reverse',

                          ease:
                            'linear',
                        }}
                        className="
                          absolute

                          left-3
                          right-3

                          h-[2px]

                          rounded-full

                          bg-primary

                          shadow-[0_0_14px_rgba(26,158,143,0.8)]
                        "
                      />
                    )}
                  </div>
                )}

                {/* PROCESSING */}

                {scannerState ===
                  'processing' && (
                  <div
                    className="
                      absolute
                      inset-0

                      z-30

                      grid
                      place-items-center

                      bg-white/60

                      backdrop-blur-[2px]
                    "
                  >
                    <div
                      className="
                        flex
                        items-center
                        gap-3

                        rounded-xl

                        border
                        border-gray-200

                        bg-white

                        px-4
                        py-3

                        shadow-md
                      "
                    >
                      <Spinner />

                      <div>
                        <p
                          className="
                            text-[12px]
                            font-semibold
                            text-secondary
                          "
                        >
                          Verifying ticket
                        </p>

                        <p
                          className="
                            mt-0.5
                            text-[10px]
                            text-gray-500
                          "
                        >
                          Please keep the
                          pass steady
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* STATUS */}

                {scannerState !==
                  'idle' &&
                  scannerState !==
                    'error' && (
                    <div
                      className="
                        pointer-events-none

                        absolute
                        inset-x-3
                        bottom-3

                        z-20

                        flex
                        justify-center

                        sm:inset-x-4
                        sm:bottom-4
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
                          border-white/70

                          bg-white/92

                          px-3
                          py-2

                          shadow-sm

                          backdrop-blur-xl
                        "
                      >
                        <ScannerDot
                          state={
                            scannerState
                          }
                        />

                        <span
                          className="
                            truncate

                            text-[10px]
                            font-medium

                            text-secondary

                            sm:text-[11px]
                          "
                        >
                          {
                            scannerText
                          }
                        </span>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          </section>

          {/* ==================================================
              MANUAL OVERRIDE
          ================================================== */}

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
                <KeyboardIcon />
              </span>

              <div>
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

                <p
                  className="
                    mt-0.5
                    text-[11px]
                    leading-4
                    text-gray-500
                  "
                >
                  Use the Booking ID
                  when the QR code
                  cannot be scanned.
                </p>
              </div>
            </div>

            <form
              onSubmit={
                handleManualCheckIn
              }
              className="
                mt-4

                flex
                flex-col
                gap-2.5

                sm:flex-row
              "
            >
              <div
                className="
                  min-w-0
                  flex-1
                "
              >
                <label
                  htmlFor="manual-id"
                  className="sr-only"
                >
                  Booking ID
                </label>

                <input
                  id="manual-id"
                  value={
                    manualBookingId
                  }
                  onChange={(
                    event,
                  ) =>
                    setManualBookingId(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Enter Booking ID, e.g. SSI-MC-2026-04786"
                  className="form-input"
                />
              </div>

              <button
                type="submit"
                disabled={
                  manualLoading ||
                  !selectedEventId ||
                  !manualBookingId.trim()
                }
                className="
                  btn
                  btn-primary

                  min-h-[41px]

                  sm:min-w-[130px]
                "
              >
                {manualLoading ? (
                  <>
                    <Spinner />

                    Checking
                  </>
                ) : (
                  <>
                    <CheckSmallIcon />

                    Check In
                  </>
                )}
              </button>
            </form>
          </section>
        </div>

        {/* ====================================================
            RIGHT
        ==================================================== */}

        <div
          className="
            min-w-0
            space-y-5
          "
        >
          {/* ==================================================
              PROGRESS
          ================================================== */}

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
                justify-between
                gap-3
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
                  Attendance Progress
                </h2>

                <p
                  className="
                    mt-0.5
                    text-[11px]
                    text-gray-500
                  "
                >
                  Current live event
                </p>
              </div>

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
                <ProgressIcon />
              </span>
            </div>

            {dashboardLoading ? (
              <ProgressSkeleton />
            ) : (
              <>
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
                        text-[11px]
                        font-medium
                        text-gray-500
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

                          text-[30px]
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
                        /{' '}
                        {
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
                        text-[10px]
                        text-gray-400
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

                    border
                    border-gray-100

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
                        0.5,

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
                    gap-2.5
                  "
                >
                  <ProgressStat
                    label="Present"
                    value={
                      stats.present
                    }
                    positive
                  />

                  <ProgressStat
                    label="Remaining"
                    value={
                      stats.remaining
                    }
                  />
                </div>
              </>
            )}
          </section>

          {/* ==================================================
              RECENT SCANS
          ================================================== */}

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
                flex
                items-center
                justify-between
                gap-3

                border-b
                border-gray-100

                px-4
                py-3.5

                sm:px-5
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
                  Recent Check-ins
                </h2>

                <p
                  className="
                    mt-0.5
                    text-[11px]
                    text-gray-500
                  "
                >
                  Latest verified
                  tickets
                </p>
              </div>

              {recent.length >
                0 && (
                <span
                  className="
                    badge
                    badge--success
                  "
                >
                  {
                    recent.length
                  }
                </span>
              )}
            </div>

            {dashboardLoading ? (
              <RecentSkeleton />
            ) : recent.length ===
              0 ? (
              <div
                className="
                  px-5
                  py-10

                  text-center
                "
              >
                <span
                  className="
                    mx-auto

                    grid
                    h-11
                    w-11
                    place-items-center

                    rounded-lg

                    bg-gray-100

                    text-gray-400
                  "
                >
                  <QrSmallIcon />
                </span>

                <p
                  className="
                    mt-3

                    text-[12px]
                    font-medium

                    text-secondary
                  "
                >
                  No check-ins yet
                </p>

                <p
                  className="
                    mt-1
                    text-[11px]
                    text-gray-500
                  "
                >
                  Scanned attendees
                  will appear here.
                </p>
              </div>
            ) : (
              <div>
                {recent.map(
                  (
                    item,
                    index,
                  ) => (
                    <motion.div
                      key={
                        `${item.id}-${item.checkedInAt}`
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

                            text-[12px]
                            font-semibold

                            text-secondary
                          "
                        >
                          {
                            item.fullName
                          }
                        </p>

                        <p
                          className="
                            mt-0.5

                            truncate

                            font-mono

                            text-[9px]
                            text-gray-400
                          "
                        >
                          {
                            item.bookingId
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
                            text-[10px]
                            font-semibold
                            text-primary
                          "
                        >
                          {
                            formatTime(
                              item.checkedInAt,
                            )
                          }
                        </p>

                        <p
                          className="
                            mt-0.5

                            text-[8px]
                            font-medium

                            uppercase

                            tracking-[0.04em]

                            text-gray-400
                          "
                        >
                          {
                            item.method
                          }
                        </p>
                      </div>
                    </motion.div>
                  ),
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </motion.div>
  );
}

/* ============================================================
   SCAN RESULT
============================================================ */

function ScanResult({
  value,
  onClose,
}: {
  value: ScanMessage;

  onClose: () => void;
}) {
  const success =
    value.type ===
    'success';

  const warning =
    value.type ===
    'warning';

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: -6,
        scale: 0.99,
      }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
      }}
      exit={{
        opacity: 0,
        y: -4,
      }}
      transition={{
        duration:
          0.25,

        ease:
          EASE,
      }}
      className={`
        mt-4

        overflow-hidden

        rounded-xl

        border

        ${
          success
            ? `
                border-emerald-300
                bg-emerald-50
              `
            : warning
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
      {success && (
        <motion.div
          initial={{
            scaleX:
              0,
          }}
          animate={{
            scaleX:
              1,
          }}
          transition={{
            duration:
              0.6,

            ease:
              EASE,
          }}
          className="
            h-[3px]
            origin-left
            bg-emerald-500
          "
        />
      )}

      <div
        className="
          flex
          items-start
          gap-3

          px-4
          py-3.5
        "
      >
        <motion.span
          initial={{
            scale:
              0.7,
          }}
          animate={{
            scale:
              1,
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
              success
                ? `
                    bg-emerald-200/70
                    text-emerald-700
                  `
                : warning
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
          {success ? (
            <CheckLargeIcon />
          ) : warning ? (
            <InfoIcon />
          ) : (
            <AlertIcon />
          )}
        </motion.span>

        <div
          className="
            min-w-0
            flex-1
          "
        >
          <p
            className={`
              text-[13px]
              font-semibold

              ${
                success
                  ? 'text-emerald-800'
                  : warning
                    ? 'text-amber-800'
                    : 'text-red-700'
              }
            `}
          >
            {value.fullName &&
            success
              ? `${value.title}: ${value.fullName}`
              : value.title}
          </p>

          <p
            className="
              mt-0.5

              text-[11px]
              leading-4

              text-gray-600
            "
          >
            {
              value.message
            }
          </p>

          {value.bookingId && (
            <p
              className="
                mt-1

                font-mono

                text-[10px]
                text-gray-500
              "
            >
              ID:{' '}
              {
                value.bookingId
              }
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={
            onClose
          }
          aria-label="Dismiss notification"
          className="
            grid
            h-8
            w-8
            shrink-0
            cursor-pointer
            place-items-center

            rounded-lg

            text-gray-400

            transition-colors

            hover:bg-white/60
            hover:text-secondary
          "
        >
          <CloseIcon />
        </button>
      </div>
    </motion.div>
  );
}

/* ============================================================
   EVENT META
============================================================ */

function EventMeta({
  label,
  value,
  active = false,
}: {
  label: string;
  value: string;
  active?: boolean;
}) {
  return (
    <div
      className="
        rounded-lg

        border
        border-gray-100

        bg-gray-50

        px-3
        py-2
      "
    >
      <p
        className="
          text-[9px]
          font-medium
          text-gray-400
        "
      >
        {label}
      </p>

      <div
        className="
          mt-0.5

          flex
          items-center
          gap-1.5
        "
      >
        {active && (
          <span
            className="
              h-1.5
              w-1.5
              rounded-full
              bg-emerald-500
            "
          />
        )}

        <p
          className={`
            truncate

            text-[11px]
            font-semibold

            ${
              active
                ? 'text-emerald-700'
                : 'text-secondary'
            }
          `}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

/* ============================================================
   SCAN CORNER
============================================================ */

function ScanCorner({
  className,
}: {
  className: string;
}) {
  return (
    <span
      className={`
        absolute

        h-8
        w-8

        rounded-[4px]

        border-primary

        ${className}
      `}
    />
  );
}

/* ============================================================
   SCANNER DOT
============================================================ */

function ScannerDot({
  state,
}: {
  state:
    ScannerState;
}) {
  if (
    state ===
    'processing' ||
    state ===
    'starting'
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

          opacity-40
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
   PROGRESS STAT
============================================================ */

function ProgressStat({
  label,
  value,
  positive = false,
}: {
  label: string;
  value: number;
  positive?: boolean;
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
          text-[10px]
          text-gray-400
        "
      >
        {label}
      </p>

      <p
        className={`
          mt-1

          font-heading

          text-[18px]
          font-semibold

          ${
            positive
              ? 'text-primary'
              : 'text-secondary'
          }
        `}
      >
        {value}
      </p>
    </div>
  );
}

/* ============================================================
   SKELETON
============================================================ */

function ProgressSkeleton() {
  return (
    <div
      className="
        mt-5
        animate-pulse
      "
    >
      <div
        className="
          flex
          items-end
          justify-between
        "
      >
        <div>
          <div
            className="
              h-3
              w-28
              rounded
              bg-gray-100
            "
          />

          <div
            className="
              mt-2
              h-8
              w-20
              rounded
              bg-gray-100
            "
          />
        </div>

        <div
          className="
            h-6
            w-14
            rounded
            bg-gray-100
          "
        />
      </div>

      <div
        className="
          mt-4
          h-2
          rounded-full
          bg-gray-100
        "
      />

      <div
        className="
          mt-4
          grid
          grid-cols-2
          gap-3
        "
      >
        <div
          className="
            h-16
            rounded-lg
            bg-gray-100
          "
        />

        <div
          className="
            h-16
            rounded-lg
            bg-gray-100
          "
        />
      </div>
    </div>
  );
}

function RecentSkeleton() {
  return (
    <div
      className="
        divide-y
        divide-gray-100
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
              flex
              animate-pulse
              items-center
              gap-3

              px-5
              py-3
            "
          >
            <div
              className="
                h-8
                w-8
                rounded-full
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
                  h-3
                  w-28
                  rounded
                  bg-gray-100
                "
              />

              <div
                className="
                  mt-2
                  h-2.5
                  w-20
                  rounded
                  bg-gray-100
                "
              />
            </div>

            <div
              className="
                h-3
                w-12
                rounded
                bg-gray-100
              "
            />
          </div>
        ),
      )}
    </div>
  );
}

/* ============================================================
   FORMAT
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

      hour12:
        true,
    },
  ).format(
    date,
  );
}

/* ============================================================
   ICONS
============================================================ */

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
        d="M20 11a8 8 0 1 0-2.35 5.65M20 4v7h-7"
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

function QrFrameIcon() {
  return (
    <svg
      className="h-8 w-8"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.7}
    >
      <path
        d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"
        strokeLinecap="round"
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

function KeyboardIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.9}
    >
      <rect
        x="3"
        y="6"
        width="18"
        height="12"
        rx="2"
      />

      <path
        strokeLinecap="round"
        d="M7 10h.01M10 10h.01M13 10h.01M16 10h.01M7 13h.01M10 13h.01M13 13h.01M16 13h.01M8 16h8"
      />
    </svg>
  );
}

function ProgressIcon() {
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
        d="M5 19V11M12 19V5M19 19v-8"
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

function CheckLargeIcon() {
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

function QrSmallIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <rect
        x="4"
        y="4"
        width="6"
        height="6"
        rx="1"
      />

      <rect
        x="14"
        y="4"
        width="6"
        height="6"
        rx="1"
      />

      <rect
        x="4"
        y="14"
        width="6"
        height="6"
        rx="1"
      />

      <path
        strokeLinecap="round"
        d="M15 15h2v2h-2v3M19 14v2M19 19v1M14 19h2"
      />
    </svg>
  );
}

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