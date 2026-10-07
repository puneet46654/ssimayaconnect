'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { installFetchCache, warmFetch } from '@/lib/client-cache';
import { deviceTimeZone } from '@/lib/events/dates';

// Install before any page effect runs, so the first page request is shared with the warm-up.
installFetchCache();

const ADMIN_PAGES = ['/admin/landing', '/admin/bookings', '/admin/eventmanagement', '/admin/reports', '/admin/analytics', '/admin/check-in', '/admin/auth'];
const USER_PAGES = ['/events', '/events/mytickets'];
const MAX_EVENTS = 8;

function whenIdle(task: () => void) {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(task, { timeout: 2000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(task, 300);
  return () => clearTimeout(id);
}

/** After the first page is usable, quietly loads the other pages and their data in the background. */
export function Warmup() {
  const router = useRouter();
  const pathname = usePathname();
  const area = pathname.startsWith('/admin') ? (pathname.startsWith('/admin/login') ? 'login' : 'admin') : 'user';

  useEffect(() => {
    if (area === 'login') return;
    let cancelled = false;

    const cancelIdle = whenIdle(async () => {
      if (area === 'admin') {
        ADMIN_PAGES.forEach(page => router.prefetch(page));
        const [, , list] = await Promise.all([
          warmFetch('/api/admin/dashboard'),
          warmFetch('/api/events'),
          warmFetch('/api/admin/bookings?page=1&limit=10'),
          warmFetch(`/api/admin/reports?timeZone=${encodeURIComponent(deviceTimeZone())}`),
        ]);
        // The first page of Booking Records is what admins usually open next.
        const rows = Array.isArray(list?.bookings) ? (list.bookings as { _id?: string }[]) : [];
        for (const row of rows) {
          if (cancelled || !row._id) return;
          const id = encodeURIComponent(row._id);
          router.prefetch(`/admin/bookings/${id}`);
          await warmFetch(`/api/admin/bookings/${id}`);
        }
        return;
      }

      USER_PAGES.forEach(page => router.prefetch(page));
      const data = await warmFetch('/api/events');
      if (cancelled || !Array.isArray(data?.events)) return;
      void warmFetch('/api/location/countries');
      const events = (data.events as { _id?: string; status?: string }[])
        .filter(event => event._id && event.status !== 'CANCELLED' && event.status !== 'COMPLETED')
        .slice(0, MAX_EVENTS);
      for (const event of events) {
        if (cancelled) return;
        const id = encodeURIComponent(String(event._id));
        router.prefetch(`/events/${id}`);
        router.prefetch(`/events/${id}/book`);
        router.prefetch(`/events/${id}/book/slots`);
        await Promise.all([warmFetch(`/api/events/${id}`), warmFetch(`/api/events/${id}/slots`)]);
      }
    });

    return () => { cancelled = true; cancelIdle(); };
  }, [area, router]);

  return null;
}
