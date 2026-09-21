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

  createdAt: string;

  updatedAt: string;
};

type BookingResponse = {
  success: boolean;
  booking?: BookingData;
  message?: string;
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

const FIELD_PRIORITY =
  [
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
      );
    }, [
      booking,
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
     EDIT HELPERS
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
     ERROR / NOT FOUND
  ============================================================ */

  if (!booking) {
    return (
      <div
        className="
          flex
          min-h-[60vh]
          items-center
          justify-center
        "
      >
        <div
          className="
            w-full
            max-w-[440px]

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
              !text-[13px]
              !leading-5
              !text-gray-500
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
              btn
              btn-primary
              mt-5
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
    displayValue(
      booking.details
        .mobile,
    );

  const bookingDate =
    toText(
      schedule.date,
    );

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
          duration: 0.35,
          ease: EASE,
        }}
        className="
          w-full
          min-w-0
        "
      >
        {/* ====================================================
            BREADCRUMB
        ==================================================== */}

        <button
          type="button"
          onClick={() =>
            router.push(
              '/admin/bookings',
            )
          }
          className="
            inline-flex
            cursor-pointer
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

        {/* ====================================================
            PAGE HEADER
        ==================================================== */}

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
                  lg:text-[26px]
                "
              >
                {isEditing
                  ? 'Edit Booking'
                  : 'Booking Details'}
              </h1>

              {isEditing && (
                <span
                  className="
                    badge
                    badge--warning
                  "
                >
                  Editing
                </span>
              )}
            </div>

            <div
              className="
                mt-1
                flex
                flex-wrap
                items-center
                gap-x-2
                gap-y-1

                text-[13px]
                text-gray-500
              "
            >
              <span>
                Booking ID
              </span>

              <span
                className="
                  font-semibold
                  text-secondary
                "
              >
                {
                  booking.bookingId
                }
              </span>

              <span
                className="
                  text-gray-300
                "
              >
                •
              </span>

              <BookingStatus
                date={
                  bookingDate
                }
              />
            </div>
          </div>

          {/* ACTIONS */}

          <div
            className="
              flex
              flex-col
              gap-2

              min-[430px]:flex-row
              min-[430px]:items-center
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
                    btn
                    h-10

                    border-gray-200

                    bg-white

                    text-gray-600

                    hover:bg-gray-50
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
                    btn
                    btn-primary
                    h-10
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
                  btn
                  btn-primary
                  h-10
                "
              >
                <EditIcon />

                Edit Booking
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
                btn
                h-10

                border-red-200

                bg-white

                text-red-600

                hover:bg-red-50
              "
            >
              <TrashIcon />

              Delete
            </button>
          </div>
        </div>

        {/* ====================================================
            ALERTS
        ==================================================== */}

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

        {/* ====================================================
            ATTENDEE OVERVIEW
        ==================================================== */}

        <section
          className="
            mt-5

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
              gap-5

              p-4

              sm:p-5

              lg:flex-row
              lg:items-center
              lg:justify-between
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
                    !font-heading
                    !text-[17px]
                    !font-semibold
                    !text-secondary
                  "
                >
                  {
                    attendeeName
                  }
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
                grid-cols-2
                gap-px

                overflow-hidden

                rounded-lg

                border
                border-gray-200

                bg-gray-200

                sm:grid-cols-4

                lg:min-w-[520px]
              "
            >
              <SummaryMetric
                label="Event"
                value={
                  displayValue(
                    event.eventName,
                  )
                }
              />

              <SummaryMetric
                label="Date"
                value={
                  formatDate(
                    bookingDate,
                  )
                }
              />

              <SummaryMetric
                label="Time"
                value={
                  formatTimeRange(
                    slot,
                  )
                }
              />

              <SummaryMetric
                label="Created"
                value={
                  formatDate(
                    booking.createdAt,
                  )
                }
              />
            </div>
          </div>
        </section>

        {/* ====================================================
            MAIN GRID
        ==================================================== */}

        <div
          className="
            mt-5

            grid
            grid-cols-1
            gap-5

            xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.7fr)]
          "
        >
          {/* LEFT */}

          <div
            className="
              min-w-0
              space-y-5
            "
          >
            {/* REGISTRATION */}

            <SectionCard
              icon={
                <UserIcon />
              }
              title="Registration Information"
              description={
                isEditing
                  ? 'Update attendee information stored with this booking.'
                  : 'Information submitted during registration.'
              }
            >
              {detailEntries.length >
              0 ? (
                <div
                  className="
                    grid
                    grid-cols-1
                    gap-x-5
                    gap-y-4

                    sm:grid-cols-2
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
                <EmptyInformation />
              )}
            </SectionCard>

            {/* EVENT */}

            <SectionCard
              icon={
                <EventIcon />
              }
              title="Event Information"
              description="Conference information linked to this booking."
            >
              <div
                className="
                  grid
                  grid-cols-1
                  gap-x-5
                  gap-y-4

                  sm:grid-cols-2
                  lg:grid-cols-3
                "
              >
                <ReadOnlyField
                  label="Event Name"
                  value={
                    displayValue(
                      event.eventName,
                    )
                  }
                  wide
                />

                <ReadOnlyField
                  label="Event Type"
                  value={
                    displayValue(
                      event.eventType,
                    )
                  }
                />

                <ReadOnlyField
                  label="Status"
                  value={
                    displayValue(
                      event.status,
                    )
                  }
                />

                <ReadOnlyField
                  label="Venue"
                  value={
                    displayValue(
                      event.venue,
                    )
                  }
                  wide
                />

                <ReadOnlyField
                  label="Start Date"
                  value={
                    formatDate(
                      toText(
                        event.startDate,
                      ),
                    )
                  }
                />

                <ReadOnlyField
                  label="End Date"
                  value={
                    formatDate(
                      toText(
                        event.endDate,
                      ),
                    )
                  }
                />
              </div>
            </SectionCard>

            {/* SCHEDULE */}

            <SectionCard
              icon={
                <CalendarIcon />
              }
              title="Schedule Information"
              description="Selected event day and schedule configuration."
            >
              <div
                className="
                  grid
                  grid-cols-2
                  gap-x-5
                  gap-y-4

                  md:grid-cols-3
                "
              >
                <ReadOnlyField
                  label="Day"
                  value={
                    schedule.dayNumber
                      ? `Day ${displayValue(
                          schedule.dayNumber,
                        )}`
                      : '—'
                  }
                />

                <ReadOnlyField
                  label="Date"
                  value={
                    formatDate(
                      toText(
                        schedule.date,
                      ),
                    )
                  }
                />

                <ReadOnlyField
                  label="Schedule"
                  value={
                    joinTime(
                      toText(
                        schedule.startTime,
                      ),
                      toText(
                        schedule.endTime,
                      ),
                    )
                  }
                />

                <ReadOnlyField
                  label="Slot Duration"
                  value={
                    withUnit(
                      schedule.slotDuration,
                      'min',
                    )
                  }
                />

                <ReadOnlyField
                  label="Slot Gap"
                  value={
                    withUnit(
                      schedule.slotGap,
                      'min',
                    )
                  }
                />

                <ReadOnlyField
                  label="Capacity"
                  value={
                    displayValue(
                      schedule.capacity,
                    )
                  }
                />
              </div>
            </SectionCard>
          </div>

          {/* RIGHT */}

          <div
            className="
              min-w-0
              space-y-5
            "
          >
            {/* SLOT */}

            <SectionCard
              icon={
                <ClockIcon />
              }
              title="Booked Slot"
              description="Time reserved for this booking."
            >
              <div
                className="
                  rounded-lg

                  border
                  border-primary/15

                  bg-primary/[0.05]

                  p-4
                "
              >
                <p
                  className="
                    !text-[11px]
                    !font-medium
                    !text-gray-500
                  "
                >
                  Reserved Time
                </p>

                <p
                  className="
                    mt-1
                    !font-heading
                    !text-[20px]
                    !font-semibold
                    !tracking-[-0.02em]
                    !text-secondary
                  "
                >
                  {
                    formatTimeRange(
                      slot,
                    )
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
                    formatDate(
                      bookingDate,
                    )
                  }
                </p>
              </div>

              <div
                className="
                  mt-4
                  grid
                  grid-cols-2
                  gap-4
                "
              >
                <ReadOnlyField
                  label="Capacity"
                  value={
                    displayValue(
                      slot.capacity,
                    )
                  }
                />

                <ReadOnlyField
                  label="Booked"
                  value={
                    displayValue(
                      slot.bookedCount,
                    )
                  }
                />
              </div>
            </SectionCard>

            {/* BOOKING RECORD */}

            <SectionCard
              icon={
                <InfoIcon />
              }
              title="Booking Record"
              description="System information for this booking."
            >
              <div
                className="
                  divide-y
                  divide-gray-100
                "
              >
                <RecordRow
                  label="Booking ID"
                  value={
                    booking.bookingId
                  }
                />

                <RecordRow
                  label="Created"
                  value={
                    formatDateTime(
                      booking.createdAt,
                    )
                  }
                />

                <RecordRow
                  label="Last Updated"
                  value={
                    formatDateTime(
                      booking.updatedAt,
                    )
                  }
                />
              </div>
            </SectionCard>

            {/* REFERENCES */}

            <SectionCard
              icon={
                <LinkIcon />
              }
              title="System References"
              description="Linked database record identifiers."
            >
              <div
                className="
                  space-y-3
                "
              >
                <ReferenceBox
                  label="Booking Document"
                  value={
                    booking._id
                  }
                />

                <ReferenceBox
                  label="Event"
                  value={
                    toText(
                      event._id,
                    )
                  }
                />

                <ReferenceBox
                  label="Day Schedule"
                  value={
                    toText(
                      schedule._id,
                    )
                  }
                />

                <ReferenceBox
                  label="Slot"
                  value={
                    toText(
                      slot._id,
                    )
                  }
                />
              </div>
            </SectionCard>

            {/* EDIT NOTE */}

            {isEditing && (
              <div
                className="
                  rounded-xl

                  border
                  border-amber-200

                  bg-amber-50

                  p-4
                "
              >
                <div
                  className="
                    flex
                    items-start
                    gap-2.5
                  "
                >
                  <span
                    className="
                      mt-0.5
                      shrink-0
                      text-amber-600
                    "
                  >
                    <LockIcon />
                  </span>

                  <div>
                    <p
                      className="
                        !text-[13px]
                        !font-semibold
                        !text-amber-800
                      "
                    >
                      Scheduling fields
                      are locked
                    </p>

                    <p
                      className="
                        mt-1
                        !text-[12px]
                        !leading-5
                        !text-amber-700
                      "
                    >
                      Event, schedule,
                      slot and booking ID
                      are system-linked
                      values. Edit the
                      attendee registration
                      fields only.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ======================================================
          DELETE MODAL
      ====================================================== */}

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
            onClick={() => {
              if (
                !deleting
              ) {
                setDeleteOpen(
                  false,
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
                y: 8,
                scale: 0.97,
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
                      !text-[13px]
                      !leading-5
                      !text-gray-500
                    "
                  >
                    This booking will be
                    permanently removed
                    and cannot be restored.
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
                  {
                    booking.bookingId
                  }
                </p>

                <p
                  className="
                    mt-1
                    !text-[13px]
                    !font-semibold
                    !text-secondary
                  "
                >
                  {
                    attendeeName
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
                    setDeleteOpen(
                      false,
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
                    deleteBooking
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
   SECTION CARD
============================================================ */

function SectionCard({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
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
          gap-3

          border-b
          border-gray-200

          px-4
          py-3.5

          sm:px-5
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
          {icon}
        </span>

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
            {title}
          </h2>

          <p
            className="
              mt-0.5
              !text-[12px]
              !text-gray-500
            "
          >
            {description}
          </p>
        </div>
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
   READ FIELD
============================================================ */

function ReadOnlyField({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`
        min-w-0

        ${
          wide
            ? 'sm:col-span-2'
            : ''
        }
      `}
    >
      <p
        className="form-label"
      >
        {label}
      </p>

      <div
        className="
          min-h-[39px]

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
            break-words
            !text-[13px]
            !font-medium
            !leading-[18px]
            !text-gray-700
          "
        >
          {value}
        </p>
      </div>
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
  fieldKey: string;
  label: string;
  value: string;
  onChange: (
    value: string,
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
      className={`
        block
        min-w-0

        ${
          longField
            ? 'sm:col-span-2'
            : ''
        }
      `}
    >
      <span
        className="form-label"
      >
        {label}
      </span>

      {longField ? (
        <textarea
          rows={4}
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
            form-textarea
            resize-y
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
          className="form-input"
        />
      )}
    </label>
  );
}

/* ============================================================
   SUMMARY
============================================================ */

function SummaryMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      className="
        min-w-0
        bg-white
        px-3
        py-3
      "
    >
      <p
        className="
          !text-[11px]
          !font-medium
          !text-gray-400
        "
      >
        {label}
      </p>

      <p
        className="
          mt-1
          truncate
          !text-[12px]
          !font-semibold
          !text-secondary
        "
        title={
          value
        }
      >
        {value}
      </p>
    </div>
  );
}

function InlineInfo({
  icon,
  value,
}: {
  icon: ReactNode;
  value: string;
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
   RECORDS
============================================================ */

function RecordRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      className="
        flex
        items-start
        justify-between
        gap-4

        py-3

        first:pt-0
        last:pb-0
      "
    >
      <span
        className="
          text-[12px]
          text-gray-500
        "
      >
        {label}
      </span>

      <span
        className="
          max-w-[60%]
          break-words
          text-right
          text-[12px]
          font-medium
          text-secondary
        "
      >
        {value}
      </span>
    </div>
  );
}

function ReferenceBox({
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

        bg-gray-50

        px-3
        py-2.5
      "
    >
      <p
        className="
          !text-[11px]
          !font-medium
          !text-gray-400
        "
      >
        {label}
      </p>

      <p
        className="
          mt-1
          break-all
          font-mono
          !text-[11px]
          !leading-4
          !text-gray-700
        "
      >
        {value ||
          '—'}
      </p>
    </div>
  );
}

/* ============================================================
   STATUS
============================================================ */

function BookingStatus({
  date,
}: {
  date: string;
}) {
  const parsed =
    date
      ? new Date(
          date,
        )
      : null;

  const upcoming =
    parsed &&
    !Number.isNaN(
      parsed.getTime(),
    )
      ? parsed.getTime() >=
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
   AVATAR
============================================================ */

function AvatarLarge({
  name,
}: {
  name: string;
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
   ALERT BANNER
============================================================ */

function FeedbackBanner({
  text,
  success = false,
  onClose,
}: {
  text: string;
  success?: boolean;
  onClose: () => void;
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
      className={`
        mt-4

        flex
        items-start
        justify-between
        gap-4

        rounded-lg

        border

        px-4
        py-3

        ${
          success
            ? `
                border-primary/20
                bg-primary/[0.05]
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
          gap-2.5
        "
      >
        <span
          className={`
            mt-0.5

            ${
              success
                ? 'text-primary'
                : 'text-red-500'
            }
          `}
        >
          {success ? (
            <CheckIcon />
          ) : (
            <AlertIcon />
          )}
        </span>

        <p
          className={`
            !text-[13px]
            !leading-5

            ${
              success
                ? '!text-primary-dark'
                : '!text-red-700'
            }
          `}
        >
          {text}
        </p>
      </div>

      <button
        type="button"
        onClick={
          onClose
        }
        className={`
          cursor-pointer

          ${
            success
              ? 'text-primary'
              : 'text-red-500'
          }
        `}
      >
        <CloseIcon />
      </button>
    </motion.div>
  );
}

/* ============================================================
   EMPTY INFO
============================================================ */

function EmptyInformation() {
  return (
    <div
      className="
        rounded-lg
        bg-gray-50
        px-4
        py-8
        text-center
      "
    >
      <p
        className="
          !text-[13px]
          !text-gray-500
        "
      >
        No registration
        information is available.
      </p>
    </div>
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
              w-64
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
              w-28
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

      {/* OVERVIEW */}

      <div
        className="
          mt-5

          rounded-xl

          border
          border-gray-200

          bg-white

          p-5
        "
      >
        <div
          className="
            flex
            flex-col
            gap-5

            lg:flex-row
            lg:items-center
            lg:justify-between
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
                h-14
                w-14
                rounded-xl
                bg-gray-100
              "
            />

            <div>
              <div
                className="
                  h-5
                  w-40
                  rounded
                  bg-gray-100
                "
              />

              <div
                className="
                  mt-2
                  h-3
                  w-56
                  rounded
                  bg-gray-100
                "
              />
            </div>
          </div>

          <div
            className="
              grid
              grid-cols-2
              gap-2

              sm:grid-cols-4

              lg:w-[520px]
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
                    h-14
                    rounded-lg
                    bg-gray-100
                  "
                />
              ),
            )}
          </div>
        </div>
      </div>

      {/* GRID */}

      <div
        className="
          mt-5

          grid
          grid-cols-1
          gap-5

          xl:grid-cols-[1.6fr_0.7fr]
        "
      >
        <div
          className="
            space-y-5
          "
        >
          <SkeletonSection
            rows={6}
          />

          <SkeletonSection
            rows={4}
          />

          <SkeletonSection
            rows={4}
          />
        </div>

        <div
          className="
            space-y-5
          "
        >
          <SkeletonSection
            rows={3}
          />

          <SkeletonSection
            rows={3}
          />

          <SkeletonSection
            rows={4}
          />
        </div>
      </div>
    </div>
  );
}

function SkeletonSection({
  rows,
}: {
  rows: number;
}) {
  return (
    <div
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
          flex
          items-center
          gap-3

          border-b
          border-gray-200

          px-5
          py-4
        "
      >
        <div
          className="
            h-9
            w-9
            rounded-lg
            bg-gray-100
          "
        />

        <div>
          <div
            className="
              h-4
              w-36
              rounded
              bg-gray-100
            "
          />

          <div
            className="
              mt-2
              h-3
              w-52
              max-w-full
              rounded
              bg-gray-100
            "
          />
        </div>
      </div>

      <div
        className="
          grid
          grid-cols-1
          gap-4

          p-5

          sm:grid-cols-2
        "
      >
        {Array.from({
          length:
            rows,
        }).map(
          (
            _,
            index,
          ) => (
            <div
              key={
                index
              }
            >
              <div
                className="
                  h-3
                  w-20
                  rounded
                  bg-gray-100
                "
              />

              <div
                className="
                  mt-2
                  h-10
                  rounded-lg
                  bg-gray-100
                "
              />
            </div>
          ),
        )}
      </div>
    </div>
  );
}

/* ============================================================
   HELPERS
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

function formatDateTime(
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
      hour:
        '2-digit',
      minute:
        '2-digit',
    },
  ).format(
    date,
  );
}

function joinTime(
  start: string,
  end: string,
) {
  if (
    !start ||
    !end
  ) {
    return '—';
  }

  return `${start} - ${end}`;
}

function formatTimeRange(
  slot:
    GenericRecord,
) {
  return joinTime(
    toText(
      slot.startTime,
    ),
    toText(
      slot.endTime,
    ),
  );
}

function withUnit(
  value:
    unknown,
  unit: string,
) {
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

  return `${String(
    value,
  )} ${unit}`;
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

function getInputType(
  key: string,
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
  key: string,
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

function EventIcon() {
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
        d="M5 7h14v12H5zM8 3v4m8-4v4M5 10h14"
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
      strokeWidth={1.9}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 3v3m10-3v3M4.5 9h15M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z"
      />
    </svg>
  );
}

function ClockIcon() {
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
        cy="12"
        r="8.5"
      />

      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 7.5V12l3 2"
      />
    </svg>
  );
}

function InfoIcon() {
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

function LinkIcon() {
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
        d="m10 14 4-4M8.5 16.5l-1 1a3.5 3.5 0 0 1-5-5l3-3a3.5 3.5 0 0 1 5 0M15.5 7.5l1-1a3.5 3.5 0 0 1 5 5l-3 3a3.5 3.5 0 0 1-5 0"
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

function LockIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.9}
    >
      <rect
        x="5"
        y="10"
        width="14"
        height="10"
        rx="2"
      />

      <path
        strokeLinecap="round"
        d="M8 10V7a4 4 0 0 1 8 0v3"
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
