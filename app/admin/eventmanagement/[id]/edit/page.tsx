'use client';

import Link from 'next/link';

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useParams,
  useRouter,
} from 'next/navigation';

import BookingTemplateSelector from '@/app/components/admin/booking-templates/BookingTemplateSelector';

import {
  BookingFormTemplate,
  DEFAULT_BOOKING_TEMPLATE,
  isBookingFormTemplate,
} from '@/app/components/admin/booking-templates/types';

type DaySchedule = {
  startTime: string;
  endTime: string;
  lunchEnabled: boolean;
  lunchStart: string;
  lunchEnd: string;
  slotDuration: string;
  slotGap: string;
  capacity: string;
  sameAsDay1: boolean;
};

type EventResponse = {
  _id: string;

  eventName: string;

  eventType:
    | 'conference'
    | 'mantram'
    | 'event';

  bookingFormTemplate?:
    BookingFormTemplate;

  venue: string;

  description: string;

  imageUrl?: string;

  numberOfDays: number;

  startDate: string;

  endDate: string;

  status:
    | 'LIVE'
    | 'COMPLETED'
    | 'UPCOMING';

  daySchedules: Array<
    DaySchedule & {
      _id: string;
      dayNumber: number;
      date: string;
    }
  >;
};

type ThumbnailPreview = {
  name: string;
  url: string;
  local: boolean;
};

const GAP_OPTIONS = [
  0,
  3,
  5,
  10,
  15,
  20,
  25,
  30,
];

const createDaySchedule = (
  sameAsDay1 = false,
): DaySchedule => ({
  startTime: '09:00',
  endTime: '17:00',

  lunchEnabled: true,

  lunchStart: '13:00',
  lunchEnd: '14:00',

  slotDuration: '20',
  slotGap: '10',

  capacity: '20',

  sameAsDay1,
});

function parseLocalDate(
  value: string,
) {
  const [
    year,
    month,
    day,
  ] =
    value
      .split('-')
      .map(Number);

  return new Date(
    year,
    month - 1,
    day,
  );
}

function toDateInputValue(
  value:
    | string
    | Date,
) {
  const date =
    value instanceof Date
      ? value
      : new Date(
          value,
        );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return '';
  }

  const year =
    date.getUTCFullYear();

  const month =
    String(
      date.getUTCMonth() +
        1,
    ).padStart(
      2,
      '0',
    );

  const day =
    String(
      date.getUTCDate(),
    ).padStart(
      2,
      '0',
    );

  return `${year}-${month}-${day}`;
}

function addDays(
  value: string,
  amount: number,
) {
  if (!value) {
    return '';
  }

  const date =
    parseLocalDate(
      value,
    );

  date.setDate(
    date.getDate() +
      amount,
  );

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() +
        1,
    ).padStart(
      2,
      '0',
    );

  const day =
    String(
      date.getDate(),
    ).padStart(
      2,
      '0',
    );

  return `${year}-${month}-${day}`;
}

function formatDate(
  value: string,
) {
  if (!value) {
    return 'Select a start date';
  }

  return new Intl.DateTimeFormat(
    'en-IN',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    },
  ).format(
    parseLocalDate(
      value,
    ),
  );
}

function timeToMinutes(
  value: string,
) {
  if (!value) {
    return 0;
  }

  const [
    hours,
    minutes,
  ] =
    value
      .split(':')
      .map(Number);

  return (
    hours * 60 +
    minutes
  );
}

function formatTime(
  totalMinutes: number,
) {
  const hours =
    Math.floor(
      totalMinutes /
        60,
    );

  const minutes =
    totalMinutes %
    60;

  return `${String(
    hours,
  ).padStart(
    2,
    '0',
  )}:${String(
    minutes,
  ).padStart(
    2,
    '0',
  )}`;
}

function copyDay1Schedule(
  day1: DaySchedule,
  sameAsDay1 = true,
): DaySchedule {
  return {
    ...day1,
    sameAsDay1,
  };
}

