'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

type QueuedEvent = { kind: 'pageview' | 'api'; ts: number; path: string; referrer?: string; method?: string; status?: number; ms?: number };

const ENDPOINT = '/api/analytics/collect';
const FLUSH_MS = 15000;
// Requests that are themselves telemetry or polling would only add noise.
const IGNORED_API = /^\/api\/(analytics|realtime|admin)\b/;

const queue: QueuedEvent[] = [];
let installed = false;
let firstView = true;

function storedId(storage: () => Storage, key: string) {
  try {
    const store = storage();
    let id = store.getItem(key);
    if (!id) { id = crypto.randomUUID(); store.setItem(key, id); }
    return id;
  } catch { return crypto.randomUUID(); }
}

function flush(useBeacon = false) {
  if (!queue.length) return;
  const payload = JSON.stringify({
    visitorId: storedId(() => localStorage, 'ssi-analytics-visitor'),
    sessionId: storedId(() => sessionStorage, 'ssi-analytics-session'),
    events: queue.splice(0, 50),
  });
  if (useBeacon && navigator.sendBeacon?.(ENDPOINT, new Blob([payload], { type: 'application/json' }))) return;
  void fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {});
}

/** Times every same-origin API call the page makes (including cache hits, as the visitor experiences them). */
function installApiTiming() {
  if (installed) return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = input instanceof Request ? input.url : String(input);
    let path = '';
    try { const url = new URL(raw, location.origin); if (url.origin === location.origin) path = url.pathname; } catch { /* Not a URL we track. */ }
    if (!path.startsWith('/api/') || IGNORED_API.test(path)) return original(input, init);
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const started = performance.now();
    try {
      const response = await original(input, init);
      queue.push({ kind: 'api', ts: Date.now(), path, method, status: response.status, ms: performance.now() - started });
      return response;
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        queue.push({ kind: 'api', ts: Date.now(), path, method, status: 0, ms: performance.now() - started });
      }
      throw error;
    }
  };
}

/** First-party page view and API timing collection for the attendee site. Admin pages are not tracked. */
export function Analytics() {
  const pathname = usePathname();

  useEffect(() => {
    installApiTiming();
    const timer = window.setInterval(() => flush(), FLUSH_MS);
    const onHide = () => { if (document.visibilityState === 'hidden') flush(true); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, []);

  useEffect(() => {
    if (!pathname || pathname.startsWith('/admin')) return;
    // The browser's referrer only describes how the visit started, not in-app navigation.
    queue.push({ kind: 'pageview', ts: Date.now(), path: pathname, referrer: firstView ? document.referrer : undefined });
    firstView = false;
    if (queue.length >= 40) flush();
  }, [pathname]);

  return null;
}
