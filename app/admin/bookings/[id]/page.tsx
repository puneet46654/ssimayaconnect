'use client';

import type {
  ReactNode,
} from 'react';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useParams,
  useRouter,
  useSearchParams,
} from 'next/navigation';

import {
  AnimatePresence,
  motion,
} from 'framer-motion';

/* ============================================================
   TYPES
============================================================ */

type GenericRecord =
  Record<
    string,
    unknown
  >;

type AttendanceStatus =
  | 'NOT_PRESENT'
  | 'PRESENT';

type FeedbackStatus =
  | 'SUBMITTED'
  | 'SKIPPED'
  | 'NONE';

type BookingFeedback = {
  status:
    FeedbackStatus;

  rating:
    number | null;

  message:
    string;

  suggestedFeature:
    string;

  submittedAt:
    string | null;
};

type BookingData = {
  _id: string;

  bookingId: string;

  details:
    GenericRecord;

  eventId:
    GenericRecord | null;

  slotId:
    GenericRecord | null;

  dayScheduleId:
    GenericRecord | null;

  attendanceStatus?:
    AttendanceStatus;

  checkedInAt?:
    string | null;

  checkedInBy?:
    string;

  checkInMethod?:
    'QR' | 'MANUAL';

  createdAt:
    string;

  updatedAt:
    string;
};

type BookingResponse = {
  success:
    boolean;

  booking?:
    BookingData;

  feedback?:
    BookingFeedback;

  message?:
    string;
};

/* ============================================================
   CONSTANTS
============================================================ */

const EASE = [
  0.16,
  1,
  0.3,
  1,
] as const;

const FIELD_PRIORITY = [
  'title',
  'fullName',
  'email',
  'mobile',
  'designation',
  'specialty',
  'hospital',
  'hospitalName',
  'institution',
  'institutionName',
  'country',
  'state',
  'city',
  'location',
];

const HIDDEN_DETAIL_KEYS =
  new Set([
    'eventId',
    'eventName',
    'template',
    'countryCode',
    'phoneCountry',
    'countryIso2',
  ]);

const PROFILE_DETAIL_KEYS =
  new Set([
    'fullName',
    'email',
    'mobile',
  ]);

const EMPTY_FEEDBACK:
  BookingFeedback = {
  status:
    'NONE',

  rating:
    null,

  message:
    '',

  suggestedFeature:
    '',

  submittedAt:
    null,
};

/* ============================================================
   PAGE
============================================================ */