function generateSlots(
  schedule: DaySchedule,
) {
  const start =
    timeToMinutes(
      schedule.startTime,
    );

  const end =
    timeToMinutes(
      schedule.endTime,
    );

  const duration =
    Number(
      schedule.slotDuration,
    );

  const gap =
    Number(
      schedule.slotGap,
    );

  if (
    !start ||
    !end ||
    !duration ||
    end <= start
  ) {
    return [];
  }

  const lunchStart =
    schedule.lunchEnabled
      ? timeToMinutes(
          schedule.lunchStart,
        )
      : 0;

  const lunchEnd =
    schedule.lunchEnabled
      ? timeToMinutes(
          schedule.lunchEnd,
        )
      : 0;

  if (
    schedule.lunchEnabled &&
    (!lunchStart ||
      !lunchEnd ||
      lunchEnd <=
        lunchStart ||
      lunchStart < start ||
      lunchEnd > end)
  ) {
    return [];
  }

  const slots:
    string[] = [];

  let cursor =
    start;

  while (
    cursor +
      duration <=
    end
  ) {
    const slotEnd =
      cursor +
      duration;

    const overlapsLunch =
      schedule.lunchEnabled &&
      cursor <
        lunchEnd &&
      slotEnd >
        lunchStart;

    if (
      overlapsLunch
    ) {
      cursor =
        lunchEnd;

      continue;
    }

    slots.push(
      `${formatTime(
        cursor,
      )} – ${formatTime(
        slotEnd,
      )}`,
    );

    cursor =
      slotEnd +
      gap;
  }

  return slots;
}

const inputClass =
  'h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-secondary outline-none transition duration-150 placeholder:text-gray-400 hover:border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400';

const selectClass =
  `${inputClass} cursor-pointer`;

const labelClass =
  'mb-1.5 block text-xs font-semibold text-secondary';

const buttonBase =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg font-semibold transition duration-150 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

