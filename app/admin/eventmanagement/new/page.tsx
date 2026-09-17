'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';

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

type ThumbnailPreview = {
  name: string;
  url: string;
};

const GAP_OPTIONS = [0, 3, 5, 10, 15, 20, 25, 30];

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

function parseLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDays(value: string, amount: number) {
  if (!value) return '';

  const date = parseLocalDate(value);
  date.setDate(date.getDate() + amount);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatDate(value: string) {
  if (!value) return 'Select a start date';

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parseLocalDate(value));
}

function timeToMinutes(value: string) {
  if (!value) return 0;

  const [hours, minutes] = value.split(':').map(Number);

  return hours * 60 + minutes;
}

function formatTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, '0')}:${String(
    minutes,
  ).padStart(2, '0')}`;
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

function generateSlots(schedule: DaySchedule) {
  const start = timeToMinutes(schedule.startTime);
  const end = timeToMinutes(schedule.endTime);

  const duration = Number(schedule.slotDuration);
  const gap = Number(schedule.slotGap);

  if (!start || !end || !duration || end <= start) {
    return [];
  }

  const lunchStart = schedule.lunchEnabled
    ? timeToMinutes(schedule.lunchStart)
    : 0;

  const lunchEnd = schedule.lunchEnabled
    ? timeToMinutes(schedule.lunchEnd)
    : 0;

  if (
    schedule.lunchEnabled &&
    (!lunchStart ||
      !lunchEnd ||
      lunchEnd <= lunchStart ||
      lunchStart < start ||
      lunchEnd > end)
  ) {
    return [];
  }

  const slots: string[] = [];

  let cursor = start;

  while (cursor + duration <= end) {
    const slotEnd = cursor + duration;

    const overlapsLunch =
      schedule.lunchEnabled &&
      cursor < lunchEnd &&
      slotEnd > lunchStart;

    if (overlapsLunch) {
      cursor = lunchEnd;
      continue;
    }

    slots.push(
      `${formatTime(cursor)} – ${formatTime(slotEnd)}`,
    );

    cursor = slotEnd + gap;
  }

  return slots;
}

const inputClass =
  'h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-secondary outline-none transition duration-150 placeholder:text-gray-400 hover:border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400';

const selectClass = `${inputClass} cursor-pointer`;

const labelClass =
  'mb-1.5 block text-xs font-semibold text-secondary';

const buttonBase =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg font-semibold transition duration-150 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

export default function CreateNewEventPage() {
  const router = useRouter();

  const [numberOfDays, setNumberOfDays] =
    useState(1);

  const [startDate, setStartDate] =
    useState('');

  const [formError, setFormError] =
    useState('');

  const [thumbnailPreview, setThumbnailPreview] =
    useState<ThumbnailPreview | null>(null);

  const [submissionState, setSubmissionState] =
    useState<'idle' | 'creating' | 'success'>(
      'idle',
    );

  const [daySchedules, setDaySchedules] =
    useState<DaySchedule[]>(() =>
      Array.from(
        { length: 10 },
        (_, index) =>
          createDaySchedule(index > 0),
      ),
    );

  const eventDates = useMemo(
    () =>
      Array.from(
        { length: numberOfDays },
        (_, index) =>
          startDate
            ? addDays(startDate, index)
            : '',
      ),
    [numberOfDays, startDate],
  );

  const endDate =
    eventDates[eventDates.length - 1] ?? '';

  const generatedSlots = useMemo(
    () =>
      daySchedules
        .slice(0, numberOfDays)
        .map((schedule) =>
          generateSlots(schedule),
        ),
    [daySchedules, numberOfDays],
  );

  useEffect(() => {
    return () => {
      if (thumbnailPreview?.url) {
        URL.revokeObjectURL(
          thumbnailPreview.url,
        );
      }
    };
  }, [thumbnailPreview]);

  function handleThumbnailChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      setThumbnailPreview(null);
      return;
    }

    if (thumbnailPreview?.url) {
      URL.revokeObjectURL(
        thumbnailPreview.url,
      );
    }

    setThumbnailPreview({
      name: file.name,
      url: URL.createObjectURL(file),
    });

    setFormError('');
  }

  function updateDaySchedule(
    index: number,
    field: keyof DaySchedule,
    value: string | boolean,
  ) {
    setDaySchedules((current) => {
      const next = current.map(
        (schedule) => ({
          ...schedule,
        }),
      );

      next[index] = {
        ...next[index],
        [field]: value,
      };

      if (
        index === 0 &&
        field !== 'sameAsDay1'
      ) {
        for (
          let dayIndex = 1;
          dayIndex < next.length;
          dayIndex += 1
        ) {
          if (
            next[dayIndex].sameAsDay1
          ) {
            next[dayIndex] =
              copyDay1Schedule(
                next[0],
                true,
              );
          }
        }
      }

      return next;
    });

    setFormError('');
  }

  function toggleSameAsDay1(
    index: number,
    checked: boolean,
  ) {
    if (index === 0) return;

    setDaySchedules((current) =>
      current.map(
        (schedule, scheduleIndex) => {
          if (
            scheduleIndex !== index
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
            sameAsDay1: false,
          };
        },
      ),
    );

    setFormError('');
  }

  function applyDay1ToAll() {
    setDaySchedules((current) =>
      current.map((schedule, index) =>
        index === 0
          ? {
              ...schedule,
              sameAsDay1: false,
            }
          : copyDay1Schedule(
              current[0],
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
    const start = timeToMinutes(
      schedule.startTime,
    );

    const end = timeToMinutes(
      schedule.endTime,
    );

    const capacity = Number(
      schedule.capacity,
    );

    const slotGap = Number(
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

    if (schedule.lunchEnabled) {
      const lunchStart = timeToMinutes(
        schedule.lunchStart,
      );

      const lunchEnd = timeToMinutes(
        schedule.lunchEnd,
      );

      if (
        !schedule.lunchStart ||
        !schedule.lunchEnd ||
        lunchStart < start ||
        lunchEnd > end ||
        lunchEnd <= lunchStart
      ) {
        return `Day ${
          index + 1
        }: lunch must fall within the event schedule.`;
      }
    }

    if (
      !GAP_OPTIONS.includes(slotGap)
    ) {
      return `Day ${
        index + 1
      }: choose No gap, 3 minutes, or a 5-minute multiple up to 30 minutes.`;
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
      generateSlots(schedule).length ===
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

    for (
      let index = 0;
      index < numberOfDays;
      index += 1
    ) {
      const error = validateSchedule(
        daySchedules[index],
        index,
      );

      if (error) {
        setFormError(error);
        return;
      }
    }

    setSubmissionState('creating');

    try {
      const formData = new FormData(
        event.currentTarget,
      );

      formData.set(
        'numberOfDays',
        String(numberOfDays),
      );

      formData.set(
        'startDate',
        startDate,
      );

      formData.set(
        'endDate',
        endDate,
      );

      const schedulesToSubmit =
        daySchedules
          .slice(0, numberOfDays)
          .map(
            (schedule, index) => ({
              ...schedule,
              date: eventDates[index],
            }),
          );

      formData.set(
        'daySchedules',
        JSON.stringify(
          schedulesToSubmit,
        ),
      );

      const res = await fetch(
        '/api/events',
        {
          method: 'POST',
          body: formData,
        },
      );

      const data = await res.json();

      if (
        !res.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            'Failed to create event',
        );
      }

      setSubmissionState('success');

      window.setTimeout(() => {
        router.push(
          '/admin/eventmanagement',
        );
      }, 1100);
    } catch (error: unknown) {
      setSubmissionState('idle');

      setFormError(
        error instanceof Error
          ? error.message
          : 'An error occurred while creating the event',
      );
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto w-full max-w-[1600px] space-y-4 pb-6"
    >
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-secondary sm:text-3xl">
            Create New Event
          </h1>

          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
            Enter the event details, choose
            the duration, and configure booking
            slots for each day.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <Link
            href="/admin/eventmanagement"
            className={`${buttonBase} h-10 border border-gray-200 bg-white px-5 text-sm text-secondary hover:border-gray-300 hover:bg-gray-50`}
          >
            <span aria-hidden="true">
              ←
            </span>
            Back
          </Link>

          <button
            type="submit"
            disabled={
              submissionState !== 'idle'
            }
            className={`${buttonBase} h-10 bg-primary px-6 text-sm text-white shadow-sm hover:brightness-95 hover:shadow-md`}
          >
            Confirm Event

            <svg
              aria-hidden="true"
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
          </button>
        </div>
      </header>

      {formError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 shadow-sm"
        >
          {formError}
        </div>
      )}

      <div className="grid items-start gap-5 2xl:grid-cols-[minmax(360px,0.78fr)_minmax(0,1.22fr)]">
        {/* LEFT COLUMN */}
        <div className="space-y-5">
          {/* EVENT DETAILS */}
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
              <label
                htmlFor="eventName"
                className={labelClass}
              >
                Event/Conference
                Name/Mantram
                <span className="ml-1 text-red-500">
                  *
                </span>
              </label>

              <input
                id="eventName"
                name="eventName"
                type="text"
                required
                className={inputClass}
                placeholder="Enter event, conference, or Mantram name"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="eventType"
                  className={labelClass}
                >
                  Event Type
                  <span className="ml-1 text-red-500">
                    *
                  </span>
                </label>

                <select
                  id="eventType"
                  name="eventType"
                  required
                  defaultValue=""
                  className={
                    selectClass
                  }
                >
                  <option
                    value=""
                    disabled
                  >
                    Select event type
                  </option>

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
                <label
                  htmlFor="venue"
                  className={labelClass}
                >
                  Venue/Location
                  <span className="ml-1 text-red-500">
                    *
                  </span>
                </label>

                <input
                  id="venue"
                  name="venue"
                  type="text"
                  required
                  className={inputClass}
                  placeholder="Enter venue and city"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="description"
                className={labelClass}
              >
                Description
                <span className="ml-1 text-red-500">
                  *
                </span>
              </label>

              <textarea
                id="description"
                name="description"
                required
                rows={4}
                className={`${inputClass} h-auto min-h-24 resize-y py-2.5`}
                placeholder="Describe the agenda, speakers, and purpose of the event"
              />
            </div>

            {/* Thumbnail */}
            <div>
              <label
                htmlFor="thumbnail"
                className={labelClass}
              >
                Event Thumbnail

                <span className="ml-1 font-normal text-gray-400">
                  (Optional)
                </span>
              </label>

              <label
                htmlFor="thumbnail"
                className={`group block cursor-pointer overflow-hidden rounded-xl border transition duration-150 focus-within:ring-2 focus-within:ring-primary/20 ${
                  thumbnailPreview
                    ? 'border-gray-200 bg-white hover:border-primary/40'
                    : 'border-dashed border-primary/40 bg-primary/[0.03] hover:border-primary hover:bg-primary/[0.06]'
                }`}
              >
                {thumbnailPreview ? (
                  <div className="flex items-center gap-3 p-3">
                    <div className="h-16 w-20 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                      <img
                        src={
                          thumbnailPreview.url
                        }
                        alt="Event thumbnail preview"
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-secondary">
                        {
                          thumbnailPreview.name
                        }
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary transition-transform group-hover:-translate-y-0.5">
                      ↑
                    </span>

                    <span>
                      <span className="block text-sm font-semibold text-secondary">
                        Choose an image
                      </span>

                      <span className="mt-0.5 block text-xs text-gray-500">
                        JPG, PNG or WebP ·
                        Maximum 5 MB
                      </span>
                    </span>
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

          {/* EVENT DURATION */}
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
              <div>
                <label
                  htmlFor="numberOfDays"
                  className={labelClass}
                >
                  Number of Days
                  <span className="ml-1 text-red-500">
                    *
                  </span>
                </label>

                <select
                  id="numberOfDays"
                  name="numberOfDays"
                  required
                  value={
                    numberOfDays
                  }
                  onChange={(event) => {
                    setNumberOfDays(
                      Number(
                        event.target
                          .value,
                      ),
                    );

                    setFormError('');
                  }}
                  className={
                    selectClass
                  }
                >
                  {Array.from(
                    { length: 10 },
                    (_, index) =>
                      index + 1,
                  ).map((days) => (
                    <option
                      key={days}
                      value={days}
                    >
                      {days}{' '}
                      {days === 1
                        ? 'day'
                        : 'days'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="startDate"
                  className={labelClass}
                >
                  Start Date
                  <span className="ml-1 text-red-500">
                    *
                  </span>
                </label>

                <input
                  id="startDate"
                  name="startDate"
                  type="date"
                  required
                  value={startDate}
                  onChange={(event) => {
                    setStartDate(
                      event.target
                        .value,
                    );

                    setFormError('');
                  }}
                  className={`${inputClass} cursor-pointer`}
                />
              </div>

              <div>
                <label
                  htmlFor="endDate"
                  className={labelClass}
                >
                  End Date
                </label>

                <input
                  id="endDate"
                  name="endDate"
                  type="date"
                  value={endDate}
                  readOnly
                  aria-describedby="endDateHelp"
                  className={`${inputClass} cursor-not-allowed bg-gray-50 text-gray-600`}
                />

                <p
                  id="endDateHelp"
                  className="mt-1 text-[11px] text-gray-500"
                >
                  Calculated
                  automatically
                </p>
              </div>
            </div>

            {startDate && (
              <div className="rounded-xl border border-primary/15 bg-primary/[0.04] px-4 py-3 text-sm text-secondary">
                <span className="font-semibold">
                  {numberOfDays ===
                  1
                    ? 'One-day event:'
                    : 'Event period:'}
                </span>{' '}
                {formatDate(
                  startDate,
                )}

                {numberOfDays > 1 &&
                  ` – ${formatDate(
                    endDate,
                  )}`}
              </div>
            )}
          </section>
        </div>

        {/* SCHEDULE */}
        <section className="card min-w-0 space-y-5 p-4 sm:p-5 lg:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Section 3
              </p>

              <h2 className="mt-1 text-lg font-bold text-secondary">
                Daily schedule and booking
                slots
              </h2>

              <p className="mt-1 text-sm leading-6 text-gray-500">
                Lunch can be enabled or
                disabled per day. Days marked
                “Same as Day 1” stay
                synchronized automatically.
              </p>
            </div>

            {numberOfDays > 1 && (
              <button
                type="button"
                onClick={
                  applyDay1ToAll
                }
                className={`${buttonBase} h-9 shrink-0 border border-primary/20 bg-primary/[0.06] px-3.5 text-xs text-primary hover:border-primary/40 hover:bg-primary/10`}
              >
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 7h11m0 0-3-3m3 3-3 3M16 17H5m0 0 3 3m-3-3 3-3"
                  />
                </svg>

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
                ) => {
                  const slots =
                    generatedSlots[
                      index
                    ];

                  const isSynced =
                    index > 0 &&
                    schedule.sameAsDay1;

                  return (
                    <fieldset
                      key={index}
                      className={`min-w-0 rounded-xl border p-4 transition sm:p-5 ${
                        isSynced
                          ? 'border-primary/25 bg-primary/[0.025]'
                          : 'border-gray-200 bg-gray-50/60'
                      }`}
                    >
                      <legend className="max-w-full px-2">
                        <span className="inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-bold text-secondary">
                            Day{' '}
                            {index +
                              1}
                          </span>

                          <span className="text-xs font-normal text-gray-500">
                            {formatDate(
                              eventDates[
                                index
                              ],
                            )}
                          </span>

                          {index ===
                            0 && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                              Master
                            </span>
                          )}
                        </span>
                      </legend>

                      <input
                        type="hidden"
                        name={`days.${index}.date`}
                        value={
                          eventDates[
                            index
                          ]
                        }
                      />

                      {index > 0 && (
                        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-secondary">
                              Same as Day
                              1
                            </p>

                            <p className="mt-0.5 text-xs leading-5 text-gray-500">
                              Keep this
                              day
                              automatically
                              synced with
                              the Day 1
                              schedule.
                            </p>
                          </div>

                          <label className="inline-flex shrink-0 cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              name={`days.${index}.sameAsDay1`}
                              checked={
                                schedule.sameAsDay1
                              }
                              onChange={(
                                event,
                              ) =>
                                toggleSameAsDay1(
                                  index,
                                  event
                                    .target
                                    .checked,
                                )
                              }
                              className="peer sr-only"
                            />

                            <span className="relative h-6 w-11 rounded-full bg-gray-200 transition peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30 peer-focus-visible:ring-offset-2 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-5" />

                            <span className="min-w-7 text-xs font-semibold text-gray-600">
                              {schedule.sameAsDay1
                                ? 'Yes'
                                : 'No'}
                            </span>
                          </label>
                        </div>
                      )}

                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <div>
                          <label
                            htmlFor={`startTime-${index}`}
                            className={
                              labelClass
                            }
                          >
                            Start Time
                            <span className="ml-1 text-red-500">
                              *
                            </span>
                          </label>

                          <input
                            id={`startTime-${index}`}
                            name={`days.${index}.startTime`}
                            type="time"
                            required
                            disabled={
                              isSynced
                            }
                            value={
                              schedule.startTime
                            }
                            onChange={(
                              event,
                            ) =>
                              updateDaySchedule(
                                index,
                                'startTime',
                                event
                                  .target
                                  .value,
                              )
                            }
                            className={`${inputClass} ${
                              !isSynced
                                ? 'cursor-pointer'
                                : ''
                            }`}
                          />
                        </div>

                        <div>
                          <label
                            htmlFor={`endTime-${index}`}
                            className={
                              labelClass
                            }
                          >
                            End Time
                            <span className="ml-1 text-red-500">
                              *
                            </span>
                          </label>

                          <input
                            id={`endTime-${index}`}
                            name={`days.${index}.endTime`}
                            type="time"
                            required
                            disabled={
                              isSynced
                            }
                            min={
                              schedule.startTime
                            }
                            value={
                              schedule.endTime
                            }
                            onChange={(
                              event,
                            ) =>
                              updateDaySchedule(
                                index,
                                'endTime',
                                event
                                  .target
                                  .value,
                              )
                            }
                            className={`${inputClass} ${
                              !isSynced
                                ? 'cursor-pointer'
                                : ''
                            }`}
                          />
                        </div>

                        <div className="md:col-span-2 xl:col-span-2">
                          <span
                            className={
                              labelClass
                            }
                          >
                            Lunch Break
                          </span>

                          <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-1">
                            <button
                              type="button"
                              disabled={
                                isSynced
                              }
                              aria-pressed={
                                schedule.lunchEnabled
                              }
                              onClick={() =>
                                updateDaySchedule(
                                  index,
                                  'lunchEnabled',
                                  true,
                                )
                              }
                              className={`${buttonBase} h-8 px-3 text-xs ${
                                schedule.lunchEnabled
                                  ? 'bg-white text-primary shadow-sm ring-1 ring-black/[0.04]'
                                  : 'text-gray-500 hover:bg-white/70 hover:text-secondary'
                              }`}
                            >
                              Have
                              lunch
                            </button>

                            <button
                              type="button"
                              disabled={
                                isSynced
                              }
                              aria-pressed={
                                !schedule.lunchEnabled
                              }
                              onClick={() =>
                                updateDaySchedule(
                                  index,
                                  'lunchEnabled',
                                  false,
                                )
                              }
                              className={`${buttonBase} h-8 px-3 text-xs ${
                                !schedule.lunchEnabled
                                  ? 'bg-white text-primary shadow-sm ring-1 ring-black/[0.04]'
                                  : 'text-gray-500 hover:bg-white/70 hover:text-secondary'
                              }`}
                            >
                              No lunch
                            </button>
                          </div>

                          <input
                            type="hidden"
                            name={`days.${index}.lunchEnabled`}
                            value={
                              schedule.lunchEnabled
                                ? 'true'
                                : 'false'
                            }
                          />
                        </div>

                        {schedule.lunchEnabled && (
                          <>
                            <div>
                              <label
                                htmlFor={`lunchStart-${index}`}
                                className={
                                  labelClass
                                }
                              >
                                Lunch Start
                                <span className="ml-1 text-red-500">
                                  *
                                </span>
                              </label>

                              <input
                                id={`lunchStart-${index}`}
                                name={`days.${index}.lunchStart`}
                                type="time"
                                required
                                disabled={
                                  isSynced
                                }
                                min={
                                  schedule.startTime
                                }
                                max={
                                  schedule.endTime
                                }
                                value={
                                  schedule.lunchStart
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateDaySchedule(
                                    index,
                                    'lunchStart',
                                    event
                                      .target
                                      .value,
                                  )
                                }
                                className={`${inputClass} ${
                                  !isSynced
                                    ? 'cursor-pointer'
                                    : ''
                                }`}
                              />
                            </div>

                            <div>
                              <label
                                htmlFor={`lunchEnd-${index}`}
                                className={
                                  labelClass
                                }
                              >
                                Lunch End
                                <span className="ml-1 text-red-500">
                                  *
                                </span>
                              </label>

                              <input
                                id={`lunchEnd-${index}`}
                                name={`days.${index}.lunchEnd`}
                                type="time"
                                required
                                disabled={
                                  isSynced
                                }
                                min={
                                  schedule.lunchStart
                                }
                                max={
                                  schedule.endTime
                                }
                                value={
                                  schedule.lunchEnd
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateDaySchedule(
                                    index,
                                    'lunchEnd',
                                    event
                                      .target
                                      .value,
                                  )
                                }
                                className={`${inputClass} ${
                                  !isSynced
                                    ? 'cursor-pointer'
                                    : ''
                                }`}
                              />
                            </div>
                          </>
                        )}

                        <div>
                          <label
                            htmlFor={`slotDuration-${index}`}
                            className={
                              labelClass
                            }
                          >
                            Slot Duration
                            <span className="ml-1 text-red-500">
                              *
                            </span>
                          </label>

                          <select
                            id={`slotDuration-${index}`}
                            name={`days.${index}.slotDuration`}
                            required
                            disabled={
                              isSynced
                            }
                            value={
                              schedule.slotDuration
                            }
                            onChange={(
                              event,
                            ) =>
                              updateDaySchedule(
                                index,
                                'slotDuration',
                                event
                                  .target
                                  .value,
                              )
                            }
                            className={
                              selectClass
                            }
                          >
                            <option value="10">
                              10
                              minutes
                            </option>

                            <option value="15">
                              15
                              minutes
                            </option>

                            <option value="20">
                              20
                              minutes
                            </option>

                            <option value="30">
                              30
                              minutes
                            </option>
                          </select>
                        </div>

                        <div>
                          <label
                            htmlFor={`slotGap-${index}`}
                            className={
                              labelClass
                            }
                          >
                            Gap Between
                            Slots
                            <span className="ml-1 text-red-500">
                              *
                            </span>
                          </label>

                          <select
                            id={`slotGap-${index}`}
                            name={`days.${index}.slotGap`}
                            required
                            disabled={
                              isSynced
                            }
                            value={
                              schedule.slotGap
                            }
                            onChange={(
                              event,
                            ) =>
                              updateDaySchedule(
                                index,
                                'slotGap',
                                event
                                  .target
                                  .value,
                              )
                            }
                            className={
                              selectClass
                            }
                          >
                            {GAP_OPTIONS.map(
                              (
                                minutes,
                              ) => (
                                <option
                                  key={
                                    minutes
                                  }
                                  value={
                                    minutes
                                  }
                                >
                                  {minutes ===
                                  0
                                    ? 'No gap'
                                    : `${minutes} minutes`}
                                </option>
                              ),
                            )}
                          </select>

                          <p className="mt-1 text-[11px] leading-4 text-gray-500">
                            No gap, 3
                            min, then
                            5-minute
                            steps up to
                            30 min.
                          </p>
                        </div>

                        <div className="md:col-span-2 xl:col-span-2">
                          <label
                            htmlFor={`capacity-${index}`}
                            className={
                              labelClass
                            }
                          >
                            Booking
                            Capacity Per
                            Slot
                            <span className="ml-1 text-red-500">
                              *
                            </span>
                          </label>

                          <input
                            id={`capacity-${index}`}
                            name={`days.${index}.capacity`}
                            type="number"
                            required
                            disabled={
                              isSynced
                            }
                            min={1}
                            max={20}
                            step={1}
                            value={
                              schedule.capacity
                            }
                            onChange={(
                              event,
                            ) =>
                              updateDaySchedule(
                                index,
                                'capacity',
                                event
                                  .target
                                  .value,
                              )
                            }
                            className={
                              inputClass
                            }
                          />

                          <p className="mt-1 text-[11px] leading-4 text-gray-500">
                            Minimum 1 and
                            maximum 20
                            attendees per
                            slot.
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 border-t border-gray-200 pt-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-semibold text-secondary">
                              Generated
                              slot
                              preview
                            </h3>

                            <p className="mt-0.5 text-[11px] text-gray-500">
                              {schedule.lunchEnabled
                                ? `Lunch excluded: ${schedule.lunchStart} – ${schedule.lunchEnd}`
                                : 'No lunch break for this day'}
                            </p>
                          </div>

                          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                            {
                              slots.length
                            }{' '}
                            {slots.length ===
                            1
                              ? 'slot'
                              : 'slots'}
                          </span>
                        </div>

                        {slots.length >
                        0 ? (
                          <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto pr-1">
                            {slots.map(
                              (
                                slot,
                              ) => (
                                <span
                                  key={
                                    slot
                                  }
                                  className="rounded-md border border-primary/20 bg-white px-2.5 py-1 text-xs font-medium text-primary shadow-sm"
                                >
                                  {
                                    slot
                                  }
                                </span>
                              ),
                            )}
                          </div>
                        ) : (
                          <p className="rounded-lg border border-gray-100 bg-white px-3 py-2 text-xs text-gray-500">
                            Complete a
                            valid
                            schedule to
                            generate
                            slots.
                          </p>
                        )}
                      </div>
                    </fieldset>
                  );
                },
              )}
          </div>
        </section>
      </div>

      {submissionState !==
        'idle' && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-secondary/35 px-4 backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <div className="w-full max-w-sm rounded-2xl border border-white/60 bg-white p-7 text-center shadow-2xl sm:p-8">
            {submissionState ===
            'creating' ? (
              <>
                <div className="relative mx-auto mb-5 h-16 w-16">
                  <div className="absolute inset-0 rounded-full border-4 border-primary/15" />

                  <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-r-primary border-t-primary" />

                  <div className="absolute inset-3 rounded-full bg-primary/[0.07]" />
                </div>

                <h2 className="text-xl font-bold text-secondary">
                  Creating your
                  event
                </h2>

                <p className="mt-2 text-sm leading-6 text-gray-500">
                  Preparing the
                  schedule and
                  generating booking
                  slots…
                </p>
              </>
            ) : (
              <>
                <div className="relative mx-auto mb-5 grid h-16 w-16 place-items-center">
                  <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/20" />

                  <span className="relative grid h-16 w-16 place-items-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/25">
                    <svg
                      className="h-8 w-8 animate-[pulse_600ms_ease-out_1]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={
                        2.5
                      }
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m5 12 4 4L19 6"
                      />
                    </svg>
                  </span>
                </div>

                <h2 className="text-xl font-bold text-secondary">
                  Event created
                  successfully
                </h2>

                <p className="mt-2 text-sm leading-6 text-gray-500">
                  Redirecting you to
                  Event Management…
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </form>
  );
}