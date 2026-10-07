import { bookingStorage } from './booking-contracts';

type PendingCache = { draftId: string; details: Record<string, string>; expiresAt?: string; savedAt: number };
// Used only until the server reports the real event end time.
const FALLBACK_MS = 30 * 86_400_000;

export function readPendingBooking(eventId: string): PendingCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = JSON.parse(localStorage.getItem(bookingStorage.pending(eventId)) || 'null') as PendingCache | null;
    if (!cached || typeof cached.details !== 'object' || typeof cached.draftId !== 'string') return null;
    const expiry = cached.expiresAt ? new Date(cached.expiresAt).getTime() : cached.savedAt + FALLBACK_MS;
    if (!(expiry > Date.now())) { clearPendingBooking(eventId); return null; }
    return cached;
  } catch { return null; }
}

export function clearPendingBooking(eventId: string) {
  try { localStorage.removeItem(bookingStorage.pending(eventId)); } catch { /* Browser storage is optional. */ }
}

function writeCache(eventId: string, cache: PendingCache) {
  try { localStorage.setItem(bookingStorage.pending(eventId), JSON.stringify(cache)); } catch { /* Browser storage is optional. */ }
}

/** Keeps the details on this device and records them for admins as a pending booking. */
export function savePendingBooking(eventId: string, details: Record<string, string>) {
  const draftId = readPendingBooking(eventId)?.draftId || crypto.randomUUID();
  const cache: PendingCache = { draftId, details, savedAt: Date.now() };
  writeCache(eventId, cache);
  // keepalive lets the request finish while the browser moves on to the slots page.
  void fetch('/api/bookings/pending', {
    method: 'POST', keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId, draftId, details }),
  }).then(response => response.json()).then((data: { ended?: boolean; expiresAt?: string }) => {
    if (data.ended) clearPendingBooking(eventId);
    else if (data.expiresAt) writeCache(eventId, { ...cache, expiresAt: data.expiresAt });
  }).catch(() => { /* The local copy still restores the form; the slots step does not depend on this. */ });
}
