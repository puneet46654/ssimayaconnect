'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearPendingBooking, listPendingBookings, resumePendingBooking } from '@/lib/pending-booking';

type Pending = { eventId: string; details: Record<string, string> };

/** Lets attendees who left before choosing a slot carry on from the slot step. */
export default function PendingRegistrations() {
  const router = useRouter();
  const [pending, setPending] = useState<Pending[]>([]);

  useEffect(() => {
    // Browser storage is only readable after hydration.
    const timer = window.setTimeout(() => setPending(listPendingBookings()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  function resume(eventId: string) {
    const target = resumePendingBooking(eventId) ? 'book/slots' : 'book';
    router.push(`/events/${encodeURIComponent(eventId)}/${target}`);
  }

  function dismiss(eventId: string) {
    clearPendingBooking(eventId);
    setPending(current => current.filter(item => item.eventId !== eventId));
  }

  if (!pending.length) return null;
  return (
    <div className="mb-5 space-y-2">
      {pending.map(({ eventId, details }) => (
        <div key={eventId}
          className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-secondary">Your registration is not complete</p>
            <p className="mt-0.5 truncate text-[12px] text-gray-600">
              {details.eventName ? `${details.eventName} · ` : ''}Choose a time slot to get your ticket.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => dismiss(eventId)}
              className="cursor-pointer px-2 text-[12px] font-medium text-gray-500 hover:text-gray-700">
              Dismiss
            </button>
            <button type="button" onClick={() => resume(eventId)} className="btn btn-primary h-9 px-4 text-[13px]">
              Continue registration
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