export default function BookingDetailsPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const router =
    useRouter();

  const searchParams =
    useSearchParams();

  const id =
    params.id;

  const isEditing =
    searchParams.get(
      'mode',
    ) ===
    'edit';

  const [
    booking,
    setBooking,
  ] =
    useState<BookingData | null>(
      null,
    );

  const [
    feedback,
    setFeedback,
  ] =
    useState<BookingFeedback>(
      EMPTY_FEEDBACK,
    );

  const [
    draft,
    setDraft,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    deleting,
    setDeleting,
  ] =
    useState(false);

  const [
    deleteOpen,
    setDeleteOpen,
  ] =
    useState(false);

  const [
    success,
    setSuccess,
  ] =
    useState('');

  const [
    error,
    setError,
  ] =
    useState('');

  /* ============================================================
     LOAD
  ============================================================ */

  useEffect(() => {
    const controller =
      new AbortController();

    async function load() {
      setLoading(
        true,
      );

      setError('');

      try {
        const response =
          await fetch(
            `/api/admin/bookings/${id}`,
            {
              credentials:
                'include',

              cache:
                'no-store',

              signal:
                controller.signal,
            },
          );

        const data =
          (await response.json()) as BookingResponse;

        if (
          !response.ok ||
          !data.success ||
          !data.booking
        ) {
          throw new Error(
            data.message ||
              'Unable to load booking.',
          );
        }

        setBooking(
          data.booking,
        );

        setFeedback(
          data.feedback ||
            EMPTY_FEEDBACK,
        );

        setDraft(
          normalizeDetails(
            data.booking
              .details,
          ),
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

        setError(
          err instanceof
            Error
            ? err.message
            : 'Unable to load booking.',
        );
      } finally {
        if (
          !controller.signal
            .aborted
        ) {
          setLoading(
            false,
          );
        }
      }
    }

    void load();

    return () => {
      controller.abort();
    };
  }, [
    id,
  ]);

  /* ============================================================
     VALUES
  ============================================================ */

  const originalDraft =
    useMemo(
      () =>
        normalizeDetails(
          booking?.details ??
            {},
        ),
      [
        booking,
      ],
    );

  const hasChanges =
    useMemo(
      () =>
        JSON.stringify(
          draft,
        ) !==
        JSON.stringify(
          originalDraft,
        ),
      [
        draft,
        originalDraft,
      ],
    );

  const detailEntries =
    useMemo(() => {
      if (!booking) {
        return [];
      }

      return sortDetails(
        Object.entries(
          booking.details ??
            {},
        ),
      ).filter(
        ([
          key,
          value,
        ]) => {
          /*
           * Hide technical values.
           */
          if (
            HIDDEN_DETAIL_KEYS.has(
              key,
            )
          ) {
            return false;
          }

          /*
           * Name / email / mobile are already
           * shown in the top attendee header.
           *
           * When editing we show them again
           * because they need input controls.
           */
          if (
            !isEditing &&
            PROFILE_DETAIL_KEYS.has(
              key,
            )
          ) {
            return false;
          }

          if (isEditing) {
            return true;
          }

          return (
            displayValue(
              value,
            ) !==
            '—'
          );
        },
      );
    }, [
      booking,
      isEditing,
    ]);

  /* ============================================================
     SAVE
  ============================================================ */

  async function saveChanges() {
    if (
      !booking ||
      saving ||
      !hasChanges
    ) {
      return;
    }

    const fullName =
      draft.fullName
        ?.trim();

    const email =
      draft.email
        ?.trim();

    const mobile =
      draft.mobile
        ?.trim();

    if (!fullName) {
      setError(
        'Full name is required.',
      );

      return;
    }

    if (!email) {
      setError(
        'Email address is required.',
      );

      return;
    }

    if (!mobile) {
      setError(
        'Mobile number is required.',
      );

      return;
    }

    setSaving(
      true,
    );

    setError('');
    setSuccess('');

    try {
      const response =
        await fetch(
          `/api/admin/bookings/${id}`,
          {
            method:
              'PATCH',

            credentials:
              'include',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                details:
                  draft,
              }),
          },
        );

      const data =
        (await response.json()) as BookingResponse;

      if (
        !response.ok ||
        !data.success ||
        !data.booking
      ) {
        throw new Error(
          data.message ||
            'Unable to update booking.',
        );
      }

      setBooking(
        data.booking,
      );

      setFeedback(
        data.feedback ||
          EMPTY_FEEDBACK,
      );

      setDraft(
        normalizeDetails(
          data.booking
            .details,
        ),
      );

      setSuccess(
        'Booking updated successfully.',
      );

      router.replace(
        `/admin/bookings/${id}`,
      );
    } catch (err) {
      setError(
        err instanceof
          Error
          ? err.message
          : 'Unable to update booking.',
      );
    } finally {
      setSaving(
        false,
      );
    }
  }

  /* ============================================================
     DELETE
  ============================================================ */

  async function deleteBooking() {
    if (
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
          `/api/admin/bookings/${id}`,
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

      router.replace(
        '/admin/bookings',
      );
    } catch (err) {
      setDeleteOpen(
        false,
      );

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

  /* ============================================================
     EDIT
  ============================================================ */

  function changeField(
    key: string,
    value: string,
  ) {
    setDraft(
      (
        current,
      ) => ({
        ...current,

        [key]:
          value,
      }),
    );
  }

  function cancelEdit() {
    if (!booking) {
      return;
    }

    setDraft(
      normalizeDetails(
        booking.details,
      ),
    );

    setError('');
    setSuccess('');

    router.replace(
      `/admin/bookings/${id}`,
    );
  }

  /* ============================================================
     LOADING
  ============================================================ */

  if (loading) {
    return (
      <BookingDetailSkeleton />
    );
  }

  /* ============================================================
     ERROR
  ============================================================ */

  if (!booking) {
    return (
      <div
        className="
          flex
          min-h-[58vh]
          items-center
          justify-center
          px-4
        "
      >
        <div
          className="
            w-full
            max-w-[420px]

            rounded-xl

            border
            border-gray-200

            bg-white

            p-6

            text-center

            shadow-sm
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

              bg-red-50

              text-red-500
            "
          >
            <AlertIcon />
          </span>

          <h1
            className="
              mt-4

              text-[17px]
              font-semibold

              text-secondary
            "
          >
            Booking unavailable
          </h1>

          <p
            className="
              mt-2

              text-[13px]
              leading-5

              text-gray-500
            "
          >
            {error ||
              'The booking could not be found.'}
          </p>

          <button
            type="button"
            onClick={() =>
              router.push(
                '/admin/bookings',
              )
            }
            className="
              mt-5

              inline-flex
              h-10

              items-center
              justify-center

              rounded-lg

              bg-primary

              px-4

              text-[12px]
              font-semibold

              text-white

              transition

              hover:bg-primary-dark
            "
          >
            Back to Bookings
          </button>
        </div>
      </div>
    );
  }

  /* ============================================================
     DATA
  ============================================================ */

  const event =
    booking.eventId ??
    {};

  const slot =
    booking.slotId ??
    {};

  const schedule =
    booking.dayScheduleId ??
    {};

  const attendeeName =
    displayValue(
      booking.details
        .fullName,
    );

  const attendeeEmail =
    displayValue(
      booking.details
        .email,
    );

  const attendeeMobile =
    displayMobile(
      booking.details,
    );

  const bookingDate =
    toText(
      schedule.date,
    );

  const attendance =
    booking.attendanceStatus ||
    'NOT_PRESENT';

  /* ============================================================
     RENDER
  ============================================================ */

  return (
    <>
      <motion.div
        initial={{
          opacity: 0,
          y: 5,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        transition={{
          duration: 0.3,
          ease: EASE,
        }}
        className="
          w-full
          min-w-0
        "
      >
        {/* BACK */}

        <button
          type="button"
          onClick={() =>
            router.push(
              '/admin/bookings',
            )
          }
          className="
            inline-flex

            items-center
            gap-1.5

            text-[12px]
            font-medium

            text-gray-500

            transition-colors

            hover:text-secondary
          "
        >
          <BackIcon />

          All Bookings
        </button>

        {/* HEADER */}

        <div
          className="
            mt-3

            flex
            flex-col

            gap-4

            lg:flex-row
            lg:items-start
            lg:justify-between
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
                "
              >
                {isEditing
                  ? 'Edit Booking'
                  : 'Booking Details'}
              </h1>

              <AttendanceBadge
                status={
                  attendance
                }
              />
            </div>

            <div
              className="
                mt-1

                flex
                flex-wrap

                items-center

                gap-x-2
                gap-y-1

                text-[12px]

                text-gray-500
              "
            >
              <span
                className="
                  font-semibold

                  text-secondary
                "
              >
                {booking.bookingId}
              </span>

              <span
                className="
                  text-gray-300
                "
              >
                •
              </span>

              <span>
                Created{' '}
                {formatDate(
                  booking.createdAt,
                )}
              </span>
            </div>
          </div>

          {/* ACTIONS */}

          <div
            className="
              flex
              flex-wrap

              items-center

              gap-2
            "
          >
            {isEditing ? (
              <>
                <button
                  type="button"
                  disabled={
                    saving
                  }
                  onClick={
                    cancelEdit
                  }
                  className="
                    inline-flex
                    h-10

                    items-center
                    justify-center

                    rounded-lg

                    border
                    border-gray-200

                    bg-white

                    px-4

                    text-[12px]
                    font-semibold

                    text-gray-600

                    transition

                    hover:bg-gray-50

                    disabled:opacity-50
                  "
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={
                    saving ||
                    !hasChanges
                  }
                  onClick={
                    saveChanges
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

                    text-[12px]
                    font-semibold

                    text-white

                    transition

                    hover:bg-primary-dark

                    disabled:cursor-not-allowed
                    disabled:opacity-45
                  "
                >
                  {saving ? (
                    <>
                      <SpinnerIcon />

                      Saving...
                    </>
                  ) : (
                    <>
                      <SaveIcon />

                      Save Changes
                    </>
                  )}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() =>
                  router.replace(
                    `/admin/bookings/${id}?mode=edit`,
                  )
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

                  text-[12px]
                  font-semibold

                  text-white

                  transition

                  hover:bg-primary-dark
                "
              >
                <EditIcon />

                Edit
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                setDeleteOpen(
                  true,
                )
              }
              className="
                inline-flex
                h-10

                items-center
                justify-center

                gap-2

                rounded-lg

                border
                border-red-200

                bg-white

                px-4

                text-[12px]
                font-semibold

                text-red-600

                transition

                hover:bg-red-50
              "
            >
              <TrashIcon />

              Delete
            </button>
          </div>
        </div>

        {/* ALERTS */}

        <AnimatePresence>
          {success && (
            <FeedbackBanner
              success
              text={
                success
              }
              onClose={() =>
                setSuccess('')
              }
            />
          )}

          {error && (
            <FeedbackBanner
              text={
                error
              }
              onClose={() =>
                setError('')
              }
            />
          )}
        </AnimatePresence>

        {/* COMPACT OVERVIEW */}

        <section
          className="
            mt-4

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

              gap-4

              xl:flex-row
              xl:items-center
              xl:justify-between
            "
          >
            <div
              className="
                flex
                min-w-0

                items-center

                gap-3.5
              "
            >
              <AvatarLarge
                name={
                  attendeeName
                }
              />

              <div
                className="
                  min-w-0
                "
              >
                <p
                  className="
                    truncate

                    font-heading

                    text-[17px]
                    font-semibold

                    text-secondary
                  "
                >
                  {attendeeName}
                </p>

                <div
                  className="
                    mt-1.5

                    flex
                    flex-col

                    gap-1

                    sm:flex-row
                    sm:flex-wrap

                    sm:gap-x-4
                  "
                >
                  <InlineInfo
                    icon={
                      <MailIcon />
                    }
                    value={
                      attendeeEmail
                    }
                  />

                  <InlineInfo
                    icon={
                      <PhoneIcon />
                    }
                    value={
                      attendeeMobile
                    }
                  />
                </div>
              </div>
            </div>

            <div
              className="
                grid
                w-full

                grid-cols-2

                gap-2

                xl:max-w-[690px]
                xl:grid-cols-4
              "
            >
              <SummaryItem
                label="Event"
                value={
                  displayValue(
                    event.eventName,
                  )
                }
              />

              <SummaryItem
                label="Date"
                value={
                  formatDate(
                    bookingDate,
                  )
                }
              />

              <SummaryItem
                label="Time"
                value={
                  formatTimeRange(
                    slot,
                  )
                }
              />

              <SummaryItem
                label="Venue"
                value={
                  displayValue(
                    event.venue,
                  )
                }
              />
            </div>
          </div>
        </section>

        {/* CONTENT */}

        <div
          className="
            mt-4

            grid
            grid-cols-1

            gap-4

            xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.75fr)]
          "
        >
          {/* ATTENDEE */}

          <CompactCard
            icon={
              <UserIcon />
            }
            title="Attendee Details"
          >
            {detailEntries.length >
            0 ? (
              <div
                className="
                  grid
                  grid-cols-1

                  gap-x-4
                  gap-y-4

                  sm:grid-cols-2

                  lg:grid-cols-3
                "
              >
                {detailEntries.map(
                  ([
                    key,
                    value,
                  ]) =>
                    isEditing ? (
                      <EditableField
                        key={
                          key
                        }
                        fieldKey={
                          key
                        }
                        label={
                          formatFieldName(
                            key,
                          )
                        }
                        value={
                          draft[
                            key
                          ] ??
                          ''
                        }
                        onChange={(
                          next,
                        ) =>
                          changeField(
                            key,
                            next,
                          )
                        }
                      />
                    ) : (
                      <ReadOnlyField
                        key={
                          key
                        }
                        label={
                          formatFieldName(
                            key,
                          )
                        }
                        value={
                          displayValue(
                            value,
                          )
                        }
                      />
                    ),
                )}
              </div>
            ) : (
              <div
                className="
                  rounded-lg

                  bg-gray-50

                  px-4
                  py-6

                  text-center

                  text-[12px]

                  text-gray-500
                "
              >
                No additional attendee information.
              </div>
            )}
          </CompactCard>

          {/* RIGHT */}

          <div
            className="
              space-y-4
            "
          >
            <CompactCard
              icon={
                <AttendanceIcon />
              }
              title="Attendance"
            >
              <AttendancePanel
                status={
                  attendance
                }
                checkedInAt={
                  booking.checkedInAt ||
                  null
                }
                checkedInBy={
                  booking.checkedInBy ||
                  ''
                }
                checkInMethod={
                  booking.checkInMethod ||
                  ''
                }
              />
            </CompactCard>

            <CompactCard
              icon={
                <FeedbackIcon />
              }
              title="Feedback"
            >
              <FeedbackPanel
                feedback={
                  feedback
                }
              />
            </CompactCard>
          </div>
        </div>
      </motion.div>

      {/* DELETE MODAL */}

      <AnimatePresence>
        {deleteOpen && (
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

              grid
              place-items-center

              bg-secondary/25

              px-4

              backdrop-blur-[2px]
            "
            onClick={() => {
              if (
                !deleting
              ) {
                setDeleteOpen(
                  false,
                );
              }
            }}
          >
            <motion.div
              initial={{
                opacity: 0,
                y: 8,
                scale: 0.98,
              }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
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
                max-w-[420px]

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

                <div>
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

                      text-[12px]
                      leading-5

                      text-gray-500
                    "
                  >
                    This permanently removes the booking and releases one slot capacity.
                  </p>
                </div>
              </div>

              <div
                className="
                  mt-4

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
                    text-[11px]

                    text-gray-500
                  "
                >
                  {booking.bookingId}
                </p>

                <p
                  className="
                    mt-1

                    text-[13px]
                    font-semibold

                    text-secondary
                  "
                >
                  {attendeeName}
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
                    setDeleteOpen(
                      false,
                    )
                  }
                  className="
                    inline-flex
                    h-10

                    items-center
                    justify-center

                    rounded-lg

                    border
                    border-gray-200

                    bg-white

                    px-4

                    text-[12px]
                    font-semibold

                    text-gray-600

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
                    deleteBooking
                  }
                  className="
                    inline-flex
                    h-10

                    items-center
                    justify-center

                    gap-2

                    rounded-lg

                    bg-red-600

                    px-4

                    text-[12px]
                    font-semibold

                    text-white

                    transition

                    hover:bg-red-700

                    disabled:opacity-50
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
   CARD
============================================================ */

function CompactCard({
  icon,
  title,
  children,
}: {
  icon:
    ReactNode;

  title:
    string;

  children:
    ReactNode;
}) {
  return (
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

          gap-2.5

          border-b
          border-gray-100

          px-4
          py-3

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

            rounded-lg

            bg-primary/[0.07]

            text-primary
          "
        >
          {icon}
        </span>

        <h2
          className="
            text-[13px]
            font-semibold

            text-secondary
          "
        >
          {title}
        </h2>
      </div>

      <div
        className="
          p-4

          sm:p-5
        "
      >
        {children}
      </div>
    </section>
  );
}

/* ============================================================
   SUMMARY
============================================================ */

function SummaryItem({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
}) {
  return (
    <div
      className="
        min-w-0

        rounded-lg

        border
        border-gray-100

        bg-gray-50

        px-3
        py-2.5
      "
    >
      <p
        className="
          text-[10px]
          font-medium

          text-gray-400
        "
      >
        {label}
      </p>

      <p
        title={
          value
        }
        className="
          mt-1

          truncate

          text-[12px]
          font-semibold

          text-secondary
        "
      >
        {value}
      </p>
    </div>
  );
}

/* ============================================================
   READ FIELD
============================================================ */

function ReadOnlyField({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
}) {
  return (
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

          tracking-[0.045em]

          text-gray-400
        "
      >
        {label}
      </p>

      <p
        className="
          mt-1

          break-words

          text-[13px]
          font-medium

          leading-5

          text-gray-700
        "
      >
        {value}
      </p>
    </div>
  );
}

/* ============================================================
   EDIT FIELD
============================================================ */

function EditableField({
  fieldKey,
  label,
  value,
  onChange,
}: {
  fieldKey:
    string;

  label:
    string;

  value:
    string;

  onChange:
    (
      value:
        string,
    ) => void;
}) {
  const type =
    getInputType(
      fieldKey,
    );

  const longField =
    isLongField(
      fieldKey,
    );

  return (
    <label
      className={
        longField
          ? `
              block
              min-w-0

              sm:col-span-2
              lg:col-span-3
            `
          : `
              block
              min-w-0
            `
      }
    >
      <span
        className="
          text-[10px]
          font-semibold

          uppercase

          tracking-[0.045em]

          text-gray-400
        "
      >
        {label}
      </span>

      {longField ? (
        <textarea
          rows={3}
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
          className="
            mt-1.5

            min-h-[88px]
            w-full

            resize-y

            rounded-lg

            border
            border-gray-200

            bg-white

            px-3
            py-2.5

            text-[13px]

            text-secondary

            outline-none

            transition

            focus:border-primary/40

            focus:ring-2
            focus:ring-primary/10
          "
        />
      ) : (
        <input
          type={
            type
          }
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
          className="
            mt-1.5

            h-10
            w-full

            rounded-lg

            border
            border-gray-200

            bg-white

            px-3

            text-[13px]

            text-secondary

            outline-none

            transition

            focus:border-primary/40

            focus:ring-2
            focus:ring-primary/10
          "
        />
      )}
    </label>
  );
}

/* ============================================================
   ATTENDANCE
============================================================ */

function AttendancePanel({
  status,
  checkedInAt,
  checkedInBy,
  checkInMethod,
}: {
  status:
    AttendanceStatus;

  checkedInAt:
    string | null;

  checkedInBy:
    string;

  checkInMethod:
    string;
}) {
  const present =
    status ===
    'PRESENT';

  return (
    <div>
      <div
        className={
          present
            ? `
                flex

                items-center

                gap-3

                rounded-lg

                border
                border-emerald-100

                bg-emerald-50

                px-3.5
                py-3
              `
            : `
                flex

                items-center

                gap-3

                rounded-lg

                border
                border-gray-200

                bg-gray-50

                px-3.5
                py-3
              `
        }
      >
        <span
          className={
            present
              ? `
                  grid
                  h-9
                  w-9

                  shrink-0

                  place-items-center

                  rounded-full

                  bg-emerald-100

                  text-emerald-700
                `
              : `
                  grid
                  h-9
                  w-9

                  shrink-0

                  place-items-center

                  rounded-full

                  bg-gray-200

                  text-gray-500
                `
          }
        >
          {present ? (
            <CheckIcon />
          ) : (
            <AttendanceIcon />
          )}
        </span>

        <div>
          <p
            className={
              present
                ? `
                    text-[13px]
                    font-semibold

                    text-emerald-800
                  `
                : `
                    text-[13px]
                    font-semibold

                    text-gray-700
                  `
            }
          >
            {present
              ? 'Present'
              : 'Not Present'}
          </p>

          <p
            className="
              mt-0.5

              text-[11px]

              text-gray-500
            "
          >
            {present
              ? 'Check-in recorded for this attendee.'
              : 'No check-in has been recorded.'}
          </p>
        </div>
      </div>

      {present && (
        <div
          className="
            mt-3

            divide-y
            divide-gray-100
          "
        >
          <MiniRow
            label="Checked in"
            value={
              formatDateTime(
                checkedInAt ||
                  '',
              )
            }
          />

          <MiniRow
            label="Method"
            value={
              checkInMethod ||
              '—'
            }
          />

          {checkedInBy && (
            <MiniRow
              label="Checked in by"
              value={
                checkedInBy
              }
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   FEEDBACK
============================================================ */

function FeedbackPanel({
  feedback,
}: {
  feedback:
    BookingFeedback;
}) {
  if (
    feedback.status ===
    'NONE'
  ) {
    return (
      <div
        className="
          rounded-lg

          border
          border-dashed
          border-gray-200

          bg-gray-50

          px-4
          py-5

          text-center
        "
      >
        <span
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
          <FeedbackIcon />
        </span>

        <p
          className="
            mt-2

            text-[12px]
            font-semibold

            text-secondary
          "
        >
          No feedback submitted
        </p>
      </div>
    );
  }

  if (
    feedback.status ===
    'SKIPPED'
  ) {
    return (
      <div
        className="
          rounded-lg

          border
          border-gray-200

          bg-gray-50

          px-4
          py-4
        "
      >
        <p
          className="
            text-[12px]
            font-semibold

            text-secondary
          "
        >
          Feedback skipped
        </p>

        {feedback.submittedAt && (
          <p
            className="
              mt-1

              text-[10px]

              text-gray-400
            "
          >
            {formatDateTime(
              feedback.submittedAt,
            )}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div
        className="
          flex
          flex-wrap

          items-center
          justify-between

          gap-3
        "
      >
        <div>
          <div
            className="
              flex
              items-center

              gap-1
            "
          >
            {[
              1,
              2,
              3,
              4,
              5,
            ].map(
              (
                value,
              ) => (
                <StarIcon
                  key={
                    value
                  }
                  active={
                    Boolean(
                      feedback.rating &&
                        value <=
                          feedback.rating,
                    )
                  }
                />
              ),
            )}
          </div>

          <p
            className="
              mt-1

              text-[11px]
              font-semibold

              text-secondary
            "
          >
            {feedback.rating
              ? `${feedback.rating}/5 · ${ratingText(
                  feedback.rating,
                )}`
              : 'Feedback submitted'}
          </p>
        </div>

        {feedback.submittedAt && (
          <span
            className="
              text-[10px]

              text-gray-400
            "
          >
            {formatDate(
              feedback.submittedAt,
            )}
          </span>
        )}
      </div>

      {feedback.message && (
        <div
          className="
            mt-4
          "
        >
          <p
            className="
              text-[10px]
              font-semibold

              uppercase

              tracking-[0.045em]

              text-gray-400
            "
          >
            Comment
          </p>

          <p
            className="
              mt-1.5

              whitespace-pre-wrap

              rounded-lg

              bg-gray-50

              px-3
              py-2.5

              text-[12px]
              leading-5

              text-gray-700
            "
          >
            {feedback.message}
          </p>
        </div>
      )}

      {feedback.suggestedFeature && (
        <div
          className="
            mt-3
          "
        >
          <p
            className="
              text-[10px]
              font-semibold

              uppercase

              tracking-[0.045em]

              text-gray-400
            "
          >
            Suggested Feature
          </p>

          <p
            className="
              mt-1.5

              rounded-lg

              border
              border-primary/10

              bg-primary/[0.04]

              px-3
              py-2.5

              text-[12px]
              leading-5

              text-gray-700
            "
          >
            {feedback.suggestedFeature}
          </p>
        </div>
      )}

      {!feedback.message &&
        !feedback.suggestedFeature && (
          <p
            className="
              mt-3

              text-[11px]
              leading-5

              text-gray-500
            "
          >
            A rating was submitted without a written comment.
          </p>
        )}
    </div>
  );
}

/* ============================================================
   SMALL ROW
============================================================ */

function MiniRow({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
}) {
  return (
    <div
      className="
        flex

        items-start
        justify-between

        gap-4

        py-2.5

        first:pt-0

        last:pb-0
      "
    >
      <span
        className="
          text-[11px]

          text-gray-500
        "
      >
        {label}
      </span>

      <span
        className="
          max-w-[62%]

          break-words

          text-right

          text-[11px]
          font-semibold

          text-secondary
        "
      >
        {value}
      </span>
    </div>
  );
}

/* ============================================================
   ATTENDANCE BADGE
============================================================ */

function AttendanceBadge({
  status,
}: {
  status:
    AttendanceStatus;
}) {
  const present =
    status ===
    'PRESENT';

  return (
    <span
      className={
        present
          ? `
              inline-flex

              items-center

              gap-1.5

              rounded-full

              bg-emerald-50

              px-2.5
              py-1

              text-[10px]
              font-semibold

              text-emerald-700

              ring-1
              ring-inset
              ring-emerald-100
            `
          : `
              inline-flex

              items-center

              gap-1.5

              rounded-full

              bg-gray-100

              px-2.5
              py-1

              text-[10px]
              font-semibold

              text-gray-600

              ring-1
              ring-inset
              ring-gray-200
            `
      }
    >
      <span
        className={
          present
            ? `
                h-1.5
                w-1.5

                rounded-full

                bg-emerald-500
              `
            : `
                h-1.5
                w-1.5

                rounded-full

                bg-gray-400
              `
        }
      />

      {present
        ? 'Present'
        : 'Not Present'}
    </span>
  );
}

/* ============================================================
   AVATAR
============================================================ */

function AvatarLarge({
  name,
}: {
  name:
    string;
}) {
  const initials =
    name
      .split(' ')
      .filter(
        Boolean,
      )
      .slice(
        0,
        2,
      )
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
      className="
        grid
        h-12
        w-12

        shrink-0
        place-items-center

        rounded-xl

        bg-primary

        font-heading

        text-[14px]
        font-semibold

        text-white

        shadow-sm

        sm:h-14
        sm:w-14

        sm:text-[15px]
      "
    >
      {initials}
    </div>
  );
}

/* ============================================================
   INLINE INFO
============================================================ */

function InlineInfo({
  icon,
  value,
}: {
  icon:
    ReactNode;

  value:
    string;
}) {
  return (
    <span
      className="
        inline-flex
        min-w-0

        items-center

        gap-1.5

        text-[12px]

        text-gray-500
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
          truncate
        "
      >
        {value}
      </span>
    </span>
  );
}

/* ============================================================
   ALERT
============================================================ */

function FeedbackBanner({
  text,
  success = false,
  onClose,
}: {
  text:
    string;

  success?:
    boolean;

  onClose:
    () => void;
}) {
  return (
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
      className={
        success
          ? `
              mt-4

              flex
              items-start
              justify-between

              gap-4

              rounded-lg

              border
              border-primary/20

              bg-primary/[0.05]

              px-4
              py-3
            `
          : `
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
            `
      }
    >
      <div
        className="
          flex
          items-start

          gap-2.5
        "
      >
        <span
          className={
            success
              ? `
                  mt-0.5

                  text-primary
                `
              : `
                  mt-0.5

                  text-red-500
                `
          }
        >
          {success ? (
            <CheckIcon />
          ) : (
            <AlertIcon />
          )}
        </span>

        <p
          className={
            success
              ? `
                  text-[12px]
                  leading-5

                  text-primary-dark
                `
              : `
                  text-[12px]
                  leading-5

                  text-red-700
                `
          }
        >
          {text}
        </p>
      </div>

      <button
        type="button"
        onClick={
          onClose
        }
        className={
          success
            ? 'text-primary'
            : 'text-red-500'
        }
      >
        <CloseIcon />
      </button>
    </motion.div>
  );
}

/* ============================================================
   SKELETON
============================================================ */

function BookingDetailSkeleton() {
  return (
    <div
      className="
        w-full

        animate-pulse
      "
    >
      <div
        className="
          h-4
          w-24

          rounded

          bg-gray-200
        "
      />

      <div
        className="
          mt-4

          flex
          flex-col

          gap-4

          sm:flex-row
          sm:items-start
          sm:justify-between
        "
      >
        <div>
          <div
            className="
              h-7
              w-48

              rounded

              bg-gray-200
            "
          />

          <div
            className="
              mt-2

              h-4
              w-56
              max-w-full

              rounded

              bg-gray-100
            "
          />
        </div>

        <div
          className="
            flex

            gap-2
          "
        >
          <div
            className="
              h-10
              w-24

              rounded-lg

              bg-gray-100
            "
          />

          <div
            className="
              h-10
              w-24

              rounded-lg

              bg-gray-100
            "
          />
        </div>
      </div>

      <div
        className="
          mt-4

          h-28

          rounded-xl

          border
          border-gray-200

          bg-white
        "
      />

      <div
        className="
          mt-4

          grid
          grid-cols-1

          gap-4

          xl:grid-cols-[1.45fr_0.75fr]
        "
      >
        <div
          className="
            h-72

            rounded-xl

            border
            border-gray-200

            bg-white
          "
        />

        <div
          className="
            space-y-4
          "
        >
          <div
            className="
              h-44

              rounded-xl

              border
              border-gray-200

              bg-white
            "
          />

          <div
            className="
              h-52

              rounded-xl

              border
              border-gray-200

              bg-white
            "
          />
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   DETAILS HELPERS
============================================================ */

function normalizeDetails(
  details:
    GenericRecord,
) {
  const output:
    Record<
      string,
      string
    > = {};

  for (
    const [
      key,
      value,
    ] of Object.entries(
      details,
    )
  ) {
    if (
      value ===
        undefined ||
      value ===
        null
    ) {
      output[key] =
        '';

      continue;
    }

    if (
      typeof value ===
      'object'
    ) {
      try {
        output[key] =
          JSON.stringify(
            value,
          );
      } catch {
        output[key] =
          String(
            value,
          );
      }

      continue;
    }

    output[key] =
      String(
        value,
      );
  }

  return output;
}

function sortDetails(
  entries:
    [
      string,
      unknown,
    ][],
) {
  return [
    ...entries,
  ].sort(
    (
      [
        keyA,
      ],
      [
        keyB,
      ],
    ) => {
      const indexA =
        FIELD_PRIORITY.indexOf(
          keyA,
        );

      const indexB =
        FIELD_PRIORITY.indexOf(
          keyB,
        );

      const priorityA =
        indexA ===
        -1
          ? 999
          : indexA;

      const priorityB =
        indexB ===
        -1
          ? 999
          : indexB;

      if (
        priorityA !==
        priorityB
      ) {
        return (
          priorityA -
          priorityB
        );
      }

      return keyA.localeCompare(
        keyB,
      );
    },
  );
}

function formatFieldName(
  value: string,
) {
  return value
    .replace(
      /([a-z0-9])([A-Z])/g,
      '$1 $2',
    )
    .replace(
      /[_-]+/g,
      ' ',
    )
    .replace(
      /\b\w/g,
      (
        char,
      ) =>
        char.toUpperCase(),
    );
}

function displayValue(
  value:
    unknown,
): string {
  if (
    value ===
      undefined ||
    value ===
      null ||
    value ===
      ''
  ) {
    return '—';
  }

  if (
    typeof value ===
    'boolean'
  ) {
    return value
      ? 'Yes'
      : 'No';
  }

  if (
    Array.isArray(
      value,
    )
  ) {
    return value
      .map(
        displayValue,
      )
      .join(', ');
  }

  if (
    typeof value ===
    'object'
  ) {
    try {
      return JSON.stringify(
        value,
      );
    } catch {
      return String(
        value,
      );
    }
  }

  return String(
    value,
  );
}

function displayMobile(
  details:
    GenericRecord,
) {
  const mobile =
    toText(
      details.mobile,
    ).trim();

  const countryCode =
    toText(
      details.countryCode,
    ).trim();

  if (!mobile) {
    return '—';
  }

  if (
    countryCode &&
    !mobile.startsWith(
      countryCode,
    )
  ) {
    return `${countryCode} ${mobile}`;
  }

  return mobile;
}

function toText(
  value:
    unknown,
) {
  if (
    value ===
      undefined ||
    value ===
      null
  ) {
    return '';
  }

  return String(
    value,
  );
}

/* ============================================================
   DATE
============================================================ */

function formatDate(
  value?:
    string,
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

function formatDateTime(
  value?:
    string,
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
   TIME
============================================================ */

function formatTimeRange(
  slot:
    GenericRecord,
) {
  const start =
    formatTime(
      toText(
        slot.startTime,
      ),
    );

  const end =
    formatTime(
      toText(
        slot.endTime,
      ),
    );

  if (
    start ===
      '—' ||
    end ===
      '—'
  ) {
    return '—';
  }

  return `${start} – ${end}`;
}

function formatTime(
  value:
    string,
) {
  const match =
    /^(\d{1,2}):(\d{2})/.exec(
      value,
    );

  if (!match) {
    return value ||
      '—';
  }

  const hours =
    Number(
      match[1],
    );

  const minutes =
    match[2];

  if (
    Number.isNaN(
      hours,
    ) ||
    hours < 0 ||
    hours > 23
  ) {
    return value;
  }

  const suffix =
    hours >= 12
      ? 'PM'
      : 'AM';

  const normalized =
    hours % 12 ||
    12;

  return `${normalized}:${minutes} ${suffix}`;
}

/* ============================================================
   RATING
============================================================ */

function ratingText(
  rating:
    number,
) {
  switch (
    rating
  ) {
    case 1:
      return 'Needs improvement';

    case 2:
      return 'Fair';

    case 3:
      return 'Good';

    case 4:
      return 'Very good';

    case 5:
      return 'Excellent';

    default:
      return '';
  }
}

/* ============================================================
   INPUT TYPE
============================================================ */

function getInputType(
  key:
    string,
):
  | 'text'
  | 'email'
  | 'tel'
  | 'url' {
  const lower =
    key.toLowerCase();

  if (
    lower.includes(
      'email',
    )
  ) {
    return 'email';
  }

  if (
    lower.includes(
      'mobile',
    ) ||
    lower.includes(
      'phone',
    ) ||
    lower.includes(
      'contact',
    )
  ) {
    return 'tel';
  }

  if (
    lower.includes(
      'website',
    ) ||
    lower.includes(
      'url',
    )
  ) {
    return 'url';
  }

  return 'text';
}

function isLongField(
  key:
    string,
) {
  const lower =
    key.toLowerCase();

  return [
    'address',
    'description',
    'remarks',
    'remark',
    'message',
    'comment',
    'comments',
    'note',
    'notes',
  ].some(
    (
      item,
    ) =>
      lower.includes(
        item,
      ),
  );
}

/* ============================================================
   ICONS
============================================================ */

function BackIcon() {
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
        strokeLinejoin="round"
        d="m15 18-6-6 6-6"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.9}
    >
      <circle
        cx="12"
        cy="8"
        r="3.5"
      />

      <path
        strokeLinecap="round"
        d="M5.5 20c.7-4 3-6 6.5-6s5.8 2 6.5 6"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <rect
        x="3.5"
        y="5.5"
        width="17"
        height="13"
        rx="2"
      />

      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m5 7 7 5 7-5"
      />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 3.5 10 7 8.5 9.5c1.5 3 3 4.5 6 6L17 14l3.5 3c-1 2.5-3 3.5-5 2.8-6-2-9.3-5.3-11.3-11.3C3.5 6.5 4.5 4.5 7 3.5Z"
      />
    </svg>
  );
}

function AttendanceIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.9}
    >
      <circle
        cx="12"
        cy="8"
        r="3.2"
      />

      <path
        strokeLinecap="round"
        d="M6 20c.7-3.5 2.8-5.4 6-5.4s5.3 1.9 6 5.4"
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
      strokeWidth={1.9}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 5.5h14v10H9l-4 3v-13Z"
      />

      <path
        strokeLinecap="round"
        d="M8.5 9h7M8.5 12h4.5"
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

function SaveIcon() {
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
        d="M5 4h12l2 2v14H5V4Z"
      />

      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 4v6h8V4M8 16h8"
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

function CheckIcon() {
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
        strokeLinejoin="round"
        d="m5 12 4 4L19 6"
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

function StarIcon({
  active,
}: {
  active:
    boolean;
}) {
  return (
    <svg
      className={
        active
          ? `
              h-4
              w-4

              text-amber-400
            `
          : `
              h-4
              w-4

              text-gray-200
            `
      }
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path
        d="m12 2.7 2.86 5.8 6.4.93-4.63 4.51 1.09 6.37L12 17.3l-5.72 3.01 1.09-6.37-4.63-4.51 6.4-.93L12 2.7Z"
      />
    </svg>
  );
}