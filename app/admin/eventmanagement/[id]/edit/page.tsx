'use client';

import type {
  ChangeEvent,
  FormEvent,
  ReactNode,
} from 'react';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import Image from 'next/image';
import Link from 'next/link';

import {
  useParams,
  useRouter,
} from 'next/navigation';

import {
  AnimatePresence,
  motion,
} from 'framer-motion';

import BookingTemplateSelector from '@/app/components/admin/booking-templates/BookingTemplateSelector';

import {
  BookingFormTemplate,
  DEFAULT_BOOKING_TEMPLATE,
  isBookingFormTemplate,
} from '@/app/components/admin/booking-templates/types';

import { useFormDraft } from '@/lib/use-form-draft';
import { prepareImageForUpload } from '@/lib/image-upload';

/* ============================================================
   TYPES
============================================================ */

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

  bookingFormTemplate?: BookingFormTemplate;

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

type SubmissionState =
  | 'idle'
  | 'saving'
  | 'success';

/* ============================================================
   CONSTANTS
============================================================ */

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

const EASE = [
  0.16,
  1,
  0.3,
  1,
] as const;

const inputClass = `
  h-10
  w-full
  min-w-0

  rounded-lg

  border
  border-gray-200

  bg-white

  px-3

  text-[11px]
  font-medium

  text-secondary

  outline-none

  transition-all
  duration-150

  placeholder:text-gray-400

  hover:border-gray-300

  focus:border-primary/45
  focus:ring-2
  focus:ring-primary/10

  disabled:cursor-not-allowed
  disabled:border-gray-100
  disabled:bg-gray-50
  disabled:text-gray-400

  sm:text-[12px]
`;

const selectClass = `
  ${inputClass}
  cursor-pointer
`;

const secondaryButton = `
  inline-flex
  h-10

  items-center
  justify-center
  gap-1.5

  rounded-lg

  border
  border-gray-200

  bg-white

  px-3.5

  text-[10px]
  font-semibold

  text-secondary

  transition-all
  duration-150

  hover:border-gray-300
  hover:bg-gray-50

  focus:outline-none
  focus:ring-2
  focus:ring-primary/10

  disabled:cursor-not-allowed
  disabled:opacity-50
`;

const primaryButton = `
  inline-flex
  h-10

  items-center
  justify-center
  gap-1.5

  rounded-lg

  bg-primary

  px-4

  text-[10px]
  font-semibold

  text-white

  shadow-[0_4px_14px_rgba(26,158,143,0.18)]

  transition-all
  duration-150

  hover:bg-primary-dark

  focus:outline-none
  focus:ring-2
  focus:ring-primary/20

  disabled:cursor-not-allowed
  disabled:opacity-50
`;

/* ============================================================
   DEFAULT DAY
============================================================ */

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

/* ============================================================
   DATE HELPERS
============================================================ */

