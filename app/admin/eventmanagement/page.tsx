'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import Link from 'next/link';

interface IEvent {
  _id: string;
  eventName: string;
  eventType: 'conference' | 'mantram' | 'event';
  venue: string;
  startDate: string;
  endDate: string;
  totalSlots: number;
  bookedSlots: number;
  status: 'LIVE' | 'COMPLETED' | 'UPCOMING';
  description?: string;
}

type EventTab =
  | 'All Events'
  | 'Conferences'
  | 'Mantram'
  | 'Live'
  | 'Upcoming'
  | 'Completed';

const tabs: EventTab[] = [
  'All Events',
  'Conferences',
  'Mantram',
  'Live',
  'Upcoming',
  'Completed',
];

export default function EventsManagementPage() {
  const [events, setEvents] = useState<IEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] =
    useState<EventTab>('All Events');

  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/events', {
        method: 'GET',
        cache: 'no-store',
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(
          data.error || 'Failed to fetch events.',
        );
      }

      setEvents(data.events || []);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(fetchEvents);
  }, [fetchEvents]);

  const handleDelete = async (
    id: string,
    name: string,
  ) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${name}"?`,
    );

    if (!confirmed) return;

    setDeletingId(id);

    try {
      const res = await fetch(
        `/api/events?id=${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
        },
      );

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(
          data.error || 'Failed to delete event.',
        );
      }

      setEvents((prev) =>
        prev.filter((event) => event._id !== id),
      );
    } catch (err: unknown) {
      window.alert(
        err instanceof Error
          ? err.message
          : 'Error deleting event.',
      );
    } finally {
      setDeletingId(null);
    }
  };

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (activeTab === 'All Events') {
        return true;
      }

      if (activeTab === 'Conferences') {
        return event.eventType === 'conference';
      }

      if (activeTab === 'Mantram') {
        return event.eventType === 'mantram';
      }

      if (activeTab === 'Live') {
        return event.status === 'LIVE';
      }

      if (activeTab === 'Upcoming') {
        return event.status === 'UPCOMING';
      }

      if (activeTab === 'Completed') {
        return event.status === 'COMPLETED';
      }

      return true;
    });
  }, [events, activeTab]);

  const stats = useMemo(
    () => ({
      total: events.length,

      live: events.filter(
        (event) => event.status === 'LIVE',
      ).length,

      upcoming: events.filter(
        (event) => event.status === 'UPCOMING',
      ).length,

      completed: events.filter(
        (event) => event.status === 'COMPLETED',
      ).length,
    }),
    [events],
  );

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(
      'en-GB',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      },
    );
  };

  const getStatusBadgeClass = (
    status: IEvent['status'],
  ) => {
    switch (status) {
      case 'LIVE':
        return 'bg-green-50 text-green-700 border border-green-200';

      case 'COMPLETED':
        return 'bg-gray-100 text-gray-600 border border-gray-200';

      case 'UPCOMING':
      default:
        return 'bg-blue-50 text-blue-700 border border-blue-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="mb-2 font-heading text-3xl font-bold tracking-tight text-secondary">
            Events Management
          </h1>

          <p className="max-w-2xl text-sm leading-6 text-gray-500">
            Create, configure, and monitor conferences
            and event registrations across the platform.
          </p>
        </div>

        <Link
          href="/admin/eventmanagement/new"
          className="btn btn-primary inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 shadow-sm"
        >
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
              d="M12 4v16m8-8H4"
            />
          </svg>

          Create New Event
        </Link>
      </div>

      {/* Filters + Stats */}
      <div className="flex flex-col gap-4 py-1 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const isActive =
              activeTab === tab;

            return (
              <button
                key={tab}
                type="button"
                onClick={() =>
                  setActiveTab(tab)
                }
                className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? 'border-primary bg-primary text-white shadow-sm'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <StatPill
            label="Total"
            value={stats.total}
          />

          <StatPill
            label="Live"
            value={stats.live}
          />

          <StatPill
            label="Upcoming"
            value={stats.upcoming}
          />

          <StatPill
            label="Completed"
            value={stats.completed}
          />
        </div>
      </div>

      {/* Main Card */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Error */}
        {error && (
          <div className="flex flex-col gap-3 border-b border-red-100 bg-red-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-red-700">
                Failed to load events
              </p>

              <p className="mt-0.5 text-sm text-red-600">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                void fetchEvents()
              }
              className="cursor-pointer self-start rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-100 sm:self-auto"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Desktop Table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/80">
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Event Name
                </th>

                <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Type
                </th>

                <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Date
                </th>

                <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Venue
                </th>

                <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Slots
                </th>

                <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Status
                </th>

                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <LoadingRows />
              ) : filteredEvents.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-16 text-center"
                  >
                    <div className="mx-auto flex max-w-sm flex-col items-center">
                      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-400">
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
                            d="M8 7V3m8 4V3M5 11h14M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z"
                          />
                        </svg>
                      </div>

                      <p className="font-semibold text-gray-800">
                        No events found
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        There are no events available
                        in this view.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredEvents.map(
                  (event) => {
                    const bookedSlots =
                      event.bookedSlots || 0;

                    return (
                      <tr
                        key={event._id}
                        className="transition-colors hover:bg-gray-50/70"
                      >
                        {/* Event */}
                        <td className="px-6 py-4">
                          <div className="max-w-[260px]">
                            <p className="truncate font-semibold text-secondary">
                              {event.eventName}
                            </p>

                            {event.description && (
                              <p className="mt-1 truncate text-xs text-gray-400">
                                {
                                  event.description
                                }
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Type */}
                        <td className="px-4 py-4">
                          <span className="inline-flex rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium capitalize text-gray-700">
                            {event.eventType}
                          </span>
                        </td>

                        {/* Date */}
                        <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600">
                          {formatDate(
                            event.startDate,
                          )}
                        </td>

                        {/* Venue */}
                        <td className="px-4 py-4">
                          <div className="max-w-[180px] truncate text-sm text-gray-600">
                            {event.venue}
                          </div>
                        </td>

                        {/* Slots */}
                        <td className="px-4 py-4">
                          <div className="whitespace-nowrap">
                            <span
                              className={`font-semibold ${
                                bookedSlots > 0
                                  ? 'text-primary'
                                  : 'text-gray-800'
                              }`}
                            >
                              {bookedSlots}
                            </span>

                            <span className="ml-1 text-xs text-gray-400">
                              /{' '}
                              {
                                event.totalSlots
                              }{' '}
                              slots
                            </span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(
                              event.status,
                            )}`}
                          >
                            {event.status}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            {/* Edit */}
                            <Link
                              href={`/admin/eventmanagement/${event._id}/edit`}
                              title="Edit event"
                              aria-label={`Edit ${event.eventName}`}
                              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                            >
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
                                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                />
                              </svg>
                            </Link>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() =>
                                void handleDelete(
                                  event._id,
                                  event.eventName,
                                )
                              }
                              disabled={
                                deletingId ===
                                event._id
                              }
                              title="Delete event"
                              aria-label={`Delete ${event.eventName}`}
                              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {deletingId ===
                              event._id ? (
                                <svg
                                  className="h-4 w-4 animate-spin"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                >
                                  <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="9"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                  />

                                  <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M12 3a9 9 0 019 9h-3a6 6 0 00-6-6V3z"
                                  />
                                </svg>
                              ) : (
                                <svg
                                  className="h-4 w-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={
                                    2
                                  }
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  },
                )
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="divide-y divide-gray-100 md:hidden">
          {loading ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3].map(
                (item) => (
                  <div
                    key={item}
                    className="animate-pulse rounded-xl border border-gray-100 p-4"
                  >
                    <div className="mb-3 h-4 w-2/3 rounded bg-gray-200" />

                    <div className="mb-2 h-3 w-1/2 rounded bg-gray-100" />

                    <div className="h-3 w-3/4 rounded bg-gray-100" />
                  </div>
                ),
              )}
            </div>
          ) : filteredEvents.length ===
            0 ? (
            <div className="px-6 py-14 text-center">
              <p className="font-semibold text-gray-800">
                No events found
              </p>

              <p className="mt-1 text-sm text-gray-500">
                There are no events available
                in this view.
              </p>
            </div>
          ) : (
            filteredEvents.map(
              (event) => (
                <div
                  key={event._id}
                  className="p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold text-secondary">
                        {event.eventName}
                      </h2>

                      <p className="mt-1 text-xs capitalize text-gray-400">
                        {event.eventType}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${getStatusBadgeClass(
                        event.status,
                      )}`}
                    >
                      {event.status}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                        Date
                      </p>

                      <p className="mt-1 text-xs font-medium text-gray-700">
                        {formatDate(
                          event.startDate,
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                        Venue
                      </p>

                      <p className="mt-1 truncate text-xs font-medium text-gray-700">
                        {event.venue}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                        Booked
                      </p>

                      <p className="mt-1 text-xs font-medium text-gray-700">
                        {event.bookedSlots ||
                          0}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                        Total Slots
                      </p>

                      <p className="mt-1 text-xs font-medium text-gray-700">
                        {event.totalSlots}
                      </p>
                    </div>
                  </div>

                  {/* Mobile actions */}
                  <div className="mt-4 flex justify-end gap-2">
                    <Link
                      href={`/admin/eventmanagement/${event._id}/edit`}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                    >
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
                          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                        />
                      </svg>

                      Edit
                    </Link>

                    <button
                      type="button"
                      onClick={() =>
                        void handleDelete(
                          event._id,
                          event.eventName,
                        )
                      }
                      disabled={
                        deletingId ===
                        event._id
                      }
                      className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-red-100 px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deletingId ===
                      event._id ? (
                        <svg
                          className="h-4 w-4 animate-spin"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="9"
                            stroke="currentColor"
                            strokeWidth="3"
                          />

                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M12 3a9 9 0 019 9h-3a6 6 0 00-6-6V3z"
                          />
                        </svg>
                      ) : (
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
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      )}

                      {deletingId ===
                      event._id
                        ? 'Deleting...'
                        : 'Delete'}
                    </button>
                  </div>
                </div>
              ),
            )
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div className="border-t border-gray-100 bg-gray-50/40 px-4 py-4 sm:px-6">
            <p className="text-sm text-gray-500">
              Showing{' '}
              <strong className="font-semibold text-gray-900">
                {filteredEvents.length}
              </strong>{' '}
              of{' '}
              <strong className="font-semibold text-gray-900">
                {events.length}
              </strong>{' '}
              events
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatPill({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-500 shadow-sm">
      {label}:{' '}
      <strong className="ml-1 font-bold text-gray-900">
        {value}
      </strong>
    </div>
  );
}

function LoadingRows() {
  return (
    <>
      {[1, 2, 3, 4, 5].map(
        (item) => (
          <tr
            key={item}
            className="animate-pulse"
          >
            <td className="px-6 py-5">
              <div className="h-4 w-40 rounded bg-gray-200" />
            </td>

            <td className="px-4 py-5">
              <div className="h-6 w-20 rounded bg-gray-100" />
            </td>

            <td className="px-4 py-5">
              <div className="h-4 w-24 rounded bg-gray-100" />
            </td>

            <td className="px-4 py-5">
              <div className="h-4 w-28 rounded bg-gray-100" />
            </td>

            <td className="px-4 py-5">
              <div className="h-4 w-20 rounded bg-gray-100" />
            </td>

            <td className="px-4 py-5">
              <div className="h-6 w-20 rounded-full bg-gray-100" />
            </td>

            <td className="px-6 py-5">
              <div className="ml-auto flex justify-end gap-2">
                <div className="h-9 w-9 rounded-lg bg-gray-100" />
                <div className="h-9 w-9 rounded-lg bg-gray-100" />
              </div>
            </td>
          </tr>
        ),
      )}
    </>
  );
}