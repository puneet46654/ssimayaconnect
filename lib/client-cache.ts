'use client';

/**
 * In-memory cache for read-only API calls, shared by every page in this tab.
 *
 * Pages keep their own fetch() code; this layer answers repeat GETs instantly and lets
 * the warm-up prefetch data before a page asks for it. It never serves data across a
 * change: any write request and any realtime change clears it, and entries expire quickly.
 */

const TTL_MS = 30_000;

// Only safe, read-only endpoints whose data is refreshed through realtime changes.
const CACHEABLE = [
  /^\/api\/events$/,
  /^\/api\/events\/[^/]+$/,
  /^\/api\/events\/[^/]+\/slots$/,
  /^\/api\/location\/(countries|states)$/,
  /^\/api\/admin\/(dashboard|bookings|reports|activity|users)$/,
  /^\/api\/admin\/bookings\/[^/]+$/,
  /^\/api\/feedback$/,
];

type Entry = { time: number; status: number; headers: [string, string][]; body: string };

const entries = new Map<string, Entry>();
const inFlight = new Map<string, Promise<Entry | null>>();
let generation = 0;
let installed = false;

/** Cache key: same-origin path plus query, ignoring the cache-busting `refresh` parameter. */
function cacheKey(input: RequestInfo | URL, method: string) {
  if (method !== 'GET' || typeof window === 'undefined') return null;
  const raw = input instanceof Request ? input.url : String(input);
  const url = new URL(raw, window.location.origin);
  if (url.origin !== window.location.origin || !CACHEABLE.some(pattern => pattern.test(url.pathname))) return null;
  url.searchParams.delete('refresh');
  url.searchParams.sort();
  return url.pathname + url.search;
}

function toResponse(entry: Entry) {
  return new Response(entry.body, { status: entry.status, headers: entry.headers });
}

export function clearFetchCache() {
  generation++;
  entries.clear();
  inFlight.clear();
}

export function installFetchCache() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const original = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const key = cacheKey(input, method);

    if (!key) {
      const response = await original(input, init);
      // Any write may change what the cached reads would return.
      if (method !== 'GET' && method !== 'HEAD') clearFetchCache();
      return response;
    }

    const cached = entries.get(key);
    if (cached && Date.now() - cached.time < TTL_MS) return toResponse(cached);

    let pending = inFlight.get(key);
    if (!pending) {
      const startedAt = generation;
      // The shared request must not be cancelled by whichever caller started it.
      const { signal: _signal, ...shared } = init || {};
      void _signal;
      pending = original(input instanceof Request ? input.url : input, shared)
        .then(async response => {
          if (!response.ok) return null;
          const entry: Entry = { time: Date.now(), status: response.status, headers: [...response.headers], body: await response.text() };
          if (startedAt === generation) entries.set(key, entry);
          return entry;
        })
        .catch(() => null)
        .finally(() => { if (inFlight.get(key) === pending) inFlight.delete(key); });
      inFlight.set(key, pending);
    }

    const signal = init?.signal || (input instanceof Request ? input.signal : undefined);
    const entry = await (signal ? Promise.race([pending, abortPromise(signal)]) : pending);
    // Errors and unexpected failures go straight to the network so pages keep their own handling.
    return entry ? toResponse(entry) : original(input, init);
  };
}

function abortPromise(signal: AbortSignal) {
  return new Promise<never>((_, reject) => {
    const fail = () => reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    if (signal.aborted) fail();
    else signal.addEventListener('abort', fail, { once: true });
  });
}

/** Loads a cacheable GET in the background; failures are ignored. */
export async function warmFetch(url: string) {
  try {
    const response = await fetch(url, { credentials: 'include' });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}
