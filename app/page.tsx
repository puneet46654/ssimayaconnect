'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';

interface IEvent {
  _id: string;
  eventName: string;
  eventType: 'conference' | 'mantram' | 'event';
  venue: string;
  startDate: string;
  endDate: string;
  description?: string;
  imageUrl?: string;
  totalSlots: number;
  bookedSlots: number;
  status: 'LIVE' | 'COMPLETED' | 'UPCOMING';
}

export default function HomePage() {
  const [events, setEvents] = useState<IEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function fetchEvents() {
      setLoading(true);

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
      } catch (error) {
        console.error('Failed to fetch events:', error);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    }

    void fetchEvents();
  }, []);

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return events;
    }

    return events.filter((event) =>
      [
        event.eventName,
        event.eventType,
        event.venue,
        event.description || '',
      ].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [events, search]);

  const liveEvents = useMemo(
    () =>
      filteredEvents.filter(
        (event) => event.status === 'LIVE',
      ),
    [filteredEvents],
  );

  const upcomingConferences = useMemo(
    () =>
      filteredEvents.filter(
        (event) =>
          event.status === 'UPCOMING' &&
          event.eventType === 'conference',
      ),
    [filteredEvents],
  );

  const upcomingMantram = useMemo(
    () =>
      filteredEvents.filter(
        (event) =>
          event.status === 'UPCOMING' &&
          event.eventType === 'mantram',
      ),
    [filteredEvents],
  );

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-[60px] w-full max-w-[1500px] items-center justify-between gap-6 px-6 lg:px-10">
          {/* Brand */}
          <Link
            href="/"
            className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full border border-primary/20 bg-white px-4 py-2 shadow-sm transition hover:border-primary/40 hover:text-secondary"
          >
            <Image
              src="/logos/ssilogo.png"
              alt="SSI"
              width={22}
              height={22}
              priority
              className="h-[22px] w-[22px] object-contain"
            />

            <span className="text-sm font-semibold text-secondary">
              SSI Maya Connect
            </span>
          </Link>

          {/* Search */}
          <div className="relative hidden w-full max-w-[430px] md:block">
            <svg
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <circle cx="11" cy="11" r="7" />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m20 20-3.5-3.5"
              />
            </svg>

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search conferences, manthan, speakers..."
              className="h-9 w-full rounded-full border border-gray-200 bg-gray-50 pl-11 pr-11 text-xs text-secondary outline-none transition placeholder:text-gray-500 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
            />

            <svg
              className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.7}
            >
              <path d="M4 7h10M18 7h2M4 17h4M12 17h8M4 12h2M10 12h10" />
              <circle cx="16" cy="7" r="2" />
              <circle cx="10" cy="17" r="2" />
              <circle cx="8" cy="12" r="2" />
            </svg>
          </div>

          {/* My Tickets */}
          <Link
            href="/tickets"
            className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full border border-primary/20 bg-white px-5 py-2 text-xs font-semibold text-primary transition hover:border-primary/40 hover:bg-primary/5"
          >
            My Tickets
          </Link>
        </div>

        {/* Mobile Search */}
        <div className="border-t border-gray-100 px-4 py-3 md:hidden">
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <circle cx="11" cy="11" r="7" />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m20 20-3.5-3.5"
              />
            </svg>

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search conferences, manthan, speakers..."
              className="h-10 w-full rounded-full border border-gray-200 bg-gray-50 pl-11 pr-4 text-xs text-secondary outline-none transition focus:border-primary focus:bg-white"
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-[1500px] px-6 py-8 lg:px-10">
        {/* Hero */}
        <section className="mb-7">
          <h1 className="font-heading text-3xl font-bold text-secondary">
            Hello!
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Welcome to your central medical networking hub.
            Discover live conferences and share expert research inside
            discussions.
          </p>
        </section>

        {loading ? (
          <LoadingState />
        ) : (
          <div className="space-y-10">
            {/* Live */}
            {liveEvents.length > 0 && (
              <section>
                <div className="mb-4 flex items-center gap-2">
                  <h2 className="font-heading text-xl font-semibold text-secondary">
                    Live Now
                  </h2>

                  <span className="h-2 w-2 rounded-full bg-success shadow-[0_0_0_3px_rgba(16,185,129,0.12)]" />
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  {liveEvents.map((event) => (
                    <LiveEventCard
                      key={event._id}
                      event={event}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Upcoming Conferences */}
            {upcomingConferences.length > 0 && (
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-heading text-xl font-semibold text-secondary">
                    Upcoming Conferences
                  </h2>

                  <span className="text-xs font-semibold text-primary">
                    See All
                  </span>
                </div>

                <div className="grid gap-5 xl:grid-cols-3">
                  {upcomingConferences.map((event) => (
                    <UpcomingEventCard
                      key={event._id}
                      event={event}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Upcoming Mantram */}
            {upcomingMantram.length > 0 && (
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-heading text-xl font-semibold text-secondary">
                    Upcoming MantraM Sessions
                  </h2>

                  <span className="text-xs font-semibold text-primary">
                    See All
                  </span>
                </div>

                <div className="grid gap-5 xl:grid-cols-3">
                  {upcomingMantram.map((event) => (
                    <UpcomingEventCard
                      key={event._id}
                      event={event}
                    />
                  ))}
                </div>
              </section>
            )}

            {filteredEvents.length === 0 && (
              <div className="rounded-xl border border-gray-200 bg-white px-6 py-14 text-center">
                <p className="text-sm font-medium text-gray-500">
                  No events found.
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function LiveEventCard({
  event,
}: {
  event: IEvent;
}) {
  return (
    <article className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="relative aspect-[16/4.7] overflow-hidden bg-gray-100">
        {event.imageUrl ? (
          <img
            src={event.imageUrl}
            alt={event.eventName}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gray-100" />
        )}

        <span className="absolute left-3 top-3 rounded bg-red-500 px-2 py-1 text-[10px] font-bold text-white">
          LIVE
        </span>
      </div>

      <div className="p-5">
        <h3 className="text-base font-semibold text-secondary">
          {event.eventName}
        </h3>

        <div className="mt-3 space-y-1.5">
          <MetaRow
            type="location"
            value={event.venue}
          />

          <MetaRow
            type="date"
            value={formatDateRange(
              event.startDate,
              event.endDate,
            )}
          />
        </div>

        <Link
          href={`/events/${event._id}`}
          className="mt-4 inline-flex cursor-pointer rounded-md bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary-dark hover:text-white"
        >
          Book Slot
        </Link>
      </div>
    </article>
  );
}

function UpcomingEventCard({
  event,
}: {
  event: IEvent;
}) {
  return (
    <Link
      href={`/events/${event._id}`}
      className="flex min-h-[110px] cursor-pointer items-center gap-4 rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition hover:border-primary/30 hover:text-inherit"
    >
      <div className="h-[82px] w-[82px] shrink-0 overflow-hidden rounded-lg bg-gray-100">
        {event.imageUrl ? (
          <img
            src={event.imageUrl}
            alt={event.eventName}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gray-100" />
        )}
      </div>

      <div className="min-w-0">
        <h3 className="truncate text-sm font-semibold text-secondary">
          {event.eventName}
        </h3>

        <p className="mt-2 truncate text-[11px] text-gray-500">
          {formatDate(event.startDate)}
          {event.venue
            ? ` • ${event.venue}`
            : ''}
        </p>
      </div>
    </Link>
  );
}

function MetaRow({
  type,
  value,
}: {
  type: 'location' | 'date';
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-gray-500">
      {type === 'location' ? (
        <svg
          className="h-4 w-4 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11z"
          />
          <circle cx="12" cy="10" r="2" />
        </svg>
      ) : (
        <svg
          className="h-4 w-4 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1z" />
        </svg>
      )}

      <span className="truncate text-xs">
        {value}
      </span>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-10">
      <section>
        <div className="mb-4 h-6 w-32 animate-pulse rounded bg-gray-100" />

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="h-[315px] animate-pulse rounded-xl bg-gray-100" />
          <div className="h-[315px] animate-pulse rounded-xl bg-gray-100" />
        </div>
      </section>

      <section>
        <div className="mb-4 h-6 w-52 animate-pulse rounded bg-gray-100" />

        <div className="grid gap-5 xl:grid-cols-3">
          <div className="h-[110px] animate-pulse rounded-xl bg-gray-100" />
          <div className="h-[110px] animate-pulse rounded-xl bg-gray-100" />
          <div className="h-[110px] animate-pulse rounded-xl bg-gray-100" />
        </div>
      </section>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

function formatDateRange(
  startValue: string,
  endValue: string,
) {
  const start = new Date(startValue);
  const end = new Date(endValue);

  if (
    start.toDateString() ===
    end.toDateString()
  ) {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(start);
  }

  const startLabel = new Intl.DateTimeFormat(
    'en-GB',
    {
      day: '2-digit',
      month: 'short',
    },
  ).format(start);

  const endLabel = new Intl.DateTimeFormat(
    'en-GB',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    },
  ).format(end);

  return `${startLabel} - ${endLabel}`;
}