export default function EditEventPage() {
  const router =
    useRouter();

  const params =
    useParams<{
      id: string;
    }>();

  const eventId =
    params.id;

  const [
    initialLoading,
    setInitialLoading,
  ] =
    useState(true);

  const [
    loadError,
    setLoadError,
  ] =
    useState('');

  const [
    eventName,
    setEventName,
  ] =
    useState('');

  const [
    eventType,
    setEventType,
  ] =
    useState<
      | 'conference'
      | 'mantram'
      | 'event'
      | ''
    >('');

  const [
    bookingFormTemplate,
    setBookingFormTemplate,
  ] =
    useState<BookingFormTemplate>(
      DEFAULT_BOOKING_TEMPLATE,
    );

  const [
    venue,
    setVenue,
  ] =
    useState('');

  const [
    description,
    setDescription,
  ] =
    useState('');

  const [
    numberOfDays,
    setNumberOfDays,
  ] =
    useState(1);

  const [
    startDate,
    setStartDate,
  ] =
    useState('');

  const [
    formError,
    setFormError,
  ] =
    useState('');

  const [
    thumbnailPreview,
    setThumbnailPreview,
  ] =
    useState<ThumbnailPreview | null>(
      null,
    );

  const [
    selectedThumbnail,
    setSelectedThumbnail,
  ] =
    useState<File | null>(
      null,
    );

  const [
    submissionState,
    setSubmissionState,
  ] =
    useState<
      | 'idle'
      | 'saving'
      | 'success'
    >(
      'idle',
    );

  const [
    daySchedules,
    setDaySchedules,
  ] =
    useState<
      DaySchedule[]
    >(() =>
      Array.from(
        {
          length:
            10,
        },

        (
          _,
          index,
        ) =>
          createDaySchedule(
            index >
              0,
          ),
      ),
    );

  useEffect(() => {
    let cancelled =
      false;

    async function loadEvent() {
      setInitialLoading(
        true,
      );

      setLoadError('');

      try {
        const res =
          await fetch(
            `/api/events/${encodeURIComponent(
              eventId,
            )}?refresh=${Date.now()}`,
            {
              method:
                'GET',

              cache:
                'no-store',
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
              'Failed to load event.',
          );
        }

        if (
          cancelled
        ) {
          return;
        }

        const event =
          data.event as
            EventResponse;

        setEventName(
          event.eventName,
        );

        setEventType(
          event.eventType,
        );

        setBookingFormTemplate(
          isBookingFormTemplate(
            event.bookingFormTemplate,
          )
            ? event.bookingFormTemplate
            : DEFAULT_BOOKING_TEMPLATE,
        );

        setVenue(
          event.venue,
        );

        setDescription(
          event.description,
        );

        setNumberOfDays(
          event.numberOfDays,
        );

        setStartDate(
          toDateInputValue(
            event.startDate,
          ),
        );

        if (
          event.imageUrl
        ) {
          setThumbnailPreview({
            name:
              'Current event image',

            url:
              event.imageUrl,

            local:
              false,
          });
        } else {
          setThumbnailPreview(
            null,
          );
        }

        setSelectedThumbnail(
          null,
        );

        const nextSchedules =
          Array.from(
            {
              length:
                10,
            },

            (
              _,
              index,
            ) =>
              createDaySchedule(
                index >
                  0,
              ),
          );

        for (
          const schedule of
            event.daySchedules
        ) {
          const index =
            schedule.dayNumber -
            1;

          if (
            index <
              0 ||
            index >=
              10
          ) {
            continue;
          }

          nextSchedules[
            index
          ] = {
            startTime:
              schedule.startTime,

            endTime:
              schedule.endTime,

            lunchEnabled:
              schedule.lunchEnabled,

            lunchStart:
              schedule.lunchStart ||
              '',

            lunchEnd:
              schedule.lunchEnd ||
              '',

            slotDuration:
              String(
                schedule.slotDuration,
              ),

            slotGap:
              String(
                schedule.slotGap,
              ),

            capacity:
              String(
                schedule.capacity,
              ),

            sameAsDay1:
              schedule.sameAsDay1,
          };
        }

        setDaySchedules(
          nextSchedules,
        );
      } catch (
        error: unknown
      ) {
        if (
          cancelled
        ) {
          return;
        }

        setLoadError(
          error instanceof
            Error
            ? error.message
            : 'Failed to load event.',
        );
      } finally {
        if (
          !cancelled
        ) {
          setInitialLoading(
            false,
          );
        }
      }
    }

    if (
      eventId
    ) {
      void loadEvent();
    }

    return () => {
      cancelled =
        true;
    };
  }, [
    eventId,
  ]);

  useEffect(() => {
    return () => {
      if (
        thumbnailPreview?.local
      ) {
        URL.revokeObjectURL(
          thumbnailPreview.url,
        );
      }
    };
  }, [
    thumbnailPreview,
  ]);

  const eventDates =
    useMemo(
      () =>
        Array.from(
          {
            length:
              numberOfDays,
          },

          (
            _,
            index,
          ) =>
            startDate
              ? addDays(
                  startDate,
                  index,
                )
              : '',
        ),
      [
        numberOfDays,
        startDate,
      ],
    );

  const endDate =
    eventDates[
      eventDates.length -
        1
    ] ?? '';

  const generatedSlots =
    useMemo(
      () =>
        daySchedules
          .slice(
            0,
            numberOfDays,
          )
          .map(
            (
              schedule,
            ) =>
              generateSlots(
                schedule,
              ),
          ),
      [
        daySchedules,
        numberOfDays,
      ],
    );

  function handleThumbnailChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    setSelectedThumbnail(
      file,
    );

    if (
      thumbnailPreview?.local
    ) {
      URL.revokeObjectURL(
        thumbnailPreview.url,
      );
    }

    setThumbnailPreview({
      name:
        file.name,

      url:
        URL.createObjectURL(
          file,
        ),

      local:
        true,
    });

    setFormError('');
  }

  function updateDaySchedule(
    index: number,
    field:
      keyof DaySchedule,
    value:
      | string
      | boolean,
  ) {
    setDaySchedules(
      (current) => {
        const next =
          current.map(
            (
              schedule,
            ) => ({
              ...schedule,
            }),
          );

        next[
          index
        ] = {
          ...next[
            index
          ],

          [field]:
            value,
        };

        if (
          index ===
            0 &&
          field !==
            'sameAsDay1'
        ) {
          for (
            let dayIndex =
              1;
            dayIndex <
            next.length;
            dayIndex +=
              1
          ) {
            if (
              next[
                dayIndex
              ]
                .sameAsDay1
            ) {
              next[
                dayIndex
              ] =
                copyDay1Schedule(
                  next[
                    0
                  ],
                  true,
                );
            }
          }
        }

        return next;
      },
    );

    setFormError('');
  }

  function toggleSameAsDay1(
    index: number,
    checked: boolean,
  ) {
    if (
      index === 0
    ) {
      return;
    }

    setDaySchedules(
      (current) =>
        current.map(
          (
            schedule,
            scheduleIndex,
          ) => {
            if (
              scheduleIndex !==
              index
            ) {
              return schedule;
            }

            if (
              checked
            ) {
              return copyDay1Schedule(
                current[
                  0
                ],
                true,
              );
            }

            return {
              ...schedule,

              sameAsDay1:
                false,
            };
          },
        ),
    );

    setFormError('');
  }

  function applyDay1ToAll() {
    setDaySchedules(
      (current) =>
        current.map(
          (
            schedule,
            index,
          ) =>
            index ===
            0
              ? {
                  ...schedule,

                  sameAsDay1:
                    false,
                }
              : copyDay1Schedule(
                  current[
                    0
                  ],
                  true,
                ),
        ),
    );

    setFormError('');
  }

  function validateSchedule(
    schedule: DaySchedule,
    index: number,
  ) {
    const start =
      timeToMinutes(
        schedule.startTime,
      );

    const end =
      timeToMinutes(
        schedule.endTime,
      );

    const capacity =
      Number(
        schedule.capacity,
      );

    const slotGap =
      Number(
        schedule.slotGap,
      );

    if (
      !schedule.startTime ||
      !schedule.endTime ||
      end <= start
    ) {
      return `Day ${
        index + 1
      }: end time must be later than start time.`;
    }

    if (
      schedule.lunchEnabled
    ) {
      const lunchStart =
        timeToMinutes(
          schedule.lunchStart,
        );

      const lunchEnd =
        timeToMinutes(
          schedule.lunchEnd,
        );

      if (
        !schedule.lunchStart ||
        !schedule.lunchEnd ||
        lunchStart <
          start ||
        lunchEnd >
          end ||
        lunchEnd <=
          lunchStart
      ) {
        return `Day ${
          index + 1
        }: lunch must fall within the event schedule.`;
      }
    }

    if (
      !GAP_OPTIONS.includes(
        slotGap,
      )
    ) {
      return `Day ${
        index + 1
      }: choose a valid slot gap.`;
    }

    if (
      capacity <
        1 ||
      capacity >
        20
    ) {
      return `Day ${
        index + 1
      }: booking capacity must be between 1 and 20.`;
    }

    if (
      generateSlots(
        schedule,
      ).length ===
      0
    ) {
      return `Day ${
        index + 1
      }: the current schedule cannot generate any booking slots.`;
    }

    return '';
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setFormError('');

    if (!startDate) {
      setFormError(
        'Please select a start date.',
      );

      return;
    }

    for (
      let index =
        0;
      index <
      numberOfDays;
      index += 1
    ) {
      const error =
        validateSchedule(
          daySchedules[
            index
          ],
          index,
        );

      if (
        error
      ) {
        setFormError(
          error,
        );

        return;
      }
    }

    if (
      !eventType
    ) {
      setFormError(
        'Please select an event type.',
      );

      return;
    }

    if (
      !isBookingFormTemplate(
        bookingFormTemplate,
      )
    ) {
      setFormError(
        'Please select a valid registration form template.',
      );

      return;
    }

    setSubmissionState(
      'saving',
    );

    try {
      const formData =
        new FormData();

      formData.set(
        'eventName',
        eventName,
      );

      formData.set(
        'eventType',
        eventType,
      );

      formData.set(
        'bookingFormTemplate',
        bookingFormTemplate,
      );

      formData.set(
        'venue',
        venue,
      );

      formData.set(
        'description',
        description,
      );

      formData.set(
        'numberOfDays',
        String(
          numberOfDays,
        ),
      );

      formData.set(
        'startDate',
        startDate,
      );

      formData.set(
        'endDate',
        endDate,
      );

      if (
        selectedThumbnail
      ) {
        formData.set(
          'thumbnail',
          selectedThumbnail,
        );
      }

      const schedulesToSubmit =
        daySchedules
          .slice(
            0,
            numberOfDays,
          )
          .map(
            (
              schedule,
              index,
            ) => ({
              ...schedule,

              date:
                eventDates[
                  index
                ],
            }),
          );

      formData.set(
        'daySchedules',
        JSON.stringify(
          schedulesToSubmit,
        ),
      );

      const res =
        await fetch(
          `/api/events/${encodeURIComponent(
            eventId,
          )}`,
          {
            method:
              'PUT',

            body:
              formData,

            cache:
              'no-store',
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
            'Failed to update event.',
        );
      }

      if (
        data.bookingFormTemplate !==
        bookingFormTemplate
      ) {
        throw new Error(
          `Template update mismatch. Requested "${bookingFormTemplate}" but server returned "${String(
            data.bookingFormTemplate,
          )}".`,
        );
      }

      if (
        data.imageUrl
      ) {
        setThumbnailPreview({
          name:
            selectedThumbnail?.name ||
            'Current event image',

          url:
            data.imageUrl,

          local:
            false,
        });
      }

      setSelectedThumbnail(
        null,
      );

      setSubmissionState(
        'success',
      );

      window.setTimeout(
        () => {
          router.replace(
            '/admin/eventmanagement',
          );

          router.refresh();
        },
        600,
      );
    } catch (
      error: unknown
    ) {
      setSubmissionState(
        'idle',
      );

      setFormError(
        error instanceof
          Error
          ? error.message
          : 'An error occurred while updating the event.',
      );
    }
  }

  if (
    initialLoading
  ) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-primary/15 border-r-primary border-t-primary" />

          <p className="mt-3 text-sm font-medium text-gray-500">
            Loading event…
          </p>
        </div>
      </div>
    );
  }

  if (
    loadError
  ) {
    return (
      <div className="mx-auto w-full max-w-[1600px]">
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <h1 className="font-semibold text-red-700">
            Unable to load event
          </h1>

          <p className="mt-1 text-sm text-red-600">
            {loadError}
          </p>

          <Link
            href="/admin/eventmanagement"
            className="mt-4 inline-flex rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700"
          >
            ← Back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={
        handleSubmit
      }
      className="mx-auto w-full max-w-[1600px] space-y-4 pb-6"
    >
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-secondary sm:text-3xl">
            Edit Event
          </h1>

          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
            Update event details, registration form,
            duration and booking schedule.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <Link
            href="/admin/eventmanagement"
            className={`${buttonBase} h-10 border border-gray-200 bg-white px-5 text-sm text-secondary`}
          >
            ← Back
          </Link>

          <button
            type="submit"
            disabled={
              submissionState !==
              'idle'
            }
            className={`${buttonBase} h-10 bg-primary px-6 text-sm text-white shadow-sm`}
          >
            {submissionState ===
            'saving'
              ? 'Saving...'
              : submissionState ===
                  'success'
                ? 'Saved'
                : 'Save Changes'}
          </button>
        </div>
      </header>

      {formError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {formError}
        </div>
      )}

      <div className="grid items-start gap-5 2xl:grid-cols-[minmax(360px,0.78fr)_minmax(0,1.22fr)]">
        <div className="space-y-5">
          <section className="card space-y-5 p-4 sm:p-5 lg:p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Section 1
              </p>

              <h2 className="mt-1 text-lg font-bold text-secondary">
                Event details
              </h2>
            </div>

            <div>
              <label className={labelClass}>
                Event/Conference Name/Mantram
              </label>

              <input
                name="eventName"
                required
                value={
                  eventName
                }
                onChange={(
                  event,
                ) =>
                  setEventName(
                    event.target.value,
                  )
                }
                className={
                  inputClass
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>
                  Event Type
                </label>

                <select
                  name="eventType"
                  required
                  value={
                    eventType
                  }
                  onChange={(
                    event,
                  ) =>
                    setEventType(
                      event.target.value as
                        | 'conference'
                        | 'mantram'
                        | 'event',
                    )
                  }
                  className={
                    selectClass
                  }
                >
                  <option value="conference">
                    Conference
                  </option>

                  <option value="mantram">
                    Mantram
                  </option>

                  <option value="event">
                    Event
                  </option>
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  Venue/Location
                </label>

                <input
                  name="venue"
                  required
                  value={
                    venue
                  }
                  onChange={(
                    event,
                  ) =>
                    setVenue(
                      event.target.value,
                    )
                  }
                  className={
                    inputClass
                  }
                />
              </div>
            </div>

            <BookingTemplateSelector
              value={
                bookingFormTemplate
              }
              onChange={(
                value,
              ) => {
                setBookingFormTemplate(
                  value,
                );

                setFormError('');
              }}
            />

            <input
              type="hidden"
              name="bookingFormTemplate"
              value={
                bookingFormTemplate
              }
            />

            <div>
              <label className={labelClass}>
                Description
              </label>

              <textarea
                name="description"
                required
                rows={4}
                value={
                  description
                }
                onChange={(
                  event,
                ) =>
                  setDescription(
                    event.target.value,
                  )
                }
                className={`${inputClass} h-auto min-h-24 resize-y py-2.5`}
              />
            </div>

            <div>
              <label className={labelClass}>
                Event Thumbnail
              </label>

              <label
                htmlFor="thumbnail"
                className="block cursor-pointer overflow-hidden rounded-xl border border-gray-200 bg-white"
              >
                {thumbnailPreview ? (
                  <div className="flex items-center gap-3 p-3">
                    <div className="h-16 w-20 overflow-hidden rounded-lg">
                      <img
                        src={
                          thumbnailPreview.url
                        }
                        alt="Event"
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <p className="truncate text-sm font-semibold text-secondary">
                      {
                        thumbnailPreview.name
                      }
                    </p>
                  </div>
                ) : (
                  <div className="p-4 text-sm text-gray-500">
                    Choose an image
                  </div>
                )}

                <input
                  id="thumbnail"
                  name="thumbnail"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={
                    handleThumbnailChange
                  }
                  className="sr-only"
                />
              </label>
            </div>
          </section>

          <section className="card space-y-5 p-4 sm:p-5 lg:p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Section 2
              </p>

              <h2 className="mt-1 text-lg font-bold text-secondary">
                Event duration
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 2xl:grid-cols-1">
              <select
                value={
                  numberOfDays
                }
                onChange={(
                  event,
                ) =>
                  setNumberOfDays(
                    Number(
                      event.target.value,
                    ),
                  )
                }
                className={
                  selectClass
                }
              >
                {Array.from(
                  {
                    length:
                      10,
                  },
                  (
                    _,
                    index,
                  ) =>
                    index +
                    1,
                ).map(
                  (
                    days,
                  ) => (
                    <option
                      key={
                        days
                      }
                      value={
                        days
                      }
                    >
                      {
                        days
                      }{' '}
                      {days ===
                      1
                        ? 'day'
                        : 'days'}
                    </option>
                  ),
                )}
              </select>

              <input
                type="date"
                value={
                  startDate
                }
                onChange={(
                  event,
                ) =>
                  setStartDate(
                    event.target.value,
                  )
                }
                className={
                  inputClass
                }
              />

              <input
                type="date"
                value={
                  endDate
                }
                readOnly
                className={`${inputClass} bg-gray-50`}
              />
            </div>

            {startDate && (
              <div className="rounded-xl border border-primary/15 bg-primary/[0.04] px-4 py-3 text-sm text-secondary">
                {formatDate(
                  startDate,
                )}

                {numberOfDays >
                  1 &&
                  ` – ${formatDate(
                    endDate,
                  )}`}
              </div>
            )}
          </section>
        </div>

        <section className="card min-w-0 space-y-5 p-4 sm:p-5 lg:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Section 3
              </p>

              <h2 className="mt-1 text-lg font-bold text-secondary">
                Daily schedule and booking slots
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Existing booked time slots are protected.
              </p>
            </div>

            {numberOfDays >
              1 && (
              <button
                type="button"
                onClick={
                  applyDay1ToAll
                }
                className={`${buttonBase} border border-primary/20 bg-primary/[0.06] px-3 py-2 text-xs text-primary`}
              >
                Apply Day 1 to all
              </button>
            )}
          </div>

          <div className="space-y-4">
            {daySchedules
              .slice(
                0,
                numberOfDays,
              )
              .map(
                (
                  schedule,
                  index,
                ) => (
                  <fieldset
                    key={
                      index
                    }
                    className="rounded-xl border border-gray-200 bg-gray-50/60 p-4"
                  >
                    <legend className="px-2 font-bold text-secondary">
                      Day{' '}
                      {index +
                        1}{' '}

                      <span className="text-xs font-normal text-gray-500">
                        {formatDate(
                          eventDates[
                            index
                          ],
                        )}
                      </span>
                    </legend>

                    {index >
                      0 && (
                      <label className="mb-4 flex gap-2 text-xs font-semibold">
                        <input
                          type="checkbox"
                          checked={
                            schedule.sameAsDay1
                          }
                          onChange={(
                            event,
                          ) =>
                            toggleSameAsDay1(
                              index,
                              event.target.checked,
                            )
                          }
                        />

                        Same as Day 1
                      </label>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <ScheduleField label="Start Time">
                        <input
                          type="time"
                          value={
                            schedule.startTime
                          }
                          disabled={
                            schedule.sameAsDay1
                          }
                          onChange={(
                            event,
                          ) =>
                            updateDaySchedule(
                              index,
                              'startTime',
                              event.target.value,
                            )
                          }
                          className={
                            inputClass
                          }
                        />
                      </ScheduleField>

                      <ScheduleField label="End Time">
                        <input
                          type="time"
                          value={
                            schedule.endTime
                          }
                          disabled={
                            schedule.sameAsDay1
                          }
                          onChange={(
                            event,
                          ) =>
                            updateDaySchedule(
                              index,
                              'endTime',
                              event.target.value,
                            )
                          }
                          className={
                            inputClass
                          }
                        />
                      </ScheduleField>

                      <ScheduleField label="Slot Duration">
                        <input
                          type="number"
                          value={
                            schedule.slotDuration
                          }
                          disabled={
                            schedule.sameAsDay1
                          }
                          onChange={(
                            event,
                          ) =>
                            updateDaySchedule(
                              index,
                              'slotDuration',
                              event.target.value,
                            )
                          }
                          className={
                            inputClass
                          }
                        />
                      </ScheduleField>

                      <ScheduleField label="Gap">
                        <select
                          value={
                            schedule.slotGap
                          }
                          disabled={
                            schedule.sameAsDay1
                          }
                          onChange={(
                            event,
                          ) =>
                            updateDaySchedule(
                              index,
                              'slotGap',
                              event.target.value,
                            )
                          }
                          className={
                            selectClass
                          }
                        >
                          {GAP_OPTIONS.map(
                            (
                              gap,
                            ) => (
                              <option
                                key={
                                  gap
                                }
                                value={
                                  gap
                                }
                              >
                                {gap ===
                                0
                                  ? 'No gap'
                                  : `${gap} min`}
                              </option>
                            ),
                          )}
                        </select>
                      </ScheduleField>

                      <ScheduleField label="Capacity">
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={
                            schedule.capacity
                          }
                          disabled={
                            schedule.sameAsDay1
                          }
                          onChange={(
                            event,
                          ) =>
                            updateDaySchedule(
                              index,
                              'capacity',
                              event.target.value,
                            )
                          }
                          className={
                            inputClass
                          }
                        />
                      </ScheduleField>

                      <label className="flex items-center gap-2 rounded-lg border bg-white p-3 text-xs font-semibold">
                        <input
                          type="checkbox"
                          checked={
                            schedule.lunchEnabled
                          }
                          disabled={
                            schedule.sameAsDay1
                          }
                          onChange={(
                            event,
                          ) =>
                            updateDaySchedule(
                              index,
                              'lunchEnabled',
                              event.target.checked,
                            )
                          }
                        />

                        Lunch Break
                      </label>
                    </div>

                    {schedule.lunchEnabled && (
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <input
                          type="time"
                          value={
                            schedule.lunchStart
                          }
                          disabled={
                            schedule.sameAsDay1
                          }
                          onChange={(
                            event,
                          ) =>
                            updateDaySchedule(
                              index,
                              'lunchStart',
                              event.target.value,
                            )
                          }
                          className={
                            inputClass
                          }
                        />

                        <input
                          type="time"
                          value={
                            schedule.lunchEnd
                          }
                          disabled={
                            schedule.sameAsDay1
                          }
                          onChange={(
                            event,
                          ) =>
                            updateDaySchedule(
                              index,
                              'lunchEnd',
                              event.target.value,
                            )
                          }
                          className={
                            inputClass
                          }
                        />
                      </div>
                    )}

                    <div className="mt-4 rounded-lg bg-white p-3">
                      <p className="text-xs font-semibold text-secondary">
                        Generated Slots:{' '}
                        {
                          generatedSlots[
                            index
                          ].length
                        }
                      </p>
                    </div>
                  </fieldset>
                ),
              )}
          </div>
        </section>
      </div>
    </form>
  );
}

function ScheduleField({
  label,
  children,
}: {
  label: string;
  children:
    React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-secondary">
        {label}
      </label>

      {children}
    </div>
  );
}