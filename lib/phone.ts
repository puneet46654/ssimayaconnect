/** Keep every digit, including international dialing codes. Never match suffixes. */
export function normalizePhone(value: unknown): string {
  if (typeof value !== 'string' || !/^\+?[\d\s()-]+$/.test(value.trim())) return '';
  return value.replace(/\D/g, '');
}

export function phoneIdentity(mobile: unknown, callingCode: unknown = ''): string {
  const number = normalizePhone(mobile);
  if (!number) return '';
  if (typeof mobile === 'string' && mobile.trim().startsWith('+')) return number;
  const prefix = callingCode ? normalizePhone(callingCode) : '';
  if (callingCode && !prefix) return '';
  return prefix + number;
}

/** The number without its country code, e.g. "9876543210" for +91 9876543210. */
export function nationalNumber(mobile: unknown, callingCode: unknown = ''): string {
  const number = normalizePhone(mobile);
  if (!number || typeof mobile !== 'string' || !mobile.trim().startsWith('+')) return number;
  const prefix = normalizePhone(callingCode);
  return prefix && number.startsWith(prefix) ? number.slice(prefix.length) : '';
}

export function isValidPhone(mobile: unknown, callingCode: unknown = ''): boolean {
  return /^[1-9]\d{6,14}$/.test(phoneIdentity(mobile, callingCode));
}

export function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function isValidEmail(value: unknown): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(value));
}
