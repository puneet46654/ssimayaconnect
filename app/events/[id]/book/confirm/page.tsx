'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { confirmBooking } from '@/lib/bookings/confirm-booking';

/**
 * Tickets now live only in My Tickets. This route remains for old links and for
 * browsers still running the previous slot page, which came here to create the booking.
 */
export default function BookingConfirmRedirect() {
  const { id: eventId } = useParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const reference = new URLSearchParams(window.location.search).get('bookingId');
      let target = reference ? `/events/mytickets?booked=${encodeURIComponent(reference)}` : '/events/mytickets';
      try {
        const slot = JSON.parse(sessionStorage.getItem(`ssi-booking-slot:${eventId}:latest`) || 'null') as
          { dayScheduleId?: string; slotId?: string } | null;
        if (!reference && slot?.dayScheduleId && slot.slotId) {
          sessionStorage.removeItem(`ssi-booking-slot:${eventId}:latest`);
          const booking = await confirmBooking(eventId, { dayScheduleId: slot.dayScheduleId, slotId: slot.slotId });
          target = `/events/mytickets?booked=${encodeURIComponent(booking.bookingId)}`;
        }
      } catch {
        // The slot may have filled up; let the attendee pick again.
        target = `/events/${encodeURIComponent(eventId)}/book/slots`;
      }
      if (!cancelled) router.replace(target);
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [eventId, router]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#F7F9FA] px-4">
      <p role="status" className="text-[14px] font-medium text-gray-500">Opening your ticket...</p>
    </main>
  );
}
