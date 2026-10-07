/** Shared helpers for first-party analytics (collection and reporting). */

const OBJECT_ID = /[a-f0-9]{24}/gi;

/** Groups paths by shape: /events/6abc…/book -> /events/:id/book. Query strings are dropped. */
export function normalizePath(path: string) {
  return (path.split('?')[0] || '/').replace(OBJECT_ID, ':id').slice(0, 200) || '/';
}

/** The event a public page or API call belongs to, if any. */
export function eventIdFromPath(path: string) {
  return /\/events\/([a-f0-9]{24})(?:\/|$|\?)/i.exec(path)?.[1];
}

export function isBot(userAgent: string) {
  return /bot|crawl|spider|slurp|preview|headless|lighthouse|pingdom|uptime|monitor/i.test(userAgent);
}

export function describeAgent(userAgent: string) {
  const ua = userAgent || '';
  const device = /ipad|tablet/i.test(ua) ? 'Tablet' : /mobi|android|iphone/i.test(ua) ? 'Mobile' : 'Desktop';
  const browser = /edg\//i.test(ua) ? 'Edge'
    : /opr\/|opera/i.test(ua) ? 'Opera'
    : /samsungbrowser/i.test(ua) ? 'Samsung Internet'
    : /chrome|crios/i.test(ua) ? 'Chrome'
    : /firefox|fxios/i.test(ua) ? 'Firefox'
    : /safari/i.test(ua) ? 'Safari' : 'Other';
  const os = /windows/i.test(ua) ? 'Windows'
    : /android/i.test(ua) ? 'Android'
    : /iphone|ipad|ios/i.test(ua) ? 'iOS'
    : /mac os/i.test(ua) ? 'macOS'
    : /linux/i.test(ua) ? 'Linux' : 'Other';
  return { device, browser, os };
}

/** Host of an external referrer; visits from within the site are not referrals. */
export function referrerHost(referrer: unknown, ownHost: string) {
  if (typeof referrer !== 'string' || !referrer) return undefined;
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '');
    return host && host !== ownHost.replace(/^www\./, '') ? host : undefined;
  } catch { return undefined; }
}