function parseLocalDate(
  value: string,
) {
  const [
    year,
    month,
    day,
  ] = value
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
      : new Date(value);

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
    return 'Date not selected';
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

function formatCompactDate(
  value: string,
) {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat(
    'en-IN',
    {
      day: 'numeric',
      month: 'short',
    },
  ).format(
    parseLocalDate(
      value,
    ),
  );
}

/* ============================================================
   TIME HELPERS
============================================================ */

function timeToMinutes(
  value: string,
) {
  if (!value) {
    return 0;
  }

  const [
    hours,
    minutes,
  ] = value
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

/* ============================================================
   SCHEDULE HELPERS
============================================================ */

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
    (
      !lunchStart ||
      !lunchEnd ||
      lunchEnd <= lunchStart ||
      lunchStart < start ||
      lunchEnd > end
    )
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

/* ============================================================
   PAGE
============================================================ */

export default function EditEventPage() {
  const router =
    useRouter();

  const params =
    useParams<{
      id: string;
    }>();

  const eventId =
    params.id;

  const formRef =
    useRef<HTMLFormElement | null>(
      null,
    );

  /* ==========================================================
     LOADING
  ========================================================== */

  const [
    initialLoading,
    setInitialLoading,
  ] = useState(true);

  const [
    loadError,
    setLoadError,
  ] = useState('');

  useFormDraft(
    initialLoading
      ? ''
      : `ssi-event-draft:edit:${eventId}`,
    formRef,
  );

  /* ==========================================================
     EVENT
  ========================================================== */

  const [
    eventName,
    setEventName,
  ] = useState('');

  const [
    eventType,
    setEventType,
  ] = useState<
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
  ] = useState('');

  const [
    description,
    setDescription,
  ] = useState('');

  const [
    numberOfDays,
    setNumberOfDays,
  ] = useState(1);

  const [
    startDate,
    setStartDate,
  ] = useState('');

  const [
    formError,
    setFormError,
  ] = useState('');

  /* ==========================================================
     IMAGE
  ========================================================== */

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

  /* ==========================================================
     SAVE
  ========================================================== */

  const [
    submissionState,
    setSubmissionState,
  ] =
    useState<SubmissionState>(
      'idle',
    );

  /* ==========================================================
     SCHEDULE
  ========================================================== */

  const [
    daySchedules,
    setDaySchedules,
  ] =
    useState<DaySchedule[]>(
      () =>
        Array.from(
          {
            length: 10,
          },
          (
            _,
            index,
          ) =>
            createDaySchedule(
              index > 0,
            ),
        ),
    );

  const [
    selectedDayIndex,
    setSelectedDayIndex,
  ] = useState(0);

  /* ==========================================================
     LOAD EVENT
  ========================================================== */

  useEffect(() => {
    let cancelled =
      false;

    async function loadEvent() {
      setInitialLoading(
        true,
      );

      setLoadError('');

      try {
        const response =
          await fetch(
            `/api/events/${encodeURIComponent(
              eventId,
            )}?refresh=${Date.now()}`,
            {
              method: 'GET',
              cache: 'no-store',
            },
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.error ||
              'Failed to load event.',
          );
        }

        if (cancelled) {
          return;
        }

        const event =
          data.event as EventResponse;

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
              length: 10,
            },
            (
              _,
              index,
            ) =>
              createDaySchedule(
                index > 0,
              ),
          );

        for (
          const schedule of
            event.daySchedules ??
            []
        ) {
          const index =
            schedule.dayNumber -
            1;

          if (
            index < 0 ||
            index >= 10
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

        setSelectedDayIndex(
          0,
        );
      } catch (
        error: unknown
      ) {
        if (cancelled) {
          return;
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Failed to load event.',
        );
      } finally {
        if (!cancelled) {
          setInitialLoading(
            false,
          );
        }
      }
    }

    if (eventId) {
      void loadEvent();
    }

    return () => {
      cancelled =
        true;
    };
  }, [
    eventId,
  ]);

  /* ==========================================================
     IMAGE CLEANUP
  ========================================================== */

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

  /* ==========================================================
     COMPUTED DATES
  ========================================================== */

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

  /* ==========================================================
     GENERATED SLOTS
  ========================================================== */

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

  const activeDayIndex =
    Math.min(
      selectedDayIndex,
      Math.max(
        numberOfDays -
          1,
        0,
      ),
    );

  const activeSchedule =
    daySchedules[
      activeDayIndex
    ];

  const activeSlots =
    generatedSlots[
      activeDayIndex
    ] ?? [];

  const activeCapacity =
    Number(
      activeSchedule?.capacity ||
        0,
    );

  const totalDayCapacity =
    activeSlots.length *
    activeCapacity;

  /* ==========================================================
     IMAGE CHANGE
  ========================================================== */

  async function handleThumbnailChange(
    event:
      ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target
        .files?.[0];

    if (!file) {
      return;
    }

    if (
      ![
        'image/jpeg',
        'image/png',
        'image/webp',
      ].includes(
        file.type,
      )
    ) {
      setFormError(
        'Please select a JPG, PNG or WebP image.',
      );

      return;
    }

    try {
      const optimizedFile =
        await prepareImageForUpload(file);

      if (
        thumbnailPreview?.local
      ) {
        URL.revokeObjectURL(
          thumbnailPreview.url,
        );
      }

      setSelectedThumbnail(
        optimizedFile,
      );

      setThumbnailPreview({
        name:
          optimizedFile.name,

        url:
          URL.createObjectURL(
            optimizedFile,
          ),

        local:
          true,
      });

      setFormError('');
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Unable to process the selected image.',
      );
    }
  }

  /* ==========================================================
     UPDATE DAY
  ========================================================== */

  function updateDaySchedule(
    index: number,

    field:
      keyof DaySchedule,

    value:
      | string
      | boolean,
  ) {
    setDaySchedules(
      (
        current,
      ) => {
        const next =
          current.map(
            (
              schedule,
            ) => ({
              ...schedule,
            }),
          );

        next[index] = {
          ...next[index],
          [field]:
            value,
        };

        if (
          index === 0 &&
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
              ].sameAsDay1
            ) {
              next[
                dayIndex
              ] =
                copyDay1Schedule(
                  next[0],
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

  /* ==========================================================
     SAME AS DAY 1
  ========================================================== */

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
      (
        current,
      ) =>
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

            if (checked) {
              return copyDay1Schedule(
                current[0],
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

  /* ==========================================================
     APPLY DAY 1
  ========================================================== */

  function applyDay1ToAll() {
    setDaySchedules(
      (
        current,
      ) =>
        current.map(
          (
            schedule,
            index,
          ) =>
            index === 0
              ? {
                  ...schedule,
                  sameAsDay1:
                    false,
                }
              : copyDay1Schedule(
                  current[0],
                  true,
                ),
        ),
    );

    setFormError('');
  }

  /* ==========================================================
     NUMBER OF DAYS
  ========================================================== */

  function handleDaysChange(
    value: number,
  ) {
    setNumberOfDays(
      value,
    );

    if (
      selectedDayIndex >=
      value
    ) {
      setSelectedDayIndex(
        Math.max(
          value - 1,
          0,
        ),
      );
    }

    setFormError('');
  }

  /* ==========================================================
     VALIDATE
  ========================================================== */

  function validateSchedule(
    schedule:
      DaySchedule,

    index:
      number,
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
      capacity < 1 ||
      capacity > 20
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

  /* ==========================================================
     SUBMIT
  ========================================================== */

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setFormError('');

    if (
      !eventName.trim()
    ) {
      setFormError(
        'Please enter an event name.',
      );

      return;
    }

    if (!eventType) {
      setFormError(
        'Please select an event type.',
      );

      return;
    }

    if (
      !venue.trim()
    ) {
      setFormError(
        'Please enter the venue or location.',
      );

      return;
    }

    if (
      !description.trim()
    ) {
      setFormError(
        'Please enter an event description.',
      );

      return;
    }

    if (!startDate) {
      setFormError(
        'Please select a start date.',
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

    for (
      let index = 0;
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

      if (error) {
        setSelectedDayIndex(
          index,
        );

        setFormError(
          error,
        );

        return;
      }
    }

    setSubmissionState(
      'saving',
    );

    try {
      const formData =
        new FormData();

      formData.set(
        'eventName',
        eventName.trim(),
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
        venue.trim(),
      );

      formData.set(
        'description',
        description.trim(),
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

      const response =
        await fetch(
          `/api/events/${encodeURIComponent(
            eventId,
          )}`,
          {
            method: 'PUT',
            body: formData,
            cache: 'no-store',
          },
        );

      const data =
        await response.json();

      if (
        !response.ok ||
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
        if (
          thumbnailPreview?.local
        ) {
          URL.revokeObjectURL(
            thumbnailPreview.url,
          );
        }

        setThumbnailPreview({
          name:
            selectedThumbnail
              ?.name ||
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
        650,
      );
    } catch (
      error: unknown
    ) {
      setSubmissionState(
        'idle',
      );

      setFormError(
        error instanceof Error
          ? error.message
          : 'An error occurred while updating the event.',
      );
    }
  }

  /* ==========================================================
     LOADING
  ========================================================== */

  if (
    initialLoading
  ) {
    return (
      <PageSkeleton />
    );
  }

  /* ==========================================================
     LOAD ERROR
  ========================================================== */

  if (
    loadError
  ) {
    return (
      <div
        className="
          mx-auto
          w-full
          max-w-[1600px]
        "
      >
        <div
          className="
            rounded-xl

            border
            border-red-200

            bg-red-50

            p-4
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
                  text-[12px]
                  font-semibold

                  text-red-700
                "
              >
                Unable to load event
              </p>

              <p
                className="
                  mt-1

                  text-[10px]
                  leading-5

                  text-red-600
                "
              >
                {loadError}
              </p>
            </div>
          </div>

          <Link
            href="/admin/eventmanagement"
            className="
              mt-3

              inline-flex
              h-9

              items-center
              gap-1.5

              rounded-lg

              border
              border-red-200

              bg-white

              px-3

              text-[10px]
              font-semibold

              text-red-700
            "
          >
            <BackIcon />

            Back to Events
          </Link>
        </div>
      </div>
    );
  }

  /* ==========================================================
     PAGE
  ========================================================== */

  return (
    <motion.form
      ref={formRef}
      initial={{
        opacity: 0,
        y: 4,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        duration: 0.3,
        ease: EASE,
      }}
      onSubmit={
        handleSubmit
      }
      className="
        mx-auto

        w-full
        min-w-0
        max-w-[1600px]

        space-y-3

        pb-6
      "
    >
      {/* ======================================================
          ACTION BAR
      ====================================================== */}

      <div
        className="
          sticky
          top-2
          z-30

          flex
          items-center
          justify-between
          gap-3

          rounded-xl

          border
          border-gray-200

          bg-white/95

          p-2

          shadow-[0_4px_18px_rgba(27,75,107,0.055)]

          backdrop-blur-xl
        "
      >
        <Link
          href="/admin/eventmanagement"
          className={
            secondaryButton
          }
        >
          <BackIcon />

          <span>
            Back
          </span>
        </Link>

        <motion.button
          type="submit"
          whileTap={{
            scale: 0.98,
          }}
          disabled={
            submissionState !==
            'idle'
          }
          className={
            primaryButton
          }
        >
          {submissionState ===
          'saving' ? (
            <>
              <Spinner />

              Saving...
            </>
          ) : submissionState ===
            'success' ? (
            <>
              <CheckIcon />

              Saved
            </>
          ) : (
            <>
              <SaveIcon />

              Save Changes
            </>
          )}
        </motion.button>
      </div>

      {/* ======================================================
          ERROR
      ====================================================== */}

      <AnimatePresence>
        {formError && (
          <motion.div
            initial={{
              opacity: 0,
              y: -5,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              y: -5,
            }}
            className="
              flex
              items-start
              gap-2.5

              rounded-lg

              border
              border-red-200

              bg-red-50

              px-3
              py-2.5
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
                min-w-0
                flex-1

                text-[10px]
                font-medium

                leading-4

                text-red-700
              "
            >
              {formError}
            </p>

            <button
              type="button"
              onClick={() =>
                setFormError('')
              }
              className="
                shrink-0

                text-[9px]
                font-semibold

                text-red-600
              "
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ======================================================
          MAIN LAYOUT

          IMPORTANT:
          - NO fixed viewport height
          - NO internal vertical scrolling
          - cards stop at their actual content
      ====================================================== */}

      <div
        className="
          grid
          min-w-0
          items-start
          gap-3

          xl:grid-cols-[minmax(430px,0.92fr)_minmax(0,1.28fr)]
        "
      >
        {/* ====================================================
            EVENT DETAILS
        ==================================================== */}

        <motion.section
          initial={{
            opacity: 0,
            y: 6,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            delay: 0.03,
            duration: 0.3,
          }}
          className="
            min-w-0

            overflow-hidden

            rounded-xl

            border
            border-gray-200

            bg-white

            shadow-[0_3px_14px_rgba(27,75,107,0.025)]
          "
        >
          <CardHeader
            icon={
              <EventIcon />
            }
            title="Event Details"
          />

          <div
            className="
              p-3

              sm:p-3.5
            "
          >
            {/* ================================================
                BASIC INFO
            ================================================ */}

            <div
              className="
                grid
                grid-cols-1
                gap-x-3
                gap-y-2.5

                sm:grid-cols-2
              "
            >
              <Field
                label="Event Name"
                required
                className="sm:col-span-2"
              >
                <input
                  name="eventName"
                  required
                  value={
                    eventName
                  }
                  onChange={(
                    event,
                  ) => {
                    setEventName(
                      event.target
                        .value,
                    );

                    setFormError('');
                  }}
                  placeholder="Enter event name"
                  className={
                    inputClass
                  }
                />
              </Field>

              <Field
                label="Event Type"
                required
              >
                <select
                  name="eventType"
                  required
                  value={
                    eventType
                  }
                  onChange={(
                    event,
                  ) => {
                    setEventType(
                      event.target
                        .value as
                        | 'conference'
                        | 'mantram'
                        | 'event',
                    );

                    setFormError('');
                  }}
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
              </Field>

              <Field
                label="Venue / Location"
                required
              >
                <input
                  name="venue"
                  required
                  value={
                    venue
                  }
                  onChange={(
                    event,
                  ) => {
                    setVenue(
                      event.target
                        .value,
                    );

                    setFormError('');
                  }}
                  placeholder="Enter venue"
                  className={
                    inputClass
                  }
                />
              </Field>

              <Field
                label="Description"
                required
                hint={`${description.length} characters`}
                className="sm:col-span-2"
              >
                <textarea
                  name="description"
                  required
                  rows={3}
                  value={
                    description
                  }
                  onChange={(
                    event,
                  ) => {
                    setDescription(
                      event.target
                        .value,
                    );

                    setFormError('');
                  }}
                  placeholder="Event description"
                  className={`
                    ${inputClass}

                    h-[70px]

                    resize-none

                    py-2.5

                    leading-[17px]
                  `}
                />
              </Field>
            </div>

            {/* ================================================
                DURATION
            ================================================ */}

            <div
              className="
                mt-3

                border-t
                border-gray-100

                pt-3
              "
            >
              <SubHeading
                icon={
                  <CalendarIcon />
                }
                label="Event Duration"
              />

              <div
                className="
                  mt-2

                  grid
                  grid-cols-1
                  gap-2.5

                  min-[430px]:grid-cols-3
                "
              >
                <Field label="Days">
                  <select
                    value={
                      numberOfDays
                    }
                    onChange={(
                      event,
                    ) =>
                      handleDaysChange(
                        Number(
                          event.target
                            .value,
                        ),
                      )
                    }
                    className={
                      selectClass
                    }
                  >
                    {Array.from(
                      {
                        length: 10,
                      },
                      (
                        _,
                        index,
                      ) =>
                        index + 1,
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
                          {days}{' '}
                          {days ===
                          1
                            ? 'Day'
                            : 'Days'}
                        </option>
                      ),
                    )}
                  </select>
                </Field>

                <Field
                  label="Start Date"
                  required
                >
                  <input
                    type="date"
                    value={
                      startDate
                    }
                    onChange={(
                      event,
                    ) => {
                      setStartDate(
                        event.target
                          .value,
                      );

                      setFormError('');
                    }}
                    className={
                      inputClass
                    }
                  />
                </Field>

                <Field label="End Date">
                  <input
                    type="date"
                    value={
                      endDate
                    }
                    readOnly
                    className={`
                      ${inputClass}
                      bg-gray-50
                    `}
                  />
                </Field>
              </div>
            </div>

            {/* ================================================
                THUMBNAIL + REGISTRATION FORM
            ================================================ */}

            <div
              className="
                mt-3

                border-t
                border-gray-100

                pt-3
              "
            >
              <div
                className="
                  grid
                  grid-cols-1
                  gap-3

                  md:grid-cols-[0.92fr_1.08fr]
                  xl:grid-cols-1
                  2xl:grid-cols-[0.92fr_1.08fr]
                "
              >
                {/* THUMBNAIL */}

                <div
                  className="
                    min-w-0
                  "
                >
                  <SubHeading
                    icon={
                      <ImageIcon />
                    }
                    label="Thumbnail"
                  />

                  <label
                    htmlFor="thumbnail"
                    className="
                      group
                      relative

                      mt-2
                      block

                      h-[118px]

                      cursor-pointer

                      overflow-hidden

                      rounded-lg

                      border
                      border-gray-200

                      bg-gray-50

                      transition-all

                      hover:border-primary/30
                    "
                  >
                    {thumbnailPreview ? (
                      <>
                        <Image
                          src={
                            thumbnailPreview.url
                          }
                          alt="Event thumbnail"
                          fill
                          unoptimized
                          sizes="480px"
                          className="
                            object-cover

                            transition-transform
                            duration-300

                            group-hover:scale-[1.02]
                          "
                        />

                        <div
                          className="
                            absolute
                            inset-0

                            bg-gradient-to-t

                            from-black/45
                            via-transparent
                            to-transparent
                          "
                        />

                        <div
                          className="
                            absolute
                            inset-x-2
                            bottom-2

                            flex
                            items-end
                            justify-between
                            gap-2
                          "
                        >
                          <p
                            className="
                              min-w-0
                              truncate

                              text-[8px]
                              font-medium

                              text-white/90
                            "
                          >
                            {
                              thumbnailPreview.name
                            }
                          </p>

                          <span
                            className="
                              inline-flex
                              h-7
                              shrink-0

                              items-center
                              gap-1

                              rounded-md

                              bg-white/95

                              px-2

                              text-[8px]
                              font-semibold

                              text-secondary
                            "
                          >
                            <UploadIcon />

                            Change
                          </span>
                        </div>
                      </>
                    ) : (
                      <div
                        className="
                          flex
                          h-full

                          flex-col
                          items-center
                          justify-center

                          text-center
                        "
                      >
                        <span
                          className="
                            grid
                            h-8
                            w-8

                            place-items-center

                            rounded-lg

                            bg-primary/[0.07]

                            text-primary
                          "
                        >
                          <UploadIcon />
                        </span>

                        <p
                          className="
                            mt-1.5

                            text-[9px]
                            font-semibold

                            text-secondary
                          "
                        >
                          Upload Image
                        </p>

                        <p
                          className="
                            mt-0.5

                            text-[7px]

                            text-gray-400
                          "
                        >
                          JPG, PNG or WebP
                        </p>
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

                {/* REGISTRATION FORM */}

                <div
                  className="
                    min-w-0
                  "
                >
                  <SubHeading
                    icon={
                      <FormIcon />
                    }
                    label="Registration Form"
                  />

                  {/* IMPORTANT:
                      no max-height
                      no overflow-y-auto
                      selector gets its natural height
                  */}

                  <div
                    className="
                      mt-2
                      min-w-0

                      rounded-lg

                      border
                      border-gray-100

                      bg-gray-50/40

                      p-2
                    "
                  >
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
                  </div>

                  <input
                    type="hidden"
                    name="bookingFormTemplate"
                    value={
                      bookingFormTemplate
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ====================================================
            DAILY SCHEDULE
        ==================================================== */}

        <motion.section
          initial={{
            opacity: 0,
            y: 6,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            delay: 0.07,
            duration: 0.3,
          }}
          className="
            min-w-0

            overflow-hidden

            rounded-xl

            border
            border-gray-200

            bg-white

            shadow-[0_3px_14px_rgba(27,75,107,0.025)]
          "
        >
          {/* ================================================
              HEADER
          ================================================ */}

          <div
            className="
              flex
              items-center
              justify-between
              gap-3

              border-b
              border-gray-100

              px-3
              py-2.5
            "
          >
            <div
              className="
                flex
                min-w-0
                items-center
                gap-2
              "
            >
              <span
                className="
                  grid
                  h-7
                  w-7
                  shrink-0

                  place-items-center

                  rounded-md

                  bg-primary/[0.07]

                  text-primary
                "
              >
                <ClockIcon />
              </span>

              <div
                className="
                  min-w-0
                "
              >
                <h2
                  className="
                    text-[11px]
                    font-semibold

                    text-secondary
                  "
                >
                  Daily Schedule
                </h2>

                <p
                  className="
                    mt-0.5

                    text-[7px]

                    text-gray-400
                  "
                >
                  Booking slots and capacity
                </p>
              </div>
            </div>

            {numberOfDays >
              1 && (
              <button
                type="button"
                onClick={
                  applyDay1ToAll
                }
                className="
                  inline-flex
                  h-8
                  shrink-0

                  items-center
                  justify-center
                  gap-1

                  rounded-lg

                  border
                  border-primary/15

                  bg-primary/[0.05]

                  px-2.5

                  text-[8px]
                  font-semibold

                  text-primary

                  transition-colors

                  hover:bg-primary/[0.09]
                "
              >
                <CopyIcon />

                <span
                  className="
                    hidden
                    sm:inline
                  "
                >
                  Apply Day 1 to All
                </span>

                <span
                  className="
                    sm:hidden
                  "
                >
                  Copy Day 1
                </span>
              </button>
            )}
          </div>

          {/* ================================================
              DAY SELECTOR

              Grid instead of scroll.
              Up to 10 days wraps naturally.
          ================================================ */}

          <div
            className="
              border-b
              border-gray-100

              bg-gray-50/55

              p-2
            "
          >
            <div
              className="
                grid
                grid-cols-2
                gap-1.5

                sm:grid-cols-4
                2xl:grid-cols-5
              "
            >
              {daySchedules
                .slice(
                  0,
                  numberOfDays,
                )
                .map(
                  (
                    schedule,
                    index,
                  ) => {
                    const selected =
                      index ===
                      activeDayIndex;

                    const slots =
                      generatedSlots[
                        index
                      ]?.length ??
                      0;

                    return (
                      <button
                        key={
                          index
                        }
                        type="button"
                        onClick={() =>
                          setSelectedDayIndex(
                            index,
                          )
                        }
                        className={`
                          relative

                          min-h-[48px]

                          rounded-lg

                          border

                          px-2.5
                          py-2

                          text-left

                          transition-all
                          duration-150

                          ${
                            selected
                              ? `
                                  border-primary/30
                                  bg-white
                                  shadow-[0_2px_8px_rgba(26,158,143,0.08)]
                                `
                              : `
                                  border-transparent
                                  bg-transparent

                                  hover:border-gray-200
                                  hover:bg-white
                                `
                          }
                        `}
                      >
                        <div
                          className="
                            flex
                            items-center
                            justify-between
                            gap-1
                          "
                        >
                          <span
                            className={`
                              text-[8px]
                              font-bold

                              ${
                                selected
                                  ? 'text-primary'
                                  : 'text-secondary'
                              }
                            `}
                          >
                            Day{' '}
                            {index + 1}
                          </span>

                          {index >
                            0 &&
                            schedule.sameAsDay1 && (
                              <LockSmallIcon />
                            )}
                        </div>

                        <div
                          className="
                            mt-1

                            flex
                            flex-wrap
                            items-center
                            gap-x-1.5
                            gap-y-0.5
                          "
                        >
                          <span
                            className="
                              text-[7px]

                              text-gray-400
                            "
                          >
                            {eventDates[
                              index
                            ]
                              ? formatCompactDate(
                                  eventDates[
                                    index
                                  ],
                                )
                              : 'No date'}
                          </span>

                          <span
                            className="
                              h-1
                              w-1

                              rounded-full

                              bg-gray-300
                            "
                          />

                          <span
                            className="
                              text-[7px]
                              font-medium

                              text-gray-500
                            "
                          >
                            {slots}{' '}
                            {slots ===
                            1
                              ? 'slot'
                              : 'slots'}
                          </span>
                        </div>

                        {selected && (
                          <motion.span
                            layoutId="active-day"
                            className="
                              absolute
                              inset-x-2
                              bottom-0

                              h-[2px]

                              rounded-full

                              bg-primary
                            "
                          />
                        )}
                      </button>
                    );
                  },
                )}
            </div>
          </div>

          {/* ================================================
              ACTIVE DAY
          ================================================ */}

          <div
            className="
              p-3

              sm:p-3.5
            "
          >
            <AnimatePresence
              mode="wait"
            >
              <motion.div
                key={
                  activeDayIndex
                }
                initial={{
                  opacity: 0,
                  x: 5,
                }}
                animate={{
                  opacity: 1,
                  x: 0,
                }}
                exit={{
                  opacity: 0,
                  x: -5,
                }}
                transition={{
                  duration: 0.16,
                }}
              >
                {/* ============================================
                    DAY TITLE
                ============================================ */}

                <div
                  className="
                    flex
                    flex-col
                    gap-2

                    sm:flex-row
                    sm:items-center
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
                      <h3
                        className="
                          text-[13px]
                          font-semibold

                          text-secondary
                        "
                      >
                        Day{' '}
                        {activeDayIndex +
                          1}
                      </h3>

                      <span
                        className="
                          text-[8px]

                          text-gray-400
                        "
                      >
                        {formatDate(
                          eventDates[
                            activeDayIndex
                          ] ||
                            '',
                        )}
                      </span>

                      {activeDayIndex >
                        0 &&
                        activeSchedule.sameAsDay1 && (
                          <span
                            className="
                              inline-flex

                              items-center
                              gap-1

                              rounded-full

                              bg-primary/[0.07]

                              px-2
                              py-0.5

                              text-[7px]
                              font-semibold

                              text-primary
                            "
                          >
                            <LockSmallIcon />

                            Synced
                          </span>
                        )}
                    </div>
                  </div>

                  {activeDayIndex >
                    0 && (
                    <div
                      className="
                        flex
                        items-center
                        justify-between
                        gap-3

                        rounded-lg

                        border
                        border-gray-200

                        bg-gray-50/60

                        px-3
                        py-2
                      "
                    >
                      <div>
                        <p
                          className="
                            text-[8px]
                            font-semibold

                            text-secondary
                          "
                        >
                          Same as Day 1
                        </p>

                        <p
                          className="
                            text-[7px]

                            text-gray-400
                          "
                        >
                          Sync settings
                        </p>
                      </div>

                      <Switch
                        checked={
                          activeSchedule.sameAsDay1
                        }
                        onChange={(
                          checked,
                        ) =>
                          toggleSameAsDay1(
                            activeDayIndex,
                            checked,
                          )
                        }
                      />
                    </div>
                  )}
                </div>

                {/* ============================================
                    PRIMARY SCHEDULE FIELDS
                ============================================ */}

                <div
                  className="
                    mt-3

                    grid
                    grid-cols-1
                    gap-2.5

                    min-[430px]:grid-cols-2
                    lg:grid-cols-3
                    2xl:grid-cols-5
                  "
                >
                  <ScheduleField
                    label="Start Time"
                  >
                    <input
                      type="time"
                      value={
                        activeSchedule.startTime
                      }
                      disabled={
                        activeSchedule.sameAsDay1
                      }
                      onChange={(
                        event,
                      ) =>
                        updateDaySchedule(
                          activeDayIndex,
                          'startTime',
                          event.target
                            .value,
                        )
                      }
                      className={
                        inputClass
                      }
                    />
                  </ScheduleField>

                  <ScheduleField
                    label="End Time"
                  >
                    <input
                      type="time"
                      value={
                        activeSchedule.endTime
                      }
                      disabled={
                        activeSchedule.sameAsDay1
                      }
                      onChange={(
                        event,
                      ) =>
                        updateDaySchedule(
                          activeDayIndex,
                          'endTime',
                          event.target
                            .value,
                        )
                      }
                      className={
                        inputClass
                      }
                    />
                  </ScheduleField>

                  <ScheduleField
                    label="Slot Duration"
                    suffix="min"
                  >
                    <input
                      type="number"
                      min={1}
                      value={
                        activeSchedule.slotDuration
                      }
                      disabled={
                        activeSchedule.sameAsDay1
                      }
                      onChange={(
                        event,
                      ) =>
                        updateDaySchedule(
                          activeDayIndex,
                          'slotDuration',
                          event.target
                            .value,
                        )
                      }
                      className={
                        inputClass
                      }
                    />
                  </ScheduleField>

                  <ScheduleField
                    label="Slot Gap"
                  >
                    <select
                      value={
                        activeSchedule.slotGap
                      }
                      disabled={
                        activeSchedule.sameAsDay1
                      }
                      onChange={(
                        event,
                      ) =>
                        updateDaySchedule(
                          activeDayIndex,
                          'slotGap',
                          event.target
                            .value,
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

                  <ScheduleField
                    label="Capacity"
                    suffix="per slot"
                  >
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={
                        activeSchedule.capacity
                      }
                      disabled={
                        activeSchedule.sameAsDay1
                      }
                      onChange={(
                        event,
                      ) =>
                        updateDaySchedule(
                          activeDayIndex,
                          'capacity',
                          event.target
                            .value,
                        )
                      }
                      className={
                        inputClass
                      }
                    />
                  </ScheduleField>
                </div>

                {/* ============================================
                    LUNCH
                ============================================ */}

                <div
                  className="
                    mt-3

                    border-t
                    border-gray-100

                    pt-3
                  "
                >
                  <div
                    className="
                      grid
                      grid-cols-1
                      items-end
                      gap-2.5

                      min-[430px]:grid-cols-2

                      lg:grid-cols-[170px_minmax(0,1fr)_minmax(0,1fr)]
                    "
                  >
                    <ScheduleField
                      label="Lunch Break"
                    >
                      <div
                        className={`
                          flex
                          h-10

                          items-center
                          justify-between
                          gap-2

                          rounded-lg

                          border

                          px-2.5

                          transition-colors

                          ${
                            activeSchedule.lunchEnabled
                              ? `
                                  border-primary/20
                                  bg-primary/[0.035]
                                `
                              : `
                                  border-gray-200
                                  bg-gray-50
                                `
                          }
                        `}
                      >
                        <div
                          className="
                            flex
                            min-w-0
                            items-center
                            gap-1.5
                          "
                        >
                          <LunchIcon />

                          <span
                            className="
                              truncate

                              text-[8px]
                              font-medium

                              text-secondary
                            "
                          >
                            {activeSchedule.lunchEnabled
                              ? 'Enabled'
                              : 'Disabled'}
                          </span>
                        </div>

                        <Switch
                          checked={
                            activeSchedule.lunchEnabled
                          }
                          disabled={
                            activeSchedule.sameAsDay1
                          }
                          onChange={(
                            checked,
                          ) =>
                            updateDaySchedule(
                              activeDayIndex,
                              'lunchEnabled',
                              checked,
                            )
                          }
                        />
                      </div>
                    </ScheduleField>

                    {activeSchedule.lunchEnabled && (
                      <>
                        <ScheduleField
                          label="Lunch Starts"
                        >
                          <input
                            type="time"
                            value={
                              activeSchedule.lunchStart
                            }
                            disabled={
                              activeSchedule.sameAsDay1
                            }
                            onChange={(
                              event,
                            ) =>
                              updateDaySchedule(
                                activeDayIndex,
                                'lunchStart',
                                event.target
                                  .value,
                              )
                            }
                            className={
                              inputClass
                            }
                          />
                        </ScheduleField>

                        <ScheduleField
                          label="Lunch Ends"
                        >
                          <input
                            type="time"
                            value={
                              activeSchedule.lunchEnd
                            }
                            disabled={
                              activeSchedule.sameAsDay1
                            }
                            onChange={(
                              event,
                            ) =>
                              updateDaySchedule(
                                activeDayIndex,
                                'lunchEnd',
                                event.target
                                  .value,
                              )
                            }
                            className={
                              inputClass
                            }
                          />
                        </ScheduleField>
                      </>
                    )}
                  </div>
                </div>

                {/* ============================================
                    GENERATED SLOTS

                    NO horizontal scrollbar.
                    Slots wrap and use the available space.
                ============================================ */}

                <div
                  className="
                    mt-3

                    border-t
                    border-gray-100

                    pt-3
                  "
                >
                  <div
                    className="
                      flex
                      flex-col
                      gap-2

                      sm:flex-row
                      sm:items-center
                      sm:justify-between
                    "
                  >
                    <div
                      className="
                        flex
                        items-center
                        gap-2
                      "
                    >
                      <span
                        className="
                          grid
                          h-7
                          w-7
                          shrink-0

                          place-items-center

                          rounded-md

                          bg-primary/[0.07]

                          text-primary
                        "
                      >
                        <SlotsIcon />
                      </span>

                      <div>
                        <p
                          className="
                            text-[9px]
                            font-semibold

                            text-secondary
                          "
                        >
                          Generated Slots
                        </p>

                        <p
                          className="
                            mt-0.5

                            text-[7px]

                            text-gray-400
                          "
                        >
                          Live preview from current settings
                        </p>
                      </div>
                    </div>

                    <div
                      className="
                        flex
                        flex-wrap
                        items-center
                        gap-1.5
                      "
                    >
                      <span
                        className="
                          rounded-md

                          bg-primary/[0.07]

                          px-2
                          py-1

                          text-[8px]
                          font-semibold

                          text-primary
                        "
                      >
                        {activeSlots.length}{' '}
                        slots
                      </span>

                      {activeCapacity >
                        0 && (
                        <span
                          className="
                            rounded-md

                            bg-secondary/[0.06]

                            px-2
                            py-1

                            text-[8px]
                            font-semibold

                            text-secondary
                          "
                        >
                          {
                            totalDayCapacity
                          }{' '}
                          total capacity
                        </span>
                      )}
                    </div>
                  </div>

                  {activeSlots.length >
                  0 ? (
                    <div
                      className="
                        mt-2.5

                        flex
                        flex-wrap
                        gap-1.5
                      "
                    >
                      {activeSlots.map(
                        (
                          slot,
                          index,
                        ) => (
                          <motion.span
                            key={`${slot}-${index}`}
                            initial={{
                              opacity: 0,
                              y: 3,
                            }}
                            animate={{
                              opacity: 1,
                              y: 0,
                            }}
                            transition={{
                              delay:
                                Math.min(
                                  index *
                                    0.015,
                                  0.15,
                                ),
                            }}
                            className="
                              inline-flex
                              min-h-[28px]

                              items-center

                              rounded-md

                              border
                              border-gray-200

                              bg-gray-50/80

                              px-2.5

                              text-[8px]
                              font-medium

                              text-gray-600

                              transition-colors

                              hover:border-primary/20
                              hover:bg-primary/[0.03]
                            "
                          >
                            {slot}
                          </motion.span>
                        ),
                      )}
                    </div>
                  ) : (
                    <div
                      className="
                        mt-2.5

                        rounded-lg

                        border
                        border-dashed
                        border-red-200

                        bg-red-50/50

                        px-3
                        py-3

                        text-center
                      "
                    >
                      <p
                        className="
                          text-[9px]
                          font-medium

                          text-red-600
                        "
                      >
                        Current schedule cannot generate booking slots.
                      </p>

                      <p
                        className="
                          mt-0.5

                          text-[7px]

                          text-red-400
                        "
                      >
                        Check event time, lunch break and slot duration.
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.section>
      </div>
    </motion.form>
  );
}

/* ============================================================
   CARD HEADER
============================================================ */

function CardHeader({
  icon,
  title,
}: {
  icon: ReactNode;
  title: string;
}) {
  return (
    <div
      className="
        flex
        h-[44px]

        items-center
        gap-2

        border-b
        border-gray-100

        px-3
      "
    >
      <span
        className="
          grid
          h-7
          w-7
          shrink-0

          place-items-center

          rounded-md

          bg-primary/[0.07]

          text-primary
        "
      >
        {icon}
      </span>

      <h2
        className="
          text-[11px]
          font-semibold

          text-secondary
        "
      >
        {title}
      </h2>
    </div>
  );
}

/* ============================================================
   SUBHEADING
============================================================ */

function SubHeading({
  icon,
  label,
}: {
  icon: ReactNode;
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
        className="
          text-primary
        "
      >
        {icon}
      </span>

      <p
        className="
          text-[9px]
          font-semibold

          text-secondary
        "
      >
        {label}
      </p>
    </div>
  );
}

/* ============================================================
   FIELD
============================================================ */

function Field({
  label,
  children,
  required = false,
  hint,
  className = '',
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={`
        min-w-0
        ${className}
      `}
    >
      <div
        className="
          mb-1

          flex
          items-center
          justify-between
          gap-2
        "
      >
        <label
          className="
            text-[8px]
            font-semibold

            text-secondary

            sm:text-[9px]
          "
        >
          {label}

          {required && (
            <span
              className="
                ml-0.5
                text-red-500
              "
            >
              *
            </span>
          )}
        </label>

        {hint && (
          <span
            className="
              shrink-0

              text-[7px]

              text-gray-400
            "
          >
            {hint}
          </span>
        )}
      </div>

      {children}
    </div>
  );
}

/* ============================================================
   SCHEDULE FIELD
============================================================ */

function ScheduleField({
  label,
  children,
  suffix,
}: {
  label: string;
  children: ReactNode;
  suffix?: string;
}) {
  return (
    <div
      className="
        min-w-0
      "
    >
      <div
        className="
          mb-1

          flex
          items-center
          justify-between
          gap-1
        "
      >
        <label
          className="
            text-[8px]
            font-semibold

            text-secondary
          "
        >
          {label}
        </label>

        {suffix && (
          <span
            className="
              text-[7px]

              text-gray-400
            "
          >
            {suffix}
          </span>
        )}
      </div>

      {children}
    </div>
  );
}

/* ============================================================
   SWITCH
============================================================ */

function Switch({
  checked,
  disabled = false,
  onChange,
}: {
  checked: boolean;

  disabled?: boolean;

  onChange:
    (
      checked:
        boolean,
    ) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={
        checked
      }
      aria-label={
        checked
          ? 'Disable'
          : 'Enable'
      }
      disabled={
        disabled
      }
      onClick={() =>
        onChange(
          !checked,
        )
      }
      className={`
        relative

        inline-flex
        h-[22px]
        w-10
        shrink-0

        items-center

        rounded-full

        border

        transition-all
        duration-200

        focus:outline-none
        focus-visible:ring-2
        focus-visible:ring-primary/25
        focus-visible:ring-offset-2

        ${
          checked
            ? `
                border-primary
                bg-primary
              `
            : `
                border-gray-300
                bg-gray-200
              `
        }

        ${
          disabled
            ? `
                cursor-not-allowed
                opacity-40
              `
            : `
                cursor-pointer
              `
        }
      `}
    >
      <span
        className={`
          absolute
          left-[2px]

          h-[18px]
          w-[18px]

          rounded-full

          bg-white

          shadow-[0_1px_4px_rgba(0,0,0,0.22)]

          transition-transform
          duration-200
          ease-out

          ${
            checked
              ? 'translate-x-[18px]'
              : 'translate-x-0'
          }
        `}
      />
    </button>
  );
}

/* ============================================================
   LOADING SKELETON
============================================================ */

function PageSkeleton() {
  return (
    <div
      className="
        mx-auto

        w-full
        max-w-[1600px]

        animate-pulse

        space-y-3
      "
    >
      <div
        className="
          h-[58px]

          rounded-xl

          border
          border-gray-200

          bg-white
        "
      />

      <div
        className="
          grid
          grid-cols-1
          items-start
          gap-3

          xl:grid-cols-[0.92fr_1.28fr]
        "
      >
        <div
          className="
            h-[570px]

            rounded-xl

            border
            border-gray-200

            bg-white
          "
        />

        <div
          className="
            h-[470px]

            rounded-xl

            border
            border-gray-200

            bg-white
          "
        />
      </div>
    </div>
  );
}

/* ============================================================
   ICONS
============================================================ */

function BackIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.9}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m15 18-6-6 6-6"
      />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
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
        d="M8 4v6h8V4M8 17h8"
      />
    </svg>
  );
}

function EventIcon() {
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
        d="M5 5h14v14H5V5Zm3 4h8M8 13h6"
      />
    </svg>
  );
}

function FormIcon() {
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
        d="M6 3h9l4 4v14H6V3Z"
      />

      <path
        strokeLinecap="round"
        d="M15 3v5h5M9 12h6M9 16h6"
      />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <rect
        x="4"
        y="5"
        width="16"
        height="14"
        rx="2"
      />

      <circle
        cx="9"
        cy="10"
        r="1.5"
      />

      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m5 17 4-4 3 3 2-2 5 5"
      />
    </svg>
  );
}

function CalendarIcon() {
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
        d="M8 3v4m8-4v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
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

function SlotsIcon() {
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
        d="M5 7h14M5 12h14M5 17h14"
      />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.9}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 16V4m0 0-4 4m4-4 4 4M5 20h14"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      className="h-3 w-3"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <rect
        x="8"
        y="8"
        width="11"
        height="11"
        rx="1"
      />

      <path
        strokeLinecap="round"
        d="M16 8V5H5v11h3"
      />
    </svg>
  );
}

function LunchIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 text-primary"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        d="M6 4v7a3 3 0 0 0 6 0V4M9 4v16M16 4v16M16 4c3 1 3 7 0 8"
      />
    </svg>
  );
}

function LockSmallIcon() {
  return (
    <svg
      className="h-2.5 w-2.5 text-primary"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <rect
        x="6"
        y="10"
        width="12"
        height="10"
        rx="2"
      />

      <path
        strokeLinecap="round"
        d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10"
      />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
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
      className="h-3.5 w-3.5"
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

function Spinner() {
  return (
    <svg
      className="
        h-3.5
        w-3.5

        animate-spin
      "
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-20"
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
      />

      <path
        className="opacity-75"
        fill="currentColor"
        d="M12 3a9 9 0 0 1 9 9h-3a6 6 0 0 0-6-6V3Z"
      />
    </svg>
  );
}